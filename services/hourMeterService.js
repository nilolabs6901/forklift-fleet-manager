/**
 * Hour Meter Service
 * Handles hour meter readings with anomaly detection
 */

const db = require('../config/sqlite-database');

class HourMeterService {
    constructor() {
        // Anomaly detection thresholds
        this.thresholds = {
            backwardThreshold: 0, // Any backward movement is flagged
            jumpThreshold: 100, // Hours increase > 100 in single reading
            dailyMaxHours: 24, // Max hours expected per day
            weeklyMaxHours: 120, // Max hours expected per week
            monthlyMaxHours: 500 // Max hours expected per month
        };
    }

    /**
     * Record a new hour meter reading with anomaly detection
     */
    recordReading(forkliftId, reading, source = 'manual', recordedBy = null) {
        // Validate input
        if (typeof reading !== 'number' || reading < 0) {
            throw new Error('Invalid reading: must be a non-negative number');
        }

        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) {
            throw new Error(`Forklift ${forkliftId} not found`);
        }

        // Get previous readings for analysis
        const previousReadings = db.hourReadings.findAll({
            forkliftId,
            limit: 10
        });

        const previousReading = previousReadings[0];
        const anomalies = this.detectAnomalies(reading, previousReading, previousReadings, forklift);

        // Create the reading record
        const result = db.hourReadings.create({
            forklift_id: forkliftId,
            reading,
            source,
            recorded_by: recordedBy
        });

        // If anomalies were detected, create alerts
        if (result.is_flagged) {
            this.createAnomalyAlert(forklift, result, anomalies);
        }

        // Log the action
        db.audit.log({
            user_id: recordedBy,
            action: 'create',
            entity_type: 'hour_meter_reading',
            entity_id: result.id.toString(),
            new_values: {
                forklift_id: forkliftId,
                reading,
                source,
                is_flagged: result.is_flagged,
                flag_reason: result.flag_reason
            }
        });

        return {
            reading: result,
            anomalies,
            forklift: db.forklifts.findById(forkliftId)
        };
    }

    /**
     * Detect anomalies in hour meter reading
     */
    detectAnomalies(reading, previousReading, historicalReadings, forklift) {
        const anomalies = [];

        if (!previousReading) {
            // First reading - no anomalies possible
            return anomalies;
        }

        const delta = reading - previousReading.reading;
        const timeDiff = (new Date() - new Date(previousReading.recorded_at)) / (1000 * 60 * 60); // Hours

        // Check for backward reading
        if (delta < -this.thresholds.backwardThreshold) {
            anomalies.push({
                type: 'backward_reading',
                severity: 'error',
                description: `Hour meter went backwards by ${Math.abs(delta).toFixed(1)} hours`,
                previous_value: previousReading.reading,
                new_value: reading,
                delta
            });
        }

        // Check for unusually large jump
        if (delta > this.thresholds.jumpThreshold) {
            anomalies.push({
                type: 'large_jump',
                severity: 'warning',
                description: `Unusually large increase of ${delta.toFixed(1)} hours`,
                previous_value: previousReading.reading,
                new_value: reading,
                delta
            });
        }

        // Check if delta exceeds what's possible in the time period
        if (timeDiff > 0) {
            const maxPossibleHours = Math.min(timeDiff, this.thresholds.dailyMaxHours * (timeDiff / 24));
            if (delta > maxPossibleHours * 1.5) { // 50% buffer
                anomalies.push({
                    type: 'exceeds_possible',
                    severity: 'warning',
                    description: `${delta.toFixed(1)} hours recorded in ${timeDiff.toFixed(1)} hours elapsed time`,
                    previous_value: previousReading.reading,
                    new_value: reading,
                    delta,
                    time_elapsed_hours: timeDiff
                });
            }
        }

        // Check for suspicious pattern (e.g., always round numbers)
        if (historicalReadings.length >= 5) {
            const allRound = historicalReadings.every(r => r.reading % 10 === 0) && reading % 10 === 0;
            if (allRound) {
                anomalies.push({
                    type: 'suspicious_pattern',
                    severity: 'warning',
                    description: 'All recent readings are round numbers - possible estimation',
                    previous_value: previousReading.reading,
                    new_value: reading
                });
            }
        }

        // Check for stagnant readings (no change over multiple entries)
        if (historicalReadings.length >= 3) {
            const recentThree = historicalReadings.slice(0, 3);
            const allSame = recentThree.every(r => r.reading === reading);
            if (allSame && reading === previousReading.reading) {
                anomalies.push({
                    type: 'stagnant_reading',
                    severity: 'warning',
                    description: 'Hour meter has not changed in multiple readings',
                    current_value: reading
                });
            }
        }

        return anomalies;
    }

    /**
     * Create alert for anomalous reading
     */
    createAnomalyAlert(forklift, reading, anomalies) {
        const severity = anomalies.some(a => a.severity === 'error') ? 'high' : 'medium';
        const description = anomalies.map(a => a.description).join('; ');

        db.alerts.create({
            forklift_id: forklift.id,
            type: 'hour_anomaly',
            severity,
            title: `Hour Meter Anomaly: ${forklift.id}`,
            message: description,
            context_data: {
                reading_id: reading.id,
                anomalies,
                previous_reading: reading.previous_reading,
                new_reading: reading.reading
            },
            actual_value: reading.reading,
            threshold_value: reading.previous_reading,
            recurrence_key: `hour_anomaly_${forklift.id}_${reading.id}`
        });
    }

    /**
     * Correct a flagged reading (admin action)
     */
    correctReading(readingId, correctedValue, correctedBy, notes) {
        const reading = db.hourReadings.findById(readingId);
        if (!reading) {
            throw new Error(`Reading ${readingId} not found`);
        }

        if (!reading.is_flagged) {
            throw new Error('Only flagged readings can be corrected');
        }

        const oldValue = reading.reading;
        const result = db.hourReadings.correct(readingId, {
            corrected_value: correctedValue,
            corrected_by: correctedBy,
            correction_notes: notes
        });

        // Resolve related alert
        const alerts = db.alerts.findAll({
            forkliftId: reading.forklift_id,
            type: 'hour_anomaly',
            isResolved: false
        });

        alerts.forEach(alert => {
            const context = alert.context_data ? JSON.parse(alert.context_data) : {};
            if (context.reading_id === readingId) {
                db.alerts.resolve(alert.id, correctedBy, `Corrected to ${correctedValue} hours`);
            }
        });

        // Log the correction
        db.audit.log({
            user_id: correctedBy,
            action: 'correct',
            entity_type: 'hour_meter_reading',
            entity_id: readingId.toString(),
            old_values: { reading: oldValue },
            new_values: {
                corrected_value: correctedValue,
                correction_notes: notes
            }
        });

        return result;
    }

    /**
     * Validate a flagged reading as correct (no correction needed)
     */
    validateReading(readingId, validatedBy, notes) {
        const reading = db.hourReadings.findById(readingId);
        if (!reading) {
            throw new Error(`Reading ${readingId} not found`);
        }

        db.raw.prepare(`
            UPDATE hour_meter_readings
            SET is_validated = 1,
                validated_by = ?,
                validated_at = datetime('now'),
                correction_notes = ?
            WHERE id = ?
        `).run(validatedBy, notes || 'Validated as correct', readingId);

        // Update forklift hours since reading is confirmed correct
        db.forklifts.update(reading.forklift_id, {
            current_hours: reading.reading,
            last_hour_reading: reading.reading,
            last_hour_reading_date: new Date().toISOString()
        });

        // Resolve related alert
        const alerts = db.alerts.findAll({
            forkliftId: reading.forklift_id,
            type: 'hour_anomaly',
            isResolved: false
        });

        alerts.forEach(alert => {
            const context = alert.context_data ? JSON.parse(alert.context_data) : {};
            if (context.reading_id === readingId) {
                db.alerts.resolve(alert.id, validatedBy, notes || 'Reading validated as correct');
            }
        });

        // Log the validation
        db.audit.log({
            user_id: validatedBy,
            action: 'approve',
            entity_type: 'hour_meter_reading',
            entity_id: readingId.toString(),
            new_values: {
                validated: true,
                notes
            }
        });

        return db.hourReadings.findById(readingId);
    }

    /**
     * Get all flagged readings pending review
     */
    getFlaggedReadings(limit = 50) {
        return db.hourReadings.getFlagged(limit);
    }

    /**
     * Get hour meter history for a forklift
     */
    getHistory(forkliftId, options = {}) {
        return db.hourReadings.findAll({
            forkliftId,
            limit: options.limit || 100,
            startDate: options.startDate,
            endDate: options.endDate
        });
    }

    /**
     * Get hour meter trends for a forklift
     */
    getTrends(forkliftId, days = 90) {
        const readings = db.hourReadings.findAll({
            forkliftId,
            startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        });

        if (readings.length < 2) {
            return null;
        }

        // Sort by date ascending
        readings.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

        const firstReading = readings[0];
        const lastReading = readings[readings.length - 1];
        const totalHoursAdded = lastReading.reading - firstReading.reading;
        const daysCovered = (new Date(lastReading.recorded_at) - new Date(firstReading.recorded_at)) / (1000 * 60 * 60 * 24);

        return {
            forklift_id: forkliftId,
            period_days: days,
            readings_count: readings.length,
            first_reading: firstReading.reading,
            last_reading: lastReading.reading,
            total_hours_added: totalHoursAdded,
            average_daily_hours: daysCovered > 0 ? totalHoursAdded / daysCovered : 0,
            average_weekly_hours: daysCovered > 0 ? (totalHoursAdded / daysCovered) * 7 : 0,
            projected_annual_hours: daysCovered > 0 ? (totalHoursAdded / daysCovered) * 365 : 0,
            flagged_readings: readings.filter(r => r.is_flagged).length,
            readings: readings.map(r => ({
                date: r.recorded_at,
                reading: r.reading,
                delta: r.reading_delta,
                flagged: r.is_flagged
            }))
        };
    }

    /**
     * Bulk import hour meter readings
     */
    bulkImport(readings, source = 'import', importedBy = null) {
        const results = {
            successful: 0,
            failed: 0,
            flagged: 0,
            errors: []
        };

        for (const item of readings) {
            try {
                const result = this.recordReading(
                    item.forklift_id,
                    item.reading,
                    source,
                    importedBy
                );

                results.successful++;
                if (result.reading.is_flagged) {
                    results.flagged++;
                }
            } catch (error) {
                results.failed++;
                results.errors.push({
                    forklift_id: item.forklift_id,
                    reading: item.reading,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Get fleet-wide hour meter summary
     */
    getFleetSummary() {
        const stats = db.forklifts.getStats();
        const flaggedCount = db.hourReadings.getFlagged().length;

        // Calculate average daily hours from recent readings
        const recentReadings = db.hourReadings.findAll({ limit: 500 });
        let totalDailyHours = 0;
        let validReadings = 0;

        for (const reading of recentReadings) {
            if (reading.reading_delta > 0 && reading.reading_delta <= 24) {
                totalDailyHours += reading.reading_delta;
                validReadings++;
            }
        }

        // Get total readings in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const totalReadings = db.hourReadings.findAll({ startDate: thirtyDaysAgo }).length;

        // Get corrected count
        const correctedReadings = db.raw.prepare(`
            SELECT COUNT(*) as count FROM hour_meter_readings
            WHERE is_corrected = 1 AND recorded_at >= date('now', '-30 days')
        `).get();

        // Get units reporting in last 7 days
        const unitsReporting = db.raw.prepare(`
            SELECT COUNT(DISTINCT forklift_id) as count FROM hour_meter_readings
            WHERE recorded_at >= date('now', '-7 days')
        `).get();

        return {
            total_forklifts: stats.total,
            average_hours: stats.avg_hours,
            average_daily_hours: validReadings > 0 ? totalDailyHours / validReadings : 0,
            flagged_readings_pending: flaggedCount,
            high_hours_units: db.forklifts.findAll()
                .filter(f => f.current_hours > 15000).length,
            readings_today: db.hourReadings.findAll({
                startDate: new Date().toISOString().split('T')[0]
            }).length,
            total_readings: totalReadings,
            corrected_count: correctedReadings?.count || 0,
            units_reporting: unitsReporting?.count || 0
        };
    }

    /**
     * Update anomaly detection thresholds
     */
    updateThresholds(newThresholds) {
        Object.assign(this.thresholds, newThresholds);

        // Persist to settings
        Object.entries(newThresholds).forEach(([key, value]) => {
            db.settings.set(`hour_anomaly_${key}`, value.toString());
        });

        return this.thresholds;
    }

    /**
     * Load thresholds from settings
     */
    loadThresholds() {
        const settings = db.settings.getAll('anomaly');
        settings.forEach(s => {
            const key = s.key.replace('hour_anomaly_', '');
            if (this.thresholds[key] !== undefined) {
                this.thresholds[key] = parseFloat(s.value);
            }
        });
        return this.thresholds;
    }
}

module.exports = new HourMeterService();
