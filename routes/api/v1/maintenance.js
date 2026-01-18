/**
 * Maintenance API Routes - v1
 * Complete maintenance management endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');
const maintenanceService = require('../../../services/maintenanceService');

// GET /api/v1/maintenance - List all maintenance records
router.get('/', (req, res) => {
    try {
        const options = {
            forkliftId: req.query.forklift_id,
            type: req.query.type,
            status: req.query.status,
            startDate: req.query.start_date,
            endDate: req.query.end_date,
            limit: req.query.limit ? parseInt(req.query.limit) : null
        };

        const records = db.maintenance.findAll(options);
        res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/stats - Get maintenance statistics
router.get('/stats', (req, res) => {
    try {
        const stats = db.maintenance.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/schedule - Get maintenance schedule (due/overdue)
router.get('/schedule', (req, res) => {
    try {
        const schedule = maintenanceService.getMaintenanceSchedule();
        res.json({ success: true, data: schedule });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/costs - Get cost analysis
router.get('/costs', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;
        const analysis = maintenanceService.getCostAnalysis({ months });
        res.json({ success: true, data: analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/monthly - Get monthly cost trends
router.get('/monthly', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;
        const trends = db.maintenance.getMonthlyCosts(months);
        res.json({ success: true, data: trends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/templates - Get maintenance schedule templates
router.get('/templates', (req, res) => {
    try {
        const templates = maintenanceService.getMaintenanceSchedules();
        res.json({ success: true, data: templates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance/templates - Create maintenance template
router.post('/templates', (req, res) => {
    try {
        if (!req.body.name || !req.body.tasks) {
            return res.status(400).json({
                success: false,
                error: 'Name and tasks are required'
            });
        }

        const template = maintenanceService.createMaintenanceSchedule(req.body, req.user?.id);
        res.status(201).json({ success: true, data: template });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/summary - Get fleet maintenance summary
router.get('/summary', (req, res) => {
    try {
        const summary = maintenanceService.getFleetSummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/maintenance/:id - Get single maintenance record
router.get('/:id', (req, res) => {
    try {
        const record = db.maintenance.findById(req.params.id);
        if (!record) {
            return res.status(404).json({ success: false, error: 'Maintenance record not found' });
        }
        res.json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance - Create maintenance record
router.post('/', (req, res) => {
    try {
        if (!req.body.forklift_id || !req.body.type) {
            return res.status(400).json({
                success: false,
                error: 'Forklift ID and type are required'
            });
        }

        const record = maintenanceService.createMaintenanceRecord(req.body, req.user?.id);
        res.status(201).json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/maintenance/:id - Update maintenance record
router.put('/:id', (req, res) => {
    try {
        const record = maintenanceService.updateMaintenanceRecord(
            parseInt(req.params.id),
            req.body,
            req.user?.id
        );

        if (!record) {
            return res.status(404).json({ success: false, error: 'Maintenance record not found' });
        }

        res.json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance/:id/complete - Complete maintenance record
router.post('/:id/complete', (req, res) => {
    try {
        const record = maintenanceService.completeMaintenanceRecord(
            parseInt(req.params.id),
            req.body,
            req.user?.id
        );

        res.json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/v1/maintenance/:id - Delete maintenance record
router.delete('/:id', (req, res) => {
    try {
        const existing = db.maintenance.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Maintenance record not found' });
        }

        const deleted = db.maintenance.delete(parseInt(req.params.id));

        db.audit.log({
            user_id: req.user?.id,
            action: 'delete',
            entity_type: 'maintenance_record',
            entity_id: req.params.id,
            old_values: existing
        });

        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance/service-request - Submit service request
router.post('/service-request', (req, res) => {
    try {
        if (!req.body.forklift_id || !req.body.type) {
            return res.status(400).json({
                success: false,
                error: 'Forklift ID and type are required'
            });
        }

        const record = maintenanceService.submitServiceRequest(req.body, req.user?.id);
        res.status(201).json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance/apply-template - Apply maintenance template
router.post('/apply-template', (req, res) => {
    try {
        if (!req.body.template_id || !req.body.forklift_id) {
            return res.status(400).json({
                success: false,
                error: 'Template ID and forklift ID are required'
            });
        }

        const record = maintenanceService.applyScheduleToForklift(
            parseInt(req.body.template_id),
            req.body.forklift_id,
            req.body.scheduled_date,
            req.user?.id
        );

        res.status(201).json({ success: true, data: record });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/maintenance/check-alerts - Run maintenance alert check
router.post('/check-alerts', (req, res) => {
    try {
        const alerts = maintenanceService.checkMaintenanceAlerts();
        res.json({
            success: true,
            alerts_created: alerts.length,
            data: alerts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
