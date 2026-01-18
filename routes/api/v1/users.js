/**
 * Users API Routes - v1
 * User management and authentication
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../../config/sqlite-database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h';

// =================== AUTHENTICATION ===================

// POST /api/v1/users/login - User login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        const user = db.users.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        db.users.updateLastLogin(user.id);

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Log the login
        db.audit.log({
            user_id: user.id,
            user_email: user.email,
            action: 'login',
            entity_type: 'user',
            entity_id: user.id.toString(),
            ip_address: req.ip
        });

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/users/logout - User logout
router.post('/logout', (req, res) => {
    try {
        if (req.user) {
            db.audit.log({
                user_id: req.user.id,
                action: 'logout',
                entity_type: 'user',
                entity_id: req.user.id.toString()
            });
        }

        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/users/me - Get current user
router.get('/me', (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const user = db.users.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/users/me - Update current user profile
router.put('/me', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const allowedUpdates = ['first_name', 'last_name', 'phone'];
        const updates = {};

        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const user = db.users.update(req.user.id, updates);
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/users/me/password - Change password
router.put('/me/password', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        const minLength = parseInt(db.settings.get('password_min_length') || '8');
        if (new_password.length < minLength) {
            return res.status(400).json({
                success: false,
                error: `Password must be at least ${minLength} characters`
            });
        }

        const user = db.users.findByEmail(req.user.email);
        const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }

        const password_hash = await bcrypt.hash(new_password, 10);
        db.users.update(req.user.id, { password_hash });

        db.audit.log({
            user_id: req.user.id,
            action: 'update',
            entity_type: 'user',
            entity_id: req.user.id.toString(),
            changed_fields: ['password']
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== USER MANAGEMENT (Admin only) ===================

// GET /api/v1/users - List all users
router.get('/', (req, res) => {
    try {
        // Check for admin role
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const users = db.users.findAll();
        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/users/:id - Get single user
router.get('/:id', (req, res) => {
    try {
        if (req.user?.role !== 'admin' && req.user?.id !== parseInt(req.params.id)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = db.users.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/v1/users - Create user (Admin only)
router.post('/', async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const { email, password, first_name, last_name, role, phone } = req.body;

        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({
                success: false,
                error: 'Email, password, first name, and last name are required'
            });
        }

        // Check for duplicate email
        const existing = db.users.findByEmail(email);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }

        const minLength = parseInt(db.settings.get('password_min_length') || '8');
        if (password.length < minLength) {
            return res.status(400).json({
                success: false,
                error: `Password must be at least ${minLength} characters`
            });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const user = db.users.create({
            email,
            password_hash,
            first_name,
            last_name,
            role: role || 'viewer',
            phone
        });

        db.audit.log({
            user_id: req.user?.id,
            action: 'create',
            entity_type: 'user',
            entity_id: user.id.toString(),
            new_values: { email, first_name, last_name, role }
        });

        res.status(201).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/v1/users/:id - Update user (Admin only)
router.put('/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        const existing = db.users.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const updates = {};
        const allowedFields = ['email', 'first_name', 'last_name', 'role', 'phone', 'is_active'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Handle password update
        if (req.body.password) {
            const minLength = parseInt(db.settings.get('password_min_length') || '8');
            if (req.body.password.length < minLength) {
                return res.status(400).json({
                    success: false,
                    error: `Password must be at least ${minLength} characters`
                });
            }
            updates.password_hash = await bcrypt.hash(req.body.password, 10);
        }

        const user = db.users.update(parseInt(req.params.id), updates);

        db.audit.log({
            user_id: req.user?.id,
            action: 'update',
            entity_type: 'user',
            entity_id: req.params.id,
            old_values: existing,
            new_values: updates
        });

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/v1/users/:id - Delete user (Admin only)
router.delete('/:id', (req, res) => {
    try {
        if (req.user?.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Admin access required'
            });
        }

        // Prevent self-deletion
        if (req.user?.id === parseInt(req.params.id)) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete your own account'
            });
        }

        const existing = db.users.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const deleted = db.users.delete(parseInt(req.params.id));

        db.audit.log({
            user_id: req.user?.id,
            action: 'delete',
            entity_type: 'user',
            entity_id: req.params.id,
            old_values: existing
        });

        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/v1/users/:id/activity - Get user activity log
router.get('/:id/activity', (req, res) => {
    try {
        if (req.user?.role !== 'admin' && req.user?.id !== parseInt(req.params.id)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const activity = db.audit.findAll({
            userId: parseInt(req.params.id),
            limit
        });

        res.json({ success: true, data: activity });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
