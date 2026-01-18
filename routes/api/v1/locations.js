/**
 * Locations API Routes - v1
 * Warehouse/location management
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');

// GET /api/v1/locations - List all locations
router.get('/', (req, res) => {
    try {
        const locations = db.locations.findAll();
        res.json({
            success: true,
            count: locations.length,
            data: locations
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/locations/stats - Get location statistics
router.get('/stats', (req, res) => {
    try {
        const stats = db.locations.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/locations/:id - Get single location
router.get('/:id', (req, res) => {
    try {
        const location = db.locations.findById(req.params.id);
        if (!location) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }
        res.json({ success: true, data: location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/locations/:id/forklifts - Get forklifts at location
router.get('/:id/forklifts', (req, res) => {
    try {
        const forklifts = db.forklifts.getByLocation(parseInt(req.params.id));
        res.json({
            success: true,
            count: forklifts.length,
            data: forklifts
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/locations/:id/summary - Get location summary with metrics
router.get('/:id/summary', (req, res) => {
    try {
        const location = db.locations.findById(req.params.id);
        if (!location) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        const forklifts = db.forklifts.getByLocation(parseInt(req.params.id));

        // Calculate metrics
        const activeCount = forklifts.filter(f => f.status === 'active').length;
        const maintenanceCount = forklifts.filter(f => f.status === 'maintenance').length;
        const outOfServiceCount = forklifts.filter(f => f.status === 'out_of_service').length;
        const highRiskCount = forklifts.filter(f => f.risk_score >= 7).length;
        const avgRisk = forklifts.length > 0
            ? forklifts.reduce((sum, f) => sum + (f.risk_score || 0), 0) / forklifts.length
            : 0;

        // Get maintenance costs
        const totalMaintenanceCost = forklifts.reduce((sum, f) => {
            const costs = db.maintenance.getCostByForklift(f.id, 12);
            return sum + (costs?.total_cost || 0);
        }, 0);

        // Get active alerts
        const alertService = require('../../../services/alertService');
        const alerts = forklifts.reduce((all, f) => {
            return all.concat(alertService.getForkliftAlerts(f.id, { limit: 10 }));
        }, []).filter(a => !a.is_resolved).slice(0, 10);

        res.json({
            success: true,
            data: {
                location,
                metrics: {
                    total_units: forklifts.length,
                    active: activeCount,
                    in_maintenance: maintenanceCount,
                    out_of_service: outOfServiceCount,
                    high_risk: highRiskCount,
                    average_risk_score: avgRisk.toFixed(1),
                    utilization: forklifts.length > 0
                        ? ((activeCount / forklifts.length) * 100).toFixed(1)
                        : 0,
                    total_maintenance_cost_12m: totalMaintenanceCost
                },
                active_alerts: alerts,
                forklifts: forklifts.slice(0, 20) // First 20 forklifts
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/locations - Create location
router.post('/', (req, res) => {
    try {
        if (!req.body.name) {
            return res.status(400).json({ success: false, error: 'Location name is required' });
        }

        // Check for duplicate
        const existing = db.locations.findByName(req.body.name);
        if (existing) {
            return res.status(409).json({ success: false, error: 'Location name already exists' });
        }

        const location = db.locations.create(req.body);

        db.audit.log({
            user_id: req.user?.id,
            action: 'create',
            entity_type: 'location',
            entity_id: location.id.toString(),
            new_values: req.body
        });

        res.status(201).json({ success: true, data: location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/locations/:id - Update location
router.put('/:id', (req, res) => {
    try {
        const existing = db.locations.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        const location = db.locations.update(parseInt(req.params.id), req.body);

        db.audit.log({
            user_id: req.user?.id,
            action: 'update',
            entity_type: 'location',
            entity_id: req.params.id,
            old_values: existing,
            new_values: req.body
        });

        res.json({ success: true, data: location });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/v1/locations/:id - Delete (deactivate) location
router.delete('/:id', (req, res) => {
    try {
        const existing = db.locations.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        // Check if location has forklifts
        const forklifts = db.forklifts.getByLocation(parseInt(req.params.id));
        if (forklifts.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete location with ${forklifts.length} assigned forklifts`
            });
        }

        const deleted = db.locations.delete(parseInt(req.params.id));

        db.audit.log({
            user_id: req.user?.id,
            action: 'delete',
            entity_type: 'location',
            entity_id: req.params.id,
            old_values: existing
        });

        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
