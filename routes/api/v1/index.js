/**
 * API v1 Router Index
 * Aggregates all v1 API routes
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        req.user = null;
    }

    next();
};

// Role-based access control middleware
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions'
            });
        }

        next();
    };
};

// Apply authentication middleware to all routes
router.use(authenticate);

// Import route modules
const forkliftRoutes = require('./forklifts');
const maintenanceRoutes = require('./maintenance');
const alertRoutes = require('./alerts');
const downtimeRoutes = require('./downtime');
const analyticsRoutes = require('./analytics');
const locationRoutes = require('./locations');
const userRoutes = require('./users');
const invoiceRoutes = require('./invoices');
const chatRoutes = require('./chat');
const predictionRoutes = require('./predictions');
const shareRoutes = require('./share');

// Mount routes
router.use('/forklifts', forkliftRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/alerts', alertRoutes);
router.use('/downtime', downtimeRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/locations', locationRoutes);
router.use('/users', userRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/chat', chatRoutes);
router.use('/predictions', predictionRoutes);
router.use('/share', shareRoutes);

// API info endpoint
router.get('/', (req, res) => {
    res.json({
        success: true,
        api: 'Forklift Fleet Manager API',
        version: 'v1',
        endpoints: {
            forklifts: '/api/v1/forklifts',
            maintenance: '/api/v1/maintenance',
            alerts: '/api/v1/alerts',
            downtime: '/api/v1/downtime',
            analytics: '/api/v1/analytics',
            locations: '/api/v1/locations',
            users: '/api/v1/users',
            predictions: '/api/v1/predictions'
        }
    });
});

// Export middleware for use in other files
router.authenticate = authenticate;
router.requireRole = requireRole;

module.exports = router;
