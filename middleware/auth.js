/**
 * Authentication Middleware
 * JWT-based authentication and role-based access control
 */

const jwt = require('jsonwebtoken');
const db = require('../config/sqlite-database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Extract and verify JWT token from request
 */
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

        // Optionally verify user still exists and is active
        const user = db.users.findById(decoded.id);
        if (!user || !user.is_active) {
            req.user = null;
        }
    } catch (error) {
        req.user = null;
    }

    next();
};

/**
 * Require authentication - returns 401 if not authenticated
 */
const requireAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    next();
};

/**
 * Require specific role(s) - returns 403 if role not matched
 */
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

/**
 * Check if user has admin role
 */
const isAdmin = (req, res, next) => {
    return requireRole('admin')(req, res, next);
};

/**
 * Check if user has fleet manager or admin role
 */
const isFleetManager = (req, res, next) => {
    return requireRole('admin', 'fleet_manager')(req, res, next);
};

/**
 * Check if user has technician or higher role
 */
const isTechnician = (req, res, next) => {
    return requireRole('admin', 'fleet_manager', 'technician')(req, res, next);
};

/**
 * API key authentication for external integrations
 */
const authenticateApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        return next();
    }

    try {
        // Hash the provided key to compare with stored hash
        const crypto = require('crypto');
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        const keyRecord = db.raw.prepare(`
            SELECT ak.*, u.email, u.role
            FROM api_keys ak
            LEFT JOIN users u ON ak.user_id = u.id
            WHERE ak.key_hash = ? AND ak.is_active = 1
        `).get(keyHash);

        if (!keyRecord) {
            return res.status(401).json({
                success: false,
                error: 'Invalid API key'
            });
        }

        // Check expiration
        if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
            return res.status(401).json({
                success: false,
                error: 'API key expired'
            });
        }

        // Update last used
        db.raw.prepare('UPDATE api_keys SET last_used_at = datetime("now") WHERE id = ?')
            .run(keyRecord.id);

        // Set user context from API key
        req.user = {
            id: keyRecord.user_id,
            email: keyRecord.email,
            role: keyRecord.role,
            api_key_id: keyRecord.id,
            permissions: JSON.parse(keyRecord.permissions || '["read"]')
        };

        next();
    } catch (error) {
        res.status(500).json({ success: false, error: 'API key validation failed' });
    }
};

/**
 * Combined auth - supports both JWT and API key
 */
const authenticateAny = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    if (apiKey) {
        return authenticateApiKey(req, res, next);
    } else if (authHeader) {
        return authenticate(req, res, next);
    } else {
        req.user = null;
        next();
    }
};

/**
 * Session-based authentication for web views
 */
const authenticateSession = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
    } else {
        req.user = null;
    }
    next();
};

/**
 * Require session authentication - redirect to login if not authenticated
 */
const requireSession = (req, res, next) => {
    if (!req.user) {
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    next();
};

module.exports = {
    authenticate,
    requireAuth,
    requireRole,
    isAdmin,
    isFleetManager,
    isTechnician,
    authenticateApiKey,
    authenticateAny,
    authenticateSession,
    requireSession
};
