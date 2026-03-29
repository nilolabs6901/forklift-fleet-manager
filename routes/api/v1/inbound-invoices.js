/**
 * Inbound Invoice API Routes
 * Handles incoming invoices from email/webhooks and invoice review queue
 * Now supports Claude Vision API for intelligent invoice parsing
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const inboundInvoiceService = require('../../../services/inboundInvoiceService');
const claudeVisionService = require('../../../services/claudeVisionInvoiceService');
const db = require('../../../config/sqlite-database');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads/inbound-invoices');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `invoice_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.tiff', '.bmp'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, PNG, JPG, JPEG, GIF, TIFF, BMP'));
        }
    }
});

// =================== SHARED HELPERS ===================

/**
 * Resolve tenant and check trial status for inbound webhooks.
 * Returns { tenant, emailData } or sends error response.
 */
function resolveWebhookTenant(emailData, explicitTenantId) {
    let tenant = null;

    if (explicitTenantId) {
        tenant = db.tenants.findById(parseInt(explicitTenantId));
    } else {
        tenant = db.tenants.resolveFromEmail(emailData.to, emailData.from);
    }

    if (tenant) {
        // Check trial/subscription status
        const trialCheck = db.tenants.checkTrialStatus(tenant);
        if (!trialCheck.allowed) {
            return { tenant: null, blocked: true, blockReason: trialCheck.message, status: trialCheck.status };
        }
        if (trialCheck.readOnly) {
            // Grace period — still accept invoices (data preservation) but flag them
            emailData.grace_period = true;
        }
        emailData.tenant_id = tenant.id;
    }
    // If no tenant found, invoice still gets processed — lands in "unmatched" queue

    return { tenant, blocked: false, emailData };
}

// =================== WEBHOOK ENDPOINT FOR EMAIL SERVICES ===================

/**
 * POST /api/v1/inbound-invoices/webhook
 * Webhook endpoint for email services (Mailgun, SendGrid, Power Automate)
 * Accepts multipart form data with email metadata and attachments
 *
 * Always returns 200 for valid requests so email services don't retry needlessly.
 * Returns 400 for missing data, 500 only for true server errors (triggers retry).
 */
router.post('/webhook', upload.single('attachment'), async (req, res) => {
    try {
        const emailData = {
            from: req.body.from || req.body.sender || req.body.From,
            to: req.body.to || req.body.recipient || req.body.To,
            subject: req.body.subject || req.body.Subject,
            date: req.body.date || req.body.Date || new Date().toISOString(),
            body: req.body.body || req.body['body-plain'] || req.body.Body
        };

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No attachment provided'
            });
        }

        // Resolve tenant and check status
        const resolution = resolveWebhookTenant(emailData);
        if (resolution.blocked) {
            // Accept the webhook (200) so the email service doesn't keep retrying,
            // but log it and don't process
            console.warn(`[Webhook] Blocked invoice from ${emailData.from}: ${resolution.blockReason}`);
            return res.json({
                success: false,
                warning: resolution.blockReason,
                status: resolution.status
            });
        }

        // Read the uploaded file
        const attachmentData = fs.readFileSync(req.file.path);

        const result = await inboundInvoiceService.processInboundInvoice(
            resolution.emailData || emailData,
            attachmentData,
            req.file.originalname
        );

        // Flag if no tenant was matched
        if (!resolution.tenant) {
            result.warning = 'No tenant matched for this email. Invoice saved to unmatched queue.';
            result.unmatched = true;
            console.warn(`[Webhook] Unmatched invoice: from=${emailData.from}, to=${emailData.to}, subject=${emailData.subject}`);
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Inbound Invoice Webhook Error]', error);
        // Return 500 so email services (Mailgun, SendGrid) will retry
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/inbound-invoices/webhook/json
 * JSON-based webhook for services that send base64-encoded attachments
 *
 * Always returns 200 for valid requests so automation tools don't retry needlessly.
 * Returns 400 for missing data, 500 only for true server errors (triggers retry).
 */
router.post('/webhook/json', async (req, res) => {
    try {
        const { email, attachment, attachmentName, tenant_id } = req.body;

        if (!attachment) {
            return res.status(400).json({
                success: false,
                error: 'No attachment provided'
            });
        }

        const emailData = {
            from: email?.from || email?.sender,
            to: email?.to || email?.recipient,
            subject: email?.subject,
            date: email?.date || new Date().toISOString()
        };

        // Resolve tenant and check status
        const resolution = resolveWebhookTenant(emailData, tenant_id);
        if (resolution.blocked) {
            console.warn(`[Webhook/JSON] Blocked invoice from ${emailData.from}: ${resolution.blockReason}`);
            return res.json({
                success: false,
                warning: resolution.blockReason,
                status: resolution.status
            });
        }

        // attachment should be base64 encoded
        const result = await inboundInvoiceService.processInboundInvoice(
            resolution.emailData || emailData,
            attachment,
            attachmentName || 'invoice.pdf'
        );

        if (!resolution.tenant) {
            result.warning = 'No tenant matched for this email. Invoice saved to unmatched queue.';
            result.unmatched = true;
            console.warn(`[Webhook/JSON] Unmatched invoice: from=${emailData.from}, to=${emailData.to}`);
        }

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Inbound Invoice JSON Webhook Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =================== MANUAL UPLOAD ===================

/**
 * POST /api/v1/inbound-invoices/upload
 * Manual invoice upload through the UI
 */
router.post('/upload', upload.single('invoice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const emailData = {
            from: req.body.vendor || 'Manual Upload',
            subject: req.body.description || 'Manually Uploaded Invoice',
            date: new Date().toISOString()
        };

        const attachmentData = fs.readFileSync(req.file.path);

        const result = await inboundInvoiceService.processInboundInvoice(
            emailData,
            attachmentData,
            req.file.originalname
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Inbound Invoice Upload Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =================== UNMATCHED INVOICE QUEUE ===================

/**
 * GET /api/v1/inbound-invoices/unmatched
 * Get invoices that could not be matched to any tenant
 */
router.get('/unmatched', (req, res) => {
    try {
        const invoices = db.raw.prepare(`
            SELECT i.*, f.id as matched_unit_id, f.model as matched_model
            FROM inbound_invoices i
            LEFT JOIN forklifts f ON i.matched_forklift_id = f.id
            WHERE i.tenant_id IS NULL
            ORDER BY i.created_at DESC
            LIMIT ?
        `).all(req.query.limit ? parseInt(req.query.limit) : 50);

        res.json({
            success: true,
            data: invoices.map(inv => ({
                ...inv,
                extracted_data: inv.extracted_data ? JSON.parse(inv.extracted_data) : null
            })),
            count: invoices.length,
            message: invoices.length > 0
                ? `${invoices.length} invoices need tenant assignment`
                : 'No unmatched invoices'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/v1/inbound-invoices/:id/assign-tenant
 * Manually assign an unmatched invoice to a tenant
 */
router.put('/:id/assign-tenant', (req, res) => {
    try {
        const { tenant_id } = req.body;
        if (!tenant_id) {
            return res.status(400).json({ success: false, error: 'tenant_id is required' });
        }

        const tenant = db.tenants.findById(tenant_id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const invoice = db.raw.prepare('SELECT * FROM inbound_invoices WHERE id = ?').get(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }

        db.raw.prepare('UPDATE inbound_invoices SET tenant_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
            .run(tenant_id, req.params.id);

        res.json({
            success: true,
            message: `Invoice ${req.params.id} assigned to ${tenant.company_name}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== INVOICE QUEUE MANAGEMENT ===================

/**
 * GET /api/v1/inbound-invoices
 * Get list of inbound invoices with optional filters
 */
router.get('/', (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            fromDate: req.query.fromDate,
            limit: req.query.limit ? parseInt(req.query.limit) : 50
        };

        const invoices = inboundInvoiceService.getInboundInvoices(filters);

        res.json({
            success: true,
            data: invoices.map(inv => ({
                ...inv,
                extracted_data: inv.extracted_data ? JSON.parse(inv.extracted_data) : null
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/stats
 * Get processing statistics
 */
router.get('/stats', (req, res) => {
    try {
        const stats = inboundInvoiceService.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/pending
 * Get invoices pending review
 */
router.get('/pending', (req, res) => {
    try {
        const invoices = inboundInvoiceService.getInboundInvoices({
            status: 'ready_for_review'
        });

        res.json({
            success: true,
            data: invoices.map(inv => ({
                ...inv,
                extracted_data: inv.extracted_data ? JSON.parse(inv.extracted_data) : null
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/:id
 * Get a specific inbound invoice
 */
router.get('/:id', (req, res) => {
    try {
        const invoice = inboundInvoiceService.getInboundInvoice(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        res.json({
            success: true,
            data: {
                ...invoice,
                extracted_data: invoice.extracted_data ? JSON.parse(invoice.extracted_data) : null
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/inbound-invoices/:id/approve
 * Approve an invoice and create maintenance record
 */
router.post('/:id/approve', (req, res) => {
    try {
        const { forkliftId, adjustments } = req.body;

        if (!forkliftId) {
            return res.status(400).json({
                success: false,
                error: 'forkliftId is required'
            });
        }

        const maintenanceRecord = inboundInvoiceService.approveInboundInvoice(
            req.params.id,
            forkliftId,
            adjustments || {}
        );

        res.json({
            success: true,
            data: maintenanceRecord
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/inbound-invoices/:id/reject
 * Reject an invoice
 */
router.post('/:id/reject', (req, res) => {
    try {
        const { reason } = req.body;

        inboundInvoiceService.rejectInboundInvoice(req.params.id, reason);

        res.json({
            success: true,
            message: 'Invoice rejected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =================== TESTING ENDPOINTS ===================

/**
 * POST /api/v1/inbound-invoices/test/parse
 * Test invoice parsing with raw text (for development/testing)
 */
router.post('/test/parse', (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({
                success: false,
                error: 'text is required'
            });
        }

        const result = inboundInvoiceService.processFromText(text);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/inbound-invoices/test/ocr
 * Test OCR on an uploaded image
 */
router.post('/test/ocr', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image uploaded'
            });
        }

        const ocrText = await inboundInvoiceService.performOCR(req.file.path);
        const extractedData = inboundInvoiceService.extractInvoiceData(ocrText);
        const matchedForklift = inboundInvoiceService.matchForklift(extractedData);

        res.json({
            success: true,
            data: {
                ocrText,
                extractedData,
                matchedForklift
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =================== CLAUDE VISION ENDPOINTS ===================

/**
 * POST /api/v1/inbound-invoices/vision/upload
 * Upload and process invoice using Claude Vision API
 */
router.post('/vision/upload', upload.single('invoice'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        const emailData = {
            from: req.body.vendor || 'Manual Upload (Vision)',
            subject: req.body.description || 'Invoice processed with Claude Vision',
            date: new Date().toISOString()
        };

        const attachmentData = fs.readFileSync(req.file.path);

        const result = await claudeVisionService.processInboundInvoice(
            emailData,
            attachmentData,
            req.file.originalname
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Claude Vision Upload Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =================== DEMO & SIMULATION ENDPOINTS ===================

/**
 * POST /api/v1/inbound-invoices/demo/simulate
 * Simulate receiving an invoice via email (for demo purposes)
 */
router.post('/demo/simulate', async (req, res) => {
    try {
        const { type } = req.body;
        const result = await claudeVisionService.simulateEmailInvoice(type || 'random');

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Demo Simulation Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/poll
 * Long-polling endpoint for real-time updates
 */
router.get('/poll', (req, res) => {
    try {
        const lastId = parseInt(req.query.lastId) || 0;
        const newInvoices = claudeVisionService.getInvoicesSince(lastId);
        const stats = claudeVisionService.getStats();
        const latestId = claudeVisionService.getLatestInvoiceId();

        res.json({
            success: true,
            data: {
                newInvoices: newInvoices.map(inv => ({
                    ...inv,
                    extracted_data: inv.extracted_data ? JSON.parse(inv.extracted_data) : null
                })),
                stats,
                latestId
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/latest-id
 * Get the latest invoice ID for initializing polling
 */
router.get('/latest-id', (req, res) => {
    try {
        const latestId = claudeVisionService.getLatestInvoiceId();
        res.json({
            success: true,
            data: { latestId }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/v1/inbound-invoices/generate-pdf/:maintenanceId
 * Generate a PDF invoice for a maintenance record on-demand
 */
router.get('/generate-pdf/:maintenanceId', (req, res) => {
    try {
        const invoicePdfService = require('../../../services/invoicePdfService');
        const db = require('../../../config/sqlite-database');

        const maintenanceId = parseInt(req.params.maintenanceId);
        const record = db.maintenance.findById(maintenanceId);

        if (!record) {
            return res.status(404).json({
                success: false,
                error: 'Maintenance record not found'
            });
        }

        // Build invoice data from maintenance record
        const invoiceData = {
            vendor: record.service_provider || 'Service Provider',
            invoiceNumber: record.invoice_number || `MR-${record.id}`,
            invoiceDate: record.service_date || new Date().toISOString().split('T')[0],
            poNumber: record.work_order_number || null,
            location: record.location_name || 'Fleet Location',
            unitReference: record.forklift_id,
            make: null,
            model: record.forklift_model || null,
            serialNumber: null,
            description: record.description || record.work_performed || 'Maintenance Service',
            lineItems: [],
            laborCost: record.labor_cost || 0,
            partsCost: record.parts_cost || 0,
            subtotal: (record.labor_cost || 0) + (record.parts_cost || 0),
            tax: 0,
            totalAmount: record.total_cost || 0
        };

        // Add line items if we have labor/parts breakdown
        if (record.labor_cost > 0) {
            invoiceData.lineItems.push({
                description: `Labor - ${record.type || 'Service'}`,
                quantity: record.labor_hours || 1,
                unitPrice: record.labor_hours ? record.labor_cost / record.labor_hours : record.labor_cost,
                total: record.labor_cost
            });
        }
        if (record.parts_cost > 0) {
            invoiceData.lineItems.push({
                description: 'Parts & Materials',
                quantity: 1,
                unitPrice: record.parts_cost,
                total: record.parts_cost
            });
        }
        if (record.diagnostic_cost > 0) {
            invoiceData.lineItems.push({
                description: 'Diagnostic Fee',
                quantity: 1,
                unitPrice: record.diagnostic_cost,
                total: record.diagnostic_cost
            });
        }

        // Generate the PDF
        const pdfPath = invoicePdfService.generateInvoicePdf(invoiceData, `maintenance_${maintenanceId}`);

        // Redirect to the generated PDF
        res.redirect(pdfPath);
    } catch (error) {
        console.error('[Generate PDF Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
