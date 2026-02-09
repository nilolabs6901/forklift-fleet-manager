/**
 * Formulas PDF Generation Service
 * Creates a PDF document of all system formulas and calculations
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Directory for storing generated PDFs
const PDF_DIR = path.join(__dirname, '../public/docs');
if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
}

class FormulasPdfService {
    /**
     * Generate the formulas PDF
     * @returns {string} - The public URL path to the PDF
     */
    generateFormulasPdf() {
        const pdfPath = path.join(PDF_DIR, 'fleet-shield-formulas.pdf');
        const publicPath = '/docs/fleet-shield-formulas.pdf';

        const doc = new PDFDocument({
            margin: 50,
            size: 'LETTER',
            bufferPages: true
        });
        const writeStream = fs.createWriteStream(pdfPath);
        doc.pipe(writeStream);

        // Cover page
        this.drawCoverPage(doc);

        // Table of Contents
        doc.addPage();
        this.drawTableOfContents(doc);

        // Section 1: Risk Assessment
        doc.addPage();
        this.drawRiskAssessmentSection(doc);

        // Section 2: Financial & Depreciation
        doc.addPage();
        this.drawFinancialSection(doc);

        // Section 3: Predictive Maintenance
        doc.addPage();
        this.drawPredictiveMaintenanceSection(doc);

        // Section 4: Hour Meter & Anomaly Detection
        doc.addPage();
        this.drawHourMeterSection(doc);

        // Section 5: Downtime & Cost Calculations
        doc.addPage();
        this.drawDowntimeSection(doc);

        // Section 6: Analytics & KPIs
        doc.addPage();
        this.drawAnalyticsSection(doc);

        // Add page numbers
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(9).fillColor('#666666')
               .text(`Page ${i + 1} of ${pages.count}`, 50, 750, { align: 'center', width: 512 });
        }

        doc.end();
        return publicPath;
    }

    drawCoverPage(doc) {
        // Header bar
        doc.rect(0, 0, 612, 150).fill('#1e3a5f');

        // Title
        doc.fontSize(36).fillColor('#ffffff')
           .text('Fleet Shield', 50, 50, { align: 'center', width: 512 });
        doc.fontSize(24).fillColor('#87ceeb')
           .text('System Formulas & Calculations', 50, 95, { align: 'center', width: 512 });

        // Subtitle
        doc.fontSize(14).fillColor('#333333')
           .text('Technical Reference Guide', 50, 200, { align: 'center', width: 512 });

        // Description
        doc.fontSize(11).fillColor('#666666')
           .text('This document contains all formulas, calculations, and algorithms used in the Fleet Shield fleet management system for risk assessment, predictive maintenance, financial analysis, and operational metrics.',
                 80, 260, { align: 'center', width: 452 });

        // Version info
        doc.fontSize(10).fillColor('#999999')
           .text(`Generated: ${new Date().toLocaleDateString()}`, 50, 700, { align: 'center', width: 512 });
        doc.text('Version 2.0', 50, 715, { align: 'center', width: 512 });
    }

    drawTableOfContents(doc) {
        doc.fontSize(20).fillColor('#1e3a5f').text('Table of Contents', 50, 50);
        doc.moveTo(50, 80).lineTo(562, 80).stroke('#1e3a5f');

        const sections = [
            { title: '1. Risk Assessment Formulas', page: 3 },
            { title: '   1.1 Overall Risk Score (Weighted)', page: 3 },
            { title: '   1.2 Age Score Calculation', page: 3 },
            { title: '   1.3 Hours Score Calculation', page: 3 },
            { title: '   1.4 Maintenance Cost Score', page: 3 },
            { title: '   1.5 Repair Frequency Score', page: 4 },
            { title: '   1.6 Downtime Score', page: 4 },
            { title: '2. Financial & Depreciation Formulas', page: 5 },
            { title: '   2.1 Current Value (Depreciation)', page: 5 },
            { title: '   2.2 Projected Maintenance Cost', page: 5 },
            { title: '   2.3 Replacement Analysis', page: 5 },
            { title: '   2.4 ROI & Payback Calculations', page: 6 },
            { title: '3. Predictive Maintenance Formulas', page: 7 },
            { title: '   3.1 Usage Rate Calculation', page: 7 },
            { title: '   3.2 Service Prediction', page: 7 },
            { title: '   3.3 Component Health', page: 7 },
            { title: '   3.4 Urgency Score', page: 8 },
            { title: '4. Hour Meter & Anomaly Detection', page: 9 },
            { title: '5. Downtime & Cost Calculations', page: 10 },
            { title: '6. Analytics & KPIs', page: 11 }
        ];

        let y = 100;
        sections.forEach(section => {
            const isMain = !section.title.startsWith('   ');
            doc.fontSize(isMain ? 12 : 10)
               .fillColor(isMain ? '#333333' : '#666666')
               .text(section.title, 50, y, { continued: true, width: 450 })
               .text(section.page.toString(), { align: 'right', width: 62 });
            y += isMain ? 22 : 18;
        });
    }

    drawRiskAssessmentSection(doc) {
        this.drawSectionHeader(doc, '1. Risk Assessment Formulas');
        doc.fontSize(10).fillColor('#666666')
           .text('File: services/riskAssessmentService.js', 50, 85);

        let y = 110;

        // 1.1 Overall Risk Score
        y = this.drawSubsection(doc, y, '1.1 Overall Risk Score (Weighted Average)');
        y = this.drawFormula(doc, y,
            'Overall Score = (Age × 0.15) + (Hours × 0.20) + (Maint. Cost × 0.25) + (Repair Freq. × 0.20) + (Downtime × 0.20)');

        y = this.drawTable(doc, y, 'Weight Distribution:', [
            ['Component', 'Weight', 'Description'],
            ['Age Score', '15%', 'Equipment age in years'],
            ['Hours Score', '20%', 'Current operating hours'],
            ['Maintenance Cost', '25%', '12-month maintenance as % of purchase price'],
            ['Repair Frequency', '20%', 'Number of repairs in 12 months'],
            ['Downtime Score', '20%', 'Total downtime hours in 12 months']
        ]);

        // 1.2 Age Score
        y = this.drawSubsection(doc, y + 10, '1.2 Age Score Calculation');
        y = this.drawTable(doc, y, 'Thresholds (Years):', [
            ['Age Range', 'Score Range', 'Formula'],
            ['≤ 3 years', '1', 'Fixed score'],
            ['3-6 years', '1-4', '1 + ((age - 3) / 3) × 3'],
            ['6-8 years', '4-7', '4 + ((age - 6) / 2) × 3'],
            ['8-10 years', '7-9', '7 + ((age - 8) / 2) × 2'],
            ['> 10 years', '10', 'Maximum score']
        ]);

        // 1.3 Hours Score
        y = this.drawSubsection(doc, y + 10, '1.3 Hours Score Calculation');
        y = this.drawTable(doc, y, 'Thresholds (Operating Hours):', [
            ['Hours Range', 'Score Range', 'Formula'],
            ['≤ 5,000', '1', 'Fixed score'],
            ['5,000-10,000', '1-4', '1 + ((hours - 5000) / 5000) × 3'],
            ['10,000-15,000', '4-7', '4 + ((hours - 10000) / 5000) × 3'],
            ['15,000-20,000', '7-9', '7 + ((hours - 15000) / 5000) × 2'],
            ['> 20,000', '10', 'Maximum score']
        ]);

        // Check if we need a new page
        if (y > 650) {
            doc.addPage();
            y = 50;
        }

        // 1.4 Maintenance Cost Score
        y = this.drawSubsection(doc, y + 10, '1.4 Maintenance Cost Score');
        y = this.drawFormula(doc, y, 'Cost % = (12-Month Maintenance Cost / Purchase Price) × 100');
        y = this.drawTable(doc, y, 'Thresholds (% of Purchase Price):', [
            ['Cost %', 'Score Range', 'Risk Level'],
            ['≤ 5%', '1', 'Low'],
            ['5-10%', '1-4', 'Moderate'],
            ['10-15%', '4-7', 'High'],
            ['15-20%', '7-9', 'Very High'],
            ['> 20%', '10', 'Critical']
        ]);

        // New page for remaining risk scores
        doc.addPage();
        y = 50;

        // 1.5 Repair Frequency Score
        y = this.drawSubsection(doc, y, '1.5 Repair Frequency Score');
        y = this.drawTable(doc, y, 'Thresholds (Repairs per Year):', [
            ['Repairs/Year', 'Score Range', 'Risk Level'],
            ['≤ 2', '1', 'Low'],
            ['2-4', '1-4', 'Moderate'],
            ['4-6', '4-7', 'High'],
            ['6-8', '7-9', 'Very High'],
            ['> 8', '10', 'Critical']
        ]);

        // 1.6 Downtime Score
        y = this.drawSubsection(doc, y + 10, '1.6 Downtime Score');
        y = this.drawTable(doc, y, 'Thresholds (Hours per Year):', [
            ['Downtime Hours', 'Score Range', 'Risk Level'],
            ['≤ 24 hrs', '1', 'Low (1 day)'],
            ['24-72 hrs', '1-4', 'Moderate (1-3 days)'],
            ['72-168 hrs', '4-7', 'High (3-7 days)'],
            ['168-336 hrs', '7-9', 'Very High (1-2 weeks)'],
            ['> 336 hrs', '10', 'Critical (2+ weeks)']
        ]);

        // Risk Level Classification
        y = this.drawSubsection(doc, y + 10, '1.7 Risk Level Classification');
        y = this.drawTable(doc, y, 'Overall Score to Risk Level:', [
            ['Score Range', 'Risk Level', 'Recommended Action'],
            ['1-3', 'Low', 'Continue normal operations'],
            ['4-6', 'Medium', 'Monitor closely'],
            ['7-8', 'High', 'Plan replacement within 12 months'],
            ['9-10', 'Critical', 'Replace immediately']
        ]);
    }

    drawFinancialSection(doc) {
        this.drawSectionHeader(doc, '2. Financial & Depreciation Formulas');
        doc.fontSize(10).fillColor('#666666')
           .text('File: services/riskAssessmentService.js', 50, 85);

        let y = 110;

        // 2.1 Current Value
        y = this.drawSubsection(doc, y, '2.1 Current Value (Declining Balance Depreciation)');
        y = this.drawFormula(doc, y, 'Current Value = Purchase Price × (1 - Depreciation Rate)^Age Years');
        y = this.drawNote(doc, y, 'Default depreciation rate: 15% per year');

        // 2.2 Projected Maintenance Cost
        y = this.drawSubsection(doc, y + 10, '2.2 Projected Annual Maintenance Cost');
        y = this.drawFormula(doc, y, 'Maintenance Trend = 1 + (Age Years × 0.05)');
        y = this.drawFormula(doc, y, 'Projected Cost = 12-Month Actual Cost × Maintenance Trend');
        y = this.drawNote(doc, y, 'Assumes 5% cost increase per year of equipment age');

        // 2.3 Replacement Analysis
        y = this.drawSubsection(doc, y + 10, '2.3 Replacement Cost Analysis');
        y = this.drawFormula(doc, y, 'Replacement Cost = Purchase Price × 1.2');
        y = this.drawNote(doc, y, 'Assumes 20% price increase for new model');

        y = this.drawSubsection(doc, y + 10, '2.4 Savings If Replaced (3-Year Analysis)');
        y = this.drawFormula(doc, y, 'Continue Cost = (Projected Maintenance + Projected Downtime) × Years');
        y = this.drawFormula(doc, y, 'New Unit Annual Cost = Purchase Price × 0.03');
        y = this.drawFormula(doc, y, 'Replace Cost = Replacement Cost + (New Unit Cost × Years)');
        y = this.drawFormula(doc, y, 'Savings = Continue Cost - Replace Cost + Trade-in Value');

        // New page
        doc.addPage();
        y = 50;

        // 2.5 ROI
        y = this.drawSubsection(doc, y, '2.5 ROI If Replaced');
        y = this.drawFormula(doc, y, 'Net Replacement Cost = Replacement Cost - Trade-in Value');
        y = this.drawFormula(doc, y, 'ROI = (Savings If Replaced / Net Replacement Cost) × 100');

        // 2.6 Payback Period
        y = this.drawSubsection(doc, y + 10, '2.6 Payback Period');
        y = this.drawFormula(doc, y, 'Annual Savings = Savings If Replaced / 3');
        y = this.drawFormula(doc, y, 'Payback Months = Net Replacement Cost / (Annual Savings / 12)');

        // 2.7 Remaining Life
        y = this.drawSubsection(doc, y + 10, '2.7 Remaining Useful Life');
        y = this.drawFormula(doc, y, 'Remaining Life (Months) = Max(0, (Expected Life Years - Age Years) × 12)');
        y = this.drawNote(doc, y, 'Default expected life: 10 years');
    }

    drawPredictiveMaintenanceSection(doc) {
        this.drawSectionHeader(doc, '3. Predictive Maintenance Formulas');
        doc.fontSize(10).fillColor('#666666')
           .text('File: services/predictiveMaintenanceService.js', 50, 85);

        let y = 110;

        // 3.1 Usage Rate
        y = this.drawSubsection(doc, y, '3.1 Usage Rate Calculation');
        y = this.drawFormula(doc, y, 'Hours Per Day = (Last Reading - First Reading) / Days Elapsed');
        y = this.drawFormula(doc, y, 'Hours Per Week = Hours Per Day × 7');
        y = this.drawFormula(doc, y, 'Hours Per Month = Hours Per Day × 30');
        y = this.drawFormula(doc, y, 'Projected Annual Hours = Hours Per Day × 365');

        // 3.2 Service Prediction
        y = this.drawSubsection(doc, y + 10, '3.2 Service Prediction');
        y = this.drawFormula(doc, y, 'Hours Remaining = Next Service Hours - Current Hours');
        y = this.drawFormula(doc, y, 'Days Until Service = Hours Remaining / Hours Per Day');
        y = this.drawFormula(doc, y, 'Predicted Service Date = Today + Days Until Service');

        y = this.drawTable(doc, y, 'Confidence Scoring:', [
            ['Data Points', 'Confidence'],
            ['≥ 10 readings', '90%'],
            ['5-9 readings', '75%'],
            ['< 5 readings', '60%']
        ]);

        // 3.3 Component Health
        y = this.drawSubsection(doc, y + 10, '3.3 Component Health');
        y = this.drawFormula(doc, y, 'Life Used % = (Hours Since Service / Expected Hours) × 100');
        y = this.drawFormula(doc, y, 'Remaining Hours = Expected Hours - Hours Since Service');

        y = this.drawTable(doc, y, 'Component Lifecycle Defaults:', [
            ['Component', 'Expected Hours', 'Warning Threshold'],
            ['Drive Motor', '15,000', '80%'],
            ['Hydraulic Pump', '8,000', '85%'],
            ['Brake Pads', '2,000', '80%'],
            ['Battery', '6,000', '85%'],
            ['Mast Chain', '6,000', '80%'],
            ['Lift Cylinder', '10,000', '85%'],
            ['Tires', '3,000', '75%']
        ]);

        // New page
        doc.addPage();
        y = 50;

        // 3.4 Urgency Score
        y = this.drawSubsection(doc, y, '3.4 Urgency Score Calculation (0-100)');
        y = this.drawTable(doc, y, 'Point Values:', [
            ['Condition', 'Points Added'],
            ['Service due ≤ 7 days', '+30'],
            ['Service due 8-14 days', '+20'],
            ['Service due 15-30 days', '+10'],
            ['Critical failure pattern detected', '+40'],
            ['High urgency failure pattern', '+25'],
            ['Medium urgency pattern', '+15'],
            ['Each critical component', '+35'],
            ['Each warning component', '+15']
        ]);
        y = this.drawFormula(doc, y + 5, 'Final Score = Min(100, Sum of Points)');

        // 3.5 Status Classification
        y = this.drawSubsection(doc, y + 10, '3.5 Status Classification');
        y = this.drawTable(doc, y, 'Urgency Score to Status:', [
            ['Urgency Score', 'Status', 'Action Required'],
            ['≥ 50', 'Critical', 'Immediate attention required'],
            ['30-49', 'Warning', 'Schedule maintenance soon'],
            ['< 30', 'OK', 'Normal operations']
        ]);
    }

    drawHourMeterSection(doc) {
        this.drawSectionHeader(doc, '4. Hour Meter & Anomaly Detection');
        doc.fontSize(10).fillColor('#666666')
           .text('File: services/hourMeterService.js', 50, 85);

        let y = 110;

        // 4.1 Trend Analysis
        y = this.drawSubsection(doc, y, '4.1 Hour Meter Trend Analysis');
        y = this.drawFormula(doc, y, 'Total Hours Added = Last Reading - First Reading');
        y = this.drawFormula(doc, y, 'Days Covered = (Last Date - First Date) / (1000 × 60 × 60 × 24)');
        y = this.drawFormula(doc, y, 'Average Daily Hours = Total Hours Added / Days Covered');
        y = this.drawFormula(doc, y, 'Average Weekly Hours = Average Daily Hours × 7');
        y = this.drawFormula(doc, y, 'Projected Annual Hours = Average Daily Hours × 365');

        // 4.2 Anomaly Detection
        y = this.drawSubsection(doc, y + 10, '4.2 Anomaly Detection Thresholds');
        y = this.drawTable(doc, y, 'Anomaly Types:', [
            ['Anomaly Type', 'Threshold', 'Description'],
            ['Backward Reading', 'Any negative', 'Hours went backwards'],
            ['Jump Reading', '> 100 hours', 'Single entry exceeds limit'],
            ['Daily Maximum', '24 hours/day', 'Exceeds possible daily use'],
            ['Weekly Maximum', '120 hours/week', 'Exceeds 5-day × 24hr'],
            ['Monthly Maximum', '500 hours/month', 'Exceeds reasonable monthly use']
        ]);

        // 4.3 Exceeds Possible
        y = this.drawSubsection(doc, y + 10, '4.3 Exceeds Possible Check');
        y = this.drawFormula(doc, y, 'Max Possible Hours = Min(Time Elapsed Hours, 24 × Days Elapsed)');
        y = this.drawFormula(doc, y, 'Flagged = Delta > (Max Possible × 1.5)');
        y = this.drawNote(doc, y, '50% buffer allows for rounding and timing differences');

        // 4.4 Fleet Average
        y = this.drawSubsection(doc, y + 10, '4.4 Fleet Average Daily Hours');
        y = this.drawFormula(doc, y, 'For each valid reading where 0 < delta ≤ 24:');
        y = this.drawFormula(doc, y, '   Total Daily Hours += Reading Delta');
        y = this.drawFormula(doc, y, '   Valid Readings++');
        y = this.drawFormula(doc, y, 'Average Daily Hours = Total Daily Hours / Valid Readings');
    }

    drawDowntimeSection(doc) {
        this.drawSectionHeader(doc, '5. Downtime & Cost Calculations');
        doc.fontSize(10).fillColor('#666666')
           .text('File: services/downtimeService.js', 50, 85);

        let y = 110;

        // 5.1 Downtime Cost
        y = this.drawSubsection(doc, y, '5.1 Downtime Cost Calculation');
        y = this.drawFormula(doc, y, 'Downtime Cost = Duration Hours × Cost Per Hour');
        y = this.drawNote(doc, y, 'Default cost per hour: $150');

        // 5.2 Total Event Cost
        y = this.drawSubsection(doc, y + 10, '5.2 Total Downtime Event Cost');
        y = this.drawFormula(doc, y, 'Total Cost = Downtime Cost + Rental Cost + Maintenance Cost');
        y = this.drawTable(doc, y, 'Cost Components:', [
            ['Component', 'Description'],
            ['Downtime Cost', 'Duration × Hourly Rate'],
            ['Rental Cost', 'Sum of rental.total_cost'],
            ['Maintenance Cost', 'Associated maintenance record cost']
        ]);

        // 5.3 Downtime by Root Cause
        y = this.drawSubsection(doc, y + 10, '5.3 Downtime by Root Cause');
        y = this.drawFormula(doc, y, 'For each downtime event:');
        y = this.drawFormula(doc, y, '   By Cause[Root Cause].count++');
        y = this.drawFormula(doc, y, '   By Cause[Root Cause].hours += Duration Hours');
        y = this.drawFormula(doc, y, '   By Cause[Root Cause].cost += Duration × Hourly Rate');

        // 5.4 Monthly Aggregation
        y = this.drawSubsection(doc, y + 10, '5.4 Fleet Downtime Analysis');
        y = this.drawFormula(doc, y, 'Monthly Aggregation:');
        y = this.drawFormula(doc, y, '   Monthly Data[Month].events++');
        y = this.drawFormula(doc, y, '   Monthly Data[Month].hours += Duration Hours');
        y = this.drawFormula(doc, y, '   Monthly Data[Month].cost += Duration × Hourly Rate');
    }

    drawAnalyticsSection(doc) {
        this.drawSectionHeader(doc, '6. Analytics & KPIs');
        doc.fontSize(10).fillColor('#666666')
           .text('File: routes/api/v1/analytics.js', 50, 85);

        let y = 110;

        // 6.1 Fleet Utilization
        y = this.drawSubsection(doc, y, '6.1 Fleet Utilization Rate');
        y = this.drawFormula(doc, y, 'Fleet Utilization = (Active Units / Total Units) × 100');

        // 6.2 Average Cost Per Unit
        y = this.drawSubsection(doc, y + 10, '6.2 Average Maintenance Cost Per Unit');
        y = this.drawFormula(doc, y, 'Avg Cost/Unit = Yearly Maintenance Cost / Total Units');

        // 6.3 Average Downtime
        y = this.drawSubsection(doc, y + 10, '6.3 Average Downtime Per Unit');
        y = this.drawFormula(doc, y, 'Avg Downtime/Unit = Total Downtime Hours / Total Units');

        // 6.4 Cost Trend
        y = this.drawSubsection(doc, y + 10, '6.4 Maintenance Cost Trend');
        y = this.drawFormula(doc, y, 'Cost Trend % = ((Latest Month Cost - First Month Cost) / First Month Cost) × 100');

        // 6.5 Cost Per Hour
        y = this.drawSubsection(doc, y + 10, '6.5 Cost Per Operating Hour');
        y = this.drawFormula(doc, y, 'Cost/Hour = Yearly Maintenance Cost / (Avg Hours × Total Units)');

        // 6.6 Cost Composition
        y = this.drawSubsection(doc, y + 10, '6.6 Cost Composition Percentages');
        y = this.drawFormula(doc, y, 'Maintenance % = (Maintenance Cost / Total Cost) × 100');
        y = this.drawFormula(doc, y, 'Downtime % = (Downtime Cost / Total Cost) × 100');
        y = this.drawFormula(doc, y, 'Rental % = (Rental Cost / Total Cost) × 100');

        // 6.7 Location Metrics
        y = this.drawSubsection(doc, y + 10, '6.7 Location Performance Metrics');
        y = this.drawFormula(doc, y, 'Location Avg Risk = Sum of Unit Risk Scores / Unit Count');
        y = this.drawFormula(doc, y, 'Location Avg Cost/Unit = Total Location Maintenance / Unit Count');

        // 6.8 Maintenance Calculations
        y = this.drawSubsection(doc, y + 10, '6.8 Maintenance Record Calculations');
        y = this.drawFormula(doc, y, 'Total Cost = Labor Cost + Parts Cost + Diagnostic Cost + Other Cost');
        y = this.drawFormula(doc, y, 'Next Service Date = Completion Date + Service Interval Days');
        y = this.drawFormula(doc, y, 'Next Service Hours = Current Hours + Service Interval Hours');
        y = this.drawNote(doc, y, 'Default intervals: 90 days or 250 hours');
    }

    // Helper methods
    drawSectionHeader(doc, title) {
        doc.rect(0, 0, 612, 70).fill('#1e3a5f');
        doc.fontSize(20).fillColor('#ffffff').text(title, 50, 30);
    }

    drawSubsection(doc, y, title) {
        doc.fontSize(12).fillColor('#1e3a5f').text(title, 50, y);
        doc.moveTo(50, y + 16).lineTo(350, y + 16).stroke('#cccccc');
        return y + 25;
    }

    drawFormula(doc, y, formula) {
        doc.fontSize(10).fillColor('#333333')
           .font('Courier').text(formula, 60, y);
        doc.font('Helvetica');
        return y + 16;
    }

    drawNote(doc, y, note) {
        doc.fontSize(9).fillColor('#666666')
           .text('Note: ' + note, 60, y, { oblique: true });
        return y + 14;
    }

    drawTable(doc, y, title, data) {
        doc.fontSize(10).fillColor('#666666').text(title, 60, y);
        y += 15;

        const colWidths = [150, 120, 180];
        const startX = 60;
        let rowHeight = 18;

        // Header row
        doc.fillColor('#f0f0f0').rect(startX, y, 450, rowHeight).fill();
        doc.fillColor('#333333').fontSize(9);
        let x = startX + 5;
        data[0].forEach((cell, i) => {
            doc.text(cell, x, y + 4, { width: colWidths[i] - 10 });
            x += colWidths[i];
        });
        y += rowHeight;

        // Data rows
        doc.fillColor('#333333').fontSize(9);
        for (let i = 1; i < data.length; i++) {
            if (i % 2 === 0) {
                doc.fillColor('#f8f8f8').rect(startX, y, 450, rowHeight).fill();
            }
            doc.fillColor('#333333');
            x = startX + 5;
            data[i].forEach((cell, j) => {
                doc.text(cell, x, y + 4, { width: colWidths[j] - 10 });
                x += colWidths[j];
            });
            y += rowHeight;
        }

        return y + 5;
    }
}

module.exports = new FormulasPdfService();
