/**
 * Dashboard & Page Routes
 * Renders HTML views for the fleet management system
 */

const express = require('express');
const router = express.Router();
const db = require('../config/sqlite-database');
const maintenanceService = require('../services/maintenanceService');
const downtimeService = require('../services/downtimeService');
const alertService = require('../services/alertService');
const riskAssessmentService = require('../services/riskAssessmentService');
const hourMeterService = require('../services/hourMeterService');

// Dashboard home
router.get('/', (req, res) => {
    try {
        const forkliftStats = db.forklifts.getStats();
        const alertStats = alertService.getAlertStats();
        const maintenanceStats = db.maintenance.getStats();
        const recentAlerts = alertService.getActiveAlerts({ limit: 5 });
        const maintenanceSchedule = maintenanceService.getMaintenanceSchedule();
        const locations = db.locations.findAll();
        const downtimeSummary = downtimeService.getDashboardSummary();
        const monthlyCosts = db.maintenance.getMonthlyCosts(6);

        res.render('dashboard', {
            title: 'Dashboard',
            forkliftStats,
            alertStats,
            maintenanceStats,
            recentAlerts,
            maintenanceDue: maintenanceSchedule.overdue.units.slice(0, 5),
            maintenanceSchedule,
            locations,
            downtimeSummary,
            monthlyCosts
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.render('dashboard', {
            title: 'Dashboard',
            forkliftStats: { total: 0, active: 0, in_maintenance: 0, out_of_service: 0, high_risk: 0, critical_risk: 0 },
            alertStats: { active_alerts: 0, critical_count: 0, high_count: 0 },
            maintenanceStats: { monthly_cost: 0, yearly_cost: 0 },
            recentAlerts: [],
            maintenanceDue: [],
            maintenanceSchedule: { total_due: 0, overdue: { count: 0 } },
            locations: [],
            downtimeSummary: { downtime: {}, rentals: {} },
            monthlyCosts: []
        });
    }
});

// Forklifts list
router.get('/forklifts', (req, res) => {
    const { status, location, risk, search } = req.query;

    const forklifts = db.forklifts.findAll({
        status,
        locationId: location ? parseInt(location) : null,
        riskLevel: risk,
        search
    });
    const locations = db.locations.findAll();

    res.render('forklifts/index', {
        title: 'Fleet Inventory',
        forklifts,
        locations,
        filters: { status, location, risk, search }
    });
});

// Add forklift form
router.get('/forklifts/new', (req, res) => {
    const locations = db.locations.findAll();
    res.render('forklifts/form', {
        title: 'Add Forklift',
        forklift: null,
        locations,
        isEdit: false
    });
});

// Forklift detail
router.get('/forklifts/:id', (req, res) => {
    const forklift = db.forklifts.findById(req.params.id);

    if (!forklift) {
        return res.status(404).render('errors/404', { title: 'Forklift Not Found' });
    }

    const maintenanceHistory = maintenanceService.getForkliftMaintenanceHistory(req.params.id, { limit: 20 });
    const alerts = alertService.getForkliftAlerts(req.params.id, { limit: 20 });
    const hourLogs = hourMeterService.getHistory(req.params.id, { limit: 30 });
    const riskAssessment = db.riskAssessments.getLatest(req.params.id);
    const downtimeHistory = downtimeService.getForkliftDowntime(req.params.id, { limit: 10 });
    const hourTrends = hourMeterService.getTrends(req.params.id, 90);

    // Get location with service center info
    const location = forklift.location_id ? db.locations.findById(forklift.location_id) : null;

    res.render('forklifts/detail', {
        title: `Forklift ${forklift.id}`,
        forklift,
        location,
        maintenanceHistory,
        alerts,
        hourLogs,
        riskAssessment,
        downtimeHistory,
        hourTrends
    });
});

// Edit forklift form
router.get('/forklifts/:id/edit', (req, res) => {
    const forklift = db.forklifts.findById(req.params.id);

    if (!forklift) {
        return res.status(404).render('errors/404', { title: 'Forklift Not Found' });
    }

    const locations = db.locations.findAll();

    res.render('forklifts/form', {
        title: `Edit Forklift ${forklift.id}`,
        forklift,
        locations,
        isEdit: true
    });
});

// Maintenance records list
router.get('/maintenance', (req, res) => {
    const { forklift, type, status } = req.query;

    const records = db.maintenance.findAll({
        forkliftId: forklift,
        type,
        status
    });
    const forklifts = db.forklifts.findAll();
    const maintenanceStats = db.maintenance.getStats();
    const schedule = maintenanceService.getMaintenanceSchedule();
    const typeBreakdown = db.maintenance.getTypeBreakdown ? db.maintenance.getTypeBreakdown() : [];

    res.render('maintenance/index', {
        title: 'Maintenance Records',
        records,
        forklifts,
        maintenanceStats,
        schedule,
        typeBreakdown,
        filters: { forklift, type, status }
    });
});

// Add maintenance record form
router.get('/maintenance/new', (req, res) => {
    const forklifts = db.forklifts.findAll();
    const forkliftId = req.query.forklift || null;

    res.render('maintenance/form', {
        title: 'Log Maintenance',
        record: null,
        forklifts,
        selectedForkliftId: forkliftId,
        isEdit: false
    });
});

// Alerts list
router.get('/alerts', (req, res) => {
    const { severity, resolved, forklift, type } = req.query;

    const alerts = db.alerts.findAll({
        severity,
        type,
        isResolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        forkliftId: forklift
    });
    const alertStats = alertService.getAlertStats();
    const forklifts = db.forklifts.findAll();
    const dashboard = alertService.getDashboardSummary();

    res.render('alerts/index', {
        title: 'Alerts',
        alerts,
        alertStats,
        forklifts,
        dashboard,
        filters: { severity, resolved, forklift, type }
    });
});

// Locations list
router.get('/locations', (req, res) => {
    const locations = db.locations.findAll();
    const locationStats = db.locations.getStats();

    res.render('locations/index', {
        title: 'Locations',
        locations,
        locationStats
    });
});

// Location detail
router.get('/locations/:id', (req, res) => {
    const location = db.locations.findById(req.params.id);

    if (!location) {
        return res.status(404).render('errors/404', { title: 'Location Not Found' });
    }

    const forklifts = db.forklifts.getByLocation(parseInt(req.params.id));

    res.render('locations/detail', {
        title: location.name,
        location,
        forklifts
    });
});

// Reports page
router.get('/reports', (req, res) => {
    const forkliftStats = db.forklifts.getStats();
    const maintenanceStats = db.maintenance.getStats();
    const monthlyCosts = db.maintenance.getMonthlyCosts(12);
    const alertStats = alertService.getAlertStats();
    const locations = db.locations.findAll();
    const downtimeAnalysis = downtimeService.getFleetDowntimeAnalysis(12);
    const rentalAnalysis = downtimeService.getRentalAnalysis(12);
    const riskSummary = riskAssessmentService.getFleetRiskSummary();
    const costAnalysis = maintenanceService.getCostAnalysis({ months: 12 });

    // Get maintenance type breakdown
    const typeBreakdown = db.maintenance.getTypeBreakdown ? db.maintenance.getTypeBreakdown() : [];

    // Get alert severity breakdown
    const severityBreakdown = db.alerts.getSeverityBreakdown ? db.alerts.getSeverityBreakdown() : [];

    res.render('reports/index', {
        title: 'Reports & Analytics',
        forkliftStats,
        maintenanceStats,
        monthlyCosts,
        alertStats,
        locations,
        downtimeAnalysis,
        rentalAnalysis,
        riskSummary,
        costAnalysis,
        typeBreakdown,
        severityBreakdown
    });
});

// Risk Analysis page
router.get('/risk-analysis', (req, res) => {
    const riskSummary = riskAssessmentService.getFleetRiskSummary();
    const highRiskUnits = db.forklifts.findAll({ riskLevel: 'high' });
    const criticalUnits = db.forklifts.findAll({ riskLevel: 'critical' });
    const replacementRecommendations = riskAssessmentService.getReplacementBudgetRecommendations(new Date().getFullYear() + 1);

    res.render('reports/risk-analysis', {
        title: 'Risk Analysis',
        riskSummary,
        highRiskUnits,
        criticalUnits,
        replacementRecommendations
    });
});

// Downtime tracking page
router.get('/downtime', (req, res) => {
    const activeDowntime = downtimeService.getActiveDowntime();
    const activeRentals = downtimeService.getActiveRentals();
    const downtimeAnalysis = downtimeService.getFleetDowntimeAnalysis(12);
    const rentalAnalysis = downtimeService.getRentalAnalysis(12);
    const summary = downtimeService.getDashboardSummary();

    res.render('downtime/index', {
        title: 'Downtime & Rentals',
        activeDowntime,
        activeRentals,
        downtimeAnalysis,
        rentalAnalysis,
        summary
    });
});

// Budget planning page
router.get('/budget', (req, res) => {
    const fiscalYear = req.query.year ? parseInt(req.query.year) : new Date().getFullYear() + 1;
    const replacementRecommendations = riskAssessmentService.getReplacementBudgetRecommendations(fiscalYear);
    const maintenanceStats = db.maintenance.getStats();
    const downtimeStats = downtimeService.getDowntimeStats();
    const rentalStats = downtimeService.getRentalStats();

    res.render('reports/budget', {
        title: 'Budget Planning',
        fiscalYear,
        replacementRecommendations,
        maintenanceStats,
        downtimeStats,
        rentalStats
    });
});

// Hour meter review page (admin)
router.get('/hour-meter-review', (req, res) => {
    const flaggedReadings = hourMeterService.getFlaggedReadings(50);
    const summary = hourMeterService.getFleetSummary();

    res.render('admin/hour-meter-review', {
        title: 'Hour Meter Review',
        flaggedReadings,
        summary
    });
});

// Settings page (admin)
router.get('/settings', (req, res) => {
    const settings = db.settings.getAll();
    const users = db.users.findAll();

    res.render('admin/settings', {
        title: 'Settings',
        settings,
        users
    });
});

// Predictions page
router.get('/predictions', (req, res) => {
    const locations = db.locations.findAll();

    res.render('predictions/index', {
        title: 'Predictive Maintenance',
        locations
    });
});

// Shared report view (public - no auth required)
router.get('/share/:token', (req, res) => {
    const token = req.params.token;

    const report = db.raw.prepare(`
        SELECT * FROM shared_reports WHERE share_token = ? AND is_active = 1
    `).get(token);

    if (!report) {
        return res.status(404).render('share/not-found', {
            title: 'Report Not Found',
            layout: 'layout-minimal'
        });
    }

    // Check expiration
    if (report.expires_at && new Date(report.expires_at) < new Date()) {
        return res.status(410).render('share/expired', {
            title: 'Report Expired',
            layout: 'layout-minimal'
        });
    }

    // Check view limit
    if (report.max_views && report.view_count >= report.max_views) {
        return res.status(410).render('share/expired', {
            title: 'View Limit Reached',
            layout: 'layout-minimal',
            message: 'This shared report has reached its maximum view limit.'
        });
    }

    // Update view count
    db.raw.prepare(`
        UPDATE shared_reports
        SET view_count = view_count + 1, last_accessed_at = datetime('now')
        WHERE id = ?
    `).run(report.id);

    const reportData = JSON.parse(report.report_data);

    res.render(`share/${report.report_type}`, {
        title: report.report_title || 'Shared Report',
        layout: 'layout-minimal',
        report: reportData,
        meta: {
            type: report.report_type,
            title: report.report_title,
            createdAt: report.created_at,
            expiresAt: report.expires_at,
            viewCount: report.view_count + 1
        }
    });
});

module.exports = router;
