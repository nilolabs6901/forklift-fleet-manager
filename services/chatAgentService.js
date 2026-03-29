/**
 * Chat Agent Service
 * AI-powered conversational assistant for fleet data queries and system help
 */

const db = require('../config/sqlite-database');
const predictiveService = require('./predictiveMaintenanceService');

// Knowledge Base - Complete system documentation
const KNOWLEDGE_BASE = {
    system_overview: {
        keywords: ['what is', 'about', 'system', 'fleet shield', 'overview', 'purpose'],
        content: `**Fleet Shield** is a comprehensive fleet management system designed to help you:

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
            draft_report: [
                /draft\s*(a\s*)?(report|summary)/i,
                /generate\s*(a\s*)?(report|summary)/i,
                /write\s*(a\s*|up\s*a\s*)?(report|summary)/i,
                /create\s*(a\s*)?(report|summary)/i,
                /build\s*(a\s*)?(report|summary)/i,
                /prepare\s*(a\s*)?(report|summary)/i,
                /fleet\s*report/i,
                /maintenance\s*report/i,
                /cost\s*report/i,
                /risk\s*report/i,
                /downtime\s*report/i,
                /weekly\s*report/i,
                /monthly\s*report/i,
                /executive\s*report/i,
                /send\s*(a\s*|me\s*a\s*)?(report|summary)/i
            ],
            fleet_summary: [
                /fleet\s*(summary|overview|status)/i,
                /how many\s*(forklifts|units|total)/i,
                /total\s*(fleet|forklifts|units)/i,
                /fleet\s*stats/i,
                /give me (a |the )?(summary|overview)/i,
                /how many\s*(active|total)\s*(units|forklifts)/i,
                /total\s*active\s*(units|forklifts)/i,
                /number\s*of\s*(forklifts|units)/i,
                /count\s*(of\s*)?(forklifts|units)/i
            ],
            high_risk: [
                /high\s*risk/i,
                /critical\s*(risk|units|forklifts)/i,
                /risky\s*(units|forklifts)/i,
                /at\s*risk/i,
                /danger(ous)?\s*(units|forklifts)/i,
                /which.*(high|critical)\s*risk/i,
                /risk\s*(report|breakdown|distribution)/i
            ],
            maintenance_due: [
                /maintenance\s*(due|overdue|upcoming|scheduled)/i,
                /service\s*(due|needed|required)/i,
                /needs?\s*(service|maintenance)/i,
                /upcoming\s*(service|maintenance)/i,
                /overdue/i,
                /how many.*(maintenance|service)/i,
                /recent\s*(maintenance|service)/i,
                /maintenance\s*(count|total|number)/i
            ],
            active_alerts: [
                /active\s*alerts?/i,
                /current\s*alerts?/i,
                /(show|list|get)\s*alerts?/i,
                /open\s*alerts?/i,
                /alert\s*(status|summary|count|total|number)/i,
                /any\s*alerts?/i,
                /how many\s*alerts?/i,
                /number\s*of\s*alerts?/i,
                /total\s*(recent\s*)?alerts?/i,
                /recent\s*alerts?/i,
                /alerts?\s*(in|on)\s*(the\s*)?(system|fleet)/i,
                /count\s*(of\s*)?alerts?/i,
                /tell\s*me.*alerts/i
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
            transfer_equipment: [
                /transfer\s*(forklift|unit|equipment)/i,
                /move\s*(forklift|unit|equipment)/i,
                /relocate\s*(forklift|unit|equipment)/i,
                /send\s*(forklift|unit|equipment)/i,
                /transfer\s*[A-Z]{2}-\d+/i,
                /move\s*[A-Z]{2}-\d+/i,
                /(forklift|unit|equipment)\s*transfer/i,
                /transfer.*to\s/i,
                /move.*to\s/i,
                /reassign\s*(forklift|unit|equipment)/i
            ],
            transfer_history: [
                /transfer\s*history/i,
                /transfer\s*log/i,
                /recent\s*transfers?/i,
                /equipment\s*moves?/i,
                /location\s*changes?/i,
                /how many\s*transfers?/i,
                /where\s*(has|did).*moved/i
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

        // IMPORTANT: Classify data query intent FIRST before knowledge base
        // This ensures questions like "how many alerts" query real data
        // instead of returning static help text
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
            case 'transfer_equipment':
                response = await this.initiateTransfer(entities, trimmedMessage);
                break;
            case 'transfer_history':
                response = await this.getTransferHistory(entities, trimmedMessage);
                break;
            case 'draft_report':
                response = await this.draftReport(entities, trimmedMessage);
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
                // No data intent matched - try knowledge base for help topics
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
            `Hello! I'm your Fleet Shield assistant. I can help you with:\n\n• **Data queries** - "Fleet summary", "High risk forklifts", "Active alerts"\n• **Transfers** - "Transfer FL-0001 to Dallas", "Recent transfers"\n• **System help** - "How do I add maintenance?", "What is risk score?"\n• **Finding info** - "Find FL-0001", "Forklifts in Dallas"\n\nWhat would you like to know?`,
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
            response: `I'm your Fleet Shield assistant! Here's what I can help with:

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

**🔄 Equipment Transfers:**
• "Transfer FL-0001 to Dallas" - Move equipment
• "Recent transfers" - View transfer history
• "Transfer history for FL-0001" - Unit transfer log

**📝 Reports:**
• "Draft a report" - Executive fleet summary
• "Draft a cost report" - Spending analysis
• "Draft a risk report" - Risk assessment summary
• "Draft a maintenance report" - Service activity
• "Draft a downtime report" - Downtime analysis

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
     * Initiate equipment transfer via chat
     */
    async initiateTransfer(entities, message) {
        try {
            // Parse the message for forklift ID and destination
            const forkliftIdMatch = message.match(/([A-Z]{2}-\d{3,4})/i);
            const forkliftId = forkliftIdMatch ? forkliftIdMatch[1].toUpperCase() : entities.forkliftId;

            if (!forkliftId) {
                // No forklift specified - show instructions
                return {
                    response: `To transfer equipment, I need the forklift ID and destination. Try:\n\n• **"Transfer FL-0001 to Dallas"**\n• **"Move FL-0023 to Atlanta warehouse"**\n\nOr you can use the Transfer button on any [forklift's detail page](/forklifts).`
                };
            }

            const forklift = db.forklifts.findById(forkliftId);
            if (!forklift) {
                return { response: `Forklift **${forkliftId}** was not found. Please check the ID and try again.\n\n[View Fleet Inventory](/forklifts)` };
            }

            // Try to find the destination location from the message
            const locations = db.locations.findAll();
            let targetLocation = null;

            // Match location by name or city (case-insensitive)
            const lowerMessage = message.toLowerCase();
            for (const loc of locations) {
                const locName = (loc.name || '').toLowerCase();
                const locCity = (loc.city || '').toLowerCase();
                if (locName && lowerMessage.includes(locName)) {
                    targetLocation = loc;
                    break;
                }
                if (locCity && lowerMessage.includes(locCity)) {
                    targetLocation = loc;
                    break;
                }
            }

            if (!targetLocation) {
                // No destination found - list available locations
                let response = `I can transfer **${forkliftId}** (currently at **${forklift.location_name || 'Unassigned'}**). Which location should I send it to?\n\n**Available Locations:**\n`;
                locations.forEach(loc => {
                    if (loc.id !== forklift.location_id) {
                        response += `• **${loc.name}** - ${loc.city}, ${loc.state}\n`;
                    }
                });
                response += `\nTry: **"Transfer ${forkliftId} to [location name]"**`;
                return { response };
            }

            if (targetLocation.id === forklift.location_id) {
                return { response: `**${forkliftId}** is already at **${targetLocation.name}**. No transfer needed.` };
            }

            // Parse reason from message
            let reason = 'other';
            if (/rebalanc/i.test(message)) reason = 'rebalancing';
            else if (/maintenance|repair|service/i.test(message)) reason = 'maintenance';
            else if (/demand|workload|busy/i.test(message)) reason = 'demand';
            else if (/clos/i.test(message)) reason = 'closure';
            else if (/assign|new/i.test(message)) reason = 'new_assignment';

            // Execute the transfer
            const transfer = db.transfers.create({
                forklift_id: forkliftId,
                from_location_id: forklift.location_id || null,
                to_location_id: targetLocation.id,
                reason: reason
            });

            // Update forklift location
            db.forklifts.update(forkliftId, { location_id: targetLocation.id });

            // Audit log
            db.audit.log({
                action: 'update',
                entity_type: 'forklift',
                entity_id: forkliftId,
                old_values: { location_id: forklift.location_id },
                new_values: { location_id: targetLocation.id },
                changed_fields: ['location_id']
            });

            const fromName = forklift.location_name || 'Unassigned';
            return {
                response: `Transfer completed!\n\n**${forkliftId}** has been moved:\n**From:** ${fromName}\n**To:** ${targetLocation.name} (${targetLocation.city}, ${targetLocation.state})\n**Reason:** ${reason.replace('_', ' ')}\n\n[View ${forkliftId}](/forklifts/${forkliftId})`
            };
        } catch (error) {
            console.error('Transfer error:', error);
            return {
                response: `I encountered an error processing the transfer. Please try using the Transfer button on the [forklift's detail page](/forklifts).`
            };
        }
    }

    /**
     * Get transfer history
     */
    async getTransferHistory(entities, message) {
        try {
            const forkliftId = entities.forkliftId;

            if (forkliftId) {
                // Transfer history for a specific forklift
                const transfers = db.transfers.findByForklift(forkliftId, { limit: 10 });

                if (transfers.length === 0) {
                    return { response: `No transfer history found for **${forkliftId}**.\n\n[View ${forkliftId}](/forklifts/${forkliftId})` };
                }

                let response = `**Transfer history for ${forkliftId}** (${transfers.length} records):\n\n`;
                transfers.forEach(t => {
                    const date = t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '-';
                    const from = t.from_location_name || 'Unassigned';
                    response += `• **${date}:** ${from} → ${t.to_location_name} _(${(t.reason || 'other').replace('_', ' ')})_\n`;
                });

                response += `\n[View ${forkliftId}](/forklifts/${forkliftId})`;
                return { response };
            }

            // Fleet-wide recent transfers
            const recentTransfers = db.transfers.findAll({ limit: 10 });
            const count30d = db.transfers.getRecentCount(30);

            if (recentTransfers.length === 0) {
                return { response: `No equipment transfers have been recorded yet.` };
            }

            let response = `**Recent Equipment Transfers** (${count30d} in the last 30 days):\n\n`;
            recentTransfers.slice(0, 8).forEach(t => {
                const date = t.transfer_date ? new Date(t.transfer_date).toLocaleDateString() : '-';
                const from = t.from_location_name || 'Unassigned';
                response += `• **${date}** - [${t.forklift_id}](/forklifts/${t.forklift_id}): ${from} → ${t.to_location_name} _(${(t.reason || 'other').replace('_', ' ')})_\n`;
            });

            return { response };
        } catch (error) {
            console.error('Transfer history error:', error);
            return { response: `I encountered an error fetching transfer history. Please try again.` };
        }
    }

    /**
     * Draft a report based on the user's request
     */
    async draftReport(entities, message) {
        try {
            const lowerMessage = message.toLowerCase();

            // Determine report type
            let reportType = 'fleet_summary';
            if (/cost|spend|budget|expense/i.test(message)) reportType = 'cost';
            else if (/risk|assessment/i.test(message)) reportType = 'risk';
            else if (/downtime|offline|out.?of.?service/i.test(message)) reportType = 'downtime';
            else if (/maintenance|service|repair/i.test(message)) reportType = 'maintenance';
            else if (/executive|weekly|monthly/i.test(message)) reportType = 'executive';

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            switch (reportType) {
                case 'cost':
                    return await this._draftCostReport(dateStr);
                case 'risk':
                    return await this._draftRiskReport(dateStr);
                case 'downtime':
                    return await this._draftDowntimeReport(dateStr);
                case 'maintenance':
                    return await this._draftMaintenanceReport(dateStr);
                case 'executive':
                    return await this._draftExecutiveReport(dateStr);
                default:
                    return await this._draftExecutiveReport(dateStr);
            }
        } catch (error) {
            console.error('Report drafting error:', error);
            return {
                response: `I encountered an error drafting the report. Please try again or specify the type: "Draft a cost report", "Draft a risk report", "Draft a maintenance report".`
            };
        }
    }

    async _draftCostReport(dateStr) {
        const maintenance = db.maintenance.findAll({});
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        let totalCost = 0, last30Days = 0, last90Days = 0;
        let laborTotal = 0, partsTotal = 0;

        maintenance.forEach(m => {
            const cost = m.total_cost || 0;
            totalCost += cost;
            laborTotal += m.labor_cost || 0;
            partsTotal += m.parts_cost || 0;
            if (m.service_date) {
                const d = new Date(m.service_date);
                if (d >= thirtyDaysAgo) last30Days += cost;
                if (d >= ninetyDaysAgo) last90Days += cost;
            }
        });

        const rentals = db.rentals.findAll({});
        let rentalCost = 0;
        rentals.forEach(r => rentalCost += r.total_cost || 0);

        // Top spending forklifts
        const costByForklift = {};
        maintenance.forEach(m => {
            if (m.forklift_id) {
                costByForklift[m.forklift_id] = (costByForklift[m.forklift_id] || 0) + (m.total_cost || 0);
            }
        });
        const topSpenders = Object.entries(costByForklift)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        let response = `**COST ANALYSIS REPORT**\n*Generated: ${dateStr}*\n\n---\n\n`;
        response += `**Summary**\n`;
        response += `• Total Maintenance Spend: **$${totalCost.toLocaleString()}**\n`;
        response += `• Last 30 Days: **$${last30Days.toLocaleString()}**\n`;
        response += `• Last 90 Days: **$${last90Days.toLocaleString()}**\n`;
        response += `• Labor Costs: $${laborTotal.toLocaleString()}\n`;
        response += `• Parts Costs: $${partsTotal.toLocaleString()}\n`;
        response += `• Rental Costs: $${rentalCost.toLocaleString()}\n`;
        response += `• **Grand Total: $${(totalCost + rentalCost).toLocaleString()}**\n\n`;

        if (topSpenders.length > 0) {
            response += `**Top 5 Highest-Cost Units:**\n`;
            topSpenders.forEach(([id, cost], i) => {
                response += `${i + 1}. ${id}: $${cost.toLocaleString()}\n`;
            });
            response += '\n';
        }

        response += `**Avg Cost Per Service:** $${maintenance.length > 0 ? Math.round(totalCost / maintenance.length).toLocaleString() : 0}\n`;
        response += `**Total Service Records:** ${maintenance.length}\n`;

        return {
            response,
            data: {
                type: 'table',
                title: 'Cost Report',
                rows: [
                    { label: 'Total Spend', value: '$' + (totalCost + rentalCost).toLocaleString() },
                    { label: 'Last 30 Days', value: '$' + last30Days.toLocaleString() },
                    { label: 'Labor', value: '$' + laborTotal.toLocaleString() },
                    { label: 'Parts', value: '$' + partsTotal.toLocaleString() },
                    { label: 'Rentals', value: '$' + rentalCost.toLocaleString() }
                ]
            }
        };
    }

    async _draftRiskReport(dateStr) {
        const forklifts = db.forklifts.findAll({});
        const critical = forklifts.filter(f => f.risk_level === 'critical');
        const high = forklifts.filter(f => f.risk_level === 'high');
        const medium = forklifts.filter(f => f.risk_level === 'medium');
        const low = forklifts.filter(f => f.risk_level === 'low');

        let response = `**RISK ASSESSMENT REPORT**\n*Generated: ${dateStr}*\n\n---\n\n`;
        response += `**Fleet Risk Distribution (${forklifts.length} units)**\n`;
        response += `• Critical: **${critical.length}** units\n`;
        response += `• High: **${high.length}** units\n`;
        response += `• Medium: ${medium.length} units\n`;
        response += `• Low: ${low.length} units\n\n`;

        const atRiskPct = forklifts.length > 0 ? Math.round(((critical.length + high.length) / forklifts.length) * 100) : 0;
        response += `**At-Risk Rate:** ${atRiskPct}% of fleet\n\n`;

        if (critical.length > 0) {
            response += `**Critical Units (Immediate Action):**\n`;
            critical.forEach(fl => {
                response += `• **${fl.id}** - Score: ${fl.risk_score}/10, ${(fl.current_hours || 0).toLocaleString()} hrs, ${fl.year || 'N/A'} ${fl.manufacturer || ''} ${fl.model || ''}\n`;
            });
            response += '\n';
        }

        if (high.length > 0) {
            response += `**High Risk Units (Plan Replacement):**\n`;
            high.slice(0, 10).forEach(fl => {
                response += `• **${fl.id}** - Score: ${fl.risk_score}/10, ${(fl.current_hours || 0).toLocaleString()} hrs\n`;
            });
            if (high.length > 10) response += `  ...and ${high.length - 10} more\n`;
            response += '\n';
        }

        response += `**Recommendation:** ${critical.length > 0 ? `${critical.length} unit(s) require immediate replacement evaluation.` : 'No units require immediate replacement.'} ${high.length > 0 ? `${high.length} unit(s) should be scheduled for replacement planning.` : ''}`;

        return {
            response,
            data: {
                type: 'table',
                title: 'Risk Report',
                rows: [
                    { label: 'Critical', value: critical.length },
                    { label: 'High', value: high.length },
                    { label: 'Medium', value: medium.length },
                    { label: 'Low', value: low.length },
                    { label: 'At-Risk %', value: atRiskPct + '%' }
                ]
            }
        };
    }

    async _draftDowntimeReport(dateStr) {
        const downtime = db.downtime.findAll({});
        const active = downtime.filter(d => d.status === 'active');
        const resolved = downtime.filter(d => d.status === 'resolved');

        let totalHours = 0;
        const byCause = {};
        resolved.forEach(d => {
            totalHours += d.duration_hours || 0;
            const cause = d.root_cause || 'Unknown';
            byCause[cause] = (byCause[cause] || 0) + 1;
        });

        // Units with most downtime
        const byForklift = {};
        downtime.forEach(d => {
            if (d.forklift_id) {
                byForklift[d.forklift_id] = (byForklift[d.forklift_id] || 0) + (d.duration_hours || 0);
            }
        });
        const worstUnits = Object.entries(byForklift).sort((a, b) => b[1] - a[1]).slice(0, 5);

        let response = `**DOWNTIME ANALYSIS REPORT**\n*Generated: ${dateStr}*\n\n---\n\n`;
        response += `**Summary**\n`;
        response += `• Active Incidents: **${active.length}**\n`;
        response += `• Resolved Incidents: ${resolved.length}\n`;
        response += `• Total Hours Lost: **${Math.round(totalHours).toLocaleString()} hours**\n\n`;

        if (Object.keys(byCause).length > 0) {
            response += `**Root Causes:**\n`;
            Object.entries(byCause).sort((a, b) => b[1] - a[1]).forEach(([cause, count]) => {
                const label = cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                response += `• ${label}: ${count} incidents\n`;
            });
            response += '\n';
        }

        if (worstUnits.length > 0) {
            response += `**Most Downtime (by unit):**\n`;
            worstUnits.forEach(([id, hours], i) => {
                response += `${i + 1}. ${id}: ${Math.round(hours)} hours\n`;
            });
            response += '\n';
        }

        if (active.length > 0) {
            response += `**Currently Down:**\n`;
            active.slice(0, 5).forEach(d => {
                response += `• ${d.forklift_id} - ${d.type || 'Unplanned'} (${d.root_cause || 'Unknown cause'})\n`;
            });
        }

        return {
            response,
            data: {
                type: 'table',
                title: 'Downtime Report',
                rows: [
                    { label: 'Active Incidents', value: active.length },
                    { label: 'Resolved', value: resolved.length },
                    { label: 'Total Hours Lost', value: Math.round(totalHours).toLocaleString() }
                ]
            }
        };
    }

    async _draftMaintenanceReport(dateStr) {
        const maintenance = db.maintenance.findAll({});
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recent = maintenance.filter(m => m.service_date && new Date(m.service_date) >= thirtyDaysAgo);

        const byType = {};
        maintenance.forEach(m => {
            const type = m.service_type || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        });

        // Overdue units
        const forklifts = db.forklifts.findAll({});
        const now = new Date();
        const overdue = forklifts.filter(fl => {
            if (!fl.next_service_date) return false;
            return new Date(fl.next_service_date) < now;
        });

        let totalCost = 0;
        recent.forEach(m => totalCost += m.total_cost || 0);

        let response = `**MAINTENANCE REPORT**\n*Generated: ${dateStr}*\n\n---\n\n`;
        response += `**Summary**\n`;
        response += `• Total Records: ${maintenance.length}\n`;
        response += `• Last 30 Days: **${recent.length} services**\n`;
        response += `• 30-Day Spend: **$${totalCost.toLocaleString()}**\n`;
        response += `• Units Overdue: **${overdue.length}**\n\n`;

        if (Object.keys(byType).length > 0) {
            response += `**By Service Type (All Time):**\n`;
            Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
                const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                response += `• ${label}: ${count}\n`;
            });
            response += '\n';
        }

        if (overdue.length > 0) {
            response += `**Overdue Units:**\n`;
            overdue.slice(0, 10).forEach(fl => {
                const daysOverdue = Math.floor((now - new Date(fl.next_service_date)) / (1000 * 60 * 60 * 24));
                response += `• ${fl.id}: ${daysOverdue} days overdue\n`;
            });
            if (overdue.length > 10) response += `  ...and ${overdue.length - 10} more\n`;
        }

        return {
            response,
            data: {
                type: 'table',
                title: 'Maintenance Report',
                rows: [
                    { label: 'Total Records', value: maintenance.length },
                    { label: 'Last 30 Days', value: recent.length },
                    { label: '30-Day Spend', value: '$' + totalCost.toLocaleString() },
                    { label: 'Overdue Units', value: overdue.length }
                ]
            }
        };
    }

    async _draftExecutiveReport(dateStr) {
        const forklifts = db.forklifts.findAll({});
        const stats = db.forklifts.getStats();
        const alerts = db.alerts.findAll({ is_resolved: 0 });
        const locations = db.locations.findAll();
        const maintenance = db.maintenance.findAll({});
        const downtime = db.downtime.findAll({});

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let recentCost = 0;
        const recentMaintenance = maintenance.filter(m => {
            if (m.service_date && new Date(m.service_date) >= thirtyDaysAgo) {
                recentCost += m.total_cost || 0;
                return true;
            }
            return false;
        });

        const activeDowntime = downtime.filter(d => d.status === 'active');
        const critical = forklifts.filter(f => f.risk_level === 'critical');
        const highRisk = forklifts.filter(f => f.risk_level === 'high');
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');

        const now = new Date();
        const overdue = forklifts.filter(fl => fl.next_service_date && new Date(fl.next_service_date) < now);

        let response = `**FLEET SHIELD — EXECUTIVE SUMMARY**\n*Generated: ${dateStr}*\n\n---\n\n`;

        response += `**Fleet Overview**\n`;
        response += `• Total Units: **${stats.total}** across ${locations.length} locations\n`;
        response += `• Active: ${stats.active || 0} | Maintenance: ${stats.in_maintenance || 0} | Out of Service: ${stats.out_of_service || 0}\n\n`;

        response += `**Alerts & Issues**\n`;
        response += `• Active Alerts: **${alerts.length}** (${criticalAlerts.length} critical)\n`;
        response += `• Maintenance Overdue: **${overdue.length} units**\n`;
        response += `• Currently Down: **${activeDowntime.length} units**\n\n`;

        response += `**Risk Status**\n`;
        response += `• Critical: **${critical.length}** | High: **${highRisk.length}** | Medium: ${stats.medium_risk || 0} | Low: ${stats.low_risk || 0}\n`;
        const atRiskPct = stats.total > 0 ? Math.round(((critical.length + highRisk.length) / stats.total) * 100) : 0;
        response += `• Fleet At-Risk Rate: **${atRiskPct}%**\n\n`;

        response += `**30-Day Maintenance**\n`;
        response += `• Services Completed: ${recentMaintenance.length}\n`;
        response += `• Spend: **$${recentCost.toLocaleString()}**\n\n`;

        // Action items
        const actions = [];
        if (critical.length > 0) actions.push(`${critical.length} critical-risk unit(s) need replacement evaluation`);
        if (overdue.length > 0) actions.push(`${overdue.length} unit(s) are overdue for maintenance`);
        if (criticalAlerts.length > 0) actions.push(`${criticalAlerts.length} critical alert(s) require immediate attention`);
        if (activeDowntime.length > 0) actions.push(`${activeDowntime.length} unit(s) currently offline`);

        if (actions.length > 0) {
            response += `**Action Items:**\n`;
            actions.forEach(a => response += `• ${a}\n`);
        } else {
            response += `**Status: All Clear** — No urgent action items at this time.\n`;
        }

        return {
            response,
            data: {
                type: 'table',
                title: 'Executive Summary',
                rows: [
                    { label: 'Fleet Size', value: stats.total },
                    { label: 'Active Alerts', value: alerts.length },
                    { label: 'At-Risk Units', value: critical.length + highRisk.length },
                    { label: '30-Day Spend', value: '$' + recentCost.toLocaleString() },
                    { label: 'Units Down', value: activeDowntime.length }
                ]
            }
        };
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
