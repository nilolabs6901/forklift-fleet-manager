/**
 * Forklift Fleet Manager - Enterprise Server
 * Comprehensive fleet management system for regional operators
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database
const db = require('./config/sqlite-database');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fleet-manager-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60 * 1000 // 8 hours
    }
}));

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Make current path and user available to all views
app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.user = req.session?.user || null;
    next();
});

// =================== API ROUTES ===================

// API v1 routes
app.use('/api/v1', require('./routes/api/v1'));

// Legacy API routes (for backward compatibility)
app.use('/api/forklifts', require('./routes/api/forklifts'));
app.use('/api/locations', require('./routes/api/locations'));
app.use('/api/maintenance', require('./routes/api/maintenance'));
app.use('/api/alerts', require('./routes/api/alerts'));

// =================== PAGE ROUTES ===================

// Dashboard and page routes
app.use('/', require('./routes/dashboard'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        version: '2.0.0',
        database: 'sqlite'
    });
});

// API documentation redirect
app.get('/api', (req, res) => {
    res.redirect('/api/v1');
});

// =================== ERROR HANDLING ===================

// 404 handler
app.use((req, res, next) => {
    // API 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });
    }

    // Page 404
    res.status(404).render('errors/404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);

    // API error response
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : err.message
        });
    }

    // Page error response
    res.status(500).render('errors/500', {
        title: 'Server Error',
        error: process.env.NODE_ENV === 'production' ? {} : err
    });
});

// =================== SERVER STARTUP ===================

app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Forklift Fleet Manager v2.0');
    console.log('='.repeat(50));
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api/v1`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(50));
});

module.exports = app;
