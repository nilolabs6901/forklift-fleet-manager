/**
 * Invoice Service
 * Generates and manages maintenance invoice PDFs
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const INVOICES_DIR = path.join(__dirname, '../public/invoices');

// Ensure invoices directory exists
if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
}

/**
 * Generate a PDF invoice for a maintenance record
 */
function generateInvoicePDF(maintenanceRecord, forklift, location) {
    return new Promise((resolve, reject) => {
        const invoiceNumber = maintenanceRecord.invoice_number;
        if (!invoiceNumber) {
            return reject(new Error('No invoice number'));
        }

        const fileName = `${invoiceNumber}.pdf`;
        const filePath = path.join(INVOICES_DIR, fileName);

        // Check if already exists
        if (fs.existsSync(filePath)) {
            return resolve(filePath);
        }

        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown(0.5);

        // Invoice details box
        doc.fontSize(10).font('Helvetica');
        doc.text(`Invoice #: ${invoiceNumber}`, 400, 80);
        doc.text(`Date: ${new Date(maintenanceRecord.service_date).toLocaleDateString()}`, 400, 95);
        doc.text(`Work Order: ${maintenanceRecord.work_order_number || 'N/A'}`, 400, 110);

        // Company info
        doc.fontSize(12).font('Helvetica-Bold').text('Fleet Manager Pro', 50, 80);
        doc.fontSize(10).font('Helvetica');
        doc.text('123 Industrial Way', 50, 95);
        doc.text('Fleet City, FC 12345', 50, 110);
        doc.text('Phone: (555) 123-4567', 50, 125);

        // Divider
        doc.moveTo(50, 160).lineTo(550, 160).stroke();

        // Bill To
        doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:', 50, 180);
        doc.fontSize(10).font('Helvetica');
        doc.text(location?.name || 'Location', 50, 195);
        doc.text(location?.address || '', 50, 210);
        doc.text(`${location?.city || ''}, ${location?.state || ''} ${location?.zip_code || ''}`, 50, 225);

        // Service details
        doc.fontSize(11).font('Helvetica-Bold').text('SERVICE DETAILS:', 300, 180);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Forklift ID: ${maintenanceRecord.forklift_id}`, 300, 195);
        doc.text(`Model: ${forklift?.model || 'N/A'}`, 300, 210);
        doc.text(`Hours at Service: ${maintenanceRecord.hours_at_service?.toLocaleString() || 'N/A'}`, 300, 225);

        // Table header
        const tableTop = 270;
        doc.font('Helvetica-Bold');
        doc.rect(50, tableTop, 500, 20).fill('#f0f0f0');
        doc.fillColor('#000');
        doc.text('Description', 55, tableTop + 5, { width: 250 });
        doc.text('Type', 310, tableTop + 5, { width: 80 });
        doc.text('Amount', 450, tableTop + 5, { width: 80, align: 'right' });

        // Table content
        doc.font('Helvetica');
        let yPos = tableTop + 30;

        // Main service line
        doc.text(maintenanceRecord.description || `${maintenanceRecord.type} maintenance`, 55, yPos, { width: 250 });
        doc.text(maintenanceRecord.type?.toUpperCase() || '', 310, yPos, { width: 80 });

        yPos += 25;

        // Work performed
        if (maintenanceRecord.work_performed) {
            doc.fontSize(9).fillColor('#666');
            doc.text(`Work: ${maintenanceRecord.work_performed}`, 55, yPos, { width: 400 });
            doc.fillColor('#000').fontSize(10);
            yPos += 20;
        }

        // Cost breakdown
        yPos += 10;
        doc.moveTo(50, yPos).lineTo(550, yPos).stroke();
        yPos += 15;

        const costs = [
            { label: 'Labor Cost', amount: maintenanceRecord.labor_cost || 0 },
            { label: 'Parts Cost', amount: maintenanceRecord.parts_cost || 0 },
            { label: 'Diagnostic Cost', amount: maintenanceRecord.diagnostic_cost || 0 },
            { label: 'Other Charges', amount: maintenanceRecord.other_cost || 0 }
        ];

        costs.forEach(cost => {
            if (cost.amount > 0) {
                doc.text(cost.label, 310, yPos);
                doc.text(`$${cost.amount.toFixed(2)}`, 450, yPos, { width: 80, align: 'right' });
                yPos += 18;
            }
        });

        // Total
        yPos += 5;
        doc.moveTo(300, yPos).lineTo(550, yPos).stroke();
        yPos += 10;
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('TOTAL:', 310, yPos);
        doc.text(`$${(maintenanceRecord.total_cost || 0).toFixed(2)}`, 450, yPos, { width: 80, align: 'right' });

        // Footer
        doc.fontSize(9).font('Helvetica').fillColor('#666');
        doc.text('Thank you for your business!', 50, 700, { align: 'center' });
        doc.text('Payment terms: Net 30 days', 50, 715, { align: 'center' });

        doc.end();

        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

/**
 * Check if invoice PDF exists
 */
function invoiceExists(invoiceNumber) {
    const filePath = path.join(INVOICES_DIR, `${invoiceNumber}.pdf`);
    return fs.existsSync(filePath);
}

/**
 * Get invoice file path
 */
function getInvoicePath(invoiceNumber) {
    return path.join(INVOICES_DIR, `${invoiceNumber}.pdf`);
}

/**
 * Generate invoices for all maintenance records that have invoice numbers
 */
async function generateAllInvoices(db) {
    const records = db.maintenance.findAll({ status: 'completed' });
    let generated = 0;

    for (const record of records) {
        if (record.invoice_number && !invoiceExists(record.invoice_number)) {
            try {
                const forklift = db.forklifts.findById(record.forklift_id);
                const location = forklift?.location_id ? db.locations.findById(forklift.location_id) : null;
                await generateInvoicePDF(record, forklift, location);
                generated++;
            } catch (err) {
                console.error(`Failed to generate invoice ${record.invoice_number}:`, err.message);
            }
        }
    }

    return generated;
}

module.exports = {
    generateInvoicePDF,
    invoiceExists,
    getInvoicePath,
    generateAllInvoices,
    INVOICES_DIR
};
