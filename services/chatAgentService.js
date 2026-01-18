/**
 * Chat Agent Service
 * AI-powered conversational assistant for fleet data queries and system help
 */

const db = require('../config/sqlite-database');
const predictiveService = require('./predictiveMaintenanceService');

// Knowledge Base - Complete system documentation
const KNOWLEDGE_BASE = {
    system_overview: {
        keywords: ['what is', 'about', 'system', 'fleet manager', 'overview', 'purpose'],
        content: `**Forklift Fleet Manager** is a comprehensive fleet management system designed to help you:

• **Track Equipment** - Monitor all forklifts across multiple locations
• **Manage Maintenance** - Schedule and track preventive and repair maintenance
• **Monitor Risk** - Identify high-risk units that may need replacement
• **Control Costs** - Track maintenance expenses, parts costs, and rental costs
• **Handle Alerts** - Get notified of issues like maintenance overdue, billing discrepancies, and hour meter anomalies

The system provides real-time insights into your fleet's health and helps optimize operations.`
    },

    navigation: {
        keywords: ['navigate', 'menu', 'pages', 'sections', 'where', 'find page', 'go to'],
        content: `**Main Navigation:**

• **Dashboard** (/) - Fleet overview with key metrics and charts
• **Fleet Inventory** (/forklifts) - List all forklifts with filters
• **Maintenance** (/maintenance) - View and manage maintenance records
• **Alerts** (/alerts) - Monitor active alerts and notifications
• **Locations** (/locations) - Manage warehouse/facility locations
• **Reports** (/reports) - View analytics and reports
• **Risk Analysis** (/risk-analysis) - Assess equipment risk levels
• **Downtime** (/downtime) - Track downtime events
• **Budget** (/budget) - Cost tracking and budgets
• **Hour Meter Review** (/hour-meter-review) - Review flagged readings
• **Settings** (/settings) - System configuration`
    },

    dashboard: {
        keywords: ['dashboard', 'home', 'main page', 'overview page'],
        content: `**Dashboard Features:**

The dashboard provides an at-a-glance view of your fleet status:

• **Fleet Statistics** - Total units, active, in maintenance, out of service
• **Alert Summary** - Critical and high priority alerts requiring attention
• **Risk Distribution** - Breakdown of fleet by risk level
• **Maintenance Chart** - Visual of upcoming maintenance needs
• **Location Overview** - Units per location

Click any stat card to drill down into the details.`
    },

    forklifts: {
        keywords: ['forklift', 'unit', 'equipment', 'fleet inventory', 'add forklift', 'edit forklift'],
        content: `**Fleet Inventory Features:**

**Viewing Forklifts:**
• Use filters to search by location, status, fuel type, or risk level
• Click any row to view detailed information
• Thumbnail images show equipment type

**Forklift Detail Page includes:**
• Equipment specs (model, serial, capacity)
• Hour meter with usage trends
• Service schedule and history
• Risk assessment scores
• Active alerts
• Maintenance cost summary
• Service center contact info

**Actions:**
• **Log Maintenance** - Record new service work
• **Update Hours** - Enter new hour meter reading
• **Edit** - Modify forklift information`
    },

    maintenance: {
        keywords: ['maintenance', 'service', 'repair', 'pm', 'preventive', 'work order', 'invoice'],
        content: `**Maintenance Management:**

**Types of Maintenance:**
• **Preventive (PM)** - Scheduled maintenance based on hours/time
• **Repair** - Fix breakdowns or issues
• **Emergency** - Urgent unplanned repairs
• **Inspection** - Safety and compliance checks

**Creating a Maintenance Record:**
1. Go to Maintenance > Add Record (or from forklift detail)
2. Select the forklift
3. Choose type and category
4. Enter service details and costs
5. Add invoice number for tracking

**Invoice PDFs:**
• Completed maintenance with invoice numbers can generate PDF invoices
• Click the invoice link to view/download the PDF

**Alerts:**
• System creates alerts for overdue maintenance
• Repair time overruns are flagged when work exceeds standard times`
    },

    alerts: {
        keywords: ['alert', 'notification', 'warning', 'critical', 'resolve', 'acknowledge'],
        content: `**Alert Management:**

**Alert Types:**
• **Maintenance Due/Overdue** - Upcoming or past-due service
• **High Risk** - Equipment flagged for replacement consideration
• **Hour Anomaly** - Suspicious hour meter readings
• **Billing Discrepancy** - Potential invoice issues
• **Repair Time Overrun** - Work took longer than expected

**Severity Levels:**
• 🔴 **Critical** - Immediate attention required
• 🟠 **High** - Address soon
• 🟡 **Medium** - Monitor and plan
• 🟢 **Low** - Informational

**Managing Alerts:**
• Click ✓ to resolve an alert
• Add resolution notes for documentation
• Use filters to view by severity or type
• Invoice links are shown for billing alerts`
    },

    locations: {
        keywords: ['location', 'warehouse', 'facility', 'site', 'service center'],
        content: `**Location Management:**

Each location represents a warehouse, distribution center, or facility:

**Location Details:**
• Address and contact information
• Forklift count and status breakdown
• Service center contact (phone, email, point of contact)

**Service Center Contact:**
• Each location can have assigned service center info
• Quick access to call or email for service requests
• Displayed on both location and forklift detail pages`
    },

    risk_assessment: {
        keywords: ['risk', 'assessment', 'score', 'replace', 'replacement', 'lifecycle'],
        content: `**Risk Assessment System:**

**Risk Scores (1-10):**
• **1-3**: Low risk - Continue normal operation
• **4-6**: Medium risk - Monitor closely
• **7-8**: High risk - Plan for replacement
• **9-10**: Critical risk - Replace immediately

**Risk Factors:**
• **Age Score** - Equipment age vs expected lifespan
• **Hours Score** - Operating hours vs expected hours
• **Maintenance Cost** - Repair frequency and costs
• **Downtime Score** - Frequency of breakdowns

**Recommendations:**
• **Continue** - Equipment in good condition
• **Monitor** - Watch for increasing issues
• **Replace** - Consider replacement planning`
    },

    hour_meter: {
        keywords: ['hour', 'meter', 'hours', 'reading', 'anomaly', 'flagged'],
        content: `**Hour Meter Tracking:**

**Recording Hours:**
• Update from forklift detail page
• System tracks all readings with timestamps
• Calculates daily/weekly averages

**Anomaly Detection:**
• System flags unusual readings:
  - Hours going backward (possible error)
  - Unusually large jumps
  - Suspicious patterns

**Hour Meter Review:**
• Access from Admin menu
• Review and validate flagged readings
• Correct erroneous entries`
    },

    costs: {
        keywords: ['cost', 'expense', 'budget', 'spending', 'price', 'money', 'dollars'],
        content: `**Cost Tracking:**

**Maintenance Costs:**
• Labor costs per service
• Parts costs
• Diagnostic fees
• Total cost per maintenance record

**Cost Summaries:**
• 12-month cost summary per forklift
• Location-based cost rollups
• Budget vs actual comparisons

**Rental Costs:**
• Track rental equipment during downtime
• Rental company and daily rates
• Total rental expenses`
    },

    downtime: {
        keywords: ['downtime', 'down', 'offline', 'out of service', 'breakdown'],
        content: `**Downtime Tracking:**

**Recording Downtime:**
• Start time and end time
• Root cause categorization
• Impact and cost calculation

**Root Causes:**
• Mechanical failure
• Electrical failure
• Operator error
• Parts delay
• Scheduled maintenance

**Metrics:**
• Total downtime hours
• Mean time between failures (MTBF)
• Cost impact of downtime`
    },

    reports: {
        keywords: ['report', 'analytics', 'chart', 'graph', 'export', 'data'],
        content: `**Reports & Analytics:**

**Available Reports:**
• Fleet utilization summary
• Maintenance cost analysis
• Risk assessment overview
• Downtime analysis
• Budget tracking

**Viewing Reports:**
• Navigate to Reports section
• Select date ranges
• Filter by location or equipment

**Export Options:**
• PDF invoice generation
• Data can be filtered and analyzed`
    },

    invoices: {
        keywords: ['invoice', 'pdf', 'bill', 'receipt', 'document'],
        content: `**Invoice Management:**

**Invoice Numbers:**
• Generated for completed maintenance (INV-YYYY-NNNNN)
• Linked to work orders

**Viewing Invoices:**
• Click invoice number on maintenance records
• Opens PDF in new tab
• Includes work details, parts, and costs

**Billing Alerts:**
• System flags potential discrepancies
• Repair time overruns linked to invoices
• Click invoice link on alerts to review`
    },

    search: {
        keywords: ['search', 'find', 'look up', 'lookup', 'filter'],
        content: `**Search & Filter Options:**

**Fleet Search:**
• Search bar in top navigation
• Filter by ID, model, or serial number

**Forklift Filters:**
• Location
• Status (active, maintenance, out of service)
• Fuel type
• Risk level

**Alert Filters:**
• Severity level
• Alert type
• Resolution status

**Maintenance Filters:**
• Forklift
• Service type
• Date range`
    },

    predictions: {
        keywords: ['predict', 'prediction', 'predictive', 'forecast', 'component', 'lifecycle', 'failure', 'pattern', 'usage rate', 'expected', 'when will'],
        content: `**Predictive Maintenance:**

The system uses AI-powered analysis to predict maintenance needs before failures occur:

**Types of Predictions:**
• **Service Predictions** - When next PM is due based on usage rate
• **Component Lifecycle** - Estimated remaining life of parts (brakes, tires, hydraulics)
• **Failure Patterns** - Detects warning signs of impending failures

**How It Works:**
• Analyzes hour meter trends to calculate usage rate
• Compares component hours to expected lifespans
• Scans maintenance history for pre-failure patterns

**Dashboard Widget:**
• Shows top predictions with urgency scores
• Critical/Warning/Healthy status counts
• Click any prediction to view forklift details

**API Access:**
• /api/v1/predictions - Full fleet predictions
• /api/v1/predictions/forklift/:id - Unit-specific analysis

Ask me "What maintenance is predicted?" to see current predictions.`
    }
};

class ChatAgentService {
    constructor() {
        // Intent patterns for query classification
        this.intents = {
            fleet_summary: [
                /fleet\s*(summary|overview|status)/i,
                /how many\s*(forklifts|units)/i,
                /total\s*(fleet|forklifts|units)/i,
                /fleet\s*stats/i,
                /give me (a |the )?(summary|overview)/i
            ],
            high_risk: [
                /high\s*risk/i,
                /critical\s*(risk|units|forklifts)/i,
                /risky\s*(units|forklifts)/i,
                /at\s*risk/i,
                /danger(ous)?\s*(units|forklifts)/i
            ],
            maintenance_due: [
                /maintenance\s*(due|overdue|upcoming|scheduled)/i,
                /service\s*(due|needed|required)/i,
                /needs?\s*(service|maintenance)/i,
                /upcoming\s*(service|maintenance)/i,
                /overdue/i
            ],
            active_alerts: [
                /active\s*alerts?/i,
                /current\s*alerts?/i,
                /(show|list|get)\s*alerts?/i,
                /open\s*alerts?/i,
                /alert\s*(status|summary)/i,
                /any\s*alerts?/i
            ],
            find_forklift: [
                /find\s*(forklift|unit)/i,
                /search\s*(for\s*)?(forklift|unit)/i,
                /where\s*is\s*(forklift|unit)?/i,
                /forklift\s*(id\s*)?[A-Z]{2}-\d+/i,
                /^[A-Z]{2}-\d+$/i,
                /look\s*up/i
            ],
            location_info: [
                /location\s*(info|details|summary)/i,
                /(forklifts|units)\s*(at|in)\s*(\w+)/i,
                /which\s*location/i,
                /warehouse|distribution|manufacturing/i
            ],
            cost_info: [
                /cost/i,
                /expense/i,
                /spending/i,
                /budget/i,
                /how much.*spend/i,
                /total\s*spend/i
            ],
            downtime: [
                /downtime/i,
                /down\s*time/i,
                /out\s*of\s*service/i,
                /not\s*working/i,
                /offline/i
            ],
            predictions: [
                /predict(ion|ive|ed)?/i,
                /forecast/i,
                /what.*maintenance.*predict/i,
                /upcoming\s*failures?/i,
                /component\s*(health|life)/i,
                /when\s*will.*fail/i,
                /what.*needs?\s*attention/i,
                /failure\s*pattern/i,
                /usage\s*rate/i
            ],
            help: [
                /^help$/i,
                /what can you/i,
                /capabilities/i
            ],
            // System help intents
            how_to: [
                /how\s*(do|can|to)\s*i/i,
                /how\s*does/i,
                /what\s*is\s*(the|a)\s*(way|process|steps?)/i,
                /explain\s*how/i,
                /show\s*me\s*how/i,
                /walk\s*me\s*through/i,
                /guide/i,
                /tutorial/i
            ],
            what_is: [
                /what\s*(is|are|does)/i,
                /tell\s*me\s*about/i,
                /explain/i,
                /describe/i,
                /meaning\s*of/i,
                /definition/i
            ],
            where_is: [
                /where\s*(is|can|do)/i,
                /how\s*to\s*(find|access|get\s*to|navigate)/i,
                /location\s*of/i
            ]
        };

        // Greeting patterns
        this.greetings = [
            /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening))/i,
            /^(yo|sup|howdy)/i
        ];

        // Thank you patterns
        this.thanks = [
            /thank/i,
            /thanks/i,
            /appreciate/i,
            /helpful/i
        ];
    }

    /**
     * Process a user message and return a response
     */
    async processMessage(message) {
        const trimmedMessage = message.trim();

        // Check for greetings
        if (this.isGreeting(trimmedMessage)) {
            return this.getGreetingResponse();
        }

        // Check for thanks
        if (this.isThanks(trimmedMessage)) {
            return this.getThanksResponse();
        }

        // Extract entities first to check for forklift IDs
        const entities = this.extractEntities(trimmedMessage);

        // If a forklift ID is detected, prioritize finding it
        if (entities.forkliftId) {
            return await this.findForklift(entities, trimmedMessage);
        }

        // Check for system help questions
        const helpTopic = this.findHelpTopic(trimmedMessage);
        if (helpTopic) {
            return { response: helpTopic.content };
        }

        // Classify data query intent
        const intent = this.classifyIntent(trimmedMessage);

        let response;

        switch (intent) {
            case 'fleet_summary':
                response = await this.getFleetSummary();
                break;
            case 'high_risk':
                response = await this.getHighRiskForklifts();
                break;
            case 'maintenance_due':
                response = await this.getMaintenanceDue();
                break;
            case 'active_alerts':
                response = await this.getActiveAlerts();
                break;
            case 'find_forklift':
                response = await this.findForklift(entities, trimmedMessage);
                break;
            case 'location_info':
                response = await this.getLocationInfo(entities, trimmedMessage);
                break;
            case 'cost_info':
                response = await this.getCostInfo();
                break;
            case 'downtime':
                response = await this.getDowntimeInfo();
                break;
            case 'predictions':
                response = await this.getPredictions(entities);
                break;
            case 'help':
                response = this.getHelpMessage();
                break;
            case 'how_to':
            case 'what_is':
            case 'where_is':
                // Try to find relevant help topic
                const topic = this.findHelpTopic(trimmedMessage);
                if (topic) {
                    response = { response: topic.content };
                } else {
                    response = this.getConversationalHelp(trimmedMessage);
                }
                break;
            default:
                // Try knowledge base one more time
                const kb = this.findHelpTopic(trimmedMessage);
                if (kb) {
                    response = { response: kb.content };
                } else {
                    response = this.getDefaultResponse(trimmedMessage);
                }
        }

        return response;
    }

    /**
     * Check if message is a greeting
     */
    isGreeting(message) {
        return this.greetings.some(pattern => pattern.test(message));
    }

    /**
     * Check if message is a thank you
     */
    isThanks(message) {
        return this.thanks.some(pattern => pattern.test(message));
    }

    /**
     * Get greeting response
     */
    getGreetingResponse() {
        const greetings = [
            `Hello! I'm your Fleet Manager assistant. I can help you with:\n\n• **Data queries** - "Fleet summary", "High risk forklifts", "Active alerts"\n• **System help** - "How do I add maintenance?", "What is risk score?"\n• **Finding info** - "Find FL-0001", "Forklifts in Dallas"\n\nWhat would you like to know?`,
            `Hi there! How can I help you today? I can answer questions about your fleet data or explain how to use the system.`,
            `Hello! I'm here to help. Ask me about fleet status, maintenance, alerts, or how to use any feature.`
        ];
        return { response: greetings[Math.floor(Math.random() * greetings.length)] };
    }

    /**
     * Get thanks response
     */
    getThanksResponse() {
        const responses = [
            `You're welcome! Let me know if you need anything else.`,
            `Happy to help! Feel free to ask if you have more questions.`,
            `Glad I could assist! I'm here if you need more help.`
        ];
        return { response: responses[Math.floor(Math.random() * responses.length)] };
    }

    /**
     * Find relevant help topic from knowledge base
     */
    findHelpTopic(message) {
        const lowerMessage = message.toLowerCase();

        // Score each topic based on keyword matches
        let bestMatch = null;
        let bestScore = 0;

        for (const [topic, data] of Object.entries(KNOWLEDGE_BASE)) {
            let score = 0;
            for (const keyword of data.keywords) {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    score += keyword.split(' ').length; // Multi-word matches score higher
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestMatch = data;
            }
        }

        return bestScore > 0 ? bestMatch : null;
    }

    /**
     * Get conversational help for how-to questions
     */
    getConversationalHelp(message) {
        const lowerMessage = message.toLowerCase();

        // Check for specific action keywords
        if (lowerMessage.includes('add') || lowerMessage.includes('create') || lowerMessage.includes('new')) {
            if (lowerMessage.includes('maintenance') || lowerMessage.includes('service')) {
                return {
                    response: `**To add a maintenance record:**

1. Go to **Maintenance** in the sidebar
2. Click **+ Add Record** button
3. Select the forklift from the dropdown
4. Choose the maintenance type (preventive, repair, emergency)
5. Fill in service details, costs, and notes
6. Click **Save**

Or from a forklift detail page, click **Log Maintenance**.`
                };
            }
            if (lowerMessage.includes('forklift') || lowerMessage.includes('unit')) {
                return {
                    response: `**To add a new forklift:**

1. Go to **Fleet Inventory** in the sidebar
2. Click **+ Add Forklift** button
3. Enter equipment details (model, serial, year)
4. Assign to a location
5. Set service intervals
6. Click **Save**`
                };
            }
            if (lowerMessage.includes('alert')) {
                return {
                    response: `**To create a custom alert:**

1. Go to **Alerts** in the sidebar
2. Click **+ Create Alert** button
3. Select forklift (optional for fleet-wide alerts)
4. Choose severity and type
5. Enter title and message
6. Click **Create Alert**`
                };
            }
        }

        if (lowerMessage.includes('update') || lowerMessage.includes('edit') || lowerMessage.includes('change')) {
            if (lowerMessage.includes('hour')) {
                return {
                    response: `**To update hour meter:**

1. Go to the forklift detail page
2. Find the **Hour Meter** card
3. Click **Update** button
4. Enter the new reading
5. Click **Update Hours**

The system will automatically calculate usage trends and flag anomalies.`
                };
            }
        }

        if (lowerMessage.includes('resolve') || lowerMessage.includes('close') || lowerMessage.includes('dismiss')) {
            if (lowerMessage.includes('alert')) {
                return {
                    response: `**To resolve an alert:**

1. Go to **Alerts** page
2. Find the alert you want to resolve
3. Click the green ✓ button
4. The alert will be marked as resolved

You can also resolve alerts from the forklift detail page.`
                };
            }
        }

        if (lowerMessage.includes('view') || lowerMessage.includes('see') || lowerMessage.includes('check')) {
            if (lowerMessage.includes('invoice') || lowerMessage.includes('pdf')) {
                return {
                    response: `**To view an invoice PDF:**

1. Go to **Maintenance** page
2. Find the maintenance record with an invoice number
3. Click the invoice number (e.g., INV-2025-00123)
4. PDF opens in a new tab

Invoice links also appear on billing-related alerts.`
                };
            }
        }

        // Generic how-to response
        return {
            response: `I'd be happy to help! Could you be more specific about what you'd like to do?

**Common tasks:**
• "How do I add maintenance?" - Log service records
• "How do I update hours?" - Record hour meter readings
• "How do I resolve an alert?" - Mark issues as addressed
• "How do I view invoices?" - Access PDF invoices

Or ask about any feature: maintenance, alerts, risk scores, locations, costs, etc.`
        };
    }

    /**
     * Classify the intent of a message
     */
    classifyIntent(message) {
        for (const [intent, patterns] of Object.entries(this.intents)) {
            for (const pattern of patterns) {
                if (pattern.test(message)) {
                    return intent;
                }
            }
        }
        return 'unknown';
    }

    /**
     * Extract entities from message
     */
    extractEntities(message) {
        const entities = {};

        // Extract forklift ID
        const forkliftIdMatch = message.match(/[A-Z]{2}-\d{4}/i);
        if (forkliftIdMatch) {
            entities.forkliftId = forkliftIdMatch[0].toUpperCase();
        }

        // Extract location names
        const locationKeywords = ['atlanta', 'dallas', 'chicago', 'phoenix', 'seattle'];
        for (const loc of locationKeywords) {
            if (message.toLowerCase().includes(loc)) {
                entities.location = loc;
                break;
            }
        }

        // Extract status
        if (/active/i.test(message)) entities.status = 'active';
        if (/maintenance/i.test(message)) entities.status = 'maintenance';
        if (/out.?of.?service/i.test(message)) entities.status = 'out_of_service';

        // Extract time periods
        if (/today/i.test(message)) entities.period = 'today';
        if (/this\s*week/i.test(message)) entities.period = 'week';
        if (/this\s*month/i.test(message)) entities.period = 'month';

        return entities;
    }

    /**
     * Get fleet summary
     */
    async getFleetSummary() {
        const stats = db.forklifts.getStats();
        const alertCount = db.alerts.findAll({ is_resolved: 0 }).length;
        const locations = db.locations.findAll();

        const response = `Here's your **fleet summary**:

**Total Fleet:** ${stats.total} forklifts across ${locations.length} locations

**By Status:**
• Active: ${stats.active || 0} units
• In Maintenance: ${stats.in_maintenance || 0} units
• Out of Service: ${stats.out_of_service || 0} units

**Risk Distribution:**
• Critical: ${stats.critical_risk || 0}
• High: ${stats.high_risk || 0}
• Medium: ${stats.medium_risk || 0}
• Low: ${stats.low_risk || 0}

**Alerts:** ${alertCount} active alerts require attention

[View Dashboard](/) | [View Fleet](/forklifts)`;

        return {
            response,
            data: {
                type: 'table',
                title: 'Fleet Statistics',
                rows: [
                    { label: 'Total Units', value: stats.total },
                    { label: 'Active', value: stats.active },
                    { label: 'Avg Hours', value: Math.round(stats.avg_hours || 0).toLocaleString() },
                    { label: 'Active Alerts', value: alertCount }
                ]
            }
        };
    }

    /**
     * Get high risk forklifts
     */
    async getHighRiskForklifts() {
        const forklifts = db.forklifts.findAll({ riskLevel: 'high' });
        const critical = db.forklifts.findAll({ riskLevel: 'critical' });
        const allHighRisk = [...critical, ...forklifts].slice(0, 10);

        if (allHighRisk.length === 0) {
            return {
                response: `Great news! There are currently **no high-risk forklifts** in your fleet. All units are operating within acceptable risk parameters.

[View Risk Analysis](/reports/risk-analysis)`
            };
        }

        let response = `Found **${critical.length + forklifts.length} high-risk forklifts** that need attention:\n\n`;

        if (critical.length > 0) {
            response += `**Critical Risk (${critical.length}):**\n`;
            critical.slice(0, 3).forEach(fl => {
                response += `• [${fl.id}](/forklifts/${fl.id}) - Score: ${fl.risk_score}/10, ${fl.current_hours?.toLocaleString() || 0} hrs\n`;
            });
        }

        if (forklifts.length > 0) {
            response += `\n**High Risk (${forklifts.length}):**\n`;
            forklifts.slice(0, 5).forEach(fl => {
                response += `• [${fl.id}](/forklifts/${fl.id}) - Score: ${fl.risk_score}/10, ${fl.current_hours?.toLocaleString() || 0} hrs\n`;
            });
        }

        response += `\n[View Full Risk Analysis](/reports/risk-analysis)`;

        return {
            response,
            data: {
                type: 'list',
                title: 'High Risk Units',
                items: allHighRisk.slice(0, 5).map(fl => ({
                    id: fl.id,
                    link: `/forklifts/${fl.id}`,
                    description: `Risk: ${fl.risk_score}/10 | ${fl.current_hours?.toLocaleString() || 0} hrs`
                }))
            }
        };
    }

    /**
     * Get maintenance due
     */
    async getMaintenanceDue() {
        const forklifts = db.forklifts.findAll({});
        const now = new Date();

        const overdue = [];
        const dueSoon = [];

        forklifts.forEach(fl => {
            if (fl.next_service_date) {
                const dueDate = new Date(fl.next_service_date);
                const daysUntil = Math.floor((dueDate - now) / (1000 * 60 * 60 * 24));

                if (daysUntil < 0) {
                    overdue.push({ ...fl, daysOverdue: Math.abs(daysUntil) });
                } else if (daysUntil <= 7) {
                    dueSoon.push({ ...fl, daysUntil });
                }
            }
        });

        let response = `**Maintenance Status:**\n\n`;

        if (overdue.length > 0) {
            response += `**Overdue (${overdue.length} units):**\n`;
            overdue.slice(0, 5).forEach(fl => {
                response += `• [${fl.id}](/forklifts/${fl.id}) - ${fl.daysOverdue} days overdue\n`;
            });
            response += '\n';
        }

        if (dueSoon.length > 0) {
            response += `**Due This Week (${dueSoon.length} units):**\n`;
            dueSoon.slice(0, 5).forEach(fl => {
                response += `• [${fl.id}](/forklifts/${fl.id}) - Due in ${fl.daysUntil} days\n`;
            });
        }

        if (overdue.length === 0 && dueSoon.length === 0) {
            response = `All forklifts are up to date on maintenance. No services are currently overdue or due within the next 7 days.`;
        }

        response += `\n[View Maintenance Schedule](/maintenance)`;

        return { response };
    }

    /**
     * Get active alerts
     */
    async getActiveAlerts() {
        const alerts = db.alerts.findAll({ is_resolved: 0 });

        if (alerts.length === 0) {
            return {
                response: `No active alerts at this time. Your fleet is operating smoothly!

[View Alert History](/alerts)`
            };
        }

        // Group by type
        const byType = {};
        alerts.forEach(a => {
            byType[a.type] = (byType[a.type] || 0) + 1;
        });

        // Group by severity
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
        alerts.forEach(a => {
            bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
        });

        let response = `Found **${alerts.length} active alerts**:\n\n`;

        response += `**By Severity:**\n`;
        if (bySeverity.critical > 0) response += `• Critical: ${bySeverity.critical}\n`;
        if (bySeverity.high > 0) response += `• High: ${bySeverity.high}\n`;
        if (bySeverity.medium > 0) response += `• Medium: ${bySeverity.medium}\n`;
        if (bySeverity.low > 0) response += `• Low: ${bySeverity.low}\n`;

        response += `\n**By Type:**\n`;
        Object.entries(byType).forEach(([type, count]) => {
            const typeLabel = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            response += `• ${typeLabel}: ${count}\n`;
        });

        // Show top critical/high alerts
        const urgent = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 3);
        if (urgent.length > 0) {
            response += `\n**Urgent Alerts:**\n`;
            urgent.forEach(a => {
                response += `• ${a.title} - [View](/alerts)\n`;
            });
        }

        response += `\n[View All Alerts](/alerts)`;

        return {
            response,
            data: {
                type: 'table',
                title: 'Alert Summary',
                rows: [
                    { label: 'Total Active', value: alerts.length },
                    { label: 'Critical', value: bySeverity.critical },
                    { label: 'High', value: bySeverity.high },
                    { label: 'Medium', value: bySeverity.medium }
                ]
            }
        };
    }

    /**
     * Find specific forklift
     */
    async findForklift(entities, message) {
        if (entities.forkliftId) {
            const forklift = db.forklifts.findById(entities.forkliftId);

            if (!forklift) {
                return {
                    response: `I couldn't find a forklift with ID **${entities.forkliftId}**. Please check the ID and try again.

[Browse All Forklifts](/forklifts)`
                };
            }

            const location = forklift.location_id ? db.locations.findById(forklift.location_id) : null;

            let response = `Found **${forklift.id}**:\n\n`;
            response += `**Model:** ${forklift.manufacturer || ''} ${forklift.model || 'Unknown'}\n`;
            response += `**Status:** ${forklift.status?.replace('_', ' ').toUpperCase() || 'Unknown'}\n`;
            response += `**Location:** ${location?.name || 'Unassigned'}\n`;
            response += `**Hours:** ${forklift.current_hours?.toLocaleString() || 0}\n`;
            response += `**Risk Level:** ${(forklift.risk_level || 'low').toUpperCase()} (${forklift.risk_score || 1}/10)\n`;

            if (forklift.next_service_date) {
                const dueDate = new Date(forklift.next_service_date);
                const daysUntil = Math.floor((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                response += `**Next Service:** ${dueDate.toLocaleDateString()} (${daysUntil < 0 ? Math.abs(daysUntil) + ' days overdue' : 'in ' + daysUntil + ' days'})\n`;
            }

            if (location?.service_center_phone) {
                response += `\n**Service Center:** ${location.service_center_contact || 'N/A'} - ${location.service_center_phone}\n`;
            }

            response += `\n[View Full Details](/forklifts/${forklift.id})`;

            return {
                response,
                data: {
                    type: 'table',
                    title: forklift.id,
                    rows: [
                        { label: 'Status', value: forklift.status?.toUpperCase() || 'Unknown' },
                        { label: 'Hours', value: forklift.current_hours?.toLocaleString() || 0 },
                        { label: 'Risk', value: `${forklift.risk_level?.toUpperCase() || 'LOW'} (${forklift.risk_score || 1}/10)` },
                        { label: 'Location', value: location?.name || 'Unassigned' }
                    ]
                }
            };
        }

        // General search
        return {
            response: `To find a specific forklift, please provide the ID (e.g., "FL-0001" or "Find forklift FL-0042").

Or you can [search the fleet inventory](/forklifts) using filters.`
        };
    }

    /**
     * Get location information
     */
    async getLocationInfo(entities, message) {
        const locations = db.locations.findAll();

        if (entities.location) {
            const location = locations.find(l =>
                l.name.toLowerCase().includes(entities.location.toLowerCase()) ||
                l.city?.toLowerCase().includes(entities.location.toLowerCase())
            );

            if (location) {
                const forklifts = db.forklifts.findAll({ location_id: location.id });
                const activeCount = forklifts.filter(f => f.status === 'active').length;

                let response = `**${location.name}**\n\n`;
                response += `**Address:** ${location.address || ''}, ${location.city || ''}, ${location.state || ''}\n`;
                response += `**Type:** ${location.type?.replace('_', ' ') || 'Unknown'}\n`;
                response += `**Forklifts:** ${forklifts.length} total (${activeCount} active)\n`;
                response += `**Capacity:** ${location.capacity || 'N/A'}\n`;

                if (location.service_center_phone) {
                    response += `\n**Service Contact:** ${location.service_center_contact || 'N/A'}\n`;
                    response += `**Phone:** ${location.service_center_phone}\n`;
                    if (location.service_center_email) {
                        response += `**Email:** ${location.service_center_email}\n`;
                    }
                }

                response += `\n[View Location Details](/locations/${location.id})`;

                return { response };
            }
        }

        // List all locations
        let response = `**Fleet Locations (${locations.length}):**\n\n`;
        locations.forEach(loc => {
            const forklifts = db.forklifts.findAll({ location_id: loc.id });
            response += `• [${loc.name}](/locations/${loc.id}) - ${forklifts.length} units\n`;
        });

        response += `\n[View All Locations](/locations)`;

        return { response };
    }

    /**
     * Get cost information
     */
    async getCostInfo() {
        const maintenance = db.maintenance.findAll({});
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let totalCost = 0;
        let last30Days = 0;

        maintenance.forEach(m => {
            totalCost += m.total_cost || 0;
            if (m.service_date && new Date(m.service_date) >= thirtyDaysAgo) {
                last30Days += m.total_cost || 0;
            }
        });

        // Get rental costs
        const rentals = db.rentals.findAll({});
        let rentalCost = 0;
        rentals.forEach(r => rentalCost += r.total_cost || 0);

        const response = `**Cost Summary:**

**Maintenance Costs:**
• Total (All Time): $${totalCost.toLocaleString()}
• Last 30 Days: $${last30Days.toLocaleString()}
• Records: ${maintenance.length}

**Rental Costs:**
• Total: $${rentalCost.toLocaleString()}
• Rentals: ${rentals.length}

**Total Spend:** $${(totalCost + rentalCost).toLocaleString()}

[View Budget Report](/reports/budget)`;

        return {
            response,
            data: {
                type: 'table',
                title: 'Cost Summary',
                rows: [
                    { label: 'Maintenance (30d)', value: '$' + last30Days.toLocaleString() },
                    { label: 'Maintenance (Total)', value: '$' + totalCost.toLocaleString() },
                    { label: 'Rentals', value: '$' + rentalCost.toLocaleString() },
                    { label: 'Total', value: '$' + (totalCost + rentalCost).toLocaleString() }
                ]
            }
        };
    }

    /**
     * Get downtime information
     */
    async getDowntimeInfo() {
        const downtime = db.downtime.findAll({});
        const active = downtime.filter(d => d.status === 'active');
        const resolved = downtime.filter(d => d.status === 'resolved');

        let totalHours = 0;
        resolved.forEach(d => totalHours += d.duration_hours || 0);

        const response = `**Downtime Summary:**

**Current Status:**
• Active Incidents: ${active.length}
• Resolved (All Time): ${resolved.length}
• Total Hours Lost: ${Math.round(totalHours).toLocaleString()} hours

${active.length > 0 ? '**Active Incidents:**\n' + active.slice(0, 3).map(d =>
            `• ${d.forklift_id} - ${d.type} (${d.root_cause || 'Unknown cause'})`
        ).join('\n') : ''}

[View Downtime Report](/reports/downtime)`;

        return { response };
    }

    /**
     * Get help message
     */
    getHelpMessage() {
        return {
            response: `I'm your Fleet Manager assistant! Here's what I can help with:

**📊 Fleet Data Queries:**
• "Fleet summary" - Overall fleet statistics
• "High risk forklifts" - Units needing attention
• "Active alerts" - Current issues and notifications
• "Maintenance due" - Upcoming/overdue services
• "Find FL-0001" - Look up specific unit
• "Forklifts in Dallas" - Location-based search
• "Costs" - Spending summary

**🔮 Predictive Maintenance:**
• "Predictions" - See predicted maintenance needs
• "Predictions for FL-0001" - Unit-specific forecast
• "What needs attention?" - Fleet-wide analysis

**❓ System Help:**
• "How do I add maintenance?" - Step-by-step guides
• "What is risk score?" - Feature explanations
• "Where do I find invoices?" - Navigation help
• "Explain alerts" - Feature overviews

**💡 Tips:**
• Use natural language - I understand conversational questions
• Be specific for better answers
• Click links in my responses to navigate directly

What would you like to know?`
        };
    }

    /**
     * Get maintenance predictions
     */
    async getPredictions(entities) {
        try {
            // If a specific forklift is mentioned, get its predictions
            if (entities.forkliftId) {
                const prediction = predictiveService.generateForkliftPredictions(entities.forkliftId);

                if (!prediction) {
                    return {
                        response: `I couldn't generate predictions for **${entities.forkliftId}**. The forklift may not exist or have insufficient data.`
                    };
                }

                let response = `**Predictions for ${entities.forkliftId}:**\n\n`;
                response += `**Status:** ${prediction.overallStatus.toUpperCase()} (Urgency Score: ${prediction.urgencyScore}/100)\n\n`;

                if (prediction.predictions.length === 0) {
                    response += `No immediate predictions - this unit is in good health!\n`;
                } else {
                    response += `**Top Predictions:**\n`;
                    prediction.predictions.slice(0, 5).forEach(pred => {
                        const icon = pred.urgency === 'critical' ? '🔴' : pred.urgency === 'high' ? '🟠' : '🟡';
                        response += `${icon} **${pred.title}** (${pred.confidence}% confidence)\n`;
                        response += `   ${pred.description}\n`;
                    });
                }

                if (prediction.servicePrediction?.usageRate) {
                    response += `\n**Usage Rate:** ${prediction.servicePrediction.usageRate.hoursPerDay} hrs/day average\n`;
                }

                if (prediction.componentHealth?.criticalCount > 0) {
                    response += `\n**Component Warnings:** ${prediction.componentHealth.criticalCount} critical, ${prediction.componentHealth.warningCount} warnings\n`;
                }

                response += `\n[View Full Details](/forklifts/${entities.forkliftId})`;

                return { response };
            }

            // Get fleet-wide predictions
            const fleetData = predictiveService.generateFleetPredictions();

            let response = `**Fleet Predictions Summary:**\n\n`;
            response += `**Status Overview:**\n`;
            response += `• 🔴 Critical: ${fleetData.summary.criticalCount} units\n`;
            response += `• 🟠 Warning: ${fleetData.summary.warningCount} units\n`;
            response += `• 🟢 Healthy: ${fleetData.summary.okCount} units\n`;
            response += `• Analyzed: ${fleetData.summary.unitsWithPredictions}/${fleetData.summary.totalUnits} units\n\n`;

            if (fleetData.summary.topPredictions && fleetData.summary.topPredictions.length > 0) {
                response += `**Units Needing Attention:**\n`;
                fleetData.summary.topPredictions.slice(0, 5).forEach(pred => {
                    const icon = pred.status === 'critical' ? '🔴' : pred.status === 'warning' ? '🟠' : '🟡';
                    response += `${icon} [${pred.forkliftId}](/forklifts/${pred.forkliftId}) - ${pred.topPrediction?.title || 'Maintenance predicted'} (${pred.topPrediction?.confidence || 0}%)\n`;
                });
            }

            response += `\n[View Dashboard](/) | [Full Analysis](/api/v1/predictions)`;

            return {
                response,
                data: {
                    type: 'table',
                    title: 'Prediction Summary',
                    rows: [
                        { label: 'Critical', value: fleetData.summary.criticalCount },
                        { label: 'Warning', value: fleetData.summary.warningCount },
                        { label: 'Healthy', value: fleetData.summary.okCount },
                        { label: 'Analyzed', value: `${fleetData.summary.unitsWithPredictions}/${fleetData.summary.totalUnits}` }
                    ]
                }
            };
        } catch (error) {
            console.error('Prediction error:', error);
            return {
                response: `I encountered an error generating predictions. Please try again or view the [Dashboard](/) for prediction data.`
            };
        }
    }

    /**
     * Default response for unrecognized queries
     */
    getDefaultResponse(message) {
        return {
            response: `I'm not sure I understood that. Let me help you find what you need:

**Data Queries:**
• "Fleet summary" - Get an overview
• "High risk forklifts" - See risky units
• "Active alerts" - View current alerts
• "Find FL-0001" - Look up a forklift

**System Help:**
• "How do I..." - Step-by-step guides
• "What is..." - Feature explanations
• "Where can I find..." - Navigation help

Or type "help" to see all my capabilities.`
        };
    }
}

module.exports = new ChatAgentService();
