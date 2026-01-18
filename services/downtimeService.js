/**
 * Downtime & Rental Cost Service
 * Tracks equipment downtime and associated rental costs
 */

const db = require('../config/sqlite-database');

class DowntimeService {
    constructor() {
        this.defaultCostPerHourDown = 150;
    }

    /**
     * Start a downtime event
     */
    startDowntimeEvent(data, reportedBy = null) {
        const forklift = db.forklifts.findById(data.forklift_id);
        if (!forklift) {
            throw new Error(`Forklift ${data.forklift_id} not found`);
        }

        // Check for existing active downtime
        const activeDowntime = db.downtime.findAll({
            forkliftId: data.forklift_id,
            status: 'active'
        });

        if (activeDowntime.length > 0) {
            throw new Error(`Forklift ${data.forklift_id} already has an active downtime event`);
        }

        const event = db.downtime.create({
            ...data,
            start_time: data.start_time || new Date().toISOString(),
            cost_per_hour_down: data.cost_per_hour_down || this.defaultCostPerHourDown,
            reported_by: reportedBy
        });

        // Create downtime alert
        db.alerts.create({
            forklift_id: data.forklift_id,
            type: 'downtime',
            severity: data.type === 'emergency' ? 'critical' : 'high',
            title: `Equipment Down: ${forklift.id}`,
            message: data.root_cause_detail || `${forklift.model || 'Forklift'} is out of service`,
            context_data: {
                downtime_event_id: event.id,
                type: data.type,
                root_cause: data.root_cause
            }
        });

        // Log the action
        db.audit.log({
            user_id: reportedBy,
            action: 'create',
            entity_type: 'downtime_event',
            entity_id: event.id.toString(),
            new_values: data
        });

        return event;
    }

    /**
     * Resolve a downtime event
     */
    resolveDowntimeEvent(eventId, data, resolvedBy = null) {
        const event = db.downtime.findById(eventId);
        if (!event) {
            throw new Error(`Downtime event ${eventId} not found`);
        }

        if (event.status === 'resolved') {
            throw new Error('Downtime event is already resolved');
        }

        const resolved = db.downtime.resolve(eventId, {
            ...data,
            resolved_by: resolvedBy
        });

        // Resolve related alerts
        const alerts = db.alerts.findAll({
            forkliftId: event.forklift_id,
            type: 'downtime',
            isResolved: false
        });

        alerts.forEach(alert => {
            const context = alert.context_data ? JSON.parse(alert.context_data) : {};
            if (context.downtime_event_id === eventId) {
                db.alerts.resolve(alert.id, resolvedBy, data.resolution_notes);
            }
        });

        // Log the action
        db.audit.log({
            user_id: resolvedBy,
            action: 'update',
            entity_type: 'downtime_event',
            entity_id: eventId.toString(),
            old_values: { status: 'active' },
            new_values: { status: 'resolved', ...data }
        });

        return resolved;
    }

    /**
     * Update downtime event status
     */
    updateDowntimeStatus(eventId, status, notes = null) {
        const event = db.downtime.findById(eventId);
        if (!event) {
            throw new Error(`Downtime event ${eventId} not found`);
        }

        db.raw.prepare(`
            UPDATE downtime_events
            SET status = ?, resolution_notes = COALESCE(?, resolution_notes), updated_at = datetime('now')
            WHERE id = ?
        `).run(status, notes, eventId);

        return db.downtime.findById(eventId);
    }

    /**
     * Get active downtime events
     */
    getActiveDowntime() {
        return db.downtime.getActive();
    }

    /**
     * Get downtime history for a forklift
     */
    getForkliftDowntime(forkliftId, options = {}) {
        const events = db.downtime.findAll({
            forkliftId,
            limit: options.limit || 50
        });

        const totalHours = events.reduce((sum, e) => sum + (e.duration_hours || 0), 0);
        const totalCost = events.reduce((sum, e) =>
            sum + ((e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown)), 0);

        // Group by root cause
        const byCause = {};
        events.forEach(e => {
            const cause = e.root_cause || 'unknown';
            if (!byCause[cause]) {
                byCause[cause] = { count: 0, hours: 0, cost: 0 };
            }
            byCause[cause].count++;
            byCause[cause].hours += e.duration_hours || 0;
            byCause[cause].cost += (e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown);
        });

        return {
            forklift_id: forkliftId,
            total_events: events.length,
            total_downtime_hours: totalHours,
            total_cost: totalCost,
            by_root_cause: byCause,
            events
        };
    }

    /**
     * Get downtime statistics
     */
    getDowntimeStats() {
        return db.downtime.getStats();
    }

    /**
     * Get downtime analysis for fleet
     */
    getFleetDowntimeAnalysis(months = 12) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        const events = db.downtime.findAll().filter(e =>
            new Date(e.start_time) >= cutoffDate
        );

        // Monthly breakdown
        const monthlyData = {};
        events.forEach(e => {
            const month = e.start_time.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { month, events: 0, hours: 0, cost: 0 };
            }
            monthlyData[month].events++;
            monthlyData[month].hours += e.duration_hours || 0;
            monthlyData[month].cost += (e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown);
        });

        // Root cause analysis
        const rootCauseData = {};
        events.forEach(e => {
            const cause = e.root_cause || 'unknown';
            if (!rootCauseData[cause]) {
                rootCauseData[cause] = { cause, count: 0, hours: 0, cost: 0 };
            }
            rootCauseData[cause].count++;
            rootCauseData[cause].hours += e.duration_hours || 0;
            rootCauseData[cause].cost += (e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown);
        });

        // Type analysis
        const typeData = {};
        events.forEach(e => {
            const type = e.type || 'unknown';
            if (!typeData[type]) {
                typeData[type] = { type, count: 0, hours: 0, cost: 0 };
            }
            typeData[type].count++;
            typeData[type].hours += e.duration_hours || 0;
            typeData[type].cost += (e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown);
        });

        // Top downtime units
        const unitData = {};
        events.forEach(e => {
            if (!unitData[e.forklift_id]) {
                unitData[e.forklift_id] = {
                    forklift_id: e.forklift_id,
                    model: e.forklift_model,
                    location: e.location_name,
                    events: 0,
                    hours: 0,
                    cost: 0
                };
            }
            unitData[e.forklift_id].events++;
            unitData[e.forklift_id].hours += e.duration_hours || 0;
            unitData[e.forklift_id].cost += (e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown);
        });

        const topUnits = Object.values(unitData).sort((a, b) => b.hours - a.hours).slice(0, 10);

        return {
            period_months: months,
            total_events: events.length,
            total_downtime_hours: events.reduce((sum, e) => sum + (e.duration_hours || 0), 0),
            total_cost: events.reduce((sum, e) =>
                sum + ((e.duration_hours || 0) * (e.cost_per_hour_down || this.defaultCostPerHourDown)), 0),
            monthly_trends: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
            by_root_cause: Object.values(rootCauseData).sort((a, b) => b.count - a.count),
            by_type: Object.values(typeData).sort((a, b) => b.count - a.count),
            top_downtime_units: topUnits
        };
    }

    // =================== RENTAL TRACKING ===================

    /**
     * Start a rental
     */
    startRental(data, createdBy = null) {
        // If linked to a downtime event, validate it exists
        if (data.downtime_event_id) {
            const downtime = db.downtime.findById(data.downtime_event_id);
            if (!downtime) {
                throw new Error(`Downtime event ${data.downtime_event_id} not found`);
            }
        }

        const rental = db.rentals.create({
            ...data,
            created_by: createdBy
        });

        // Create rental alert
        db.alerts.create({
            forklift_id: data.forklift_id,
            type: 'rental_active',
            severity: 'medium',
            title: `Rental Active: ${data.rental_equipment_type || 'Equipment'}`,
            message: `Rental from ${data.rental_company} at $${data.daily_rate}/day`,
            context_data: {
                rental_id: rental.id,
                daily_rate: data.daily_rate,
                reason: data.reason
            }
        });

        // Log the action
        db.audit.log({
            user_id: createdBy,
            action: 'create',
            entity_type: 'rental_record',
            entity_id: rental.id.toString(),
            new_values: data
        });

        return rental;
    }

    /**
     * Close/return a rental
     */
    closeRental(rentalId, data, closedBy = null) {
        const rental = db.rentals.findById(rentalId);
        if (!rental) {
            throw new Error(`Rental ${rentalId} not found`);
        }

        const closed = db.rentals.close(rentalId, data);

        // Resolve rental alert
        const alerts = db.alerts.findAll({
            forkliftId: rental.forklift_id,
            type: 'rental_active',
            isResolved: false
        });

        alerts.forEach(alert => {
            const context = alert.context_data ? JSON.parse(alert.context_data) : {};
            if (context.rental_id === rentalId) {
                db.alerts.resolve(alert.id, closedBy, `Rental returned. Total cost: $${closed.total_cost}`);
            }
        });

        // Log the action
        db.audit.log({
            user_id: closedBy,
            action: 'update',
            entity_type: 'rental_record',
            entity_id: rentalId.toString(),
            old_values: { status: 'active' },
            new_values: { status: 'returned', ...data }
        });

        return closed;
    }

    /**
     * Get active rentals
     */
    getActiveRentals() {
        return db.rentals.getActive();
    }

    /**
     * Get rental history for a forklift
     */
    getForkliftRentals(forkliftId, options = {}) {
        return db.rentals.findAll({
            forkliftId,
            limit: options.limit || 50
        });
    }

    /**
     * Get rental statistics
     */
    getRentalStats() {
        return db.rentals.getStats();
    }

    /**
     * Get rental cost analysis
     */
    getRentalAnalysis(months = 12) {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        const rentals = db.rentals.findAll().filter(r =>
            new Date(r.start_date) >= cutoffDate
        );

        // Monthly breakdown
        const monthlyData = {};
        rentals.forEach(r => {
            const month = r.start_date.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = { month, count: 0, cost: 0 };
            }
            monthlyData[month].count++;
            monthlyData[month].cost += r.total_cost || 0;
        });

        // By reason
        const reasonData = {};
        rentals.forEach(r => {
            const reason = r.reason || 'unknown';
            if (!reasonData[reason]) {
                reasonData[reason] = { reason, count: 0, cost: 0 };
            }
            reasonData[reason].count++;
            reasonData[reason].cost += r.total_cost || 0;
        });

        // By company
        const companyData = {};
        rentals.forEach(r => {
            const company = r.rental_company || 'unknown';
            if (!companyData[company]) {
                companyData[company] = { company, count: 0, cost: 0 };
            }
            companyData[company].count++;
            companyData[company].cost += r.total_cost || 0;
        });

        return {
            period_months: months,
            total_rentals: rentals.length,
            total_cost: rentals.reduce((sum, r) => sum + (r.total_cost || 0), 0),
            average_daily_rate: rentals.length > 0
                ? rentals.reduce((sum, r) => sum + (r.daily_rate || 0), 0) / rentals.length
                : 0,
            monthly_trends: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
            by_reason: Object.values(reasonData).sort((a, b) => b.cost - a.cost),
            by_company: Object.values(companyData).sort((a, b) => b.cost - a.cost)
        };
    }

    /**
     * Calculate total cost of a downtime event (including rentals)
     */
    calculateDowntimeTotalCost(downtimeEventId) {
        const downtime = db.downtime.findById(downtimeEventId);
        if (!downtime) {
            throw new Error(`Downtime event ${downtimeEventId} not found`);
        }

        // Get associated rentals
        const rentals = db.rentals.findAll().filter(r =>
            r.downtime_event_id === downtimeEventId
        );

        // Get associated maintenance
        const maintenance = downtime.maintenance_record_id
            ? db.maintenance.findById(downtime.maintenance_record_id)
            : null;

        const downtimeCost = (downtime.duration_hours || 0) * (downtime.cost_per_hour_down || this.defaultCostPerHourDown);
        const rentalCost = rentals.reduce((sum, r) => sum + (r.total_cost || 0), 0);
        const maintenanceCost = maintenance ? (maintenance.total_cost || 0) : 0;

        return {
            downtime_event_id: downtimeEventId,
            downtime_hours: downtime.duration_hours || 0,
            costs: {
                downtime_cost: downtimeCost,
                rental_cost: rentalCost,
                maintenance_cost: maintenanceCost,
                total_cost: downtimeCost + rentalCost + maintenanceCost
            },
            breakdown: {
                production_loss: downtime.estimated_production_loss || 0,
                diagnostic: maintenance?.diagnostic_cost || 0,
                labor: maintenance?.labor_cost || 0,
                parts: maintenance?.parts_cost || 0,
                rental_equipment: rentalCost
            }
        };
    }

    /**
     * Get combined downtime and rental dashboard
     */
    getDashboardSummary() {
        const downtimeStats = this.getDowntimeStats();
        const rentalStats = this.getRentalStats();
        const activeDowntime = this.getActiveDowntime();
        const activeRentals = this.getActiveRentals();

        return {
            downtime: {
                active_events: activeDowntime.length,
                total_events_all_time: downtimeStats.total_events,
                monthly_downtime_hours: downtimeStats.monthly_downtime_hours,
                total_cost: downtimeStats.total_downtime_cost,
                average_duration: downtimeStats.avg_duration,
                active_events_list: activeDowntime.slice(0, 5)
            },
            rentals: {
                active_rentals: activeRentals.length,
                total_rentals: rentalStats.total_rentals,
                monthly_cost: rentalStats.monthly_cost,
                total_cost: rentalStats.total_cost,
                active_rentals_list: activeRentals.slice(0, 5)
            },
            combined: {
                total_impact_cost: (downtimeStats.total_downtime_cost || 0) + (rentalStats.total_cost || 0),
                units_affected: new Set([
                    ...activeDowntime.map(d => d.forklift_id),
                    ...activeRentals.map(r => r.forklift_id)
                ]).size
            }
        };
    }
}

module.exports = new DowntimeService();
