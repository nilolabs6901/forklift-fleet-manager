/**
 * Predictions API Routes - v1
 * Handles predictive maintenance endpoints
 */

const express = require('express');
const router = express.Router();
const predictiveService = require('../../../services/predictiveMaintenanceService');
const db = require('../../../config/sqlite-database');

// GET /api/v1/predictions - Get fleet-wide predictions
router.get('/', async (req, res) => {
    try {
        const fleetPredictions = predictiveService.generateFleetPredictions();

        res.json({
            success: true,
            data: fleetPredictions
        });
    } catch (error) {
        console.error('Predictions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate predictions'
        });
    }
});

// GET /api/v1/predictions/summary - Get prediction summary for dashboard
router.get('/summary', async (req, res) => {
    try {
        const fleetPredictions = predictiveService.generateFleetPredictions();

        res.json({
            success: true,
            data: fleetPredictions.summary
        });
    } catch (error) {
        console.error('Prediction summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate prediction summary'
        });
    }
});

// GET /api/v1/predictions/schedule - Get optimized maintenance schedule
router.get('/schedule', async (req, res) => {
    try {
        const daysAhead = parseInt(req.query.days) || 30;
        const schedule = predictiveService.getOptimizedSchedule(daysAhead);

        res.json({
            success: true,
            data: schedule
        });
    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate schedule'
        });
    }
});

// GET /api/v1/predictions/forklift/:id - Get predictions for specific forklift
router.get('/forklift/:id', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const prediction = predictiveService.generateForkliftPredictions(forkliftId);

        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: 'Forklift not found'
            });
        }

        res.json({
            success: true,
            data: prediction
        });
    } catch (error) {
        console.error('Forklift prediction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate forklift predictions'
        });
    }
});

// GET /api/v1/predictions/forklift/:id/usage - Get usage rate analysis
router.get('/forklift/:id/usage', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const daysBack = parseInt(req.query.days) || 90;
        const usageRate = predictiveService.calculateUsageRate(forkliftId, daysBack);

        if (!usageRate) {
            return res.status(404).json({
                success: false,
                error: 'Insufficient data for usage analysis'
            });
        }

        res.json({
            success: true,
            data: {
                forkliftId,
                analysisPeroid: `${daysBack} days`,
                ...usageRate
            }
        });
    } catch (error) {
        console.error('Usage rate error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate usage rate'
        });
    }
});

// GET /api/v1/predictions/forklift/:id/components - Get component health
router.get('/forklift/:id/components', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const componentHealth = predictiveService.getComponentHealth(forkliftId);

        if (!componentHealth) {
            return res.status(404).json({
                success: false,
                error: 'Forklift not found'
            });
        }

        res.json({
            success: true,
            data: componentHealth
        });
    } catch (error) {
        console.error('Component health error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze component health'
        });
    }
});

// GET /api/v1/predictions/forklift/:id/patterns - Get failure pattern analysis
router.get('/forklift/:id/patterns', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const daysBack = parseInt(req.query.days) || 180;
        const patterns = predictiveService.detectFailurePatterns(forkliftId, daysBack);

        res.json({
            success: true,
            data: {
                forkliftId,
                analysisPeroid: `${daysBack} days`,
                patterns
            }
        });
    } catch (error) {
        console.error('Pattern detection error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to detect failure patterns'
        });
    }
});

// GET /api/v1/predictions/forklift/:id/service - Get next service prediction
router.get('/forklift/:id/service', async (req, res) => {
    try {
        const forkliftId = req.params.id;
        const servicePrediction = predictiveService.predictNextService(forkliftId);

        if (!servicePrediction) {
            return res.status(404).json({
                success: false,
                error: 'Insufficient data for service prediction'
            });
        }

        res.json({
            success: true,
            data: servicePrediction
        });
    } catch (error) {
        console.error('Service prediction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to predict next service'
        });
    }
});

// POST /api/v1/predictions/generate-alerts - Generate prediction-based alerts
router.post('/generate-alerts', async (req, res) => {
    try {
        const alerts = predictiveService.createPredictionAlerts();

        res.json({
            success: true,
            message: `Created ${alerts.length} prediction alerts`,
            data: {
                alertsCreated: alerts.length,
                alerts: alerts.map(a => ({
                    id: a.id,
                    forkliftId: a.forklift_id,
                    title: a.title,
                    severity: a.severity
                }))
            }
        });
    } catch (error) {
        console.error('Generate alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate prediction alerts'
        });
    }
});

// POST /api/v1/predictions/:id/dismiss - Dismiss a prediction
router.post('/:id/dismiss', async (req, res) => {
    try {
        const predictionId = req.params.id;
        const { reason } = req.body;
        const userId = req.user?.id || null;

        db.raw.prepare(`
            UPDATE maintenance_predictions
            SET status = 'dismissed',
                dismissed_by = ?,
                dismissed_at = datetime('now'),
                dismissed_reason = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(userId, reason || 'Dismissed by user', predictionId);

        res.json({
            success: true,
            message: 'Prediction dismissed'
        });
    } catch (error) {
        console.error('Dismiss prediction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to dismiss prediction'
        });
    }
});

// POST /api/v1/predictions/:id/schedule - Schedule maintenance from prediction
router.post('/:id/schedule', async (req, res) => {
    try {
        const predictionId = req.params.id;
        const { scheduledDate, notes } = req.body;

        // Get prediction details
        const prediction = db.raw.prepare(`
            SELECT * FROM maintenance_predictions WHERE id = ?
        `).get(predictionId);

        if (!prediction) {
            return res.status(404).json({
                success: false,
                error: 'Prediction not found'
            });
        }

        // Create maintenance record
        const maintenance = db.maintenance.create({
            forklift_id: prediction.forklift_id,
            type: 'preventive',
            category: prediction.component_key ? getComponentCategory(prediction.component_key) : 'general',
            description: prediction.title,
            scheduled_date: scheduledDate || prediction.predicted_date,
            status: 'scheduled',
            priority: prediction.urgency === 'critical' ? 'critical' : prediction.urgency === 'high' ? 'high' : 'medium',
            notes: notes || `Scheduled from prediction: ${prediction.description}`
        });

        // Update prediction status
        db.raw.prepare(`
            UPDATE maintenance_predictions
            SET status = 'scheduled',
                scheduled_maintenance_id = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(maintenance.id, predictionId);

        res.json({
            success: true,
            message: 'Maintenance scheduled from prediction',
            data: {
                predictionId,
                maintenanceId: maintenance.id,
                scheduledDate: maintenance.scheduled_date
            }
        });
    } catch (error) {
        console.error('Schedule from prediction error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to schedule maintenance'
        });
    }
});

// Helper function to map component key to category
function getComponentCategory(componentKey) {
    const categoryMap = {
        'drive_motor': 'electrical',
        'drive_controller': 'electrical',
        'transmission': 'transmission',
        'hydraulic_pump': 'hydraulic',
        'hydraulic_cylinder': 'hydraulic',
        'hydraulic_hoses': 'hydraulic',
        'hydraulic_filter': 'hydraulic',
        'mast_chain': 'mast',
        'mast_rollers': 'mast',
        'fork_carriage': 'mast',
        'brake_pads': 'brakes',
        'brake_master_cylinder': 'brakes',
        'parking_brake': 'brakes',
        'load_wheels': 'tires',
        'drive_tires': 'tires',
        'steer_tires': 'tires',
        'battery': 'battery',
        'charger': 'battery',
        'contactor': 'electrical',
        'spark_plugs': 'engine',
        'fuel_filter': 'fuel_system',
        'air_filter': 'engine',
        'lpg_regulator': 'fuel_system'
    };
    return categoryMap[componentKey] || 'general';
}

module.exports = router;
