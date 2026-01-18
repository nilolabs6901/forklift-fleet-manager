/**
 * Maintenance Service
 * Handles preventive maintenance scheduling and service tracking
 */

const db = require('../config/sqlite-database');

class MaintenanceService {
    constructor() {
        // Default PM intervals
        this.defaultIntervals = {
            hours: 250,
            days: 90
        };
    }

    /**
     * Create a new maintenance record
     */
    createMaintenanceRecord(data, createdBy = null) {
        // Validate forklift exists
        const forklift = db.forklifts.findById(data.forklift_id);
        if (!forklift) {
            throw new Error(`Forklift ${data.forklift_id} not found`);
        }

        // Calculate total cost
        const totalCost = (parseFloat(data.labor_cost) || 0) +
                         (parseFloat(data.parts_cost) || 0) +
                         (parseFloat(data.diagnostic_cost) || 0) +
                         (parseFloat(data.other_cost) || 0);

        // Create the record
        const record = db.maintenance.create({
            ...data,
            total_cost: totalCost,
            hours_at_service: data.hours_at_service || forklift.current_hours,
            created_by: createdBy
        });

        // If this is an emergency repair, create alert
        if (data.type === 'emergency') {
            db.alerts.create({
                forklift_id: data.forklift_id,
                type: 'maintenance_due',
                severity: 'high',
                title: `Emergency Repair: ${forklift.id}`,
                message: data.description || 'Emergency maintenance performed',
                context_data: {
                    maintenance_id: record.id,
                    cost: totalCost
                }
            });
        }

        // Update forklift status if maintenance is in progress
        if (data.status === 'in_progress') {
            db.forklifts.update(data.forklift_id, { status: 'maintenance' });
        }

        // Log the action
        db.audit.log({
            user_id: createdBy,
            action: 'create',
            entity_type: 'maintenance_record',
            entity_id: record.id.toString(),
            new_values: data
        });

        return record;
    }

    /**
     * Update maintenance record
     */
    updateMaintenanceRecord(id, data, updatedBy = null) {
        const existing = db.maintenance.findById(id);
        if (!existing) {
            throw new Error(`Maintenance record ${id} not found`);
        }

        const record = db.maintenance.update(id, data);

        // If status changed to completed, update forklift
        if (data.status === 'completed' && existing.status !== 'completed') {
            db.forklifts.update(existing.forklift_id, {
                status: 'active',
                last_service_date: record.service_date || record.completion_date,
                last_service_hours: record.hours_at_service
            });

            // Resolve any related maintenance alerts
            this.resolveMaintenanceAlerts(existing.forklift_id, updatedBy);
        }

        // Log the action
        db.audit.log({
            user_id: updatedBy,
            action: 'update',
            entity_type: 'maintenance_record',
            entity_id: id.toString(),
            old_values: existing,
            new_values: data
        });

        return record;
    }

    /**
     * Complete a maintenance record
     */
    completeMaintenanceRecord(id, completionData, completedBy = null) {
        const existing = db.maintenance.findById(id);
        if (!existing) {
            throw new Error(`Maintenance record ${id} not found`);
        }

        const forklift = db.forklifts.findById(existing.forklift_id);

        // Calculate next service date based on intervals
        const serviceInterval = forklift.service_interval_days || this.defaultIntervals.days;
        const hoursInterval = forklift.service_interval_hours || this.defaultIntervals.hours;

        const nextServiceDate = new Date();
        nextServiceDate.setDate(nextServiceDate.getDate() + serviceInterval);

        const nextServiceHours = (forklift.current_hours || 0) + hoursInterval;

        const record = db.maintenance.update(id, {
            ...completionData,
            status: 'completed',
            completion_date: completionData.completion_date || new Date().toISOString().split('T')[0],
            next_service_date: completionData.next_service_date || nextServiceDate.toISOString().split('T')[0],
            next_service_hours: completionData.next_service_hours || nextServiceHours
        });

        // Update forklift
        db.forklifts.update(existing.forklift_id, {
            status: 'active',
            last_service_date: record.service_date || record.completion_date,
            last_service_hours: record.hours_at_service || forklift.current_hours,
            next_service_date: record.next_service_date,
            next_service_hours: record.next_service_hours
        });

        // Resolve maintenance alerts
        this.resolveMaintenanceAlerts(existing.forklift_id, completedBy);

        // Log the action
        db.audit.log({
            user_id: completedBy,
            action: 'update',
            entity_type: 'maintenance_record',
            entity_id: id.toString(),
            old_values: { status: existing.status },
            new_values: { status: 'completed', ...completionData }
        });

        return record;
    }

    /**
     * Submit a service request
     */
    submitServiceRequest(data, submittedBy = null) {
        const forklift = db.forklifts.findById(data.forklift_id);
        if (!forklift) {
            throw new Error(`Forklift ${data.forklift_id} not found`);
        }

        // Create as scheduled maintenance
        const record = db.maintenance.create({
            ...data,
            status: 'scheduled',
            scheduled_date: data.scheduled_date || data.service_date,
            created_by: submittedBy
        });

        // Create alert for service request
        db.alerts.create({
            forklift_id: data.forklift_id,
            type: 'service_reminder',
            severity: data.priority || 'medium',
            title: `Service Request: ${forklift.id}`,
            message: data.description || `${data.type} maintenance requested`,
            context_data: {
                maintenance_id: record.id,
                type: data.type,
                priority: data.priority
            }
        });

        return record;
    }

    /**
     * Get maintenance schedule (upcoming and overdue)
     */
    getMaintenanceSchedule() {
        const due = db.maintenance.getMaintenanceDue();
        const scheduled = db.maintenance.findAll({ status: 'scheduled' });

        // Group by status
        const overdue = due.filter(f => f.maintenance_status === 'overdue');
        const dueSoon = due.filter(f => f.maintenance_status === 'due_soon');
        const hoursExceeded = due.filter(f => f.maintenance_status === 'hours_exceeded');
        const upcoming = due.filter(f => f.maintenance_status === 'upcoming');

        return {
            overdue: {
                count: overdue.length,
                units: overdue
            },
            due_soon: {
                count: dueSoon.length,
                units: dueSoon
            },
            hours_exceeded: {
                count: hoursExceeded.length,
                units: hoursExceeded
            },
            upcoming: {
                count: upcoming.length,
                units: upcoming
            },
            scheduled: {
                count: scheduled.length,
                records: scheduled
            },
            total_due: overdue.length + dueSoon.length + hoursExceeded.length
        };
    }

    /**
     * Check and create maintenance due alerts
     */
    checkMaintenanceAlerts() {
        const schedule = this.getMaintenanceSchedule();
        const alertsCreated = [];

        // Create alerts for overdue units
        for (const unit of schedule.overdue.units) {
            const existingAlert = db.alerts.findAll({
                forkliftId: unit.id,
                type: 'maintenance_overdue',
                isResolved: false
            });

            if (existingAlert.length === 0) {
                const alert = db.alerts.create({
                    forklift_id: unit.id,
                    type: 'maintenance_overdue',
                    severity: 'high',
                    title: `Maintenance Overdue: ${unit.id}`,
                    message: `Scheduled maintenance was due on ${unit.next_service_date}`,
                    context_data: {
                        next_service_date: unit.next_service_date,
                        current_hours: unit.current_hours,
                        days_overdue: unit.days_until_due ? Math.abs(unit.days_until_due) : null
                    },
                    recurrence_key: `maintenance_overdue_${unit.id}`
                });
                alertsCreated.push(alert);
            }
        }

        // Create alerts for hours exceeded
        for (const unit of schedule.hours_exceeded.units) {
            const existingAlert = db.alerts.findAll({
                forkliftId: unit.id,
                type: 'maintenance_due',
                isResolved: false
            });

            if (existingAlert.length === 0) {
                const alert = db.alerts.create({
                    forklift_id: unit.id,
                    type: 'maintenance_due',
                    severity: 'medium',
                    title: `Service Hours Exceeded: ${unit.id}`,
                    message: `Current hours (${unit.current_hours}) exceed service threshold (${unit.next_service_hours})`,
                    context_data: {
                        current_hours: unit.current_hours,
                        next_service_hours: unit.next_service_hours
                    },
                    threshold_value: unit.next_service_hours,
                    actual_value: unit.current_hours,
                    recurrence_key: `maintenance_hours_${unit.id}`
                });
                alertsCreated.push(alert);
            }
        }

        // Create alerts for due soon (7 days)
        for (const unit of schedule.due_soon.units) {
            const existingAlert = db.alerts.findAll({
                forkliftId: unit.id,
                type: 'maintenance_due',
                isResolved: false
            });

            if (existingAlert.length === 0) {
                const alert = db.alerts.create({
                    forklift_id: unit.id,
                    type: 'maintenance_due',
                    severity: 'low',
                    title: `Maintenance Due Soon: ${unit.id}`,
                    message: `Scheduled maintenance due on ${unit.next_service_date}`,
                    context_data: {
                        next_service_date: unit.next_service_date,
                        days_until_due: unit.days_until_due
                    },
                    recurrence_key: `maintenance_due_${unit.id}`
                });
                alertsCreated.push(alert);
            }
        }

        return alertsCreated;
    }

    /**
     * Resolve maintenance-related alerts for a forklift
     */
    resolveMaintenanceAlerts(forkliftId, resolvedBy = null) {
        const alerts = db.alerts.findAll({
            forkliftId,
            isResolved: false
        });

        const maintenanceAlertTypes = ['maintenance_due', 'maintenance_overdue', 'service_reminder'];

        alerts.forEach(alert => {
            if (maintenanceAlertTypes.includes(alert.type)) {
                db.alerts.resolve(alert.id, resolvedBy, 'Maintenance completed');
            }
        });
    }

    /**
     * Get maintenance history for a forklift
     */
    getForkliftMaintenanceHistory(forkliftId, options = {}) {
        const records = db.maintenance.getByForklift(forkliftId, options.limit || 50);
        const costs = db.maintenance.getCostByForklift(forkliftId, options.months || 12);

        // Group by type
        const byType = {};
        records.forEach(r => {
            if (!byType[r.type]) {
                byType[r.type] = { count: 0, total_cost: 0, records: [] };
            }
            byType[r.type].count++;
            byType[r.type].total_cost += r.total_cost || 0;
            byType[r.type].records.push(r);
        });

        return {
            forklift_id: forkliftId,
            total_records: records.length,
            cost_summary: costs,
            by_type: byType,
            recent_records: records.slice(0, 10),
            all_records: records
        };
    }

    /**
     * Get maintenance cost analysis
     */
    getCostAnalysis(options = {}) {
        const stats = db.maintenance.getStats();
        const monthlyCosts = db.maintenance.getMonthlyCosts(options.months || 12);

        // Get top cost units
        const allForklifts = db.forklifts.findAll();
        const unitCosts = allForklifts.map(f => {
            const costs = db.maintenance.getCostByForklift(f.id, 12);
            return {
                forklift_id: f.id,
                model: f.model,
                location: f.location_name,
                ...costs
            };
        }).sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

        return {
            summary: stats,
            monthly_trends: monthlyCosts,
            top_cost_units: unitCosts.slice(0, 10),
            cost_by_unit: unitCosts
        };
    }

    /**
     * Get maintenance schedules (PM templates)
     */
    getMaintenanceSchedules() {
        return db.raw.prepare('SELECT * FROM maintenance_schedules WHERE is_active = 1').all();
    }

    /**
     * Create a maintenance schedule template
     */
    createMaintenanceSchedule(data, createdBy = null) {
        const stmt = db.raw.prepare(`
            INSERT INTO maintenance_schedules (
                name, description, interval_hours, interval_days, interval_type,
                tasks, estimated_duration_minutes, estimated_cost,
                applies_to_fuel_type, applies_to_manufacturer, applies_to_model
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.name,
            data.description || null,
            data.interval_hours || null,
            data.interval_days || null,
            data.interval_type || 'hours',
            JSON.stringify(data.tasks || []),
            data.estimated_duration_minutes || null,
            data.estimated_cost || null,
            data.applies_to_fuel_type || null,
            data.applies_to_manufacturer || null,
            data.applies_to_model || null
        );

        return db.raw.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(result.lastInsertRowid);
    }

    /**
     * Apply a maintenance schedule to create scheduled maintenance
     */
    applyScheduleToForklift(scheduleId, forkliftId, scheduledDate, createdBy = null) {
        const schedule = db.raw.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(scheduleId);
        if (!schedule) {
            throw new Error(`Maintenance schedule ${scheduleId} not found`);
        }

        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) {
            throw new Error(`Forklift ${forkliftId} not found`);
        }

        const tasks = JSON.parse(schedule.tasks || '[]');

        return this.createMaintenanceRecord({
            forklift_id: forkliftId,
            type: 'preventive',
            description: schedule.name,
            work_performed: tasks.join('\n'),
            scheduled_date: scheduledDate,
            status: 'scheduled',
            priority: 'medium'
        }, createdBy);
    }

    /**
     * Get fleet maintenance summary
     */
    getFleetSummary() {
        const schedule = this.getMaintenanceSchedule();
        const stats = db.maintenance.getStats();

        return {
            maintenance_due: schedule.total_due,
            overdue_count: schedule.overdue.count,
            scheduled_count: schedule.scheduled.count,
            monthly_cost: stats.monthly_cost,
            yearly_cost: stats.yearly_cost,
            monthly_count: stats.monthly_count,
            avg_cost_per_service: stats.avg_cost
        };
    }
}

module.exports = new MaintenanceService();
