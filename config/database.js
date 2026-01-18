/**
 * Simple JSON-based Database
 * Provides CRUD operations for fleet management data
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default schema
const defaultData = {
  locations: [],
  forklifts: [],
  maintenance_records: [],
  alerts: [],
  hour_logs: [],
  _meta: {
    sequences: {
      locations: 1,
      maintenance_records: 1,
      alerts: 1,
      hour_logs: 1
    }
  }
};

// Load database
let data;
const loadDb = () => {
  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Ensure _meta exists
      if (!data._meta) {
        data._meta = defaultData._meta;
      }
    } catch (e) {
      console.error('Error loading database:', e.message);
      data = JSON.parse(JSON.stringify(defaultData));
    }
  } else {
    data = JSON.parse(JSON.stringify(defaultData));
  }
};

loadDb();

// Save database
const saveDb = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Get next auto-increment ID
const nextId = (table) => {
  const id = data._meta.sequences[table] || 1;
  data._meta.sequences[table] = id + 1;
  saveDb();
  return id;
};

// Database API
const db = {
  // ===== LOCATIONS =====
  locations: {
    findAll() {
      return data.locations.map(loc => ({
        ...loc,
        forklift_count: data.forklifts.filter(f => f.location_id === loc.id).length
      })).sort((a, b) => a.name.localeCompare(b.name));
    },

    findById(id) {
      const loc = data.locations.find(l => l.id === parseInt(id));
      if (!loc) return null;
      return {
        ...loc,
        forklift_count: data.forklifts.filter(f => f.location_id === loc.id).length
      };
    },

    findByName(name) {
      return data.locations.find(l => l.name === name);
    },

    create(record) {
      const location = {
        id: nextId('locations'),
        name: record.name,
        address: record.address || null,
        type: record.type || 'warehouse',
        capacity: parseInt(record.capacity) || 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      data.locations.push(location);
      saveDb();
      return this.findById(location.id);
    },

    update(id, updates) {
      const index = data.locations.findIndex(l => l.id === parseInt(id));
      if (index === -1) return null;
      data.locations[index] = {
        ...data.locations[index],
        ...updates,
        id: data.locations[index].id,
        updated_at: new Date().toISOString()
      };
      saveDb();
      return this.findById(id);
    },

    delete(id) {
      const before = data.locations.length;
      data.locations = data.locations.filter(l => l.id !== parseInt(id));
      saveDb();
      return before > data.locations.length;
    },

    getStats() {
      return {
        total_locations: data.locations.length,
        total_capacity: data.locations.reduce((sum, l) => sum + (l.capacity || 0), 0),
        total_forklifts: data.forklifts.length
      };
    }
  },

  // ===== FORKLIFTS =====
  forklifts: {
    findAll(options = {}) {
      let items = data.forklifts.map(f => {
        const location = data.locations.find(l => l.id === f.location_id);
        return {
          ...f,
          location_name: location?.name || null
        };
      });

      // Apply filters
      if (options.locationId) {
        items = items.filter(f => f.location_id === parseInt(options.locationId));
      }
      if (options.status) {
        items = items.filter(f => f.status === options.status);
      }
      if (options.riskLevel) {
        items = items.filter(f => f.risk_level === options.riskLevel);
      }
      if (options.fuelType) {
        items = items.filter(f => f.fuel_type === options.fuelType);
      }
      if (options.search) {
        const s = options.search.toLowerCase();
        items = items.filter(f =>
          (f.id && f.id.toLowerCase().includes(s)) ||
          (f.model && f.model.toLowerCase().includes(s)) ||
          (f.manufacturer && f.manufacturer.toLowerCase().includes(s))
        );
      }

      return items.sort((a, b) => a.id.localeCompare(b.id));
    },

    findById(id) {
      const f = data.forklifts.find(f => f.id === id);
      if (!f) return null;
      const location = data.locations.find(l => l.id === f.location_id);
      return { ...f, location_name: location?.name || null };
    },

    create(record) {
      const forklift = {
        id: record.id,
        location_id: record.location_id ? parseInt(record.location_id) : null,
        model: record.model || null,
        manufacturer: record.manufacturer || null,
        serial_number: record.serial_number || null,
        year: record.year ? parseInt(record.year) : null,
        fuel_type: record.fuel_type || 'electric',
        capacity_lbs: record.capacity_lbs ? parseInt(record.capacity_lbs) : 5000,
        status: record.status || 'active',
        operating_hours: parseFloat(record.operating_hours) || 0,
        last_service_date: record.last_service_date || null,
        next_service_date: record.next_service_date || null,
        purchase_date: record.purchase_date || null,
        purchase_price: record.purchase_price ? parseFloat(record.purchase_price) : null,
        risk_level: record.risk_level || 'low',
        notes: record.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      data.forklifts.push(forklift);
      saveDb();
      return this.findById(forklift.id);
    },

    update(id, updates) {
      const index = data.forklifts.findIndex(f => f.id === id);
      if (index === -1) return null;

      const current = data.forklifts[index];
      data.forklifts[index] = {
        ...current,
        ...updates,
        id: current.id,
        location_id: updates.location_id !== undefined ? (updates.location_id ? parseInt(updates.location_id) : null) : current.location_id,
        operating_hours: updates.operating_hours !== undefined ? parseFloat(updates.operating_hours) : current.operating_hours,
        updated_at: new Date().toISOString()
      };
      saveDb();
      return this.findById(id);
    },

    delete(id) {
      const before = data.forklifts.length;
      data.forklifts = data.forklifts.filter(f => f.id !== id);
      // Also delete related records
      data.maintenance_records = data.maintenance_records.filter(m => m.forklift_id !== id);
      data.alerts = data.alerts.filter(a => a.forklift_id !== id);
      data.hour_logs = data.hour_logs.filter(h => h.forklift_id !== id);
      saveDb();
      return before > data.forklifts.length;
    },

    getStats() {
      const forklifts = data.forklifts;
      return {
        total: forklifts.length,
        active: forklifts.filter(f => f.status === 'active').length,
        in_maintenance: forklifts.filter(f => f.status === 'maintenance').length,
        out_of_service: forklifts.filter(f => f.status === 'out_of_service').length,
        high_risk: forklifts.filter(f => f.risk_level === 'high').length,
        medium_risk: forklifts.filter(f => f.risk_level === 'medium').length,
        low_risk: forklifts.filter(f => f.risk_level === 'low').length,
        avg_hours: forklifts.length ?
          forklifts.reduce((sum, f) => sum + (f.operating_hours || 0), 0) / forklifts.length : 0
      };
    },

    getByLocation(locationId) {
      return this.findAll({ locationId: parseInt(locationId) });
    },

    getMaintenanceHistory(id) {
      return data.maintenance_records
        .filter(m => m.forklift_id === id)
        .sort((a, b) => new Date(b.service_date) - new Date(a.service_date));
    },

    getAlerts(id) {
      return data.alerts
        .filter(a => a.forklift_id === id)
        .sort((a, b) => a.is_resolved - b.is_resolved || new Date(b.created_at) - new Date(a.created_at));
    },

    getHourLogs(id, limit = 30) {
      return data.hour_logs
        .filter(h => h.forklift_id === id)
        .sort((a, b) => new Date(b.logged_at) - new Date(a.logged_at))
        .slice(0, limit);
    },

    updateHours(id, hours, loggedBy = null) {
      const index = data.forklifts.findIndex(f => f.id === id);
      if (index === -1) return null;

      data.forklifts[index].operating_hours = parseFloat(hours);
      data.forklifts[index].updated_at = new Date().toISOString();

      // Log the hour update
      data.hour_logs.push({
        id: nextId('hour_logs'),
        forklift_id: id,
        hours: parseFloat(hours),
        logged_by: loggedBy,
        logged_at: new Date().toISOString()
      });

      // Recalculate risk level
      this.recalculateRiskLevel(id);
      saveDb();
      return this.findById(id);
    },

    recalculateRiskLevel(id) {
      const index = data.forklifts.findIndex(f => f.id === id);
      if (index === -1) return null;

      const forklift = data.forklifts[index];
      let score = 0;

      // Hours-based risk
      if (forklift.operating_hours > 5000) score += 3;
      else if (forklift.operating_hours > 3000) score += 2;
      else if (forklift.operating_hours > 1000) score += 1;

      // Maintenance due risk
      if (forklift.next_service_date) {
        if (new Date(forklift.next_service_date) <= new Date()) score += 2;
      } else if (!forklift.last_service_date) {
        score += 2;
      }

      // Status-based risk
      if (forklift.status === 'out_of_service') score += 3;
      else if (forklift.status === 'maintenance') score += 1;

      // Alert count risk
      const alertCount = data.alerts.filter(a => a.forklift_id === id && !a.is_resolved).length;
      if (alertCount > 5) score += 2;
      else if (alertCount > 2) score += 1;

      let riskLevel = 'low';
      if (score >= 6) riskLevel = 'high';
      else if (score >= 3) riskLevel = 'medium';

      data.forklifts[index].risk_level = riskLevel;
      saveDb();
      return riskLevel;
    }
  },

  // ===== MAINTENANCE RECORDS =====
  maintenance: {
    findAll(options = {}) {
      let items = data.maintenance_records.map(m => {
        const forklift = data.forklifts.find(f => f.id === m.forklift_id);
        const location = forklift ? data.locations.find(l => l.id === forklift.location_id) : null;
        return {
          ...m,
          forklift_model: forklift?.model || null,
          location_name: location?.name || null
        };
      });

      if (options.forkliftId) {
        items = items.filter(m => m.forklift_id === options.forkliftId);
      }
      if (options.type) {
        items = items.filter(m => m.type === options.type);
      }
      if (options.status) {
        items = items.filter(m => m.status === options.status);
      }

      items.sort((a, b) => new Date(b.service_date) - new Date(a.service_date));

      if (options.limit) {
        items = items.slice(0, parseInt(options.limit));
      }

      return items;
    },

    findById(id) {
      const m = data.maintenance_records.find(m => m.id === parseInt(id));
      if (!m) return null;
      const forklift = data.forklifts.find(f => f.id === m.forklift_id);
      const location = forklift ? data.locations.find(l => l.id === forklift.location_id) : null;
      return {
        ...m,
        forklift_model: forklift?.model || null,
        location_name: location?.name || null
      };
    },

    create(record) {
      const maintenance = {
        id: nextId('maintenance_records'),
        forklift_id: record.forklift_id,
        type: record.type,
        description: record.description || null,
        cost: parseFloat(record.cost) || 0,
        technician: record.technician || null,
        parts_replaced: record.parts_replaced || null,
        hours_at_service: record.hours_at_service ? parseFloat(record.hours_at_service) : null,
        service_date: record.service_date || new Date().toISOString().split('T')[0],
        next_service_date: record.next_service_date || null,
        status: record.status || 'completed',
        created_at: new Date().toISOString()
      };
      data.maintenance_records.push(maintenance);

      // Update forklift service dates if completed
      if (maintenance.status === 'completed') {
        const fIndex = data.forklifts.findIndex(f => f.id === maintenance.forklift_id);
        if (fIndex !== -1) {
          data.forklifts[fIndex].last_service_date = maintenance.service_date;
          if (maintenance.next_service_date) {
            data.forklifts[fIndex].next_service_date = maintenance.next_service_date;
          }
          data.forklifts[fIndex].updated_at = new Date().toISOString();
        }
      }

      saveDb();
      return this.findById(maintenance.id);
    },

    update(id, updates) {
      const index = data.maintenance_records.findIndex(m => m.id === parseInt(id));
      if (index === -1) return null;
      data.maintenance_records[index] = {
        ...data.maintenance_records[index],
        ...updates,
        id: data.maintenance_records[index].id
      };
      saveDb();
      return this.findById(id);
    },

    delete(id) {
      const before = data.maintenance_records.length;
      data.maintenance_records = data.maintenance_records.filter(m => m.id !== parseInt(id));
      saveDb();
      return before > data.maintenance_records.length;
    },

    getStats() {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const monthly = data.maintenance_records.filter(m => m.service_date >= thirtyDaysAgoStr);
      const allCosts = data.maintenance_records.filter(m => m.cost > 0);

      return {
        total_records: data.maintenance_records.length,
        total_cost: data.maintenance_records.reduce((sum, m) => sum + (m.cost || 0), 0),
        monthly_cost: monthly.reduce((sum, m) => sum + (m.cost || 0), 0),
        monthly_count: monthly.length,
        avg_cost: allCosts.length ?
          allCosts.reduce((sum, m) => sum + m.cost, 0) / allCosts.length : 0
      };
    },

    getMaintenanceDue() {
      const today = new Date().toISOString().split('T')[0];
      return data.forklifts
        .filter(f =>
          !f.next_service_date ||
          f.next_service_date <= today ||
          f.operating_hours >= 500
        )
        .map(f => {
          const location = data.locations.find(l => l.id === f.location_id);
          return { ...f, location_name: location?.name || null };
        })
        .sort((a, b) => {
          if (!a.next_service_date) return -1;
          if (!b.next_service_date) return 1;
          return new Date(a.next_service_date) - new Date(b.next_service_date);
        });
    },

    getTypeBreakdown() {
      const types = {};
      data.maintenance_records.forEach(m => {
        if (!types[m.type]) {
          types[m.type] = { type: m.type, count: 0, total_cost: 0 };
        }
        types[m.type].count++;
        types[m.type].total_cost += m.cost || 0;
      });
      return Object.values(types).sort((a, b) => b.count - a.count);
    },

    getMonthlyCosts(months = 12) {
      const results = {};
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);

      data.maintenance_records.forEach(m => {
        if (new Date(m.service_date) >= cutoff) {
          const month = m.service_date.substring(0, 7);
          if (!results[month]) {
            results[month] = { month, count: 0, total_cost: 0 };
          }
          results[month].count++;
          results[month].total_cost += m.cost || 0;
        }
      });

      return Object.values(results).sort((a, b) => a.month.localeCompare(b.month));
    }
  },

  // ===== ALERTS =====
  alerts: {
    findAll(options = {}) {
      let items = data.alerts.map(a => {
        const forklift = data.forklifts.find(f => f.id === a.forklift_id);
        const location = forklift ? data.locations.find(l => l.id === forklift.location_id) : null;
        return {
          ...a,
          forklift_model: forklift?.model || null,
          location_name: location?.name || null
        };
      });

      if (options.forkliftId) {
        items = items.filter(a => a.forklift_id === options.forkliftId);
      }
      if (options.severity) {
        items = items.filter(a => a.severity === options.severity);
      }
      if (options.type) {
        items = items.filter(a => a.type === options.type);
      }
      if (options.isResolved !== undefined) {
        items = items.filter(a => a.is_resolved === options.isResolved);
      }

      // Sort by resolved, then severity, then date
      const severityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
      items.sort((a, b) => {
        if (a.is_resolved !== b.is_resolved) return a.is_resolved - b.is_resolved;
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return new Date(b.created_at) - new Date(a.created_at);
      });

      if (options.limit) {
        items = items.slice(0, parseInt(options.limit));
      }

      return items;
    },

    findById(id) {
      const a = data.alerts.find(a => a.id === parseInt(id));
      if (!a) return null;
      const forklift = data.forklifts.find(f => f.id === a.forklift_id);
      const location = forklift ? data.locations.find(l => l.id === forklift.location_id) : null;
      return {
        ...a,
        forklift_model: forklift?.model || null,
        location_name: location?.name || null
      };
    },

    create(record) {
      const alert = {
        id: nextId('alerts'),
        forklift_id: record.forklift_id || null,
        type: record.type,
        severity: record.severity || 'medium',
        title: record.title,
        message: record.message || null,
        is_resolved: false,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date().toISOString()
      };
      data.alerts.push(alert);
      saveDb();
      return this.findById(alert.id);
    },

    resolve(id, resolvedBy = null) {
      const index = data.alerts.findIndex(a => a.id === parseInt(id));
      if (index === -1) return null;
      data.alerts[index].is_resolved = true;
      data.alerts[index].resolved_at = new Date().toISOString();
      data.alerts[index].resolved_by = resolvedBy;
      saveDb();
      return this.findById(id);
    },

    unresolve(id) {
      const index = data.alerts.findIndex(a => a.id === parseInt(id));
      if (index === -1) return null;
      data.alerts[index].is_resolved = false;
      data.alerts[index].resolved_at = null;
      data.alerts[index].resolved_by = null;
      saveDb();
      return this.findById(id);
    },

    delete(id) {
      const before = data.alerts.length;
      data.alerts = data.alerts.filter(a => a.id !== parseInt(id));
      saveDb();
      return before > data.alerts.length;
    },

    getStats() {
      const active = data.alerts.filter(a => !a.is_resolved);
      return {
        total_alerts: data.alerts.length,
        active_alerts: active.length,
        critical_count: active.filter(a => a.severity === 'critical').length,
        high_count: active.filter(a => a.severity === 'high').length,
        medium_count: active.filter(a => a.severity === 'medium').length,
        low_count: active.filter(a => a.severity === 'low').length
      };
    },

    getSeverityBreakdown() {
      const severities = ['critical', 'high', 'medium', 'low'];
      return severities.map(severity => ({
        severity,
        count: data.alerts.filter(a => a.severity === severity).length,
        active_count: data.alerts.filter(a => a.severity === severity && !a.is_resolved).length
      }));
    }
  },

  // Direct data access for seed script
  _data: data,
  _save: saveDb,
  _nextId: nextId,
  _reload: loadDb
};

console.log('Database initialized (JSON storage)');
saveDb();

module.exports = db;
