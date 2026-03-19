/**
 * Prospects API Route
 * Provides webhook endpoints for the Fleet Shield Prospect Engine.
 * Make.com calls POST /api/v1/prospects/score for each prospect it fetches.
 */

const express = require('express');
const router = express.Router();
const prospectScoringService = require('../../../services/prospectScoringService');

/**
 * POST /api/v1/prospects/score
 *
 * Score a single prospect using Claude AI.
 * Make.com calls this after enriching each contact from Vibe Prospecting.
 *
 * Request body:
 *   name     - Contact full name
 *   title    - Job title
 *   company  - Company name
 *   industry - Industry sector
 *   location - City, State
 *   email    - Business email
 *
 * Response:
 *   score  - "A", "B", or "C"
 *   reason - One sentence explanation
 *   opener - Personalized first email line (blank for C)
 */
router.post('/score', async (req, res) => {
    try {
        const { name, title, company, industry, location, email } = req.body;

        if (!company) {
            return res.status(400).json({
                success: false,
                error: 'company field is required'
            });
        }

        const result = await prospectScoringService.scoreProspect({
            name, title, company, industry, location, email
        });

        res.json({
            success: true,
            score: result.score,
            reason: result.reason,
            opener: result.opener
        });

    } catch (err) {
        console.error('Prospect scoring error:', err.message);
        res.status(500).json({
            success: false,
            error: 'Scoring failed: ' + err.message
        });
    }
});

module.exports = router;
