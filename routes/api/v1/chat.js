/**
 * Chat API Routes - v1
 * Handles chat agent interactions
 */

const express = require('express');
const router = express.Router();
const chatAgent = require('../../../services/chatAgentService');

// POST /api/v1/chat - Process a chat message
router.post('/', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Process the message through the chat agent
        const result = await chatAgent.processMessage(message.trim());

        res.json({
            success: true,
            response: result.response,
            data: result.data || null
        });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process message'
        });
    }
});

// GET /api/v1/chat/suggestions - Get suggested queries
router.get('/suggestions', (req, res) => {
    res.json({
        success: true,
        suggestions: [
            { text: 'Fleet summary', description: 'Get overall fleet statistics' },
            { text: 'High risk forklifts', description: 'View units needing attention' },
            { text: 'Maintenance due', description: 'Check upcoming service' },
            { text: 'Active alerts', description: 'View current alerts' },
            { text: 'Cost summary', description: 'See spending breakdown' },
            { text: 'Downtime report', description: 'View downtime statistics' }
        ]
    });
});

module.exports = router;
