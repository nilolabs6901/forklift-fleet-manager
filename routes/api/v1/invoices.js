/**
 * Invoice API Routes - v1
 * Invoice PDF generation and retrieval
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const invoiceService = require('../../../services/invoiceService');
const db = require('../../../config/sqlite-database');

// GET /api/v1/invoices/:invoiceNumber - Get invoice PDF
router.get('/:invoiceNumber', async (req, res) => {
    try {
        const { invoiceNumber } = req.params;

        // Validate invoice number format
        if (!invoiceNumber.match(/^INV-\d{4}-\d{5}$/)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid invoice number format'
            });
        }

        // Check if PDF exists, if not generate it
        if (!invoiceService.invoiceExists(invoiceNumber)) {
            // Find the maintenance record
            const records = db.maintenance.findAll({});
            const record = records.find(r => r.invoice_number === invoiceNumber);

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Generate the PDF
            const forklift = db.forklifts.findById(record.forklift_id);
            const location = forklift?.location_id ? db.locations.findById(forklift.location_id) : null;
            await invoiceService.generateInvoicePDF(record, forklift, location);
        }

        const filePath = invoiceService.getInvoicePath(invoiceNumber);

        // Send the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${invoiceNumber}.pdf"`);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    } catch (error) {
        console.error('Invoice error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/invoices/generate-all - Generate all missing invoices
router.post('/generate-all', async (req, res) => {
    try {
        const count = await invoiceService.generateAllInvoices(db);
        res.json({
            success: true,
            message: `Generated ${count} invoices`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/invoices/:invoiceNumber/download - Download invoice PDF
router.get('/:invoiceNumber/download', async (req, res) => {
    try {
        const { invoiceNumber } = req.params;

        if (!invoiceService.invoiceExists(invoiceNumber)) {
            return res.status(404).json({
                success: false,
                error: 'Invoice not found'
            });
        }

        const filePath = invoiceService.getInvoicePath(invoiceNumber);
        res.download(filePath, `${invoiceNumber}.pdf`);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
