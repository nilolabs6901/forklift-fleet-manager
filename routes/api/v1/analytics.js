/**
 * Analytics & Dashboard API Routes - v1
 * Fleet-wide analytics, KPIs, and dashboard data
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');
const riskAssessmentService = require('../../../services/riskAssessmentService');
const maintenanceService = require('../../../services/maintenanceService');
const downtimeService = require('../../../services/downtimeService');
const alertService = require('../../../services/alertService');
const hourMeterService = require('../../../services/hourMeterService');

// GET /api/v1/analytics/dashboard - Main dashboard data
router.get('/dashboard', async (req, res) => {
    try {
        // Gather all dashboard data in parallel
        const [
            forkliftStats,
            maintenanceStats,
            alertStats,
            downtimeSummary,
            maintenanceSchedule
        ] = await Promise.all([
            db.forklifts.getStats(),
            db.maintenance.getStats(),
            alertService.getAlertStats(),
            downtimeService.getDashboardSummary(),
            maintenanceService.getMaintenanceSchedule()
        ]);

        res.json({
            success: true,
            data: {
                fleet: {
                    total_units: forkliftStats.total,
                    active: forkliftStats.active,
                    in_maintenance: forkliftStats.in_maintenance,
                    out_of_service: forkliftStats.out_of_service,
                    average_hours: Math.round(forkliftStats.avg_hours || 0),
                    average_risk_score: (forkliftStats.avg_risk_score || 0).toFixed(1)
                },
                risk: {
                    critical: forkliftStats.critical_risk,
                    high: forkliftStats.high_risk,
                    medium: forkliftStats.medium_risk,
                    low: forkliftStats.low_risk
                },
                maintenance: {
                    due_count: maintenanceSchedule.total_due,
                    overdue_count: maintenanceSchedule.overdue.count,
                    scheduled_count: maintenanceSchedule.scheduled.count,
                    monthly_cost: maintenanceStats.monthly_cost,
                    yearly_cost: maintenanceStats.yearly_cost
                },
                alerts: {
                    active: alertStats.active_alerts,
                    critical: alertStats.critical_count,
                    high: alertStats.high_count,
                    medium: alertStats.medium_count,
                    low: alertStats.low_count
                },
                downtime: downtimeSummary.downtime,
                rentals: downtimeSummary.rentals
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/kpis - Key Performance Indicators
router.get('/kpis', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;

        const forkliftStats = db.forklifts.getStats();
        const maintenanceStats = db.maintenance.getStats();
        const downtimeStats = downtimeService.getDowntimeStats();
        const rentalStats = downtimeService.getRentalStats();

        // Calculate KPIs
        const totalUnits = forkliftStats.total || 1; // Avoid division by zero
        const avgMaintenanceCostPerUnit = maintenanceStats.yearly_cost / totalUnits;
        const avgDowntimePerUnit = (downtimeStats.total_downtime_hours || 0) / totalUnits;

        // Get monthly data for trend calculation
        const monthlyCosts = db.maintenance.getMonthlyCosts(months);
        const costTrend = monthlyCosts.length >= 2
            ? ((monthlyCosts[monthlyCosts.length - 1]?.total_cost || 0) -
               (monthlyCosts[0]?.total_cost || 0)) / (monthlyCosts[0]?.total_cost || 1) * 100
            : 0;

        res.json({
            success: true,
            data: {
                fleet_utilization: {
                    value: ((forkliftStats.active / totalUnits) * 100).toFixed(1),
                    unit: '%',
                    description: 'Percentage of fleet in active service'
                },
                average_maintenance_cost_per_unit: {
                    value: Math.round(avgMaintenanceCostPerUnit),
                    unit: '$/unit/year',
                    description: 'Annual maintenance cost per forklift'
                },
                average_downtime_per_unit: {
                    value: avgDowntimePerUnit.toFixed(1),
                    unit: 'hours/unit/year',
                    description: 'Average downtime hours per forklift'
                },
                maintenance_cost_trend: {
                    value: costTrend.toFixed(1),
                    unit: '%',
                    description: `Change in maintenance costs over ${months} months`
                },
                high_risk_units: {
                    value: (forkliftStats.critical_risk || 0) + (forkliftStats.high_risk || 0),
                    unit: 'units',
                    description: 'Units requiring attention (risk score 7+)'
                },
                total_downtime_cost: {
                    value: Math.round(downtimeStats.total_downtime_cost || 0),
                    unit: '$',
                    description: 'Total cost of equipment downtime'
                },
                total_rental_cost: {
                    value: Math.round(rentalStats.total_cost || 0),
                    unit: '$',
                    description: 'Total rental equipment costs'
                },
                cost_per_operating_hour: {
                    value: forkliftStats.avg_hours > 0
                        ? (maintenanceStats.yearly_cost / (forkliftStats.avg_hours * totalUnits)).toFixed(2)
                        : 0,
                    unit: '$/hour',
                    description: 'Maintenance cost per operating hour'
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/trends - Cost and maintenance trends
router.get('/trends', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;

        const maintenanceTrends = db.maintenance.getMonthlyCosts(months);
        const downtimeAnalysis = downtimeService.getFleetDowntimeAnalysis(months);
        const rentalAnalysis = downtimeService.getRentalAnalysis(months);

        res.json({
            success: true,
            data: {
                maintenance_costs: maintenanceTrends,
                downtime: downtimeAnalysis.monthly_trends,
                rentals: rentalAnalysis.monthly_trends
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/risk-distribution - Fleet risk distribution
router.get('/risk-distribution', (req, res) => {
    try {
        const summary = riskAssessmentService.getFleetRiskSummary();
        const forklifts = db.forklifts.findAll();

        // Get detailed distribution
        const distribution = {
            '1-2': forklifts.filter(f => f.risk_score >= 1 && f.risk_score <= 2).length,
            '3-4': forklifts.filter(f => f.risk_score >= 3 && f.risk_score <= 4).length,
            '5-6': forklifts.filter(f => f.risk_score >= 5 && f.risk_score <= 6).length,
            '7-8': forklifts.filter(f => f.risk_score >= 7 && f.risk_score <= 8).length,
            '9-10': forklifts.filter(f => f.risk_score >= 9 && f.risk_score <= 10).length
        };

        res.json({
            success: true,
            data: {
                summary,
                distribution,
                high_risk_units: forklifts
                    .filter(f => f.risk_score >= 7)
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .slice(0, 10)
                    .map(f => ({
                        id: f.id,
                        model: f.model,
                        location: f.location_name,
                        risk_score: f.risk_score,
                        risk_level: f.risk_level,
                        recommended_action: f.recommended_action
                    }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/cost-analysis - Detailed cost analysis
router.get('/cost-analysis', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;
        const maintenanceAnalysis = maintenanceService.getCostAnalysis({ months });
        const downtimeAnalysis = downtimeService.getFleetDowntimeAnalysis(months);
        const rentalAnalysis = downtimeService.getRentalAnalysis(months);

        const totalMaintenanceCost = maintenanceAnalysis.summary.yearly_cost || 0;
        const totalDowntimeCost = downtimeAnalysis.total_cost || 0;
        const totalRentalCost = rentalAnalysis.total_cost || 0;
        const grandTotal = totalMaintenanceCost + totalDowntimeCost + totalRentalCost;

        res.json({
            success: true,
            data: {
                summary: {
                    total_cost: grandTotal,
                    maintenance_cost: totalMaintenanceCost,
                    downtime_cost: totalDowntimeCost,
                    rental_cost: totalRentalCost,
                    maintenance_percentage: grandTotal > 0 ? ((totalMaintenanceCost / grandTotal) * 100).toFixed(1) : 0,
                    downtime_percentage: grandTotal > 0 ? ((totalDowntimeCost / grandTotal) * 100).toFixed(1) : 0,
                    rental_percentage: grandTotal > 0 ? ((totalRentalCost / grandTotal) * 100).toFixed(1) : 0
                },
                maintenance: maintenanceAnalysis,
                downtime: downtimeAnalysis,
                rentals: rentalAnalysis
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/replacement-planning - Replacement budget recommendations
router.get('/replacement-planning', (req, res) => {
    try {
        const fiscalYear = req.query.fiscal_year || new Date().getFullYear() + 1;
        const recommendations = riskAssessmentService.getReplacementBudgetRecommendations(fiscalYear);
        res.json({ success: true, data: recommendations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/location-comparison - Compare metrics by location
router.get('/location-comparison', (req, res) => {
    try {
        const locations = db.locations.findAll();
        const comparison = locations.map(location => {
            const forklifts = db.forklifts.findAll({ locationId: location.id });
            const maintenanceCosts = forklifts.reduce((sum, f) => {
                const costs = db.maintenance.getCostByForklift(f.id, 12);
                return sum + (costs?.total_cost || 0);
            }, 0);

            const avgRisk = forklifts.length > 0
                ? forklifts.reduce((sum, f) => sum + (f.risk_score || 0), 0) / forklifts.length
                : 0;

            return {
                location_id: location.id,
                location_name: location.name,
                unit_count: forklifts.length,
                active_units: forklifts.filter(f => f.status === 'active').length,
                high_risk_units: forklifts.filter(f => f.risk_score >= 7).length,
                average_risk_score: avgRisk.toFixed(1),
                total_maintenance_cost: maintenanceCosts,
                avg_cost_per_unit: forklifts.length > 0 ? Math.round(maintenanceCosts / forklifts.length) : 0
            };
        });

        res.json({
            success: true,
            data: comparison.sort((a, b) => b.total_maintenance_cost - a.total_maintenance_cost)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/analytics/assess-fleet - Run risk assessment on entire fleet
router.post('/assess-fleet', async (req, res) => {
    try {
        const results = await riskAssessmentService.assessFleet();
        res.json({
            success: true,
            data: {
                total_assessed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/hour-meter-summary - Fleet hour meter summary
router.get('/hour-meter-summary', (req, res) => {
    try {
        const summary = hourMeterService.getFleetSummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/analytics/flagged-readings - Get flagged hour meter readings
router.get('/flagged-readings', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const flagged = hourMeterService.getFlaggedReadings(limit);
        res.json({
            success: true,
            count: flagged.length,
            data: flagged
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
