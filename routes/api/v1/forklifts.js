/**
 * Forklifts API Routes - v1
 * Complete CRUD operations for forklift management
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');
const hourMeterService = require('../../../services/hourMeterService');
const riskAssessmentService = require('../../../services/riskAssessmentService');

// GET /api/v1/forklifts - List all forklifts
router.get('/', (req, res) => {
    try {
        const options = {
            locationId: req.query.location_id,
            status: req.query.status,
            riskLevel: req.query.risk_level,
            fuelType: req.query.fuel_type,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : null,
            excludeRetired: req.query.include_retired !== 'true'
        };

        const forklifts = db.forklifts.findAll(options);
        res.json({
            success: true,
            count: forklifts.length,
            data: forklifts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/forklifts/stats - Get fleet statistics
router.get('/stats', (req, res) => {
    try {
        const stats = db.forklifts.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/forklifts/:id - Get single forklift
router.get('/:id', (req, res) => {
    try {
        const forklift = db.forklifts.findById(req.params.id);
        if (!forklift) {
            return res.status(404).json({ success: false, error: 'Forklift not found' });
        }
        res.json({ success: true, data: forklift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/forklifts - Create new forklift
router.post('/', (req, res) => {
    try {
        if (!req.body.id) {
            return res.status(400).json({ success: false, error: 'Forklift ID is required' });
        }

        // Check for duplicate
        const existing = db.forklifts.findById(req.body.id);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Forklift ID already exists' });
        }

        const forklift = db.forklifts.create(req.body);

        db.audit.log({
            user_id: req.user?.id,
            action: 'create',
            entity_type: 'forklift',
            entity_id: forklift.id,
            new_values: req.body
        });

        res.status(201).json({ success: true, data: forklift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/forklifts/:id - Update forklift
router.put('/:id', (req, res) => {
    try {
        const existing = db.forklifts.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Forklift not found' });
        }

        const forklift = db.forklifts.update(req.params.id, req.body);

        db.audit.log({
            user_id: req.user?.id,
            action: 'update',
            entity_type: 'forklift',
            entity_id: req.params.id,
            old_values: existing,
            new_values: req.body
        });

        res.json({ success: true, data: forklift });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/v1/forklifts/:id - Delete forklift
router.delete('/:id', (req, res) => {
    try {
        const existing = db.forklifts.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Forklift not found' });
        }

        const deleted = db.forklifts.delete(req.params.id);

        db.audit.log({
            user_id: req.user?.id,
            action: 'delete',
            entity_type: 'forklift',
            entity_id: req.params.id,
            old_values: existing
        });

        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== HOUR METER ENDPOINTS ===================

// GET /api/v1/forklifts/:id/hours - Get hour meter history
router.get('/:id/hours', (req, res) => {
    try {
        const history = hourMeterService.getHistory(req.params.id, {
            limit: req.query.limit ? parseInt(req.query.limit) : 100
        });
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/forklifts/:id/hours - Record hour meter reading
router.post('/:id/hours', (req, res) => {
    try {
        if (req.body.reading === undefined) {
            return res.status(400).json({ success: false, error: 'Reading value is required' });
        }

        const result = hourMeterService.recordReading(
            req.params.id,
            parseFloat(req.body.reading),
            req.body.source || 'manual',
            req.user?.id
        );

        res.status(201).json({
            success: true,
            data: result.reading,
            anomalies: result.anomalies,
            forklift: result.forklift
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/forklifts/:id/hours/trends - Get hour meter trends
router.get('/:id/hours/trends', (req, res) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 90;
        const trends = hourMeterService.getTrends(req.params.id, days);
        res.json({ success: true, data: trends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== RISK ASSESSMENT ENDPOINTS ===================

// GET /api/v1/forklifts/:id/risk - Get risk assessment
router.get('/:id/risk', (req, res) => {
    try {
        const assessment = db.riskAssessments.getLatest(req.params.id);
        if (!assessment) {
            return res.status(404).json({ success: false, error: 'No risk assessment found' });
        }
        res.json({ success: true, data: assessment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/forklifts/:id/risk/assess - Perform risk assessment
router.post('/:id/risk/assess', async (req, res) => {
    try {
        const assessment = await riskAssessmentService.assessForklift(req.params.id);
        res.json({ success: true, data: assessment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/forklifts/:id/risk/history - Get risk assessment history
router.get('/:id/risk/history', (req, res) => {
    try {
        const history = db.riskAssessments.findByForklift(req.params.id);
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== MAINTENANCE ENDPOINTS ===================

// GET /api/v1/forklifts/:id/maintenance - Get maintenance history
router.get('/:id/maintenance', (req, res) => {
    try {
        const maintenanceService = require('../../../services/maintenanceService');
        const history = maintenanceService.getForkliftMaintenanceHistory(req.params.id, {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            months: req.query.months ? parseInt(req.query.months) : 12
        });
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== DOWNTIME ENDPOINTS ===================

// GET /api/v1/forklifts/:id/downtime - Get downtime history
router.get('/:id/downtime', (req, res) => {
    try {
        const downtimeService = require('../../../services/downtimeService');
        const history = downtimeService.getForkliftDowntime(req.params.id, {
            limit: req.query.limit ? parseInt(req.query.limit) : 50
        });
        res.json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== ALERTS ENDPOINTS ===================

// GET /api/v1/forklifts/:id/alerts - Get alerts for forklift
router.get('/:id/alerts', (req, res) => {
    try {
        const alertService = require('../../../services/alertService');
        const alerts = alertService.getForkliftAlerts(req.params.id, {
            limit: req.query.limit ? parseInt(req.query.limit) : 50
        });
        res.json({ success: true, data: alerts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== DETAIL VIEW ENDPOINT ===================

// GET /api/v1/forklifts/:id/detail - Get complete forklift detail view
router.get('/:id/detail', async (req, res) => {
    try {
        const forklift = db.forklifts.findById(req.params.id);
        if (!forklift) {
            return res.status(404).json({ success: false, error: 'Forklift not found' });
        }

        const maintenanceService = require('../../../services/maintenanceService');
        const downtimeService = require('../../../services/downtimeService');
        const alertService = require('../../../services/alertService');

        // Gather all related data
        const [
            riskAssessment,
            maintenanceHistory,
            downtimeHistory,
            alerts,
            hourHistory
        ] = await Promise.all([
            db.riskAssessments.getLatest(req.params.id),
            maintenanceService.getForkliftMaintenanceHistory(req.params.id, { limit: 20, months: 12 }),
            downtimeService.getForkliftDowntime(req.params.id, { limit: 20 }),
            alertService.getForkliftAlerts(req.params.id, { limit: 20 }),
            hourMeterService.getHistory(req.params.id, { limit: 30 })
        ]);

        res.json({
            success: true,
            data: {
                forklift,
                risk_assessment: riskAssessment,
                maintenance: maintenanceHistory,
                downtime: downtimeHistory,
                alerts,
                hour_meter_history: hourHistory
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
