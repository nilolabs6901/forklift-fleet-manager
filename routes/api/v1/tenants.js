/**
 * Tenant Management API Routes
 * Handles client onboarding, CRUD, and fleet data import for multi-tenant setup
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../../config/sqlite-database');

// Configure multer for fleet CSV/Excel uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads/fleet-imports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        cb(null, `fleet_import_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: CSV, XLSX, XLS'));
        }
    }
});

// =================== TENANT CRUD ===================

/**
 * GET /api/v1/tenants
 * List all tenants with optional status filter
 */
router.get('/', (req, res) => {
    try {
        const tenants = db.tenants.findAll({
            status: req.query.status,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined
        });
        res.json({ success: true, data: tenants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/tenants/stats
 * Get tenant statistics
 */
router.get('/stats', (req, res) => {
    try {
        const stats = db.tenants.getStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/tenants/:id
 * Get a specific tenant with summary of their fleet data
 */
router.get('/:id', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        // Get fleet summary for this tenant
        const forklifts = db.raw.prepare(
            'SELECT COUNT(*) as count FROM forklifts WHERE tenant_id = ?'
        ).get(tenant.id);
        const locations = db.raw.prepare(
            'SELECT COUNT(*) as count FROM locations WHERE tenant_id = ?'
        ).get(tenant.id);
        const users = db.raw.prepare(
            'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?'
        ).get(tenant.id);
        const invoices = db.raw.prepare(
            'SELECT COUNT(*) as count FROM inbound_invoices WHERE tenant_id = ?'
        ).get(tenant.id);

        res.json({
            success: true,
            data: {
                ...tenant,
                features: tenant.features ? JSON.parse(tenant.features) : [],
                settings: tenant.settings ? JSON.parse(tenant.settings) : {},
                summary: {
                    forklifts: forklifts.count,
                    locations: locations.count,
                    users: users.count,
                    invoices_processed: invoices.count
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/tenants
 * Create a new tenant (client)
 */
router.post('/', (req, res) => {
    try {
        const { company_name, contact_name, contact_email, contact_phone,
                sender_domain, plan_type, features } = req.body;

        if (!company_name) {
            return res.status(400).json({
                success: false,
                error: 'company_name is required'
            });
        }

        const tenant = db.tenants.create({
            company_name,
            contact_name,
            contact_email,
            contact_phone,
            sender_domain,
            plan_type,
            features
        });

        res.status(201).json({
            success: true,
            data: {
                ...tenant,
                features: tenant.features ? JSON.parse(tenant.features) : [],
                settings: tenant.settings ? JSON.parse(tenant.settings) : {}
            },
            message: `Trial client "${company_name}" created. Their invoice forwarding address is: ${tenant.inbound_email_address}`
        });
    } catch (error) {
        if (error.message.includes('UNIQUE constraint')) {
            return res.status(409).json({
                success: false,
                error: 'A tenant with this name or email address already exists'
            });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/v1/tenants/:id
 * Update a tenant
 */
router.put('/:id', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const updated = db.tenants.update(req.params.id, req.body);
        res.json({
            success: true,
            data: {
                ...updated,
                features: updated.features ? JSON.parse(updated.features) : [],
                settings: updated.settings ? JSON.parse(updated.settings) : {}
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/v1/tenants/:id
 * Delete a tenant (soft delete by setting status to 'cancelled')
 */
router.delete('/:id', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        db.tenants.update(req.params.id, { status: 'cancelled' });
        res.json({ success: true, message: 'Tenant cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =================== ONBOARDING ===================

/**
 * POST /api/v1/tenants/:id/onboard
 * Full onboarding: creates tenant admin user, default location, and optional fleet import
 */
router.post('/:id/onboard', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const { admin_email, admin_password, admin_first_name, admin_last_name,
                location_name, location_city, location_state, location_address } = req.body;

        const results = { tenant_id: tenant.id };

        // Create admin user for this tenant
        if (admin_email) {
            const bcrypt = require('bcryptjs');
            const passwordHash = bcrypt.hashSync(admin_password || 'changeme123', 10);

            const adminUser = db.users.create({
                email: admin_email,
                password_hash: passwordHash,
                first_name: admin_first_name || tenant.contact_name?.split(' ')[0] || 'Admin',
                last_name: admin_last_name || tenant.contact_name?.split(' ').slice(1).join(' ') || tenant.company_name,
                role: 'admin',
                phone: tenant.contact_phone
            });

            // Set tenant_id on the user
            db.raw.prepare('UPDATE users SET tenant_id = ? WHERE id = ?').run(tenant.id, adminUser.id);
            results.admin_user = { id: adminUser.id, email: adminUser.email };
        }

        // Create default location
        if (location_name) {
            const location = db.locations.create({
                name: location_name,
                city: location_city,
                state: location_state,
                address: location_address
            });

            // Set tenant_id on the location
            db.raw.prepare('UPDATE locations SET tenant_id = ? WHERE id = ?').run(tenant.id, location.id);
            results.location = { id: location.id, name: location.name };
        }

        res.json({
            success: true,
            data: results,
            message: `Onboarding complete for ${tenant.company_name}. Invoice forwarding address: ${tenant.inbound_email_address}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/tenants/:id/forklifts
 * Add forklifts to a tenant's fleet (bulk or single)
 */
router.post('/:id/forklifts', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const forklifts = Array.isArray(req.body) ? req.body : [req.body];
        const created = [];
        const errors = [];

        for (const data of forklifts) {
            try {
                if (!data.id) {
                    errors.push({ data, error: 'id (unit ID) is required' });
                    continue;
                }

                const forklift = db.forklifts.create({
                    id: data.id,
                    location_id: data.location_id || null,
                    model: data.model,
                    manufacturer: data.manufacturer,
                    serial_number: data.serial_number,
                    year: data.year,
                    fuel_type: data.fuel_type,
                    capacity_lbs: data.capacity_lbs,
                    mast_type: data.mast_type,
                    tire_type: data.tire_type,
                    status: data.status || 'active',
                    current_hours: data.current_hours || 0,
                    purchase_date: data.purchase_date,
                    purchase_price: data.purchase_price,
                    notes: data.notes
                });

                // Set tenant_id
                db.raw.prepare('UPDATE forklifts SET tenant_id = ? WHERE id = ?').run(tenant.id, forklift.id);
                created.push(forklift);
            } catch (err) {
                errors.push({ data, error: err.message });
            }
        }

        res.status(created.length > 0 ? 201 : 400).json({
            success: created.length > 0,
            data: {
                created: created.length,
                failed: errors.length,
                forklifts: created,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/v1/tenants/:id/import-fleet
 * Import fleet from CSV/Excel file
 */
router.post('/:id/import-fleet', upload.single('fleet_file'), async (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        let rows = [];

        if (ext === '.csv') {
            // Parse CSV
            const csvContent = fs.readFileSync(req.file.path, 'utf8');
            const lines = csvContent.split('\n').filter(l => l.trim());
            if (lines.length < 2) {
                return res.status(400).json({ success: false, error: 'CSV file is empty or has no data rows' });
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx] || null; });
                rows.push(row);
            }
        } else {
            // Excel support requires exceljs
            try {
                const ExcelJS = require('exceljs');
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.readFile(req.file.path);
                const worksheet = workbook.worksheets[0];

                const headers = [];
                worksheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
                });

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const data = {};
                    row.eachCell((cell, colNumber) => {
                        data[headers[colNumber - 1]] = cell.value;
                    });
                    rows.push(data);
                });
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    error: 'Failed to parse Excel file. Make sure exceljs is installed: ' + err.message
                });
            }
        }

        // Map common column names to our schema
        const columnMap = {
            'unit_id': 'id', 'unit': 'id', 'forklift_id': 'id', 'asset_id': 'id', 'equipment_id': 'id',
            'make': 'manufacturer', 'brand': 'manufacturer',
            'serial': 'serial_number', 'sn': 'serial_number',
            'hours': 'current_hours', 'hour_meter': 'current_hours',
            'fuel': 'fuel_type', 'power': 'fuel_type',
            'capacity': 'capacity_lbs', 'weight_capacity': 'capacity_lbs',
            'location': 'location_name', 'warehouse': 'location_name', 'site': 'location_name'
        };

        const created = [];
        const errors = [];

        // Get or create default location for this tenant
        const defaultLocation = db.raw.prepare(
            'SELECT id FROM locations WHERE tenant_id = ? LIMIT 1'
        ).get(tenant.id);

        for (const row of rows) {
            // Normalize column names
            const normalized = {};
            for (const [key, value] of Object.entries(row)) {
                const mappedKey = columnMap[key] || key;
                normalized[mappedKey] = value;
            }

            if (!normalized.id) {
                // Generate an ID if none provided
                normalized.id = `${tenant.slug.toUpperCase().slice(0, 3)}-${String(created.length + errors.length + 1).padStart(3, '0')}`;
            }

            try {
                const forklift = db.forklifts.create({
                    id: normalized.id,
                    location_id: defaultLocation?.id || null,
                    model: normalized.model || null,
                    manufacturer: normalized.manufacturer || null,
                    serial_number: normalized.serial_number || null,
                    year: normalized.year ? parseInt(normalized.year) : null,
                    fuel_type: normalized.fuel_type || 'electric',
                    capacity_lbs: normalized.capacity_lbs ? parseInt(normalized.capacity_lbs) : 5000,
                    current_hours: normalized.current_hours ? parseFloat(normalized.current_hours) : 0,
                    status: 'active',
                    notes: normalized.notes || null
                });

                db.raw.prepare('UPDATE forklifts SET tenant_id = ? WHERE id = ?').run(tenant.id, forklift.id);
                created.push(forklift);
            } catch (err) {
                errors.push({ row: normalized, error: err.message });
            }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({
            success: created.length > 0,
            data: {
                imported: created.length,
                failed: errors.length,
                total_rows: rows.length,
                forklifts: created.map(f => ({ id: f.id, model: f.model, manufacturer: f.manufacturer })),
                errors: errors.length > 0 ? errors : undefined
            },
            message: `Imported ${created.length} forklifts for ${tenant.company_name}`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/tenants/:id/forklifts
 * Get all forklifts for a specific tenant
 */
router.get('/:id/forklifts', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const forklifts = db.raw.prepare(`
            SELECT f.*, l.name as location_name, l.city as location_city
            FROM forklifts f
            LEFT JOIN locations l ON f.location_id = l.id
            WHERE f.tenant_id = ?
            ORDER BY f.id
        `).all(tenant.id);

        res.json({ success: true, data: forklifts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/v1/tenants/:id/invoices
 * Get all inbound invoices for a specific tenant
 */
router.get('/:id/invoices', (req, res) => {
    try {
        const tenant = db.tenants.findById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ success: false, error: 'Tenant not found' });
        }

        const invoices = db.raw.prepare(`
            SELECT * FROM inbound_invoices
            WHERE tenant_id = ?
            ORDER BY created_at DESC
        `).all(tenant.id);

        res.json({
            success: true,
            data: invoices.map(inv => ({
                ...inv,
                extracted_data: inv.extracted_data ? JSON.parse(inv.extracted_data) : null
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
