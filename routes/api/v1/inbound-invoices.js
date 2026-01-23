/**
 * Inbound Invoice API Routes
 * Handles incoming invoices from email/webhooks and invoice review queue
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const inboundInvoiceService = require('../../../services/inboundInvoiceService');

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

// =================== WEBHOOK ENDPOINT FOR EMAIL SERVICES ===================

/**
 * POST /api/v1/inbound-invoices/webhook
 * Webhook endpoint for email services (Mailgun, SendGrid, Power Automate)
 * Accepts multipart form data with email metadata and attachments
 */
router.post('/webhook', upload.single('attachment'), async (req, res) => {
    try {
        const emailData = {
            from: req.body.from || req.body.sender || req.body.From,
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

        // Read the uploaded file
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
        console.error('[Inbound Invoice Webhook Error]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/v1/inbound-invoices/webhook/json
 * JSON-based webhook for services that send base64-encoded attachments
 */
router.post('/webhook/json', async (req, res) => {
    try {
        const { email, attachment, attachmentName } = req.body;

        if (!attachment) {
            return res.status(400).json({
                success: false,
                error: 'No attachment provided'
            });
        }

        const emailData = {
            from: email?.from || email?.sender,
            subject: email?.subject,
            date: email?.date || new Date().toISOString()
        };

        // attachment should be base64 encoded
        const result = await inboundInvoiceService.processInboundInvoice(
            emailData,
            attachment,
            attachmentName || 'invoice.pdf'
        );

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

module.exports = router;
