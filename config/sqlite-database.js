/**
 * SQLite Database Configuration & Connection
 * Enterprise-grade database for Forklift Fleet Management
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'fleet.db');
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database with WAL mode for better performance
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const initSchema = () => {
    const schema = fs.readFileSync(SCHEMA_FILE, 'utf8');
    db.exec(schema);
    console.log('Database schema initialized');
};

// Run schema initialization
try {
    initSchema();
} catch (err) {
    console.error('Schema initialization error:', err.message);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const formatDate = (date) => {
    if (!date) return null;
    if (date instanceof Date) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
    }
    return date;
};

const parseJSON = (str, defaultVal = null) => {
    if (!str) return defaultVal;
    try {
        return JSON.parse(str);
    } catch {
        return defaultVal;
    }
};

const toJSON = (obj) => {
    if (!obj) return null;
    return JSON.stringify(obj);
};

// =====================================================
// DATABASE API
// =====================================================

const dbApi = {
    // Raw database access for complex queries
    raw: db,

    // =================== USERS ===================
    users: {
        findAll() {
            return db.prepare(`
                SELECT id, email, first_name, last_name, role, phone, is_active,
                       last_login_at, created_at, updated_at
                FROM users ORDER BY last_name, first_name
            `).all();
        },

        findById(id) {
            return db.prepare(`
                SELECT id, email, first_name, last_name, role, phone, is_active,
                       last_login_at, created_at, updated_at
                FROM users WHERE id = ?
            `).get(id);
        },

        findByEmail(email) {
            return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                data.email,
                data.password_hash,
                data.first_name,
                data.last_name,
                data.role || 'viewer',
                data.phone || null
            );
            return this.findById(result.lastInsertRowid);
        },

        update(id, data) {
            const fields = [];
            const values = [];

            ['email', 'first_name', 'last_name', 'role', 'phone', 'is_active', 'password_hash'].forEach(field => {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(data[field]);
                }
            });

            if (fields.length === 0) return this.findById(id);

            fields.push("updated_at = datetime('now')");
            values.push(id);

            db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            return this.findById(id);
        },

        updateLastLogin(id) {
            db.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').run(id);
        },

        delete(id) {
            return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
        }
    },

    // =================== LOCATIONS ===================
    locations: {
        findAll() {
            return db.prepare(`
                SELECT l.*,
                       (SELECT COUNT(*) FROM forklifts f WHERE f.location_id = l.id) as forklift_count,
                       u.first_name || ' ' || u.last_name as manager_name
                FROM locations l
                LEFT JOIN users u ON l.manager_id = u.id
                WHERE l.is_active = 1
                ORDER BY l.name
            `).all();
        },

        findById(id) {
            return db.prepare(`
                SELECT l.*,
                       (SELECT COUNT(*) FROM forklifts f WHERE f.location_id = l.id) as forklift_count,
                       u.first_name || ' ' || u.last_name as manager_name
                FROM locations l
                LEFT JOIN users u ON l.manager_id = u.id
                WHERE l.id = ?
            `).get(id);
        },

        findByName(name) {
            return db.prepare('SELECT * FROM locations WHERE name = ?').get(name);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO locations (name, address, city, state, zip_code, country, type, capacity, manager_id,
                    service_center_phone, service_center_email, service_center_contact)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                data.name,
                data.address || null,
                data.city || null,
                data.state || null,
                data.zip_code || null,
                data.country || 'USA',
                data.type || 'warehouse',
                data.capacity || 50,
                data.manager_id || null,
                data.service_center_phone || null,
                data.service_center_email || null,
                data.service_center_contact || null
            );
            return this.findById(result.lastInsertRowid);
        },

        update(id, data) {
            const fields = [];
            const values = [];

            ['name', 'address', 'city', 'state', 'zip_code', 'country', 'type', 'capacity', 'manager_id', 'is_active',
             'service_center_phone', 'service_center_email', 'service_center_contact'].forEach(field => {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(data[field]);
                }
            });

            if (fields.length === 0) return this.findById(id);

            fields.push("updated_at = datetime('now')");
            values.push(id);

            db.prepare(`UPDATE locations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            return this.findById(id);
        },

        delete(id) {
            return db.prepare('UPDATE locations SET is_active = 0 WHERE id = ?').run(id).changes > 0;
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total_locations,
                    SUM(capacity) as total_capacity,
                    (SELECT COUNT(*) FROM forklifts WHERE status != 'retired') as total_forklifts
                FROM locations WHERE is_active = 1
            `).get();
        }
    },

    // =================== FORKLIFTS ===================
    forklifts: {
        findAll(options = {}) {
            let sql = `
                SELECT f.*, l.name as location_name, l.city as location_city
                FROM forklifts f
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE 1=1
            `;
            const params = [];

            if (options.locationId) {
                sql += ' AND f.location_id = ?';
                params.push(options.locationId);
            }
            if (options.status) {
                sql += ' AND f.status = ?';
                params.push(options.status);
            }
            if (options.riskLevel) {
                sql += ' AND f.risk_level = ?';
                params.push(options.riskLevel);
            }
            if (options.fuelType) {
                sql += ' AND f.fuel_type = ?';
                params.push(options.fuelType);
            }
            if (options.search) {
                sql += ' AND (f.id LIKE ? OR f.model LIKE ? OR f.manufacturer LIKE ? OR f.serial_number LIKE ?)';
                const search = `%${options.search}%`;
                params.push(search, search, search, search);
            }
            if (options.excludeRetired !== false) {
                sql += " AND f.status != 'retired'";
            }

            sql += ' ORDER BY f.id';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT f.*, l.name as location_name, l.city as location_city
                FROM forklifts f
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE f.id = ?
            `).get(id);
        },

        findBySerialNumber(serialNumber) {
            return db.prepare('SELECT * FROM forklifts WHERE serial_number = ?').get(serialNumber);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO forklifts (
                    id, location_id, model, manufacturer, serial_number, year,
                    fuel_type, capacity_lbs, mast_type, tire_type, status,
                    current_hours, purchase_date, purchase_price, current_value,
                    service_interval_hours, service_interval_days, notes,
                    risk_score, risk_level, last_service_date, next_service_date, next_service_hours
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                data.id,
                data.location_id || null,
                data.model || null,
                data.manufacturer || null,
                data.serial_number || null,
                data.year || null,
                data.fuel_type || 'electric',
                data.capacity_lbs || 5000,
                data.mast_type || null,
                data.tire_type || null,
                data.status || 'active',
                data.current_hours || 0,
                data.purchase_date || null,
                data.purchase_price || null,
                data.current_value || data.purchase_price || null,
                data.service_interval_hours || 250,
                data.service_interval_days || 90,
                data.notes || null,
                data.risk_score || 1,
                data.risk_level || 'low',
                data.last_service_date || null,
                data.next_service_date || null,
                data.next_service_hours || null
            );

            return this.findById(data.id);
        },

        update(id, data) {
            const fields = [];
            const values = [];

            const allowedFields = [
                'location_id', 'model', 'manufacturer', 'serial_number', 'year',
                'fuel_type', 'capacity_lbs', 'mast_type', 'tire_type', 'status',
                'current_hours', 'last_hour_reading', 'last_hour_reading_date',
                'last_service_date', 'last_service_hours', 'next_service_date', 'next_service_hours',
                'service_interval_hours', 'service_interval_days',
                'purchase_date', 'purchase_price', 'current_value', 'depreciation_rate',
                'risk_score', 'risk_level', 'risk_factors', 'last_risk_assessment',
                'expected_lifespan_years', 'expected_lifespan_hours',
                'recommended_action', 'projected_replacement_date', 'projected_replacement_year',
                'notes', 'image_url', 'qr_code'
            ];

            allowedFields.forEach(field => {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(data[field]);
                }
            });

            if (fields.length === 0) return this.findById(id);

            fields.push("updated_at = datetime('now')");
            values.push(id);

            db.prepare(`UPDATE forklifts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            return this.findById(id);
        },

        delete(id) {
            return db.prepare('DELETE FROM forklifts WHERE id = ?').run(id).changes > 0;
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as in_maintenance,
                    SUM(CASE WHEN status = 'out_of_service' THEN 1 ELSE 0 END) as out_of_service,
                    SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_risk,
                    SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_risk,
                    SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_risk,
                    SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_risk,
                    AVG(current_hours) as avg_hours,
                    AVG(risk_score) as avg_risk_score
                FROM forklifts WHERE status != 'retired'
            `).get();
        },

        getByLocation(locationId) {
            return this.findAll({ locationId });
        }
    },

    // =================== HOUR METER READINGS ===================
    hourReadings: {
        findAll(options = {}) {
            let sql = `
                SELECT h.*, f.model as forklift_model,
                       u.first_name || ' ' || u.last_name as recorded_by_name
                FROM hour_meter_readings h
                LEFT JOIN forklifts f ON h.forklift_id = f.id
                LEFT JOIN users u ON h.recorded_by = u.id
                WHERE 1=1
            `;
            const params = [];

            if (options.forkliftId) {
                sql += ' AND h.forklift_id = ?';
                params.push(options.forkliftId);
            }
            if (options.flagged !== undefined) {
                sql += ' AND h.is_flagged = ?';
                params.push(options.flagged ? 1 : 0);
            }
            if (options.startDate) {
                sql += ' AND h.recorded_at >= ?';
                params.push(options.startDate);
            }
            if (options.endDate) {
                sql += ' AND h.recorded_at <= ?';
                params.push(options.endDate);
            }

            sql += ' ORDER BY h.recorded_at DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT h.*, f.model as forklift_model,
                       u.first_name || ' ' || u.last_name as recorded_by_name
                FROM hour_meter_readings h
                LEFT JOIN forklifts f ON h.forklift_id = f.id
                LEFT JOIN users u ON h.recorded_by = u.id
                WHERE h.id = ?
            `).get(id);
        },

        getLatest(forkliftId) {
            return db.prepare(`
                SELECT * FROM hour_meter_readings
                WHERE forklift_id = ?
                ORDER BY recorded_at DESC LIMIT 1
            `).get(forkliftId);
        },

        create(data) {
            // Get previous reading for delta calculation
            const previous = this.getLatest(data.forklift_id);
            const previousReading = previous ? previous.reading : 0;
            const delta = data.reading - previousReading;

            // Anomaly detection
            let isFlagged = 0;
            let flagReason = null;
            let flagSeverity = null;

            // Check for backward reading
            if (delta < 0) {
                isFlagged = 1;
                flagReason = `Hour meter went backwards by ${Math.abs(delta).toFixed(1)} hours`;
                flagSeverity = 'error';
            }
            // Check for unusually large jump (>100 hours in one reading)
            else if (delta > 100 && previous) {
                isFlagged = 1;
                flagReason = `Unusually large increase of ${delta.toFixed(1)} hours`;
                flagSeverity = 'warning';
            }

            const stmt = db.prepare(`
                INSERT INTO hour_meter_readings (
                    forklift_id, reading, previous_reading, reading_delta,
                    source, recorded_by, is_flagged, flag_reason, flag_severity
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id,
                data.reading,
                previousReading,
                delta,
                data.source || 'manual',
                data.recorded_by || null,
                isFlagged,
                flagReason,
                flagSeverity
            );

            // Update forklift current hours (only if not flagged or if approved)
            if (!isFlagged) {
                db.prepare(`
                    UPDATE forklifts
                    SET current_hours = ?,
                        last_hour_reading = ?,
                        last_hour_reading_date = datetime('now'),
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(data.reading, data.reading, data.forklift_id);
            }

            return this.findById(result.lastInsertRowid);
        },

        correct(id, data) {
            const reading = this.findById(id);
            if (!reading) return null;

            db.prepare(`
                UPDATE hour_meter_readings
                SET is_corrected = 1,
                    corrected_value = ?,
                    corrected_by = ?,
                    corrected_at = datetime('now'),
                    correction_notes = ?,
                    is_validated = 1,
                    validated_by = ?,
                    validated_at = datetime('now')
                WHERE id = ?
            `).run(
                data.corrected_value,
                data.corrected_by || null,
                data.correction_notes || null,
                data.corrected_by || null,
                id
            );

            // Update forklift hours with corrected value
            db.prepare(`
                UPDATE forklifts
                SET current_hours = ?,
                    last_hour_reading = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(data.corrected_value, data.corrected_value, reading.forklift_id);

            return this.findById(id);
        },

        getFlagged(limit = 50) {
            return db.prepare(`
                SELECT h.*, f.model as forklift_model, l.name as location_name
                FROM hour_meter_readings h
                LEFT JOIN forklifts f ON h.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE h.is_flagged = 1 AND h.is_corrected = 0
                ORDER BY h.recorded_at DESC
                LIMIT ?
            `).all(limit);
        }
    },

    // =================== MAINTENANCE ===================
    maintenance: {
        findAll(options = {}) {
            let sql = `
                SELECT m.*, f.model as forklift_model, l.name as location_name,
                       u.first_name || ' ' || u.last_name as technician_full_name,
                       i.attachment_path as invoice_pdf_path,
                       i.id as inbound_invoice_id
                FROM maintenance_records m
                LEFT JOIN forklifts f ON m.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                LEFT JOIN users u ON m.technician_id = u.id
                LEFT JOIN inbound_invoices i ON m.invoice_number = i.invoice_number
                WHERE 1=1
            `;
            const params = [];

            if (options.forkliftId) {
                sql += ' AND m.forklift_id = ?';
                params.push(options.forkliftId);
            }
            if (options.type) {
                sql += ' AND m.type = ?';
                params.push(options.type);
            }
            if (options.status) {
                sql += ' AND m.status = ?';
                params.push(options.status);
            }
            if (options.startDate) {
                sql += ' AND m.service_date >= ?';
                params.push(options.startDate);
            }
            if (options.endDate) {
                sql += ' AND m.service_date <= ?';
                params.push(options.endDate);
            }

            sql += ' ORDER BY m.service_date DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT m.*, f.model as forklift_model, l.name as location_name,
                       u.first_name || ' ' || u.last_name as technician_full_name
                FROM maintenance_records m
                LEFT JOIN forklifts f ON m.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                LEFT JOIN users u ON m.technician_id = u.id
                WHERE m.id = ?
            `).get(id);
        },

        create(data) {
            const totalCost = (parseFloat(data.labor_cost) || 0) +
                            (parseFloat(data.parts_cost) || 0) +
                            (parseFloat(data.diagnostic_cost) || 0) +
                            (parseFloat(data.other_cost) || 0);

            const stmt = db.prepare(`
                INSERT INTO maintenance_records (
                    forklift_id, type, category, description, work_performed,
                    scheduled_date, service_date, completion_date, status, priority,
                    hours_at_service, labor_hours, expected_labor_hours,
                    labor_cost, parts_cost, diagnostic_cost, other_cost, total_cost,
                    parts_replaced, technician_id, technician_name, service_provider,
                    work_order_number, invoice_number, notes,
                    follow_up_required, follow_up_notes, next_service_date, next_service_hours,
                    created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id,
                data.type,
                data.category || null,
                data.description || null,
                data.work_performed || null,
                data.scheduled_date || null,
                data.service_date || new Date().toISOString().split('T')[0],
                data.completion_date || null,
                data.status || 'completed',
                data.priority || 'medium',
                data.hours_at_service || null,
                data.labor_hours || null,
                data.expected_labor_hours || null,
                data.labor_cost || 0,
                data.parts_cost || 0,
                data.diagnostic_cost || 0,
                data.other_cost || 0,
                totalCost,
                toJSON(data.parts_replaced),
                data.technician_id || null,
                data.technician_name || null,
                data.service_provider || null,
                data.work_order_number || null,
                data.invoice_number || null,
                data.notes || null,
                data.follow_up_required ? 1 : 0,
                data.follow_up_notes || null,
                data.next_service_date || null,
                data.next_service_hours || null,
                data.created_by || null
            );

            // Update forklift service dates if completed
            if (data.status === 'completed') {
                db.prepare(`
                    UPDATE forklifts
                    SET last_service_date = ?,
                        last_service_hours = ?,
                        next_service_date = COALESCE(?, date(?, '+' || service_interval_days || ' days')),
                        next_service_hours = COALESCE(?, current_hours + service_interval_hours),
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(
                    data.service_date || new Date().toISOString().split('T')[0],
                    data.hours_at_service || null,
                    data.next_service_date,
                    data.service_date || new Date().toISOString().split('T')[0],
                    data.next_service_hours,
                    data.forklift_id
                );
            }

            return this.findById(result.lastInsertRowid);
        },

        update(id, data) {
            const current = this.findById(id);
            if (!current) return null;

            const totalCost = (parseFloat(data.labor_cost ?? current.labor_cost) || 0) +
                            (parseFloat(data.parts_cost ?? current.parts_cost) || 0) +
                            (parseFloat(data.diagnostic_cost ?? current.diagnostic_cost) || 0) +
                            (parseFloat(data.other_cost ?? current.other_cost) || 0);

            const fields = [];
            const values = [];

            const allowedFields = [
                'type', 'category', 'description', 'work_performed',
                'scheduled_date', 'service_date', 'completion_date', 'status', 'priority',
                'hours_at_service', 'labor_cost', 'parts_cost', 'diagnostic_cost', 'other_cost',
                'technician_id', 'technician_name', 'service_provider',
                'work_order_number', 'invoice_number', 'notes',
                'follow_up_required', 'follow_up_notes', 'next_service_date', 'next_service_hours'
            ];

            allowedFields.forEach(field => {
                if (data[field] !== undefined) {
                    fields.push(`${field} = ?`);
                    values.push(data[field]);
                }
            });

            if (data.parts_replaced !== undefined) {
                fields.push('parts_replaced = ?');
                values.push(toJSON(data.parts_replaced));
            }

            fields.push('total_cost = ?');
            values.push(totalCost);

            fields.push("updated_at = datetime('now')");
            values.push(id);

            db.prepare(`UPDATE maintenance_records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
            return this.findById(id);
        },

        delete(id) {
            return db.prepare('DELETE FROM maintenance_records WHERE id = ?').run(id).changes > 0;
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total_records,
                    SUM(total_cost) as total_cost,
                    AVG(total_cost) as avg_cost,
                    SUM(CASE WHEN service_date >= date('now', '-30 days') THEN total_cost ELSE 0 END) as monthly_cost,
                    SUM(CASE WHEN service_date >= date('now', '-30 days') THEN 1 ELSE 0 END) as monthly_count,
                    SUM(CASE WHEN service_date >= date('now', '-365 days') THEN total_cost ELSE 0 END) as yearly_cost
                FROM maintenance_records
            `).get();
        },

        getMaintenanceDue() {
            return db.prepare(`
                SELECT f.*, l.name as location_name,
                    CASE
                        WHEN f.next_service_date <= date('now') THEN 'overdue'
                        WHEN f.next_service_date <= date('now', '+7 days') THEN 'due_soon'
                        WHEN f.current_hours >= COALESCE(f.next_service_hours, 999999) THEN 'hours_exceeded'
                        ELSE 'upcoming'
                    END as maintenance_status
                FROM forklifts f
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE f.status NOT IN ('retired', 'pending_disposal')
                    AND (
                        f.next_service_date <= date('now', '+30 days')
                        OR f.current_hours >= COALESCE(f.next_service_hours, f.current_hours + 1000) - 50
                    )
                ORDER BY f.next_service_date
            `).all();
        },

        getMonthlyCosts(months = 12) {
            return db.prepare(`
                SELECT
                    strftime('%Y-%m', service_date) as month,
                    COUNT(*) as count,
                    SUM(total_cost) as total_cost,
                    SUM(labor_cost) as labor_cost,
                    SUM(parts_cost) as parts_cost
                FROM maintenance_records
                WHERE service_date >= date('now', '-' || ? || ' months')
                GROUP BY strftime('%Y-%m', service_date)
                ORDER BY month
            `).all(months);
        },

        getByForklift(forkliftId, limit = 50) {
            return this.findAll({ forkliftId, limit });
        },

        getCostByForklift(forkliftId, months = 12) {
            return db.prepare(`
                SELECT
                    SUM(total_cost) as total_cost,
                    SUM(labor_cost) as labor_cost,
                    SUM(parts_cost) as parts_cost,
                    COUNT(*) as service_count,
                    AVG(total_cost) as avg_cost
                FROM maintenance_records
                WHERE forklift_id = ?
                    AND service_date >= date('now', '-' || ? || ' months')
            `).get(forkliftId, months);
        },

        getTypeBreakdown() {
            return db.prepare(`
                SELECT type, COUNT(*) as count, SUM(total_cost) as total_cost
                FROM maintenance_records
                GROUP BY type
                ORDER BY count DESC
            `).all();
        },

        /**
         * Get monthly maintenance costs grouped by location
         */
        getMonthlyCostsByLocation(months = 1) {
            return db.prepare(`
                SELECT
                    f.location_id,
                    l.name as location_name,
                    COUNT(*) as service_count,
                    SUM(m.total_cost) as total_cost,
                    SUM(m.labor_cost) as labor_cost,
                    SUM(m.parts_cost) as parts_cost
                FROM maintenance_records m
                JOIN forklifts f ON m.forklift_id = f.id
                JOIN locations l ON f.location_id = l.id
                WHERE m.service_date >= date('now', '-' || ? || ' months')
                GROUP BY f.location_id
                ORDER BY total_cost DESC
            `).all(months);
        }
    },

    // =================== DOWNTIME ===================
    downtime: {
        findAll(options = {}) {
            let sql = `
                SELECT d.*, f.model as forklift_model, l.name as location_name
                FROM downtime_events d
                LEFT JOIN forklifts f ON d.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE 1=1
            `;
            const params = [];

            if (options.forkliftId) {
                sql += ' AND d.forklift_id = ?';
                params.push(options.forkliftId);
            }
            if (options.status) {
                sql += ' AND d.status = ?';
                params.push(options.status);
            }
            if (options.type) {
                sql += ' AND d.type = ?';
                params.push(options.type);
            }

            sql += ' ORDER BY d.start_time DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT d.*, f.model as forklift_model, l.name as location_name
                FROM downtime_events d
                LEFT JOIN forklifts f ON d.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE d.id = ?
            `).get(id);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO downtime_events (
                    forklift_id, start_time, end_time, duration_hours,
                    type, root_cause, root_cause_detail, impact_level,
                    production_impact, estimated_production_loss, cost_per_hour_down,
                    maintenance_record_id, status, reported_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id,
                data.start_time,
                data.end_time || null,
                data.duration_hours || null,
                data.type || 'unplanned',
                data.root_cause || null,
                data.root_cause_detail || null,
                data.impact_level || 'medium',
                data.production_impact || null,
                data.estimated_production_loss || 0,
                data.cost_per_hour_down || 150,
                data.maintenance_record_id || null,
                data.status || 'active',
                data.reported_by || null
            );

            // Update forklift status
            if (!data.end_time) {
                db.prepare(`
                    UPDATE forklifts SET status = 'out_of_service', updated_at = datetime('now')
                    WHERE id = ?
                `).run(data.forklift_id);
            }

            return this.findById(result.lastInsertRowid);
        },

        resolve(id, data) {
            const event = this.findById(id);
            if (!event) return null;

            const endTime = data.end_time || new Date().toISOString();
            const startTime = new Date(event.start_time);
            const durationHours = (new Date(endTime) - startTime) / (1000 * 60 * 60);

            db.prepare(`
                UPDATE downtime_events
                SET end_time = ?,
                    duration_hours = ?,
                    status = 'resolved',
                    resolution_notes = ?,
                    resolved_by = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                endTime,
                durationHours,
                data.resolution_notes || null,
                data.resolved_by || null,
                id
            );

            // Update forklift status back to active
            db.prepare(`
                UPDATE forklifts SET status = 'active', updated_at = datetime('now')
                WHERE id = ?
            `).run(event.forklift_id);

            return this.findById(id);
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total_events,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_events,
                    SUM(duration_hours) as total_downtime_hours,
                    SUM(duration_hours * cost_per_hour_down) as total_downtime_cost,
                    AVG(duration_hours) as avg_duration,
                    SUM(CASE WHEN start_time >= date('now', '-30 days') THEN duration_hours ELSE 0 END) as monthly_downtime_hours
                FROM downtime_events
            `).get();
        },

        getActive() {
            return this.findAll({ status: 'active' });
        }
    },

    // =================== RENTAL TRACKING ===================
    rentals: {
        findAll(options = {}) {
            let sql = `
                SELECT r.*, f.model as forklift_model, l.name as location_name
                FROM rental_records r
                LEFT JOIN forklifts f ON r.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE 1=1
            `;
            const params = [];

            if (options.forkliftId) {
                sql += ' AND r.forklift_id = ?';
                params.push(options.forkliftId);
            }
            if (options.status) {
                sql += ' AND r.status = ?';
                params.push(options.status);
            }

            sql += ' ORDER BY r.start_date DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT r.*, f.model as forklift_model, l.name as location_name
                FROM rental_records r
                LEFT JOIN forklifts f ON r.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE r.id = ?
            `).get(id);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO rental_records (
                    forklift_id, downtime_event_id, rental_company,
                    rental_equipment_type, rental_equipment_id,
                    start_date, end_date, daily_rate, weekly_rate, monthly_rate,
                    delivery_fee, pickup_fee, reason, notes, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id || null,
                data.downtime_event_id || null,
                data.rental_company,
                data.rental_equipment_type || null,
                data.rental_equipment_id || null,
                data.start_date,
                data.end_date || null,
                data.daily_rate,
                data.weekly_rate || null,
                data.monthly_rate || null,
                data.delivery_fee || 0,
                data.pickup_fee || 0,
                data.reason,
                data.notes || null,
                data.status || 'active',
                data.created_by || null
            );

            return this.findById(result.lastInsertRowid);
        },

        close(id, data) {
            const rental = this.findById(id);
            if (!rental) return null;

            const endDate = data.actual_return_date || new Date().toISOString().split('T')[0];
            const startDate = new Date(rental.start_date);
            const days = Math.ceil((new Date(endDate) - startDate) / (1000 * 60 * 60 * 24));

            const totalCost = (rental.daily_rate * days) +
                            (rental.delivery_fee || 0) +
                            (rental.pickup_fee || 0) +
                            (parseFloat(data.damage_charges) || 0) +
                            (parseFloat(data.fuel_charges) || 0) +
                            (parseFloat(data.other_charges) || 0);

            db.prepare(`
                UPDATE rental_records
                SET actual_return_date = ?,
                    damage_charges = ?,
                    fuel_charges = ?,
                    other_charges = ?,
                    total_cost = ?,
                    status = 'returned',
                    invoice_number = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                endDate,
                data.damage_charges || 0,
                data.fuel_charges || 0,
                data.other_charges || 0,
                totalCost,
                data.invoice_number || null,
                id
            );

            return this.findById(id);
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total_rentals,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_rentals,
                    SUM(total_cost) as total_cost,
                    SUM(CASE WHEN start_date >= date('now', '-30 days') THEN total_cost ELSE 0 END) as monthly_cost,
                    AVG(total_cost) as avg_cost
                FROM rental_records
            `).get();
        },

        getActive() {
            return this.findAll({ status: 'active' });
        }
    },

    // =================== ALERTS ===================
    alerts: {
        findAll(options = {}) {
            let sql = `
                SELECT a.*, f.model as forklift_model, l.name as location_name
                FROM alerts a
                LEFT JOIN forklifts f ON a.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE 1=1
            `;
            const params = [];

            if (options.forkliftId) {
                sql += ' AND a.forklift_id = ?';
                params.push(options.forkliftId);
            }
            if (options.severity) {
                sql += ' AND a.severity = ?';
                params.push(options.severity);
            }
            if (options.type) {
                sql += ' AND a.type = ?';
                params.push(options.type);
            }
            if (options.isActive !== undefined) {
                sql += ' AND a.is_active = ?';
                params.push(options.isActive ? 1 : 0);
            }
            if (options.isResolved !== undefined) {
                sql += ' AND a.is_resolved = ?';
                params.push(options.isResolved ? 1 : 0);
            }

            sql += ` ORDER BY
                CASE a.severity
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                a.created_at DESC`;

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        },

        findById(id) {
            return db.prepare(`
                SELECT a.*, f.model as forklift_model, l.name as location_name
                FROM alerts a
                LEFT JOIN forklifts f ON a.forklift_id = f.id
                LEFT JOIN locations l ON f.location_id = l.id
                WHERE a.id = ?
            `).get(id);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO alerts (
                    forklift_id, type, severity, title, message,
                    context_data, threshold_value, actual_value,
                    is_recurring, recurrence_key, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id || null,
                data.type,
                data.severity || 'medium',
                data.title,
                data.message || null,
                toJSON(data.context_data),
                data.threshold_value || null,
                data.actual_value || null,
                data.is_recurring ? 1 : 0,
                data.recurrence_key || null,
                data.expires_at || null
            );

            return this.findById(result.lastInsertRowid);
        },

        acknowledge(id, userId) {
            db.prepare(`
                UPDATE alerts
                SET is_acknowledged = 1,
                    acknowledged_by = ?,
                    acknowledged_at = datetime('now')
                WHERE id = ?
            `).run(userId, id);

            // Log acknowledgment
            db.prepare(`
                INSERT INTO alert_acknowledgments (alert_id, user_id, action)
                VALUES (?, ?, 'acknowledged')
            `).run(id, userId);

            return this.findById(id);
        },

        resolve(id, userId, notes) {
            db.prepare(`
                UPDATE alerts
                SET is_resolved = 1,
                    is_active = 0,
                    resolved_by = ?,
                    resolved_at = datetime('now'),
                    resolution_notes = ?
                WHERE id = ?
            `).run(userId, notes || null, id);

            // Log resolution
            db.prepare(`
                INSERT INTO alert_acknowledgments (alert_id, user_id, action, notes)
                VALUES (?, ?, 'resolved', ?)
            `).run(id, userId, notes || null);

            return this.findById(id);
        },

        getStats() {
            return db.prepare(`
                SELECT
                    COUNT(*) as total_alerts,
                    SUM(CASE WHEN is_active = 1 AND is_resolved = 0 THEN 1 ELSE 0 END) as active_alerts,
                    SUM(CASE WHEN severity = 'critical' AND is_resolved = 0 THEN 1 ELSE 0 END) as critical_count,
                    SUM(CASE WHEN severity = 'high' AND is_resolved = 0 THEN 1 ELSE 0 END) as high_count,
                    SUM(CASE WHEN severity = 'medium' AND is_resolved = 0 THEN 1 ELSE 0 END) as medium_count,
                    SUM(CASE WHEN severity = 'low' AND is_resolved = 0 THEN 1 ELSE 0 END) as low_count
                FROM alerts
            `).get();
        },

        getActive(limit = 100) {
            return this.findAll({ isActive: true, isResolved: false, limit });
        },

        getSeverityBreakdown() {
            return db.prepare(`
                SELECT severity, COUNT(*) as count
                FROM alerts
                WHERE is_resolved = 0
                GROUP BY severity
                ORDER BY
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END
            `).all();
        }
    },

    // =================== RISK ASSESSMENTS ===================
    riskAssessments: {
        findByForklift(forkliftId) {
            return db.prepare(`
                SELECT * FROM risk_assessments
                WHERE forklift_id = ?
                ORDER BY assessment_date DESC
            `).all(forkliftId);
        },

        getLatest(forkliftId) {
            return db.prepare(`
                SELECT * FROM risk_assessments
                WHERE forklift_id = ?
                ORDER BY assessment_date DESC
                LIMIT 1
            `).get(forkliftId);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO risk_assessments (
                    forklift_id, overall_score, age_score, hours_score,
                    maintenance_cost_score, repair_frequency_score, downtime_score,
                    risk_factors, recommendations, repair_vs_replace, replacement_urgency,
                    estimated_remaining_life_months, estimated_remaining_value,
                    projected_annual_maintenance_cost, projected_downtime_cost,
                    replacement_cost_estimate, repair_cost_estimate,
                    cost_savings_if_replaced, roi_if_replaced,
                    assessed_by, assessment_method, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.forklift_id,
                data.overall_score,
                data.age_score || null,
                data.hours_score || null,
                data.maintenance_cost_score || null,
                data.repair_frequency_score || null,
                data.downtime_score || null,
                toJSON(data.risk_factors),
                toJSON(data.recommendations),
                data.repair_vs_replace || null,
                data.replacement_urgency || null,
                data.estimated_remaining_life_months || null,
                data.estimated_remaining_value || null,
                data.projected_annual_maintenance_cost || null,
                data.projected_downtime_cost || null,
                data.replacement_cost_estimate || null,
                data.repair_cost_estimate || null,
                data.cost_savings_if_replaced || null,
                data.roi_if_replaced || null,
                data.assessed_by || null,
                data.assessment_method || 'automated',
                data.notes || null
            );

            // Update forklift risk score
            db.prepare(`
                UPDATE forklifts
                SET risk_score = ?,
                    risk_level = ?,
                    risk_factors = ?,
                    last_risk_assessment = datetime('now'),
                    recommended_action = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                data.overall_score,
                data.overall_score >= 9 ? 'critical' :
                    data.overall_score >= 7 ? 'high' :
                    data.overall_score >= 4 ? 'medium' : 'low',
                toJSON(data.risk_factors),
                data.repair_vs_replace === 'replace' ? 'plan_replacement' :
                    data.repair_vs_replace === 'monitor' ? 'monitor' : 'continue',
                data.forklift_id
            );

            return db.prepare('SELECT * FROM risk_assessments WHERE id = ?').get(result.lastInsertRowid);
        }
    },

    // =================== AUDIT LOG ===================
    audit: {
        log(data) {
            const stmt = db.prepare(`
                INSERT INTO audit_log (
                    user_id, user_email, action, entity_type, entity_id,
                    old_values, new_values, changed_fields,
                    ip_address, user_agent, session_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            return stmt.run(
                data.user_id || null,
                data.user_email || null,
                data.action,
                data.entity_type,
                data.entity_id || null,
                toJSON(data.old_values),
                toJSON(data.new_values),
                toJSON(data.changed_fields),
                data.ip_address || null,
                data.user_agent || null,
                data.session_id || null
            );
        },

        findAll(options = {}) {
            let sql = 'SELECT * FROM audit_log WHERE 1=1';
            const params = [];

            if (options.userId) {
                sql += ' AND user_id = ?';
                params.push(options.userId);
            }
            if (options.entityType) {
                sql += ' AND entity_type = ?';
                params.push(options.entityType);
            }
            if (options.entityId) {
                sql += ' AND entity_id = ?';
                params.push(options.entityId);
            }
            if (options.action) {
                sql += ' AND action = ?';
                params.push(options.action);
            }

            sql += ' ORDER BY created_at DESC';

            if (options.limit) {
                sql += ' LIMIT ?';
                params.push(options.limit);
            }

            return db.prepare(sql).all(...params);
        }
    },

    // =================== SETTINGS ===================
    settings: {
        get(key) {
            const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
            return row ? row.value : null;
        },

        set(key, value, userId) {
            db.prepare(`
                INSERT INTO system_settings (key, value, updated_by, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_by = excluded.updated_by,
                    updated_at = datetime('now')
            `).run(key, value, userId || null);
        },

        getAll(category = null) {
            if (category) {
                return db.prepare('SELECT * FROM system_settings WHERE category = ?').all(category);
            }
            return db.prepare('SELECT * FROM system_settings').all();
        }
    },

    // =================== SCHEDULED REPORTS ===================
    scheduledReports: {
        findAll() {
            return db.prepare(`
                SELECT sr.*, u.email as created_by_email
                FROM scheduled_reports sr
                LEFT JOIN users u ON sr.created_by = u.id
                WHERE sr.is_active = 1
                ORDER BY sr.name
            `).all();
        },

        findById(id) {
            return db.prepare('SELECT * FROM scheduled_reports WHERE id = ?').get(id);
        },

        create(data) {
            const stmt = db.prepare(`
                INSERT INTO scheduled_reports (
                    name, description, report_type, frequency,
                    day_of_week, day_of_month, time_of_day,
                    location_ids, forklift_ids, date_range_days,
                    format, recipients, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                data.name,
                data.description || null,
                data.report_type,
                data.frequency,
                data.day_of_week || null,
                data.day_of_month || null,
                data.time_of_day || '08:00',
                toJSON(data.location_ids),
                toJSON(data.forklift_ids),
                data.date_range_days || 30,
                data.format || 'pdf',
                toJSON(data.recipients),
                data.created_by || null
            );

            return this.findById(result.lastInsertRowid);
        }
    }
};

// Graceful shutdown
process.on('exit', () => db.close());
process.on('SIGHUP', () => process.exit(128 + 1));
process.on('SIGINT', () => process.exit(128 + 2));
process.on('SIGTERM', () => process.exit(128 + 15));

console.log('SQLite database initialized');

module.exports = dbApi;
