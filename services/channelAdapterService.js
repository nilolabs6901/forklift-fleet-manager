/**
 * Channel Adapter Service
 * Normalizes inbound/outbound messaging across WhatsApp, Microsoft Teams,
 * Slack, Telegram, and Email into a unified format for the chat agent.
 *
 * Each channel has:
 *  - parseInbound(req)   → { senderId, senderName, message, channel, raw }
 *  - formatOutbound(text, data) → channel-specific payload
 *  - sendMessage(to, text, data) → sends via channel API
 */

const axios = require('axios');

class ChannelAdapterService {
    constructor() {
        this.channels = {
            whatsapp: new WhatsAppAdapter(),
            teams: new TeamsAdapter(),
            slack: new SlackAdapter(),
            telegram: new TelegramAdapter(),
            email: new EmailAdapter()
        };
    }

    /**
     * Get adapter for a specific channel
     */
    getAdapter(channel) {
        const adapter = this.channels[channel];
        if (!adapter) {
            throw new Error(`Unknown channel: ${channel}. Supported: ${Object.keys(this.channels).join(', ')}`);
        }
        return adapter;
    }

    /**
     * Parse an inbound webhook into a normalized message
     */
    parseInbound(channel, req) {
        return this.getAdapter(channel).parseInbound(req);
    }

    /**
     * Format a chat agent response for a specific channel
     */
    formatOutbound(channel, text, data) {
        return this.getAdapter(channel).formatOutbound(text, data);
    }

    /**
     * Send a message via a specific channel
     */
    async sendMessage(channel, to, text, data) {
        return this.getAdapter(channel).sendMessage(to, text, data);
    }

    /**
     * Check which channels are configured (have API keys set)
     */
    getConfiguredChannels() {
        const status = {};
        for (const [name, adapter] of Object.entries(this.channels)) {
            status[name] = adapter.isConfigured();
        }
        return status;
    }
}

// =====================================================
// WHATSAPP (via Twilio or Meta Cloud API)
// =====================================================

class WhatsAppAdapter {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g., 'whatsapp:+14155238886'
        this.apiUrl = this.accountSid
            ? `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`
            : null;
    }

    isConfigured() {
        return !!(this.accountSid && this.authToken && this.fromNumber);
    }

    parseInbound(req) {
        const body = req.body;
        return {
            senderId: body.From || body.WaId,
            senderName: body.ProfileName || body.From,
            message: body.Body || '',
            channel: 'whatsapp',
            mediaUrl: body.MediaUrl0 || null, // for invoice images
            raw: body
        };
    }

    formatOutbound(text, data) {
        // WhatsApp supports basic markdown: *bold*, _italic_, ~strikethrough~
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '*$1*')   // **bold** → *bold*
            .replace(/#{1,3}\s/g, '')              // remove markdown headers
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [link](url) → link text only

        // Append table data as plain text
        if (data?.rows) {
            formatted += '\n\n';
            for (const row of data.rows) {
                formatted += `• ${row.label}: ${row.value}\n`;
            }
        }

        return formatted;
    }

    async sendMessage(to, text, data) {
        if (!this.isConfigured()) {
            console.warn('[WhatsApp] Not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM');
            return { success: false, error: 'WhatsApp not configured' };
        }

        const formatted = this.formatOutbound(text, data);
        const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

        try {
            const params = new URLSearchParams();
            params.append('From', this.fromNumber);
            params.append('To', toNumber);
            params.append('Body', formatted);

            const response = await axios.post(this.apiUrl, params, {
                auth: { username: this.accountSid, password: this.authToken },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            return { success: true, sid: response.data.sid };
        } catch (error) {
            console.error('[WhatsApp] Send failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

// =====================================================
// MICROSOFT TEAMS (via Bot Framework / Incoming Webhooks)
// =====================================================

class TeamsAdapter {
    constructor() {
        this.webhookUrl = process.env.TEAMS_WEBHOOK_URL; // Incoming webhook for sending
        this.appId = process.env.TEAMS_APP_ID;
        this.appPassword = process.env.TEAMS_APP_PASSWORD;
    }

    isConfigured() {
        return !!(this.webhookUrl || (this.appId && this.appPassword));
    }

    parseInbound(req) {
        const body = req.body;
        // Bot Framework activity format
        return {
            senderId: body.from?.id || body.from?.aadObjectId,
            senderName: body.from?.name || 'Teams User',
            message: (body.text || '').replace(/<at>.*?<\/at>\s*/g, '').trim(), // strip @mentions
            channel: 'teams',
            conversationId: body.conversation?.id,
            serviceUrl: body.serviceUrl,
            raw: body
        };
    }

    formatOutbound(text, data) {
        // Teams supports Adaptive Cards, but simple messages use markdown
        const card = {
            type: 'message',
            attachments: [{
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: {
                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                    type: 'AdaptiveCard',
                    version: '1.4',
                    body: [
                        {
                            type: 'TextBlock',
                            text: text.replace(/\*\*(.*?)\*\*/g, '**$1**'), // Teams supports markdown
                            wrap: true
                        }
                    ]
                }
            }]
        };

        // Add data table as a fact set
        if (data?.rows) {
            card.attachments[0].content.body.push({
                type: 'FactSet',
                facts: data.rows.map(r => ({ title: r.label, value: String(r.value) }))
            });
        }

        return card;
    }

    async sendMessage(to, text, data) {
        if (!this.webhookUrl) {
            console.warn('[Teams] Not configured. Set TEAMS_WEBHOOK_URL');
            return { success: false, error: 'Teams not configured' };
        }

        const payload = this.formatOutbound(text, data);

        try {
            await axios.post(this.webhookUrl, payload, {
                headers: { 'Content-Type': 'application/json' }
            });
            return { success: true };
        } catch (error) {
            console.error('[Teams] Send failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

// =====================================================
// SLACK (via Slack API / Incoming Webhooks)
// =====================================================

class SlackAdapter {
    constructor() {
        this.botToken = process.env.SLACK_BOT_TOKEN;
        this.webhookUrl = process.env.SLACK_WEBHOOK_URL; // Incoming webhook for simple sends
        this.signingSecret = process.env.SLACK_SIGNING_SECRET;
    }

    isConfigured() {
        return !!(this.botToken || this.webhookUrl);
    }

    parseInbound(req) {
        const body = req.body;

        // Slack sends URL verification challenges
        if (body.type === 'url_verification') {
            return { challenge: body.challenge, channel: 'slack' };
        }

        // Event API format
        const event = body.event || body;
        return {
            senderId: event.user,
            senderName: event.user_name || event.user,
            message: (event.text || '').replace(/<@[A-Z0-9]+>\s*/g, '').trim(), // strip @mentions
            channel: 'slack',
            slackChannel: event.channel,
            threadTs: event.thread_ts || event.ts,
            raw: body
        };
    }

    formatOutbound(text, data) {
        // Slack uses mrkdwn (similar to markdown but slightly different)
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '*$1*')   // **bold** → *bold*
            .replace(/#{1,3}\s/g, '')              // remove headers

        const blocks = [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: formatted }
            }
        ];

        // Add data as a fields section
        if (data?.rows) {
            blocks.push({
                type: 'section',
                fields: data.rows.slice(0, 10).map(r => ({
                    type: 'mrkdwn',
                    text: `*${r.label}:* ${r.value}`
                }))
            });
        }

        return { blocks, text: formatted }; // text is fallback for notifications
    }

    async sendMessage(to, text, data) {
        const payload = this.formatOutbound(text, data);

        // Prefer webhook for simple sends
        if (this.webhookUrl) {
            try {
                await axios.post(this.webhookUrl, payload, {
                    headers: { 'Content-Type': 'application/json' }
                });
                return { success: true };
            } catch (error) {
                console.error('[Slack] Webhook send failed:', error.response?.data || error.message);
                return { success: false, error: error.message };
            }
        }

        // Use Bot API for channel-specific sends
        if (this.botToken) {
            try {
                const response = await axios.post('https://slack.com/api/chat.postMessage', {
                    channel: to,
                    ...payload
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.botToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                return { success: response.data.ok, ts: response.data.ts };
            } catch (error) {
                console.error('[Slack] API send failed:', error.response?.data || error.message);
                return { success: false, error: error.message };
            }
        }

        return { success: false, error: 'Slack not configured' };
    }
}

// =====================================================
// TELEGRAM (via Telegram Bot API)
// =====================================================

class TelegramAdapter {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.apiUrl = this.botToken
            ? `https://api.telegram.org/bot${this.botToken}`
            : null;
    }

    isConfigured() {
        return !!this.botToken;
    }

    parseInbound(req) {
        const body = req.body;
        const message = body.message || body.edited_message;

        if (!message) {
            return { senderId: null, message: '', channel: 'telegram', raw: body };
        }

        return {
            senderId: String(message.from.id),
            senderName: [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
            message: message.text || message.caption || '',
            channel: 'telegram',
            chatId: String(message.chat.id),
            photoFileId: message.photo ? message.photo[message.photo.length - 1].file_id : null,
            documentFileId: message.document?.file_id || null,
            raw: body
        };
    }

    formatOutbound(text, data) {
        // Telegram supports HTML and Markdown formatting
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')   // **bold** → <b>bold</b>
            .replace(/\*(.*?)\*/g, '<i>$1</i>')         // *italic* → <i>italic</i>
            .replace(/#{1,3}\s(.*)/g, '<b>$1</b>')      // headers → bold
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>'); // links

        if (data?.rows) {
            formatted += '\n\n';
            for (const row of data.rows) {
                formatted += `• <b>${row.label}:</b> ${row.value}\n`;
            }
        }

        return formatted;
    }

    async sendMessage(to, text, data) {
        if (!this.isConfigured()) {
            console.warn('[Telegram] Not configured. Set TELEGRAM_BOT_TOKEN');
            return { success: false, error: 'Telegram not configured' };
        }

        const formatted = this.formatOutbound(text, data);

        try {
            const response = await axios.post(`${this.apiUrl}/sendMessage`, {
                chat_id: to,
                text: formatted,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            return { success: true, messageId: response.data.result.message_id };
        } catch (error) {
            console.error('[Telegram] Send failed:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }
}

// =====================================================
// EMAIL (via Nodemailer / SMTP)
// =====================================================

class EmailAdapter {
    constructor() {
        this.fromEmail = process.env.EMAIL_FROM || 'fleet-shield@fleetshield.com';
        this.smtpHost = process.env.SMTP_HOST;
        this.smtpPort = process.env.SMTP_PORT || 587;
        this.smtpUser = process.env.SMTP_USER;
        this.smtpPass = process.env.SMTP_PASS;
    }

    isConfigured() {
        return !!(this.smtpHost && this.smtpUser);
    }

    parseInbound(req) {
        const body = req.body;
        // Mailgun/SendGrid inbound parse format
        return {
            senderId: body.from || body.sender || body.From,
            senderName: body.from || body.sender || 'Email User',
            message: body['stripped-text'] || body['body-plain'] || body.body || body.text || '',
            channel: 'email',
            subject: body.subject || body.Subject,
            raw: body
        };
    }

    formatOutbound(text, data) {
        // Convert markdown to simple HTML for email
        let html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/#{3}\s(.*)/g, '<h3>$1</h3>')
            .replace(/#{2}\s(.*)/g, '<h2>$1</h2>')
            .replace(/#{1}\s(.*)/g, '<h1>$1</h1>')
            .replace(/•\s(.*)/g, '<li>$1</li>')
            .replace(/\n/g, '<br>');

        // Wrap list items
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

        // Add data table
        if (data?.rows) {
            html += '<table style="border-collapse:collapse;margin-top:16px;width:100%">';
            for (const row of data.rows) {
                html += `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">${row.label}</td><td style="padding:4px 0">${row.value}</td></tr>`;
            }
            html += '</table>';
        }

        return `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <div style="border-bottom:2px solid #2563eb;padding-bottom:12px;margin-bottom:16px">
                    <strong style="color:#2563eb;font-size:18px">Fleet Shield</strong>
                </div>
                ${html}
                <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:12px;color:#6b7280;font-size:12px">
                    Fleet Shield by Fleet Shield &mdash; Forklift Fleet Management
                </div>
            </div>
        `;
    }

    async sendMessage(to, text, data, subject) {
        if (!this.isConfigured()) {
            console.warn('[Email] Not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
            return { success: false, error: 'Email not configured' };
        }

        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: this.smtpHost,
                port: this.smtpPort,
                secure: this.smtpPort === 465,
                auth: { user: this.smtpUser, pass: this.smtpPass }
            });

            const html = this.formatOutbound(text, data);

            const info = await transporter.sendMail({
                from: this.fromEmail,
                to,
                subject: subject || 'Fleet Shield Report',
                html
            });

            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[Email] Send failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new ChannelAdapterService();
