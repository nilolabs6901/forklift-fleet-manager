# Fleet Shield — Forklift Fleet Management SaaS

## Executive Summary

Fleet Shield is a B2B SaaS platform for forklift fleet management. It's built for organizations operating forklift/material-handling fleets large enough that manual management has become a cost and risk center. Fleet Shield provides real-time tracking, predictive maintenance, AI-powered invoice parsing and discrepancy detection, fleet risk scoring, WhatsApp/SMS field agent, and centralized fleet/cost/maintenance visibility — all to eliminate the two biggest cost leaks: downtime and invoice overcharges.

Built by people from inside the forklift dealership world, Fleet Shield targets real operational problems — not generic fleet software.

---

## Core Capabilities

### Who Fleet Shield Is For (ICP)

**Firmographics:** Warehousing, distribution, third-party logistics (3PL), and manufacturing operations. Sized by truck count — fleet size matters, not revenue or headcount. Single large facilities or multi-site operators. US-based to start.

**Buyer personas:** Operations leaders, fleet/facility managers, warehouse and distribution center managers, supply chain and logistics directors, and C-suite/ownership at smaller operators. Practical, operations-minded buyers — not technical buyers. Keep messaging concrete and outcome-focused.

**Poor fit:** Operations with only a handful of trucks, businesses with no in-house material-handling fleet, price-only buyers indifferent to downtime or invoice accuracy.

### 1. Fleet Inventory Management

**What it does:**
- Maintains a complete database of all forklifts in the fleet
- Tracks key equipment details: make, model, serial number, year, capacity, fuel type
- Monitors current operating hours for each unit
- Assigns equipment to specific locations/warehouses
- Tracks equipment status (active, in maintenance, out of service, retired)

**Key Benefits:**
- Single source of truth for all fleet equipment — no more spreadsheets and tribal knowledge
- Quick access to any unit's complete history
- Easy identification of equipment by location, status, or risk level

**How it works:**
- Each forklift has a unique ID (e.g., FL-0001, FT-0103)
- Equipment can be filtered by status, location, risk level, or searched by any field
- Detailed view shows complete equipment profile including maintenance history, alerts, hour meter trends, and downtime events

---

### 2. Maintenance Management

**What it does:**
- Tracks all maintenance activities: preventive, repair, emergency, inspection, warranty, recall
- Records service details: date, technician, vendor, costs (labor, parts, diagnostic)
- Links maintenance records to original invoices
- Schedules upcoming maintenance based on hours or calendar intervals
- Calculates maintenance costs per unit, location, and fleet-wide

**Maintenance Types Supported:**
- **Preventive (PM):** Scheduled maintenance (PM-A, PM-B, PM-C cycles)
- **Repair:** Unplanned fixes for breakdowns or malfunctions
- **Emergency:** Urgent repairs requiring immediate attention
- **Inspection:** Safety inspections, OSHA compliance, certifications
- **Warranty:** Repairs covered under manufacturer warranty
- **Recall:** Manufacturer-initiated service campaigns

**Key Benefits:**
- Complete service history for every unit — no more lost work orders
- Cost tracking and analysis by type, vendor, and equipment
- Proactive maintenance scheduling to prevent breakdowns
- Invoice linking for audit trails and cost verification

---

### 3. Automated Invoice Processing (Email-to-Invoice Workflow)

**What it does:**
- Receives invoices via email from service vendors
- Uses AI (Claude Vision) to automatically extract invoice data:
  - Vendor name, invoice number, date
  - PO number, service description
  - Line items with quantities and prices
  - Labor costs, parts costs, tax, total
  - Equipment identifiers (unit ID, serial number, make/model)
- Automatically matches invoices to the correct forklift in the fleet
- Creates maintenance records from invoice data
- Generates downloadable PDF copies of all invoices
- Tracks automatic downtime based on service type

**How Matching Works:**
- System looks for serial number matches (highest confidence)
- Checks unit ID references in invoice text
- Matches make/model combinations
- Considers location information
- Calculates confidence score (0-100%)
- Auto-processes invoices with 80%+ confidence match

**Key Benefits:**
- Eliminates manual data entry from invoices — saves hours per week
- Catches overcharges and discrepancies before you pay
- Reduces errors in maintenance record creation
- Faster processing of vendor invoices
- Automatic cost allocation to correct equipment
- Audit trail linking invoices to maintenance records

**Demo Mode:**
- System includes a demo simulation feature
- Click to simulate receiving different invoice types:
  - Preventive Maintenance invoices
  - Repair Service invoices
  - Safety Inspection invoices
  - Random invoice types
- Shows real-time processing in live activity feed
- Demonstrates PDF generation and auto-matching

---

### 4. Automatic Downtime Tracking

**What it does:**
- Automatically creates downtime events when maintenance invoices are processed
- Categorizes downtime by type:
  - **Planned:** Scheduled PM, inspections
  - **Unplanned:** Unexpected repairs
  - **Emergency:** Critical breakdowns
- Determines root cause from invoice descriptions:
  - Mechanical failure (engine, transmission, hydraulics)
  - Electrical failure (battery, motor, wiring)
  - Operator error
  - Accident/collision
  - Parts delay
  - Inspection requirements
- Estimates downtime duration from labor hours on invoice
- Calculates downtime cost based on configurable hourly rate ($150/hour default)

**Key Benefits:**
- No manual downtime logging required — automated from invoice processing
- Accurate downtime cost tracking (configurable hourly rate, default $150/hr)
- Root cause analysis for fleet-wide patterns
- Supports data-driven decisions on repair vs. replace

---

### 3. AI Invoice Parsing & Discrepancy Detection

**What it does:**
- Uses AI (Claude Vision) to extract, validate, and flag invoice line items
- Detects price discrepancies, duplicate charges, and suspicious billing patterns
- Compares invoiced amounts against expected rates and historical benchmarks
- Auto-generates PDF copies and links invoices to the correct forklift
- Alerts fleet managers when a vendor invoice looks wrong before payment

**Why it matters:**
- Vendor invoice errors and overcharges are a silent cost center — Fleet Shield catches them
- Fleet managers stop blindly approving invoices from unknown vendors
- Every dollar spent on maintenance is verified, not guessed

---

---

### 5. Risk Assessment & Analysis

**What it does:**
- Calculates risk scores for each unit based on:
  - Equipment age
  - Operating hours
  - Maintenance history frequency
  - Cost trends
  - Downtime history
- Categorizes units as: Low, Medium, High, or Critical risk
- Generates replacement recommendations
- Creates budget projections for fleet renewal

**Risk Levels:**
- **Low Risk:** Equipment in good condition, minimal issues
- **Medium Risk:** Some concerns, increased monitoring recommended
- **High Risk:** Significant issues, replacement planning advised
- **Critical Risk:** Immediate attention required, safety concerns possible

**Key Benefits:**
- Proactive identification of problem equipment
- Data-driven replacement decisions
- Budget planning for fleet renewal
- Reduced unexpected breakdowns

---

### 5. Fleet Risk Scoring Engine

**What it does:**
- Calculates a risk score for each unit based on equipment age, operating hours, maintenance history frequency, cost trends, and downtime history
- Categorizes units as: Low, Medium, High, or Critical risk
- Generates replacement recommendations with cost impact estimates
- Creates budget projections for fleet renewal

**Why it matters:**
- Fleet managers can prioritize which units to repair, which to replace, and when to budget
- Reduces surprise breakdowns on critical production equipment
- Moves fleet management from reactive firefighting to proactive planning

---

### 6. Location Management

**What it does:**
- Manages multiple warehouse/facility locations
- Tracks equipment assigned to each location
- Monitors location capacity and utilization
- Calculates monthly maintenance spend per location
- Stores service center contact information per location

**Location Types Supported:**
- Warehouse
- Distribution Center
- Manufacturing facility
- Retail location
- Other custom types

**Key Metrics Per Location:**
- Number of forklifts assigned
- Total capacity
- Utilization percentage
- Monthly maintenance costs
- Service contact information

---

### 7. Alerts & Notifications

**What it does:**
- Generates alerts for various conditions:
  - Maintenance due/overdue
  - Hour meter thresholds exceeded
  - Risk level changes
  - Inspection expirations
  - Cost thresholds exceeded
- Categorizes by severity: Critical, High, Medium, Low
- Tracks alert resolution status
- Maintains alert history for analysis

**Alert Types:**
- **Maintenance Due:** PM scheduled within threshold
- **Overdue Service:** Missed scheduled maintenance
- **Hours Exceeded:** Operating hours past service interval
- **High Risk:** Equipment flagged as high/critical risk
- **Cost Alert:** Unit exceeding cost thresholds
- **Inspection Expiring:** Safety certifications due

---

### 8. Hour Meter Management

**What it does:**
- Tracks operating hours for each unit
- Logs hour meter readings with timestamps
- Flags suspicious readings (decreases, large jumps)
- Calculates daily/weekly usage patterns
- Triggers maintenance alerts based on hour intervals

**Validation Features:**
- Detects readings lower than previous (potential tampering or error)
- Flags unusually large increases
- Admin review queue for flagged readings
- Correction workflow with audit trail

---

### 9. Reporting & Analytics

**What it does:**
- Generates comprehensive reports:
  - Fleet overview and status
  - Maintenance cost analysis
  - Downtime analysis
  - Risk distribution
  - Location comparisons
  - Vendor spend analysis
- Visualizes data with charts and graphs
- Supports date range filtering
- Export capabilities for external analysis

**Report Types:**
- **Dashboard:** Real-time fleet status overview
- **Maintenance Reports:** Cost trends, service frequency, vendor analysis
- **Downtime Reports:** Hours lost, cost impact, root cause breakdown
- **Risk Analysis:** Fleet risk distribution, replacement recommendations
- **Budget Planning:** Projected maintenance and replacement costs

---

### 10. Budget Planning

**What it does:**
- Projects maintenance costs based on historical data
- Calculates replacement budget needs
- Considers equipment age and risk levels
- Provides fiscal year planning tools
- Tracks actual vs. budgeted spending

---

### 11. Rental Equipment Tracking

**What it does:**
- Tracks rental units when owned equipment is down
- Records rental costs and duration
- Links rentals to downtime events
- Calculates total cost of ownership including rental expenses

---

### 12. Predictive Maintenance

**What it does:**
- Analyzes historical maintenance patterns
- Predicts upcoming maintenance needs
- Identifies units likely to have issues
- Recommends preventive actions
- Optimizes PM scheduling

---

## Technical Specifications

### Architecture
- **Backend:** Node.js with Express framework
- **Database:** SQLite (lightweight, serverless)
- **Frontend:** EJS templates with Bootstrap 5
- **Hosting:** Railway.app (cloud deployment)
- **AI Integration:** Claude Vision API for invoice processing

### Data Security
- All data stored in encrypted database
- No sensitive financial data stored (references only)
- Secure API endpoints
- Session-based authentication ready

### Integration Capabilities
- **Email Webhooks:** Accepts invoices via email webhook (Mailgun, SendGrid, Power Automate compatible)
- **REST API:** Full API for external system integration
- **PDF Generation:** On-demand invoice PDF creation
- **Export:** Data export capabilities for reporting

---

## User Interface

### Navigation Structure
**Main Menu:**
- Dashboard (home)
- Fleet Inventory
- Maintenance
- Invoice Workflow (Demo)
- Alerts
- Locations

**Analytics:**
- Predictions
- Reports
- Risk Analysis
- Downtime
- Budget

**Admin:**
- Hour Meter Review
- Settings

### Key UI Features
- Modern glassmorphism design
- Responsive layout (desktop and tablet)
- Real-time updates without page refresh
- Interactive charts and visualizations
- Toast notifications for actions
- Modal dialogs for data entry

---

## Frequently Asked Questions (FAQ)

### General

**Q: How many forklifts can the system manage?**
A: Fleet Shield is designed for operations with fleets large enough that manual management is a cost center — typically 10+ units, scaling to hundreds across multiple locations. Small operations with just a handful of trucks won't see enough ROI to justify the investment.

**Q: Who is Fleet Shield for?**
A: Warehousing, distribution, 3PL, and manufacturing operations. Operators who lose money from downtime, get overcharged by vendors, and waste time on spreadsheets. If you manage a forklift fleet and it's a pain point, Fleet Shield is for you.

**Q: Is the data backed up?**
A: Yes, the cloud deployment includes automatic backups. Data can also be exported for local backup.

**Q: Can we track equipment other than forklifts?**
A: Yes, the system can track any mobile equipment with similar maintenance needs (pallet jacks, reach trucks, order pickers, etc.).

**Q: Is the data backed up?**
A: Yes, the cloud deployment includes automatic backups. Data can also be exported for local backup.

### Invoice Processing

**Q: How do vendors send invoices to the system?**
A: Vendors email invoices to a dedicated email address. The system receives them via webhook and processes automatically.

**Q: What if the system can't match an invoice to equipment?**
A: Invoices with low confidence matches go to a review queue where staff can manually match them.

**Q: What invoice formats are supported?**
A: PDF, PNG, JPG, and other common image formats. The AI can read most invoice layouts.

**Q: How accurate is the AI extraction?**
A: Claude Vision AI achieves high accuracy on standard invoice formats. Users can review and correct any errors.

### Maintenance

**Q: Can we schedule recurring maintenance?**
A: Yes, PM schedules can be set based on calendar intervals or operating hours.

**Q: How does the system know when maintenance is due?**
A: It tracks hours and dates, comparing against configured service intervals for each equipment type.

**Q: Can we track warranty repairs separately?**
A: Yes, warranty is a distinct maintenance type with separate cost tracking.

### Reporting

**Q: Can we generate reports for specific date ranges?**
A: Yes, most reports support custom date range filtering.

**Q: Can reports be exported?**
A: Yes, data can be exported for use in Excel or other analysis tools.

**Q: Can we share reports with stakeholders?**
A: Yes, there's a report sharing feature with secure, expiring links.

### Costs

**Q: How are maintenance costs calculated?**
A: Costs are captured from invoices including labor, parts, diagnostic fees, and other charges.

**Q: Can we track costs by location?**
A: Yes, the system shows monthly maintenance spend per location and fleet-wide.

**Q: How is downtime cost calculated?**
A: Downtime cost = hours down × configured hourly rate (default $150/hour, customizable).

---

## Implementation & Onboarding

### Getting Started
1. **Data Import:** Upload existing equipment list (make, model, serial, location)
2. **Location Setup:** Configure warehouse/facility locations
3. **Email Setup:** Configure email webhook for invoice receiving
4. **User Training:** Brief training on system navigation and features
5. **Vendor Communication:** Inform vendors of new invoice email address

### Typical Timeline
- Initial setup: 1-2 days
- Data migration: 1-3 days depending on data quality
- Training: 2-4 hours
- Full operation: Within 1 week

---

## Support & Maintenance

### System Updates
- Regular feature updates and improvements
- Security patches applied automatically
- No downtime for most updates

### Support Channels
- WhatsApp/SMS field agent — fleet managers and operators communicate via mobile
- Email support
- Documentation and help guides
- Video tutorials (coming soon)

---

## Competitive Advantages

1. **Built by Forklift Dealership Insiders:** Fleet Shield was built by people who lived inside the forklift dealership world. We target the real cost leaks — downtime plus invoice overcharges — not generic fleet software that misses what actually costs operators money.
2. **AI-Powered Invoice Parsing & Discrepancy Detection:** Catches vendor overcharges before you pay. Automatic data extraction eliminates manual entry and catches errors.
3. **Automatic Downtime Tracking:** No manual logging required — derived from invoice processing.
4. **Fleet Risk Scoring Engine:** Data-driven replacement decisions with cost impact estimates.
5. **WhatsApp/SMS Field Agent:** Fleet managers and operators communicate via the tools they already use daily.
6. **Modern User Interface:** Intuitive, responsive design — operations teams adopt it, not resist it.
7. **Cloud-Based:** Access from anywhere, no IT infrastructure required.
8. **Audit Trail:** Complete history linking invoices to maintenance to equipment — every dollar traceable.

---

## Contact Information

For sales inquiries, demos, or technical questions, contact your sales representative.

---

*Document Version: 1.0*
*Last Updated: January 2026*
