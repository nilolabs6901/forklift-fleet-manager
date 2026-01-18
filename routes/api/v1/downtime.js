/**
 * Downtime & Rental API Routes - v1
 * Track equipment downtime and rental costs
 */

const express = require('express');
const router = express.Router();
const db = require('../../../config/sqlite-database');
const downtimeService = require('../../../services/downtimeService');

// =================== DOWNTIME ENDPOINTS ===================

// GET /api/v1/downtime - List all downtime events
router.get('/', (req, res) => {
    try {
        const options = {
            forkliftId: req.query.forklift_id,
            status: req.query.status,
            type: req.query.type,
            limit: req.query.limit ? parseInt(req.query.limit) : null
        };

        const events = db.downtime.findAll(options);
        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/active - Get active downtime events
router.get('/active', (req, res) => {
    try {
        const events = downtimeService.getActiveDowntime();
        res.json({
            success: true,
            count: events.length,
            data: events
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/stats - Get downtime statistics
router.get('/stats', (req, res) => {
    try {
        const stats = downtimeService.getDowntimeStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/analysis - Get fleet downtime analysis
router.get('/analysis', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;
        const analysis = downtimeService.getFleetDowntimeAnalysis(months);
        res.json({ success: true, data: analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/dashboard - Get downtime dashboard summary
router.get('/dashboard', (req, res) => {
    try {
        const summary = downtimeService.getDashboardSummary();
        res.json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/:id - Get single downtime event
router.get('/:id', (req, res) => {
    try {
        const event = db.downtime.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Downtime event not found' });
        }
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/:id/total-cost - Get total cost of downtime event
router.get('/:id/total-cost', (req, res) => {
    try {
        const costs = downtimeService.calculateDowntimeTotalCost(parseInt(req.params.id));
        res.json({ success: true, data: costs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/downtime - Start downtime event
router.post('/', (req, res) => {
    try {
        if (!req.body.forklift_id) {
            return res.status(400).json({
                success: false,
                error: 'Forklift ID is required'
            });
        }

        const event = downtimeService.startDowntimeEvent(req.body, req.user?.id);
        res.status(201).json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/downtime/:id/resolve - Resolve downtime event
router.post('/:id/resolve', (req, res) => {
    try {
        const event = downtimeService.resolveDowntimeEvent(
            parseInt(req.params.id),
            req.body,
            req.user?.id
        );
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/downtime/:id/status - Update downtime status
router.put('/:id/status', (req, res) => {
    try {
        if (!req.body.status) {
            return res.status(400).json({
                success: false,
                error: 'Status is required'
            });
        }

        const event = downtimeService.updateDowntimeStatus(
            parseInt(req.params.id),
            req.body.status,
            req.body.notes
        );
        res.json({ success: true, data: event });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== RENTAL ENDPOINTS ===================

// GET /api/v1/downtime/rentals - List all rentals
router.get('/rentals/list', (req, res) => {
    try {
        const options = {
            forkliftId: req.query.forklift_id,
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : null
        };

        const rentals = db.rentals.findAll(options);
        res.json({
            success: true,
            count: rentals.length,
            data: rentals
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/rentals/active - Get active rentals
router.get('/rentals/active', (req, res) => {
    try {
        const rentals = downtimeService.getActiveRentals();
        res.json({
            success: true,
            count: rentals.length,
            data: rentals
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/rentals/stats - Get rental statistics
router.get('/rentals/stats', (req, res) => {
    try {
        const stats = downtimeService.getRentalStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/rentals/analysis - Get rental analysis
router.get('/rentals/analysis', (req, res) => {
    try {
        const months = req.query.months ? parseInt(req.query.months) : 12;
        const analysis = downtimeService.getRentalAnalysis(months);
        res.json({ success: true, data: analysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/downtime/rentals/:id - Get single rental
router.get('/rentals/:id', (req, res) => {
    try {
        const rental = db.rentals.findById(req.params.id);
        if (!rental) {
            return res.status(404).json({ success: false, error: 'Rental not found' });
        }
        res.json({ success: true, data: rental });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/downtime/rentals - Start a rental
router.post('/rentals', (req, res) => {
    try {
        if (!req.body.rental_company || !req.body.daily_rate || !req.body.reason) {
            return res.status(400).json({
                success: false,
                error: 'Rental company, daily rate, and reason are required'
            });
        }

        const rental = downtimeService.startRental(req.body, req.user?.id);
        res.status(201).json({ success: true, data: rental });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/downtime/rentals/:id/close - Close/return rental
router.post('/rentals/:id/close', (req, res) => {
    try {
        const rental = downtimeService.closeRental(
            parseInt(req.params.id),
            req.body,
            req.user?.id
        );
        res.json({ success: true, data: rental });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
