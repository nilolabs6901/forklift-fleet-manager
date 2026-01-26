/**
 * Inbound Invoice Service
 * Parses incoming invoices from email attachments and creates maintenance records
 */

const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const db = require('../config/sqlite-database');

// Directory for storing incoming invoice attachments
const INBOUND_DIR = path.join(__dirname, '../uploads/inbound-invoices');
if (!fs.existsSync(INBOUND_DIR)) {
    fs.mkdirSync(INBOUND_DIR, { recursive: true });
}

class InboundInvoiceService {
    constructor() {
        // Known vendor patterns for extraction
        this.vendorPatterns = [
            { name: 'Southern States Toyotalift', pattern: /southern\s*states\s*(toyotalift|material\s*handling)/i },
            { name: 'Raymond Handling Consultants', pattern: /raymond\s*handling/i },
            { name: 'Toyota Material Handling', pattern: /toyota\s*material\s*handling/i },
            { name: 'Crown Equipment', pattern: /crown\s*equipment/i },
            { name: 'Hyster-Yale', pattern: /hyster|yale/i }
        ];

        // Make/brand patterns
        this.makePatterns = {
            'RAYM': 'Raymond',
            'RAYMOND': 'Raymond',
            'TOYOTA': 'Toyota',
            'CROWN': 'Crown',
            'HYSTER': 'Hyster',
            'YALE': 'Yale',
            'CAT': 'Caterpillar',
            'CLARK': 'Clark'
        };

        // Service type patterns
        this.serviceTypePatterns = [
            { type: 'preventive', pattern: /preventive|pm[-\s]?[abc]|scheduled\s*maintenance/i },
            { type: 'repair', pattern: /repair|breakdown|fix/i },
            { type: 'inspection', pattern: /inspection|safety\s*check/i },
            { type: 'rental', pattern: /rental|lease|monthly/i }
        ];
    }

    /**
     * Process an inbound invoice from email
     * @param {Object} emailData - Email data from webhook
     * @param {Buffer|string} attachmentData - PDF/image attachment data or base64
     * @param {string} attachmentName - Original filename
     */
    async processInboundInvoice(emailData, attachmentData, attachmentName) {
        const timestamp = Date.now();
        const ext = path.extname(attachmentName) || '.pdf';
        const savedPath = path.join(INBOUND_DIR, `invoice_${timestamp}${ext}`);

        // Save attachment to disk
        let buffer = attachmentData;
        if (typeof attachmentData === 'string') {
            buffer = Buffer.from(attachmentData, 'base64');
        }
        fs.writeFileSync(savedPath, buffer);

        // Create inbound invoice record
        const inboundRecord = this.createInboundRecord({
            email_from: emailData.from || emailData.sender,
            email_subject: emailData.subject,
            email_date: emailData.date || new Date().toISOString(),
            attachment_path: savedPath,
            attachment_name: attachmentName,
            status: 'processing'
        });

        try {
            // Perform OCR on the attachment
            const ocrText = await this.performOCR(savedPath);

            // Update record with OCR text
            this.updateInboundRecord(inboundRecord.id, {
                ocr_text: ocrText,
                status: 'parsed'
            });

            // Extract structured data from OCR text
            const extractedData = this.extractInvoiceData(ocrText);

            // Update record with extracted data
            this.updateInboundRecord(inboundRecord.id, {
                extracted_data: JSON.stringify(extractedData),
                vendor_name: extractedData.vendor,
                invoice_number: extractedData.invoiceNumber,
                invoice_date: extractedData.invoiceDate,
                total_amount: extractedData.totalAmount,
                status: 'ready_for_review'
            });

            // Try to auto-match to a forklift
            const matchedForklift = this.matchForklift(extractedData);
            if (matchedForklift) {
                this.updateInboundRecord(inboundRecord.id, {
                    matched_forklift_id: matchedForklift.id,
                    match_confidence: matchedForklift.confidence
                });
                extractedData.matchedForklift = matchedForklift;
            }

            // Auto-create maintenance record if confidence is high
            if (matchedForklift && matchedForklift.confidence >= 0.8) {
                const maintenanceRecord = this.createMaintenanceFromInvoice(extractedData, matchedForklift.id, inboundRecord.id);
                this.updateInboundRecord(inboundRecord.id, {
                    maintenance_record_id: maintenanceRecord.id,
                    status: 'auto_processed'
                });
                extractedData.maintenanceRecord = maintenanceRecord;
            }

            return {
                success: true,
                inboundId: inboundRecord.id,
                extractedData,
                status: matchedForklift?.confidence >= 0.8 ? 'auto_processed' : 'ready_for_review'
            };
        } catch (error) {
            this.updateInboundRecord(inboundRecord.id, {
                status: 'error',
                error_message: error.message
            });
            throw error;
        }
    }

    /**
     * Perform OCR on an image/PDF file
     */
    async performOCR(filePath) {
        console.log(`[OCR] Processing: ${filePath}`);

        const result = await Tesseract.recognize(filePath, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        return result.data.text;
    }

    /**
     * Extract structured invoice data from OCR text
     */
    extractInvoiceData(ocrText) {
        const data = {
            vendor: null,
            invoiceNumber: null,
            invoiceDate: null,
            location: null,
            unitReference: null,
            make: null,
            model: null,
            serialNumber: null,
            description: null,
            servicePeriod: null,
            laborCost: 0,
            partsCost: 0,
            subtotal: 0,
            tax: 0,
            totalAmount: 0,
            rawText: ocrText
        };

        // Extract vendor
        for (const vp of this.vendorPatterns) {
            if (vp.pattern.test(ocrText)) {
                data.vendor = vp.name;
                break;
            }
        }

        // Extract invoice number - various formats
        const invoiceMatch = ocrText.match(/invoice\s*(?:#|no\.?|number)?:?\s*([A-Z0-9-]+)/i);
        if (invoiceMatch) {
            data.invoiceNumber = invoiceMatch[1].trim();
        }

        // Extract invoice date
        const datePatterns = [
            /invoice\s*date:?\s*(\w+\s+\d{1,2},?\s*\d{4})/i,
            /date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            /(\w+\s+\d{1,2},?\s*\d{4})/i
        ];
        for (const dp of datePatterns) {
            const dateMatch = ocrText.match(dp);
            if (dateMatch) {
                data.invoiceDate = dateMatch[1].trim();
                break;
            }
        }

        // Extract location
        const locationMatch = ocrText.match(/location\s*:?\s*(\w+)/i);
        if (locationMatch) {
            data.location = locationMatch[1].trim();
        }

        // Extract unit reference/ID
        const refPatterns = [
            /reference\s*:?\s*([A-Z0-9-]+)/i,
            /unit\s*(?:id|#)?:?\s*([A-Z0-9-]+)/i,
            /equipment\s*(?:id|#)?:?\s*([A-Z0-9-]+)/i,
            /asset\s*(?:id|#)?:?\s*([A-Z0-9-]+)/i
        ];
        for (const rp of refPatterns) {
            const refMatch = ocrText.match(rp);
            if (refMatch) {
                data.unitReference = refMatch[1].trim();
                break;
            }
        }

        // Extract make
        const makeMatch = ocrText.match(/make\s*:?\s*(\w+)/i);
        if (makeMatch) {
            const rawMake = makeMatch[1].trim().toUpperCase();
            data.make = this.makePatterns[rawMake] || rawMake;
        }

        // Extract model
        const modelMatch = ocrText.match(/model\s*(?:no\.?)?:?\s*([A-Z0-9-]+)/i);
        if (modelMatch) {
            data.model = modelMatch[1].trim();
        }

        // Extract serial number
        const serialMatch = ocrText.match(/serial\s*(?:no\.?|#)?:?\s*([A-Z0-9\s-]+)/i);
        if (serialMatch) {
            data.serialNumber = serialMatch[1].trim();
        }

        // Extract description
        const descPatterns = [
            /description[:\s]+([^\n]+)/i,
            /service[:\s]+([^\n]+)/i,
            /work\s*performed[:\s]+([^\n]+)/i
        ];
        for (const dp of descPatterns) {
            const descMatch = ocrText.match(dp);
            if (descMatch) {
                data.description = descMatch[1].trim();
                break;
            }
        }

        // Extract service period
        const periodMatch = ocrText.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:to|through|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
        if (periodMatch) {
            data.servicePeriod = {
                start: periodMatch[1],
                end: periodMatch[2]
            };
        }

        // Extract costs
        const amountPatterns = [
            { field: 'laborCost', pattern: /labor\s*(?:cost)?:?\s*\$?([\d,]+\.?\d*)/i },
            { field: 'partsCost', pattern: /parts?\s*(?:cost)?:?\s*\$?([\d,]+\.?\d*)/i },
            { field: 'subtotal', pattern: /subtotal:?\s*\$?([\d,]+\.?\d*)/i },
            { field: 'tax', pattern: /(?:sales\s*)?tax:?\s*\$?([\d,]+\.?\d*)/i },
            { field: 'totalAmount', pattern: /(?:total|amount\s*due|invoice\s*total)[:\s]*\$?([\d,]+\.?\d*)/i }
        ];

        for (const ap of amountPatterns) {
            const match = ocrText.match(ap.pattern);
            if (match) {
                data[ap.field] = parseFloat(match[1].replace(/,/g, '')) || 0;
            }
        }

        // Also look for standalone dollar amounts near keywords
        const netPriceMatch = ocrText.match(/net\s*price[:\s]*\$?([\d,]+\.?\d*)/i);
        if (netPriceMatch && !data.subtotal) {
            data.subtotal = parseFloat(netPriceMatch[1].replace(/,/g, '')) || 0;
        }

        // If no total found, calculate from subtotal + tax
        if (!data.totalAmount && data.subtotal) {
            data.totalAmount = data.subtotal + data.tax;
        }

        return data;
    }

    /**
     * Try to match extracted data to an existing forklift
     */
    matchForklift(extractedData) {
        const forklifts = db.forklifts.findAll({});
        let bestMatch = null;
        let bestConfidence = 0;

        for (const forklift of forklifts) {
            let confidence = 0;
            let matchReasons = [];

            // Match by serial number (highest confidence)
            if (extractedData.serialNumber && forklift.serial_number) {
                const serial1 = extractedData.serialNumber.replace(/[\s-]/g, '').toLowerCase();
                const serial2 = forklift.serial_number.replace(/[\s-]/g, '').toLowerCase();
                if (serial1.includes(serial2) || serial2.includes(serial1)) {
                    confidence += 0.5;
                    matchReasons.push('serial_number');
                }
            }

            // Match by unit ID
            if (extractedData.unitReference && forklift.unit_id) {
                const ref1 = extractedData.unitReference.toLowerCase();
                const ref2 = forklift.unit_id.toLowerCase();
                if (ref1 === ref2 || ref1.includes(ref2) || ref2.includes(ref1)) {
                    confidence += 0.4;
                    matchReasons.push('unit_id');
                }
            }

            // Match by make
            if (extractedData.make && forklift.make) {
                if (extractedData.make.toLowerCase() === forklift.make.toLowerCase()) {
                    confidence += 0.1;
                    matchReasons.push('make');
                }
            }

            // Match by model
            if (extractedData.model && forklift.model) {
                if (extractedData.model.toLowerCase().includes(forklift.model.toLowerCase()) ||
                    forklift.model.toLowerCase().includes(extractedData.model.toLowerCase())) {
                    confidence += 0.15;
                    matchReasons.push('model');
                }
            }

            // Match by location
            if (extractedData.location && forklift.location_name) {
                if (forklift.location_name.toLowerCase().includes(extractedData.location.toLowerCase())) {
                    confidence += 0.1;
                    matchReasons.push('location');
                }
            }

            if (confidence > bestConfidence) {
                bestConfidence = confidence;
                bestMatch = {
                    id: forklift.id,
                    unit_id: forklift.unit_id,
                    model: forklift.model,
                    confidence: Math.min(confidence, 1),
                    matchReasons
                };
            }
        }

        return bestMatch && bestConfidence > 0.3 ? bestMatch : null;
    }

    /**
     * Create a maintenance record from extracted invoice data
     */
    createMaintenanceFromInvoice(extractedData, forkliftId, inboundId) {
        const forklift = db.forklifts.findById(forkliftId);

        // Determine maintenance type
        let maintenanceType = 'repair';
        for (const stp of this.serviceTypePatterns) {
            if (extractedData.description && stp.pattern.test(extractedData.description)) {
                maintenanceType = stp.type;
                break;
            }
        }

        // Parse service date
        let serviceDate = new Date().toISOString().split('T')[0];
        if (extractedData.invoiceDate) {
            try {
                const parsed = new Date(extractedData.invoiceDate);
                if (!isNaN(parsed.getTime())) {
                    serviceDate = parsed.toISOString().split('T')[0];
                }
            } catch (e) {
                // Use default
            }
        }

        const maintenanceData = {
            forklift_id: forkliftId,
            type: maintenanceType,
            description: extractedData.description || `Invoice ${extractedData.invoiceNumber}`,
            service_date: serviceDate,
            vendor: extractedData.vendor,
            invoice_number: extractedData.invoiceNumber,
            labor_cost: extractedData.laborCost || 0,
            parts_cost: extractedData.partsCost || extractedData.subtotal || 0,
            total_cost: extractedData.totalAmount || 0,
            hours_at_service: forklift?.current_hours || 0,
            work_performed: extractedData.description,
            notes: `Auto-imported from email invoice. Inbound ID: ${inboundId}`,
            status: 'completed'
        };

        return db.maintenance.create(maintenanceData);
    }

    /**
     * Create an inbound invoice record
     */
    createInboundRecord(data) {
        const stmt = db.raw.prepare(`
            INSERT INTO inbound_invoices (
                email_from, email_subject, email_date, attachment_path,
                attachment_name, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        const result = stmt.run(
            data.email_from,
            data.email_subject,
            data.email_date,
            data.attachment_path,
            data.attachment_name,
            data.status
        );

        return { id: result.lastInsertRowid, ...data };
    }

    /**
     * Update an inbound invoice record
     */
    updateInboundRecord(id, data) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        values.push(id);
        db.raw.prepare(`UPDATE inbound_invoices SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    /**
     * Get all inbound invoices with optional filters
     */
    getInboundInvoices(filters = {}) {
        let sql = `
            SELECT i.*, f.id as matched_unit_id, f.model as matched_model
            FROM inbound_invoices i
            LEFT JOIN forklifts f ON i.matched_forklift_id = f.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            sql += ' AND i.status = ?';
            params.push(filters.status);
        }

        if (filters.fromDate) {
            sql += ' AND i.created_at >= ?';
            params.push(filters.fromDate);
        }

        sql += ' ORDER BY i.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return db.raw.prepare(sql).all(...params);
    }

    /**
     * Get a single inbound invoice by ID
     */
    getInboundInvoice(id) {
        return db.raw.prepare(`
            SELECT i.*, f.id as matched_unit_id, f.model as matched_model
            FROM inbound_invoices i
            LEFT JOIN forklifts f ON i.matched_forklift_id = f.id
            WHERE i.id = ?
        `).get(id);
    }

    /**
     * Manually approve and process an inbound invoice
     */
    approveInboundInvoice(id, forkliftId, adjustments = {}) {
        const inbound = this.getInboundInvoice(id);
        if (!inbound) throw new Error('Inbound invoice not found');

        let extractedData = {};
        try {
            extractedData = JSON.parse(inbound.extracted_data || '{}');
        } catch (e) {
            // Use empty object
        }

        // Apply any manual adjustments
        Object.assign(extractedData, adjustments);

        // Create the maintenance record
        const maintenanceRecord = this.createMaintenanceFromInvoice(extractedData, forkliftId, id);

        // Update inbound record
        this.updateInboundRecord(id, {
            matched_forklift_id: forkliftId,
            maintenance_record_id: maintenanceRecord.id,
            status: 'approved',
            approved_at: new Date().toISOString()
        });

        return maintenanceRecord;
    }

    /**
     * Reject an inbound invoice
     */
    rejectInboundInvoice(id, reason) {
        this.updateInboundRecord(id, {
            status: 'rejected',
            rejection_reason: reason
        });
    }

    /**
     * Get statistics about inbound invoice processing
     */
    getStats() {
        const stats = db.raw.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'auto_processed' THEN 1 ELSE 0 END) as auto_processed,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as manually_approved,
                SUM(CASE WHEN status = 'ready_for_review' THEN 1 ELSE 0 END) as pending_review,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
                SUM(COALESCE(total_amount, 0)) as total_value
            FROM inbound_invoices
        `).get();

        return stats;
    }

    /**
     * Process invoice from raw text (for testing or direct input)
     */
    processFromText(text, metadata = {}) {
        const extractedData = this.extractInvoiceData(text);
        const matchedForklift = this.matchForklift(extractedData);

        return {
            extractedData,
            matchedForklift,
            confidence: matchedForklift?.confidence || 0
        };
    }
}

module.exports = new InboundInvoiceService();
