/**
 * Invoice PDF Generation Service
 * Creates PDF invoices from extracted invoice data
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Directory for storing generated PDFs
const PDF_DIR = path.join(__dirname, '../public/invoices');
if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
}

class InvoicePdfService {
    /**
     * Generate a PDF invoice from extracted data
     * @param {Object} invoiceData - The extracted invoice data
     * @param {string} filename - Optional filename (without extension)
     * @returns {string} - The public URL path to the PDF
     */
    generateInvoicePdf(invoiceData, filename = null) {
        const pdfFilename = filename || `invoice_${invoiceData.invoiceNumber || Date.now()}`;
        const safeName = pdfFilename.replace(/[^a-zA-Z0-9-_]/g, '_');
        const pdfPath = path.join(PDF_DIR, `${safeName}.pdf`);
        const publicPath = `/invoices/${safeName}.pdf`;

        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        // Header
        this.drawHeader(doc, invoiceData);

        // Invoice details
        this.drawInvoiceDetails(doc, invoiceData);

        // Bill To / Ship To
        this.drawAddresses(doc, invoiceData);

        // Line items table
        this.drawLineItems(doc, invoiceData);

        // Totals
        this.drawTotals(doc, invoiceData);

        // Footer
        this.drawFooter(doc, invoiceData);

        doc.end();

        return publicPath;
    }

    drawHeader(doc, data) {
        // Company logo area (colored rectangle)
        doc.rect(50, 45, 60, 60).fill('#2563eb');
        doc.fontSize(24).fillColor('#ffffff').text('FL', 65, 65);

        // Company name
        doc.fillColor('#1f2937')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text(data.vendor || 'Service Provider', 130, 50);

        // Tagline
        doc.fontSize(10)
           .fillColor('#6b7280')
           .font('Helvetica')
           .text('Forklift Service & Maintenance', 130, 75);

        // INVOICE title
        doc.fontSize(28)
           .fillColor('#2563eb')
           .font('Helvetica-Bold')
           .text('INVOICE', 400, 50, { align: 'right' });

        // Invoice number
        doc.fontSize(12)
           .fillColor('#1f2937')
           .font('Helvetica')
           .text(`#${data.invoiceNumber || 'N/A'}`, 400, 85, { align: 'right' });

        // Horizontal line
        doc.moveTo(50, 120).lineTo(562, 120).strokeColor('#e5e7eb').stroke();
    }

    drawInvoiceDetails(doc, data) {
        const y = 140;

        doc.fontSize(10).fillColor('#6b7280').font('Helvetica');

        // Left column
        doc.text('Invoice Date:', 50, y);
        doc.fillColor('#1f2937').font('Helvetica-Bold')
           .text(data.invoiceDate || new Date().toLocaleDateString(), 130, y);

        doc.fillColor('#6b7280').font('Helvetica')
           .text('PO Number:', 50, y + 18);
        doc.fillColor('#1f2937').font('Helvetica-Bold')
           .text(data.poNumber || 'N/A', 130, y + 18);

        // Right column
        doc.fillColor('#6b7280').font('Helvetica')
           .text('Due Date:', 350, y);
        const dueDate = new Date(data.invoiceDate || Date.now());
        dueDate.setDate(dueDate.getDate() + 30);
        doc.fillColor('#1f2937').font('Helvetica-Bold')
           .text(dueDate.toLocaleDateString(), 420, y);

        doc.fillColor('#6b7280').font('Helvetica')
           .text('Terms:', 350, y + 18);
        doc.fillColor('#1f2937').font('Helvetica-Bold')
           .text('Net 30', 420, y + 18);
    }

    drawAddresses(doc, data) {
        const y = 200;

        // Bill To box
        doc.rect(50, y, 230, 80).fillColor('#f9fafb').fill();
        doc.fillColor('#6b7280').fontSize(9).font('Helvetica')
           .text('BILL TO', 60, y + 10);
        doc.fillColor('#1f2937').fontSize(11).font('Helvetica-Bold')
           .text('Fleet Shield Operations', 60, y + 25);
        doc.fontSize(10).font('Helvetica')
           .text(data.location || 'Main Warehouse', 60, y + 40);
        doc.text('Accounts Payable Department', 60, y + 55);

        // Service Location box
        doc.rect(300, y, 262, 80).fillColor('#f9fafb').fill();
        doc.fillColor('#6b7280').fontSize(9).font('Helvetica')
           .text('SERVICE LOCATION', 310, y + 10);
        doc.fillColor('#1f2937').fontSize(11).font('Helvetica-Bold')
           .text(data.location || 'Main Warehouse', 310, y + 25);

        if (data.unitReference) {
            doc.fontSize(10).font('Helvetica')
               .text(`Unit: ${data.unitReference}`, 310, y + 40);
        }
        if (data.serialNumber) {
            doc.text(`S/N: ${data.serialNumber}`, 310, y + 55);
        }
    }

    drawLineItems(doc, data) {
        const tableTop = 310;
        const lineItems = data.lineItems || [];

        // Table header
        doc.rect(50, tableTop, 512, 25).fillColor('#2563eb').fill();

        doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold');
        doc.text('DESCRIPTION', 60, tableTop + 8);
        doc.text('QTY', 350, tableTop + 8, { width: 50, align: 'center' });
        doc.text('UNIT PRICE', 400, tableTop + 8, { width: 70, align: 'right' });
        doc.text('AMOUNT', 480, tableTop + 8, { width: 70, align: 'right' });

        // Table rows
        let y = tableTop + 30;
        doc.fillColor('#1f2937').font('Helvetica');

        if (lineItems.length === 0) {
            // Create default line item from description
            doc.fontSize(10).text(data.description || 'Service', 60, y);
            doc.text('1', 350, y, { width: 50, align: 'center' });
            doc.text(`$${(data.totalAmount || 0).toFixed(2)}`, 400, y, { width: 70, align: 'right' });
            doc.text(`$${(data.totalAmount || 0).toFixed(2)}`, 480, y, { width: 70, align: 'right' });
            y += 25;
        } else {
            lineItems.forEach((item, index) => {
                // Alternate row background
                if (index % 2 === 0) {
                    doc.rect(50, y - 5, 512, 25).fillColor('#f9fafb').fill();
                }

                doc.fillColor('#1f2937').fontSize(10);
                doc.text(item.description || 'Item', 60, y, { width: 280 });
                doc.text(String(item.quantity || 1), 350, y, { width: 50, align: 'center' });
                doc.text(`$${(item.unitPrice || 0).toFixed(2)}`, 400, y, { width: 70, align: 'right' });
                doc.text(`$${(item.total || 0).toFixed(2)}`, 480, y, { width: 70, align: 'right' });
                y += 25;
            });
        }

        // Bottom border
        doc.moveTo(50, y + 5).lineTo(562, y + 5).strokeColor('#e5e7eb').stroke();

        return y + 10;
    }

    drawTotals(doc, data) {
        const y = 500;
        const rightCol = 400;

        // Subtotal
        doc.fontSize(10).fillColor('#6b7280').font('Helvetica')
           .text('Subtotal:', rightCol, y);
        doc.fillColor('#1f2937')
           .text(`$${(data.subtotal || data.laborCost + data.partsCost || 0).toFixed(2)}`, 480, y, { width: 70, align: 'right' });

        // Labor breakdown
        if (data.laborCost) {
            doc.fillColor('#6b7280')
               .text('Labor:', rightCol, y + 18);
            doc.fillColor('#1f2937')
               .text(`$${data.laborCost.toFixed(2)}`, 480, y + 18, { width: 70, align: 'right' });
        }

        // Parts breakdown
        if (data.partsCost) {
            doc.fillColor('#6b7280')
               .text('Parts:', rightCol, y + 36);
            doc.fillColor('#1f2937')
               .text(`$${data.partsCost.toFixed(2)}`, 480, y + 36, { width: 70, align: 'right' });
        }

        // Tax
        doc.fillColor('#6b7280')
           .text('Tax:', rightCol, y + 54);
        doc.fillColor('#1f2937')
           .text(`$${(data.tax || 0).toFixed(2)}`, 480, y + 54, { width: 70, align: 'right' });

        // Total line
        doc.moveTo(rightCol, y + 70).lineTo(562, y + 70).strokeColor('#2563eb').lineWidth(2).stroke();

        // Total
        doc.fontSize(14).fillColor('#2563eb').font('Helvetica-Bold')
           .text('TOTAL:', rightCol, y + 80);
        doc.text(`$${(data.totalAmount || 0).toFixed(2)}`, 480, y + 80, { width: 70, align: 'right' });

        // Equipment info box
        if (data.make || data.model) {
            doc.rect(50, y, 300, 80).fillColor('#fef3c7').fill();
            doc.fillColor('#92400e').fontSize(9).font('Helvetica-Bold')
               .text('EQUIPMENT SERVICED', 60, y + 10);
            doc.fillColor('#1f2937').fontSize(10).font('Helvetica');

            let equipY = y + 28;
            if (data.make) {
                doc.text(`Make: ${data.make}`, 60, equipY);
                equipY += 15;
            }
            if (data.model) {
                doc.text(`Model: ${data.model}`, 60, equipY);
                equipY += 15;
            }
            if (data.unitReference) {
                doc.text(`Unit ID: ${data.unitReference}`, 60, equipY);
            }
        }
    }

    drawFooter(doc, data) {
        const y = 650;

        // Description/Notes
        if (data.description) {
            doc.rect(50, y, 512, 50).fillColor('#f0fdf4').fill();
            doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold')
               .text('SERVICE DESCRIPTION', 60, y + 8);
            doc.fillColor('#1f2937').fontSize(10).font('Helvetica')
               .text(data.description, 60, y + 22, { width: 490 });
        }

        // Footer text
        doc.fontSize(9).fillColor('#6b7280').font('Helvetica')
           .text('Thank you for your business!', 50, 720, { align: 'center', width: 512 });
        doc.text(`Generated: ${new Date().toLocaleString()}`, 50, 735, { align: 'center', width: 512 });

        // Vendor contact info
        const vendor = data.vendor || 'Service Provider';
        doc.fontSize(8).fillColor('#9ca3af')
           .text(`${vendor} | invoices@${vendor.toLowerCase().replace(/\s+/g, '')}.com | (555) 123-4567`, 50, 750, { align: 'center', width: 512 });
    }
}

module.exports = new InvoicePdfService();
