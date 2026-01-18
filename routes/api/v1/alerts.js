/**
 * Alerts API Routes - v1
 * Alert management and notification endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');
const alertService = require('../../../services/alertService');

// GET /api/v1/alerts - List all alerts
router.get('/', (req, res) => {
    try {
        const options = {
            forkliftId: req.query.forklift_id,
            severity: req.query.severity,
            type: req.query.type,
            isActive: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
            isResolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : null
        };

        const alerts = db.alerts.findAll(options);
        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/alerts/active - Get active alerts only
router.get('/active', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const alerts = alertService.getActiveAlerts({ limit });
        res.json({
            success: true,
            count: alerts.length,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/alerts/stats - Get alert statistics
router.get('/stats', (req, res) => {
    try {
        const stats = alertService.getAlertStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/alerts/dashboard - Get alerts dashboard summary
router.get('/dashboard', (req, res) => {
    try {
        const summary = alertService.getDashboardSummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/alerts/:id - Get single alert
router.get('/:id', (req, res) => {
    try {
        const alert = db.alerts.findById(req.params.id);
        if (!alert) {
            return res.status(404).json({ success: false, error: 'Alert not found' });
        }
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/alerts/:id/history - Get alert acknowledgment history
router.get('/:id/history', (req, res) => {
    try {
        const history = alertService.getAlertHistory(parseInt(req.params.id));
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts - Create new alert
router.post('/', (req, res) => {
    try {
        if (!req.body.type || !req.body.title) {
            return res.status(400).json({
                success: false,
                error: 'Alert type and title are required'
            });
        }

        const alert = alertService.createAlert(req.body);
        res.status(201).json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/custom - Create custom alert
router.post('/custom', (req, res) => {
    try {
        if (!req.body.title) {
            return res.status(400).json({
                success: false,
                error: 'Alert title is required'
            });
        }

        const alert = alertService.createCustomAlert(req.body, req.user?.id);
        res.status(201).json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/:id/acknowledge - Acknowledge alert
router.post('/:id/acknowledge', (req, res) => {
    try {
        const alert = alertService.acknowledgeAlert(
            parseInt(req.params.id),
            req.user?.id || req.body.user_id
        );
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/:id/resolve - Resolve alert
router.post('/:id/resolve', (req, res) => {
    try {
        const alert = alertService.resolveAlert(
            parseInt(req.params.id),
            req.user?.id || req.body.user_id,
            req.body.notes
        );
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/:id/snooze - Snooze alert
router.post('/:id/snooze', (req, res) => {
    try {
        if (!req.body.snooze_until) {
            return res.status(400).json({
                success: false,
                error: 'snooze_until datetime is required'
            });
        }

        const alert = alertService.snoozeAlert(
            parseInt(req.params.id),
            req.user?.id || req.body.user_id,
            req.body.snooze_until
        );
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/bulk-acknowledge - Bulk acknowledge alerts
router.post('/bulk-acknowledge', (req, res) => {
    try {
        if (!req.body.alert_ids || !Array.isArray(req.body.alert_ids)) {
            return res.status(400).json({
                success: false,
                error: 'alert_ids array is required'
            });
        }

        const results = alertService.bulkAcknowledge(
            req.body.alert_ids,
            req.user?.id || req.body.user_id
        );

        res.json({
            success: true,
            acknowledged: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            data: results
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/bulk-resolve - Bulk resolve alerts
router.post('/bulk-resolve', (req, res) => {
    try {
        if (!req.body.alert_ids || !Array.isArray(req.body.alert_ids)) {
            return res.status(400).json({
                success: false,
                error: 'alert_ids array is required'
            });
        }

        const results = alertService.bulkResolve(
            req.body.alert_ids,
            req.user?.id || req.body.user_id,
            req.body.notes
        );

        res.json({
            success: true,
            resolved: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            data: results
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/check - Run scheduled alert checks
router.post('/check', async (req, res) => {
    try {
        const results = await alertService.runScheduledChecks();
        res.json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== WEBHOOK ENDPOINTS ===================

// GET /api/v1/alerts/webhooks - List webhooks
router.get('/webhooks', (req, res) => {
    try {
        const webhooks = alertService.getWebhooks();
        res.json({ success: true, data: webhooks });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/alerts/webhooks - Create webhook
router.post('/webhooks', (req, res) => {
    try {
        if (!req.body.name || !req.body.url) {
            return res.status(400).json({
                success: false,
                error: 'Webhook name and URL are required'
            });
        }

        const webhook = alertService.createWebhook(req.body, req.user?.id);
        res.status(201).json({ success: true, data: webhook });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/alerts/webhooks/:id - Update webhook
router.put('/webhooks/:id', (req, res) => {
    try {
        const webhook = alertService.updateWebhook(parseInt(req.params.id), req.body);
        if (!webhook) {
            return res.status(404).json({ success: false, error: 'Webhook not found' });
        }
        res.json({ success: true, data: webhook });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/v1/alerts/webhooks/:id - Delete webhook
router.delete('/webhooks/:id', (req, res) => {
    try {
        const deleted = alertService.deleteWebhook(parseInt(req.params.id));
        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
