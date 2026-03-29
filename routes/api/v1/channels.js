/**
 * Channel Webhook Routes - v1
 * Receives inbound messages from WhatsApp, Teams, Slack, Telegram, and Email
 * Routes them through the chat agent and responds via the same channel
 */

const express = require('express');
const router = express.Router();
const channelAdapter = require('../../../services/channelAdapterService');
const chatAgent = require('../../../services/chatAgentService');

// GET /api/v1/channels/status - Check which channels are configured
router.get('/status', (req, res) => {
    const channels = channelAdapter.getConfiguredChannels();
    res.json({
        success: true,
        channels,
        configured: Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
        unconfigured: Object.entries(channels).filter(([, v]) => !v).map(([k]) => k)
    });
});

// POST /api/v1/channels/send - Send a message via a specific channel
router.post('/send', async (req, res) => {
    try {
        const { channel, to, message, data, subject } = req.body;

        if (!channel || !to || !message) {
            return res.status(400).json({
                success: false,
                error: 'channel, to, and message are required'
            });
        }

        const adapter = channelAdapter.getAdapter(channel);
        const result = await adapter.sendMessage(to, message, data, subject);

        res.json({ success: result.success, ...result });
    } catch (error) {
        console.error('[Channels] Send error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// WHATSAPP WEBHOOK (Twilio)
// =====================================================

router.post('/whatsapp/webhook', async (req, res) => {
    try {
        const parsed = channelAdapter.parseInbound('whatsapp', req);
        console.log(`[WhatsApp] Message from ${parsed.senderName}: ${parsed.message}`);

        if (!parsed.message) {
            return res.status(200).send('<Response></Response>');
        }

        // Process through chat agent
        const result = await chatAgent.processMessage(parsed.message);

        // Format and send response back via WhatsApp
        const sendResult = await channelAdapter.sendMessage(
            'whatsapp', parsed.senderId, result.response, result.data
        );

        // Twilio expects TwiML response
        const formatted = channelAdapter.formatOutbound('whatsapp', result.response, result.data);
        res.set('Content-Type', 'text/xml');
        res.send(`<Response><Message>${escapeXml(formatted)}</Message></Response>`);
    } catch (error) {
        console.error('[WhatsApp Webhook] Error:', error.message);
        res.status(200).send('<Response><Message>Sorry, I encountered an error. Please try again.</Message></Response>');
    }
});

// =====================================================
// MICROSOFT TEAMS WEBHOOK (Bot Framework)
// =====================================================

router.post('/teams/webhook', async (req, res) => {
    try {
        const parsed = channelAdapter.parseInbound('teams', req);
        console.log(`[Teams] Message from ${parsed.senderName}: ${parsed.message}`);

        if (!parsed.message) {
            return res.status(200).json({});
        }

        // Process through chat agent
        const result = await chatAgent.processMessage(parsed.message);

        // Format as Teams Adaptive Card
        const payload = channelAdapter.formatOutbound('teams', result.response, result.data);

        res.json(payload);
    } catch (error) {
        console.error('[Teams Webhook] Error:', error.message);
        res.status(200).json({ type: 'message', text: 'Sorry, I encountered an error. Please try again.' });
    }
});

// =====================================================
// SLACK WEBHOOK (Events API)
// =====================================================

router.post('/slack/webhook', async (req, res) => {
    try {
        const parsed = channelAdapter.parseInbound('slack', req);

        // Handle Slack URL verification challenge
        if (parsed.challenge) {
            return res.json({ challenge: parsed.challenge });
        }

        // Ignore bot messages to prevent loops
        if (req.body.event?.bot_id || req.body.event?.subtype === 'bot_message') {
            return res.status(200).json({ ok: true });
        }

        console.log(`[Slack] Message from ${parsed.senderName}: ${parsed.message}`);

        if (!parsed.message) {
            return res.status(200).json({ ok: true });
        }

        // Acknowledge immediately (Slack requires response within 3 seconds)
        res.status(200).json({ ok: true });

        // Process and respond asynchronously
        const result = await chatAgent.processMessage(parsed.message);

        if (parsed.slackChannel) {
            await channelAdapter.sendMessage('slack', parsed.slackChannel, result.response, result.data);
        }
    } catch (error) {
        console.error('[Slack Webhook] Error:', error.message);
        if (!res.headersSent) {
            res.status(200).json({ ok: true });
        }
    }
});

// =====================================================
// TELEGRAM WEBHOOK
// =====================================================

router.post('/telegram/webhook', async (req, res) => {
    try {
        const parsed = channelAdapter.parseInbound('telegram', req);
        console.log(`[Telegram] Message from ${parsed.senderName}: ${parsed.message}`);

        // Acknowledge immediately
        res.status(200).json({ ok: true });

        if (!parsed.message || !parsed.chatId) {
            return;
        }

        // Process and respond
        const result = await chatAgent.processMessage(parsed.message);
        await channelAdapter.sendMessage('telegram', parsed.chatId, result.response, result.data);
    } catch (error) {
        console.error('[Telegram Webhook] Error:', error.message);
        if (!res.headersSent) {
            res.status(200).json({ ok: true });
        }
    }
});

// =====================================================
// EMAIL WEBHOOK (Mailgun/SendGrid inbound parse)
// =====================================================

router.post('/email/webhook', async (req, res) => {
    try {
        const parsed = channelAdapter.parseInbound('email', req);
        console.log(`[Email] Message from ${parsed.senderName}: ${parsed.subject || '(no subject)'}`);

        // Acknowledge immediately
        res.status(200).json({ ok: true });

        if (!parsed.message || !parsed.senderId) {
            return;
        }

        // Process the email body through the chat agent
        const result = await chatAgent.processMessage(parsed.message);

        // Reply via email
        const replySubject = parsed.subject
            ? (parsed.subject.startsWith('Re:') ? parsed.subject : `Re: ${parsed.subject}`)
            : 'Fleet Shield Response';

        await channelAdapter.getAdapter('email').sendMessage(
            parsed.senderId, result.response, result.data, replySubject
        );
    } catch (error) {
        console.error('[Email Webhook] Error:', error.message);
        if (!res.headersSent) {
            res.status(200).json({ ok: true });
        }
    }
});

/**
 * Escape XML special characters for TwiML responses
 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = router;
