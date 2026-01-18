-- Forklift Fleet Manager - Complete Database Schema
-- SQLite Database for Enterprise Fleet Management

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'fleet_manager', 'technician', 'viewer')),
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Locations / Warehouses
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    type TEXT DEFAULT 'warehouse' CHECK (type IN ('warehouse', 'distribution_center', 'manufacturing', 'retail', 'other')),
    capacity INTEGER DEFAULT 50,
    manager_id INTEGER REFERENCES users(id),

    -- Service Center Contact Information
    service_center_phone TEXT,
    service_center_email TEXT,
    service_center_contact TEXT,

    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Forklifts / Equipment
CREATE TABLE IF NOT EXISTS forklifts (
    id TEXT PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id),
    model TEXT,
    manufacturer TEXT,
    serial_number TEXT UNIQUE,
    year INTEGER,
    fuel_type TEXT DEFAULT 'electric' CHECK (fuel_type IN ('electric', 'propane', 'diesel', 'gas')),
    capacity_lbs INTEGER DEFAULT 5000,
    mast_type TEXT,
    tire_type TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'out_of_service', 'retired', 'pending_disposal')),

    -- Hour meter tracking
    current_hours REAL DEFAULT 0,
    last_hour_reading REAL DEFAULT 0,
    last_hour_reading_date TEXT,

    -- Service tracking
    last_service_date TEXT,
    last_service_hours REAL,
    next_service_date TEXT,
    next_service_hours REAL,
    service_interval_hours INTEGER DEFAULT 250,
    service_interval_days INTEGER DEFAULT 90,

    -- Financial data
    purchase_date TEXT,
    purchase_price REAL,
    current_value REAL,
    depreciation_rate REAL DEFAULT 0.15,

    -- Risk assessment
    risk_score INTEGER DEFAULT 1 CHECK (risk_score BETWEEN 1 AND 10),
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_factors TEXT, -- JSON array of risk factors
    last_risk_assessment TEXT,

    -- Lifecycle
    expected_lifespan_years INTEGER DEFAULT 10,
    expected_lifespan_hours INTEGER DEFAULT 20000,
    recommended_action TEXT CHECK (recommended_action IN ('continue', 'monitor', 'plan_replacement', 'replace_immediately')),
    projected_replacement_date TEXT,
    projected_replacement_year INTEGER,

    -- Metadata
    notes TEXT,
    image_url TEXT,
    qr_code TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- HOUR METER TRACKING & ANOMALY DETECTION
-- =====================================================

CREATE TABLE IF NOT EXISTS hour_meter_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT NOT NULL REFERENCES forklifts(id) ON DELETE CASCADE,
    reading REAL NOT NULL,
    previous_reading REAL,
    reading_delta REAL,
    source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'api', 'iot', 'import')),
    recorded_by INTEGER REFERENCES users(id),
    recorded_at TEXT DEFAULT (datetime('now')),

    -- Anomaly detection
    is_flagged INTEGER DEFAULT 0,
    flag_reason TEXT,
    flag_severity TEXT CHECK (flag_severity IN ('warning', 'error', 'critical')),

    -- Correction tracking
    is_corrected INTEGER DEFAULT 0,
    corrected_value REAL,
    corrected_by INTEGER REFERENCES users(id),
    corrected_at TEXT,
    correction_notes TEXT,

    -- Validation
    is_validated INTEGER DEFAULT 0,
    validated_by INTEGER REFERENCES users(id),
    validated_at TEXT
);

CREATE INDEX idx_hour_readings_forklift ON hour_meter_readings(forklift_id);
CREATE INDEX idx_hour_readings_flagged ON hour_meter_readings(is_flagged);
CREATE INDEX idx_hour_readings_date ON hour_meter_readings(recorded_at);

-- =====================================================
-- MAINTENANCE & SERVICE TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT NOT NULL REFERENCES forklifts(id) ON DELETE CASCADE,

    -- Service details
    type TEXT NOT NULL CHECK (type IN ('preventive', 'repair', 'emergency', 'inspection', 'warranty', 'recall')),
    category TEXT CHECK (category IN ('engine', 'transmission', 'hydraulic', 'electrical', 'tires', 'brakes', 'mast', 'battery', 'fuel_system', 'safety', 'general', 'other')),
    description TEXT,
    work_performed TEXT,

    -- Scheduling
    scheduled_date TEXT,
    service_date TEXT,
    completion_date TEXT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'deferred')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

    -- Hours at service
    hours_at_service REAL,

    -- Labor tracking
    labor_hours REAL DEFAULT 0,
    expected_labor_hours REAL DEFAULT 0,

    -- Cost breakdown
    labor_cost REAL DEFAULT 0,
    parts_cost REAL DEFAULT 0,
    diagnostic_cost REAL DEFAULT 0,
    other_cost REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,

    -- Parts tracking
    parts_replaced TEXT, -- JSON array
    parts_on_order TEXT, -- JSON array

    -- Personnel
    technician_id INTEGER REFERENCES users(id),
    technician_name TEXT,
    service_provider TEXT,

    -- Documentation
    work_order_number TEXT,
    invoice_number TEXT,
    notes TEXT,
    attachments TEXT, -- JSON array of file paths

    -- Follow-up
    follow_up_required INTEGER DEFAULT 0,
    follow_up_notes TEXT,
    next_service_date TEXT,
    next_service_hours REAL,

    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_maintenance_forklift ON maintenance_records(forklift_id);
CREATE INDEX idx_maintenance_type ON maintenance_records(type);
CREATE INDEX idx_maintenance_status ON maintenance_records(status);
CREATE INDEX idx_maintenance_date ON maintenance_records(service_date);

-- Expected Repair Times (standard labor times for common repairs)
CREATE TABLE IF NOT EXISTS expected_repair_times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_code TEXT UNIQUE NOT NULL,
    repair_name TEXT NOT NULL,
    category TEXT CHECK (category IN ('engine', 'transmission', 'hydraulic', 'electrical', 'tires', 'brakes', 'mast', 'battery', 'fuel_system', 'safety', 'general', 'other')),
    expected_hours REAL NOT NULL,
    min_hours REAL,
    max_hours REAL,
    description TEXT,
    applies_to_fuel_type TEXT, -- NULL means all
    applies_to_manufacturer TEXT, -- NULL means all
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_repair_times_code ON expected_repair_times(repair_code);
CREATE INDEX idx_repair_times_category ON expected_repair_times(category);

-- Maintenance schedules (PM schedules)
CREATE TABLE IF NOT EXISTS maintenance_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,

    -- Interval settings
    interval_hours INTEGER,
    interval_days INTEGER,
    interval_type TEXT DEFAULT 'hours' CHECK (interval_type IN ('hours', 'days', 'both')),

    -- Tasks
    tasks TEXT NOT NULL, -- JSON array of task descriptions
    estimated_duration_minutes INTEGER,
    estimated_cost REAL,

    -- Applicability
    applies_to_fuel_type TEXT, -- NULL means all
    applies_to_manufacturer TEXT, -- NULL means all
    applies_to_model TEXT, -- NULL means all

    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- DOWNTIME & PRODUCTION LOSS TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS downtime_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT NOT NULL REFERENCES forklifts(id) ON DELETE CASCADE,

    -- Event timing
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_hours REAL,

    -- Classification
    type TEXT NOT NULL CHECK (type IN ('unplanned', 'planned', 'emergency')),
    root_cause TEXT CHECK (root_cause IN ('mechanical_failure', 'electrical_failure', 'operator_error', 'accident', 'maintenance', 'parts_delay', 'inspection', 'weather', 'other')),
    root_cause_detail TEXT,

    -- Impact assessment
    impact_level TEXT DEFAULT 'medium' CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
    production_impact TEXT,
    estimated_production_loss REAL DEFAULT 0,
    cost_per_hour_down REAL DEFAULT 150,

    -- Associated maintenance
    maintenance_record_id INTEGER REFERENCES maintenance_records(id),

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'pending_parts', 'pending_technician')),
    resolution_notes TEXT,

    -- Reporting
    reported_by INTEGER REFERENCES users(id),
    resolved_by INTEGER REFERENCES users(id),

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_downtime_forklift ON downtime_events(forklift_id);
CREATE INDEX idx_downtime_status ON downtime_events(status);
CREATE INDEX idx_downtime_dates ON downtime_events(start_time, end_time);

-- =====================================================
-- RENTAL COST TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS rental_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT REFERENCES forklifts(id) ON DELETE SET NULL,
    downtime_event_id INTEGER REFERENCES downtime_events(id),

    -- Rental details
    rental_company TEXT,
    rental_equipment_type TEXT,
    rental_equipment_id TEXT,

    -- Dates
    start_date TEXT NOT NULL,
    end_date TEXT,
    actual_return_date TEXT,

    -- Costs
    daily_rate REAL NOT NULL,
    weekly_rate REAL,
    monthly_rate REAL,
    delivery_fee REAL DEFAULT 0,
    pickup_fee REAL DEFAULT 0,
    damage_charges REAL DEFAULT 0,
    fuel_charges REAL DEFAULT 0,
    other_charges REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,

    -- Reason
    reason TEXT NOT NULL,
    notes TEXT,

    -- Invoice
    invoice_number TEXT,
    po_number TEXT,

    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'returned', 'invoiced', 'paid')),
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_rental_forklift ON rental_records(forklift_id);
CREATE INDEX idx_rental_downtime ON rental_records(downtime_event_id);

-- =====================================================
-- ALERTS & NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT REFERENCES forklifts(id) ON DELETE CASCADE,

    -- Alert details
    type TEXT NOT NULL CHECK (type IN (
        'maintenance_due', 'maintenance_overdue', 'hour_anomaly', 'high_risk',
        'downtime', 'rental_active', 'cost_threshold', 'service_reminder',
        'inspection_due', 'warranty_expiring', 'lifecycle_alert', 'billing_discrepancy',
        'repair_time_overrun', 'custom'
    )),
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    message TEXT,

    -- Context
    context_data TEXT, -- JSON with additional context
    threshold_value REAL,
    actual_value REAL,

    -- Status
    is_active INTEGER DEFAULT 1,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_by INTEGER REFERENCES users(id),
    acknowledged_at TEXT,

    is_resolved INTEGER DEFAULT 0,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TEXT,
    resolution_notes TEXT,

    -- Notification tracking
    email_sent INTEGER DEFAULT 0,
    email_sent_at TEXT,
    sms_sent INTEGER DEFAULT 0,
    sms_sent_at TEXT,
    webhook_sent INTEGER DEFAULT 0,
    webhook_sent_at TEXT,

    -- Recurrence
    is_recurring INTEGER DEFAULT 0,
    recurrence_key TEXT, -- To prevent duplicate alerts

    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

CREATE INDEX idx_alerts_forklift ON alerts(forklift_id);
CREATE INDEX idx_alerts_active ON alerts(is_active, is_resolved);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(type);

-- Alert acknowledgment history
CREATE TABLE IF NOT EXISTS alert_acknowledgments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('viewed', 'acknowledged', 'escalated', 'resolved', 'snoozed')),
    notes TEXT,
    snooze_until TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- RISK ASSESSMENT & LIFECYCLE
-- =====================================================

CREATE TABLE IF NOT EXISTS risk_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT NOT NULL REFERENCES forklifts(id) ON DELETE CASCADE,

    -- Risk scores (1-10 scale)
    overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 1 AND 10),
    age_score INTEGER CHECK (age_score BETWEEN 1 AND 10),
    hours_score INTEGER CHECK (hours_score BETWEEN 1 AND 10),
    maintenance_cost_score INTEGER CHECK (maintenance_cost_score BETWEEN 1 AND 10),
    repair_frequency_score INTEGER CHECK (repair_frequency_score BETWEEN 1 AND 10),
    downtime_score INTEGER CHECK (downtime_score BETWEEN 1 AND 10),

    -- Analysis
    risk_factors TEXT, -- JSON array of contributing factors
    recommendations TEXT, -- JSON array of recommendations

    -- Lifecycle
    repair_vs_replace TEXT CHECK (repair_vs_replace IN ('repair', 'replace', 'monitor')),
    replacement_urgency TEXT CHECK (replacement_urgency IN ('immediate', 'within_6_months', 'within_1_year', 'within_2_years', 'not_needed')),
    estimated_remaining_life_months INTEGER,
    estimated_remaining_value REAL,

    -- Cost projections
    projected_annual_maintenance_cost REAL,
    projected_downtime_cost REAL,
    replacement_cost_estimate REAL,
    repair_cost_estimate REAL,
    cost_savings_if_replaced REAL,
    roi_if_replaced REAL,

    -- Assessment metadata
    assessment_date TEXT DEFAULT (datetime('now')),
    assessed_by INTEGER REFERENCES users(id),
    assessment_method TEXT DEFAULT 'automated',
    notes TEXT
);

CREATE INDEX idx_risk_forklift ON risk_assessments(forklift_id);
CREATE INDEX idx_risk_score ON risk_assessments(overall_score);
CREATE INDEX idx_risk_date ON risk_assessments(assessment_date);

-- =====================================================
-- BUDGET & FINANCIAL PLANNING
-- =====================================================

CREATE TABLE IF NOT EXISTS budget_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fiscal_year INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,

    -- Budget amounts
    total_budget REAL NOT NULL,
    maintenance_budget REAL DEFAULT 0,
    replacement_budget REAL DEFAULT 0,
    rental_budget REAL DEFAULT 0,
    emergency_reserve REAL DEFAULT 0,

    -- Actual spend (updated throughout year)
    maintenance_actual REAL DEFAULT 0,
    replacement_actual REAL DEFAULT 0,
    rental_actual REAL DEFAULT 0,
    emergency_actual REAL DEFAULT 0,

    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'closed')),
    approved_by INTEGER REFERENCES users(id),
    approved_at TEXT,

    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replacement_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_plan_id INTEGER REFERENCES budget_plans(id),
    forklift_id TEXT NOT NULL REFERENCES forklifts(id),

    -- Recommendation
    priority_rank INTEGER,
    recommended_year INTEGER,
    recommended_quarter INTEGER,

    -- Justification
    risk_score INTEGER,
    current_age_years REAL,
    current_hours REAL,
    ytd_maintenance_cost REAL,
    projected_next_year_cost REAL,

    -- ROI analysis
    replacement_cost REAL,
    trade_in_value REAL,
    net_replacement_cost REAL,
    annual_savings_estimate REAL,
    payback_period_months INTEGER,
    five_year_roi REAL,

    -- Decision
    decision TEXT CHECK (decision IN ('pending', 'approved', 'deferred', 'rejected')),
    decision_by INTEGER REFERENCES users(id),
    decision_at TEXT,
    decision_notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- AUDIT TRAIL
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    user_email TEXT,

    -- Action details
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'login', 'logout', 'export', 'import', 'correct', 'approve', 'reject')),
    entity_type TEXT NOT NULL,
    entity_id TEXT,

    -- Change tracking
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    changed_fields TEXT, -- JSON array

    -- Context
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- =====================================================
-- REPORTS & EXPORTS
-- =====================================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,

    -- Report type
    report_type TEXT NOT NULL CHECK (report_type IN (
        'fleet_summary', 'maintenance_costs', 'downtime_analysis',
        'risk_assessment', 'replacement_planning', 'custom'
    )),

    -- Schedule
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
    day_of_week INTEGER, -- 0-6 for weekly
    day_of_month INTEGER, -- 1-31 for monthly
    time_of_day TEXT DEFAULT '08:00',
    next_run_at TEXT,
    last_run_at TEXT,

    -- Filters
    location_ids TEXT, -- JSON array, NULL for all
    forklift_ids TEXT, -- JSON array, NULL for all
    date_range_days INTEGER DEFAULT 30,

    -- Delivery
    format TEXT DEFAULT 'pdf' CHECK (format IN ('pdf', 'excel', 'csv')),
    recipients TEXT NOT NULL, -- JSON array of email addresses

    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS report_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheduled_report_id INTEGER REFERENCES scheduled_reports(id),

    report_type TEXT NOT NULL,
    report_name TEXT,

    -- Generation details
    generated_at TEXT DEFAULT (datetime('now')),
    generated_by INTEGER REFERENCES users(id),

    -- File
    file_path TEXT,
    file_size INTEGER,
    format TEXT,

    -- Delivery
    recipients TEXT,
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
    delivery_error TEXT,

    -- Parameters used
    parameters TEXT -- JSON
);

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    updated_by INTEGER REFERENCES users(id),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default settings
INSERT OR IGNORE INTO system_settings (key, value, description, category) VALUES
    ('maintenance_reminder_days', '7', 'Days before maintenance to send reminder', 'maintenance'),
    ('maintenance_overdue_alert_hours', '24', 'Hours after due date to escalate alert', 'maintenance'),
    ('hour_anomaly_backward_threshold', '0', 'Flag if hours decrease by more than this', 'anomaly'),
    ('hour_anomaly_jump_threshold', '100', 'Flag if hours increase by more than this in one reading', 'anomaly'),
    ('hour_anomaly_daily_max', '24', 'Maximum expected hours per day', 'anomaly'),
    ('risk_high_threshold', '7', 'Score threshold for high risk', 'risk'),
    ('risk_critical_threshold', '9', 'Score threshold for critical risk', 'risk'),
    ('cost_per_hour_down', '150', 'Default cost per hour of downtime', 'financial'),
    ('depreciation_method', 'straight_line', 'Depreciation calculation method', 'financial'),
    ('default_service_interval_hours', '250', 'Default PM interval in hours', 'maintenance'),
    ('default_service_interval_days', '90', 'Default PM interval in days', 'maintenance'),
    ('alert_email_enabled', 'true', 'Enable email alerts', 'notifications'),
    ('alert_sms_enabled', 'false', 'Enable SMS alerts', 'notifications'),
    ('session_timeout_minutes', '480', 'Session timeout in minutes', 'security'),
    ('password_min_length', '8', 'Minimum password length', 'security');

-- =====================================================
-- API KEYS & WEBHOOKS
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL, -- First 8 chars for identification

    -- Permissions
    permissions TEXT DEFAULT '["read"]', -- JSON array

    -- Rate limiting
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour

    -- Status
    is_active INTEGER DEFAULT 1,
    last_used_at TEXT,
    expires_at TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT,

    -- Events to trigger
    events TEXT NOT NULL, -- JSON array of event types

    -- Status
    is_active INTEGER DEFAULT 1,
    last_triggered_at TEXT,
    last_status_code INTEGER,
    consecutive_failures INTEGER DEFAULT 0,

    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Fleet summary view
CREATE VIEW IF NOT EXISTS v_fleet_summary AS
SELECT
    f.id,
    f.model,
    f.manufacturer,
    f.serial_number,
    f.status,
    f.current_hours,
    f.risk_score,
    f.risk_level,
    f.recommended_action,
    l.name as location_name,
    l.city as location_city,
    (SELECT COUNT(*) FROM maintenance_records m WHERE m.forklift_id = f.id AND m.service_date >= date('now', '-12 months')) as maintenance_count_12m,
    (SELECT COALESCE(SUM(m.total_cost), 0) FROM maintenance_records m WHERE m.forklift_id = f.id AND m.service_date >= date('now', '-12 months')) as maintenance_cost_12m,
    (SELECT COALESCE(SUM(d.duration_hours), 0) FROM downtime_events d WHERE d.forklift_id = f.id AND d.start_time >= date('now', '-12 months')) as downtime_hours_12m,
    (SELECT COUNT(*) FROM alerts a WHERE a.forklift_id = f.id AND a.is_active = 1 AND a.is_resolved = 0) as active_alerts
FROM forklifts f
LEFT JOIN locations l ON f.location_id = l.id
WHERE f.status != 'retired';

-- Active alerts view
CREATE VIEW IF NOT EXISTS v_active_alerts AS
SELECT
    a.*,
    f.model as forklift_model,
    f.serial_number as forklift_serial,
    l.name as location_name
FROM alerts a
LEFT JOIN forklifts f ON a.forklift_id = f.id
LEFT JOIN locations l ON f.location_id = l.id
WHERE a.is_active = 1 AND a.is_resolved = 0
ORDER BY
    CASE a.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    a.created_at DESC;

-- Maintenance due view
CREATE VIEW IF NOT EXISTS v_maintenance_due AS
SELECT
    f.*,
    l.name as location_name,
    CASE
        WHEN f.next_service_date <= date('now') THEN 'overdue'
        WHEN f.next_service_date <= date('now', '+7 days') THEN 'due_soon'
        WHEN f.current_hours >= f.next_service_hours THEN 'hours_exceeded'
        ELSE 'upcoming'
    END as maintenance_status,
    julianday(f.next_service_date) - julianday('now') as days_until_due
FROM forklifts f
LEFT JOIN locations l ON f.location_id = l.id
WHERE f.status NOT IN ('retired', 'pending_disposal')
    AND (
        f.next_service_date <= date('now', '+30 days')
        OR f.current_hours >= COALESCE(f.next_service_hours, f.current_hours + 1000) - 50
    )
ORDER BY
    CASE
        WHEN f.next_service_date <= date('now') THEN 1
        WHEN f.current_hours >= f.next_service_hours THEN 2
        ELSE 3
    END,
    f.next_service_date;

-- =====================================================
-- PREDICTIVE MAINTENANCE
-- =====================================================

-- Component lifecycle definitions
CREATE TABLE IF NOT EXISTS component_lifecycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    component_name TEXT UNIQUE NOT NULL,
    component_key TEXT UNIQUE NOT NULL,
    category TEXT CHECK (category IN ('engine', 'transmission', 'hydraulic', 'electrical', 'tires', 'brakes', 'mast', 'battery', 'fuel_system', 'safety', 'general', 'other')),
    expected_hours INTEGER NOT NULL,
    warning_threshold REAL DEFAULT 0.80,
    critical_threshold REAL DEFAULT 0.95,
    applies_to_fuel_type TEXT, -- NULL means all, 'electric', 'propane', 'diesel', 'gas'
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_component_lifecycle_key ON component_lifecycles(component_key);

-- Failure pattern definitions
CREATE TABLE IF NOT EXISTS failure_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_name TEXT UNIQUE NOT NULL,
    description TEXT,
    sequence TEXT NOT NULL, -- JSON array of keywords to look for
    prediction TEXT NOT NULL,
    confidence REAL DEFAULT 0.80,
    urgency TEXT DEFAULT 'high' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    lookahead_days INTEGER DEFAULT 30,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Maintenance predictions log
CREATE TABLE IF NOT EXISTS maintenance_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forklift_id TEXT NOT NULL REFERENCES forklifts(id) ON DELETE CASCADE,

    -- Prediction details
    prediction_type TEXT NOT NULL CHECK (prediction_type IN ('scheduled_service', 'failure_pattern', 'component_lifecycle', 'anomaly')),
    title TEXT NOT NULL,
    description TEXT,

    -- Timing
    predicted_date TEXT,
    days_until INTEGER,
    hours_until REAL,

    -- Confidence and urgency
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),

    -- Additional context
    component_key TEXT,
    pattern_name TEXT,
    context_data TEXT, -- JSON

    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'scheduled', 'dismissed', 'occurred', 'expired')),
    scheduled_maintenance_id INTEGER REFERENCES maintenance_records(id),
    dismissed_by INTEGER REFERENCES users(id),
    dismissed_at TEXT,
    dismissed_reason TEXT,

    -- Accuracy tracking
    actual_occurrence_date TEXT,
    prediction_accurate INTEGER, -- 1 if prediction was accurate, 0 if not
    accuracy_notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_predictions_forklift ON maintenance_predictions(forklift_id);
CREATE INDEX idx_predictions_status ON maintenance_predictions(status);
CREATE INDEX idx_predictions_urgency ON maintenance_predictions(urgency);
CREATE INDEX idx_predictions_date ON maintenance_predictions(predicted_date);

-- Prediction accuracy history (for ML improvement)
CREATE TABLE IF NOT EXISTS prediction_accuracy_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id INTEGER REFERENCES maintenance_predictions(id),
    forklift_id TEXT NOT NULL,
    prediction_type TEXT NOT NULL,
    predicted_date TEXT,
    actual_date TEXT,
    days_difference INTEGER, -- positive = late, negative = early
    was_accurate INTEGER, -- within acceptable range
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Shared Reports (for shareable links)
CREATE TABLE IF NOT EXISTS shared_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_token TEXT UNIQUE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('predictions', 'forklift', 'fleet_summary', 'maintenance_schedule')),

    -- Report data (snapshot at time of share)
    report_data TEXT NOT NULL, -- JSON snapshot
    report_title TEXT,

    -- Scope
    forklift_id TEXT REFERENCES forklifts(id),
    location_id INTEGER REFERENCES locations(id),

    -- Access control
    password_hash TEXT, -- Optional password protection
    view_count INTEGER DEFAULT 0,
    max_views INTEGER, -- NULL for unlimited

    -- Expiration
    expires_at TEXT,
    is_active INTEGER DEFAULT 1,

    -- Audit
    created_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    last_accessed_at TEXT
);

CREATE INDEX idx_shared_reports_token ON shared_reports(share_token);
CREATE INDEX idx_shared_reports_active ON shared_reports(is_active, expires_at);

-- View for active predictions
CREATE VIEW IF NOT EXISTS v_active_predictions AS
SELECT
    p.*,
    f.model as forklift_model,
    f.current_hours,
    f.risk_score,
    l.name as location_name
FROM maintenance_predictions p
LEFT JOIN forklifts f ON p.forklift_id = f.id
LEFT JOIN locations l ON f.location_id = l.id
WHERE p.status = 'active'
ORDER BY
    CASE p.urgency
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END,
    p.predicted_date;
