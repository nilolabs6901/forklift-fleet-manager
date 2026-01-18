/**
 * Share API Routes - v1
 * Handles shareable link creation and access
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../../config/sqlite-database');
const predictiveService = require('../../../services/predictiveMaintenanceService');

// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// POST /api/v1/share/predictions - Create shareable predictions report
router.post('/predictions', async (req, res) => {
    try {
        const { expiresIn = '7d', maxViews = null, title = 'Predictive Maintenance Report' } = req.body;

        // Calculate expiration date
        let expiresAt = null;
        if (expiresIn) {
            const match = expiresIn.match(/^(\d+)(h|d|w|m)$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                const hours = unit === 'h' ? value :
                             unit === 'd' ? value * 24 :
                             unit === 'w' ? value * 24 * 7 :
                             unit === 'm' ? value * 24 * 30 : 24;
                const expDate = new Date();
                expDate.setHours(expDate.getHours() + hours);
                expiresAt = expDate.toISOString();
            }
        }

        // Generate predictions data
        const fleetPredictions = predictiveService.generateFleetPredictions();
        const token = generateToken();

        // Store in database
        const stmt = db.raw.prepare(`
            INSERT INTO shared_reports (share_token, report_type, report_data, report_title, expires_at, max_views)
            VALUES (?, 'predictions', ?, ?, ?, ?)
        `);

        const result = stmt.run(
            token,
            JSON.stringify(fleetPredictions),
            title,
            expiresAt,
            maxViews
        );

        const shareUrl = `/share/${token}`;

        res.json({
            success: true,
            data: {
                token,
                shareUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${shareUrl}`,
                expiresAt,
                maxViews,
                title
            }
        });

    } catch (error) {
        console.error('Create share link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create share link'
        });
    }
});

// POST /api/v1/share/forklift/:id - Create shareable forklift report
router.post('/forklift/:id', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const { expiresIn = '7d', maxViews = null, title } = req.body;

        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) {
            return res.status(404).json({
                success: false,
                error: 'Forklift not found'
            });
        }

        // Calculate expiration
        let expiresAt = null;
        if (expiresIn) {
            const match = expiresIn.match(/^(\d+)(h|d|w|m)$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];
                const hours = unit === 'h' ? value :
                             unit === 'd' ? value * 24 :
                             unit === 'w' ? value * 24 * 7 :
                             unit === 'm' ? value * 24 * 30 : 24;
                const expDate = new Date();
                expDate.setHours(expDate.getHours() + hours);
                expiresAt = expDate.toISOString();
            }
        }

        // Generate forklift prediction data
        const prediction = predictiveService.generateForkliftPredictions(forkliftId);
        const componentHealth = predictiveService.getComponentHealth(forkliftId);

        const reportData = {
            forklift,
            prediction,
            componentHealth,
            generatedAt: new Date().toISOString()
        };

        const token = generateToken();
        const reportTitle = title || `${forkliftId} - Equipment Report`;

        // Store in database
        const stmt = db.raw.prepare(`
            INSERT INTO shared_reports (share_token, report_type, report_data, report_title, forklift_id, expires_at, max_views)
            VALUES (?, 'forklift', ?, ?, ?, ?, ?)
        `);

        stmt.run(
            token,
            JSON.stringify(reportData),
            reportTitle,
            forkliftId,
            expiresAt,
            maxViews
        );

        const shareUrl = `/share/${token}`;

        res.json({
            success: true,
            data: {
                token,
                shareUrl,
                fullUrl: `${req.protocol}://${req.get('host')}${shareUrl}`,
                expiresAt,
                maxViews,
                title: reportTitle,
                forkliftId
            }
        });

    } catch (error) {
        console.error('Create forklift share link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create share link'
        });
    }
});

// GET /api/v1/share/:token - Get shared report data (for API access)
router.get('/:token', async (req, res) => {
    try {
        const token = req.params.token;

        const report = db.raw.prepare(`
            SELECT * FROM shared_reports WHERE share_token = ? AND is_active = 1
        `).get(token);

        if (!report) {
            return res.status(404).json({
                success: false,
                error: 'Share link not found or expired'
            });
        }

        // Check expiration
        if (report.expires_at && new Date(report.expires_at) < new Date()) {
            return res.status(410).json({
                success: false,
                error: 'This share link has expired'
            });
        }

        // Check view limit
        if (report.max_views && report.view_count >= report.max_views) {
            return res.status(410).json({
                success: false,
                error: 'This share link has reached its view limit'
            });
        }

        // Update view count and last accessed
        db.raw.prepare(`
            UPDATE shared_reports
            SET view_count = view_count + 1, last_accessed_at = datetime('now')
            WHERE id = ?
        `).run(report.id);

        const reportData = JSON.parse(report.report_data);

        res.json({
            success: true,
            data: {
                type: report.report_type,
                title: report.report_title,
                report: reportData,
                createdAt: report.created_at,
                expiresAt: report.expires_at,
                viewCount: report.view_count + 1
            }
        });

    } catch (error) {
        console.error('Get shared report error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve shared report'
        });
    }
});

// DELETE /api/v1/share/:token - Revoke a share link
router.delete('/:token', async (req, res) => {
    try {
        const token = req.params.token;

        const result = db.raw.prepare(`
            UPDATE shared_reports SET is_active = 0 WHERE share_token = ?
        `).run(token);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Share link not found'
            });
        }

        res.json({
            success: true,
            message: 'Share link revoked'
        });

    } catch (error) {
        console.error('Revoke share link error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to revoke share link'
        });
    }
});

// GET /api/v1/share - List all active share links (admin)
router.get('/', async (req, res) => {
    try {
        const links = db.raw.prepare(`
            SELECT id, share_token, report_type, report_title, forklift_id,
                   view_count, max_views, expires_at, is_active, created_at, last_accessed_at
            FROM shared_reports
            WHERE is_active = 1
            ORDER BY created_at DESC
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: links.map(link => ({
                ...link,
                shareUrl: `/share/${link.share_token}`,
                isExpired: link.expires_at && new Date(link.expires_at) < new Date(),
                isViewLimitReached: link.max_views && link.view_count >= link.max_views
            }))
        });

    } catch (error) {
        console.error('List share links error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list share links'
        });
    }
});

module.exports = router;
