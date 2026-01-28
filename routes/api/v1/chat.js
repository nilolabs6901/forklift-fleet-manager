/**
 * Chat API Routes - v1
 * Handles chat agent interactions
 * Includes voice response via Eleven Labs
 */

const express = require('express');
const router = express.Router();
const chatAgent = require('../../../services/chatAgentService');
const elevenLabsService = require('../../../services/elevenLabsService');

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

// GET /api/v1/chat/voice/status - Check if voice is available
router.get('/voice/status', (req, res) => {
    res.json({
        available: elevenLabsService.isConfigured(),
        message: elevenLabsService.isConfigured()
            ? 'Voice responses are available'
            : 'Set ELEVEN_LABS_API_KEY to enable voice'
    });
});

// POST /api/v1/chat/voice - Generate voice audio for text
router.post('/voice', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Text is required'
            });
        }

        if (!elevenLabsService.isConfigured()) {
            return res.status(503).json({
                success: false,
                error: 'Voice service not configured. Set ELEVEN_LABS_API_KEY environment variable.'
            });
        }

        // Stream audio response directly to client
        await elevenLabsService.streamToResponse(text, res);
    } catch (error) {
        console.error('Voice generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: 'Failed to generate voice'
            });
        }
    }
});

// GET /api/v1/chat/voice/voices - Get available voices
router.get('/voice/voices', async (req, res) => {
    try {
        const voices = await elevenLabsService.getVoices();
        res.json({
            success: true,
            voices: voices.map(v => ({
                id: v.voice_id,
                name: v.name,
                category: v.category,
                description: v.description
            }))
        });
    } catch (error) {
        console.error('Get voices error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get voices'
        });
    }
});

module.exports = router;
