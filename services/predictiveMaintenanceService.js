/**
 * Predictive Maintenance Service
 * Analyzes historical data to forecast equipment failures and service needs
 */

const db = require('../config/sqlite-database');

// Component lifecycle definitions (expected hours until replacement/service)
const COMPONENT_LIFECYCLES = {
    // Drive system
    'drive_motor': { expectedHours: 15000, warningThreshold: 0.85, category: 'electrical' },
    'drive_controller': { expectedHours: 12000, warningThreshold: 0.80, category: 'electrical' },
    'transmission': { expectedHours: 10000, warningThreshold: 0.85, category: 'transmission' },

    // Hydraulic system
    'hydraulic_pump': { expectedHours: 8000, warningThreshold: 0.80, category: 'hydraulic' },
    'hydraulic_cylinder': { expectedHours: 10000, warningThreshold: 0.85, category: 'hydraulic' },
    'hydraulic_hoses': { expectedHours: 5000, warningThreshold: 0.75, category: 'hydraulic' },
    'hydraulic_filter': { expectedHours: 1000, warningThreshold: 0.90, category: 'hydraulic' },

    // Mast and lifting
    'mast_chain': { expectedHours: 6000, warningThreshold: 0.80, category: 'mast' },
    'mast_rollers': { expectedHours: 5000, warningThreshold: 0.85, category: 'mast' },
    'fork_carriage': { expectedHours: 12000, warningThreshold: 0.90, category: 'mast' },

    // Brakes
    'brake_pads': { expectedHours: 2000, warningThreshold: 0.75, category: 'brakes' },
    'brake_master_cylinder': { expectedHours: 8000, warningThreshold: 0.85, category: 'brakes' },
    'parking_brake': { expectedHours: 5000, warningThreshold: 0.80, category: 'brakes' },

    // Tires/Wheels
    'load_wheels': { expectedHours: 3000, warningThreshold: 0.80, category: 'tires' },
    'drive_tires': { expectedHours: 4000, warningThreshold: 0.80, category: 'tires' },
    'steer_tires': { expectedHours: 4500, warningThreshold: 0.80, category: 'tires' },

    // Electrical (for electric units)
    'battery': { expectedHours: 6000, warningThreshold: 0.85, category: 'battery' },
    'charger': { expectedHours: 10000, warningThreshold: 0.90, category: 'battery' },
    'contactor': { expectedHours: 8000, warningThreshold: 0.85, category: 'electrical' },

    // Engine (for IC units)
    'spark_plugs': { expectedHours: 1000, warningThreshold: 0.90, category: 'engine' },
    'fuel_filter': { expectedHours: 500, warningThreshold: 0.85, category: 'fuel_system' },
    'air_filter': { expectedHours: 500, warningThreshold: 0.85, category: 'engine' },
    'lpg_regulator': { expectedHours: 4000, warningThreshold: 0.80, category: 'fuel_system' }
};

// Failure patterns - sequences of repairs that predict larger failures
const FAILURE_PATTERNS = [
    {
        name: 'hydraulic_system_failure',
        sequence: ['hydraulic_leak', 'hydraulic_pressure', 'hydraulic_noise'],
        prediction: 'Hydraulic pump failure likely',
        confidence: 0.85,
        urgency: 'high',
        lookaheadDays: 30
    },
    {
        name: 'transmission_failure',
        sequence: ['transmission_slip', 'transmission_noise', 'drive_hesitation'],
        prediction: 'Transmission failure imminent',
        confidence: 0.80,
        urgency: 'critical',
        lookaheadDays: 14
    },
    {
        name: 'battery_degradation',
        sequence: ['reduced_runtime', 'slow_charging', 'capacity_loss'],
        prediction: 'Battery replacement needed soon',
        confidence: 0.90,
        urgency: 'medium',
        lookaheadDays: 60
    },
    {
        name: 'brake_system_wear',
        sequence: ['brake_noise', 'increased_stopping_distance', 'brake_pedal_soft'],
        prediction: 'Brake system overhaul required',
        confidence: 0.88,
        urgency: 'high',
        lookaheadDays: 21
    },
    {
        name: 'mast_chain_failure',
        sequence: ['chain_noise', 'uneven_lifting', 'chain_stretch'],
        prediction: 'Mast chain replacement needed',
        confidence: 0.82,
        urgency: 'high',
        lookaheadDays: 30
    }
];

class PredictiveMaintenanceService {

    /**
     * Calculate daily usage rate for a forklift based on hour meter history
     */
    calculateUsageRate(forkliftId, daysBack = 90) {
        const readings = db.raw.prepare(`
            SELECT reading, recorded_at
            FROM hour_meter_readings
            WHERE forklift_id = ?
              AND recorded_at >= date('now', '-' || ? || ' days')
              AND is_flagged = 0
            ORDER BY recorded_at ASC
        `).all(forkliftId, daysBack);

        if (readings.length < 2) {
            // Fall back to forklift's current hours and age
            const forklift = db.forklifts.findById(forkliftId);
            if (forklift && forklift.purchase_date) {
                const daysSincePurchase = Math.max(1,
                    (Date.now() - new Date(forklift.purchase_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                return {
                    hoursPerDay: forklift.current_hours / daysSincePurchase,
                    hoursPerWeek: (forklift.current_hours / daysSincePurchase) * 7,
                    hoursPerMonth: (forklift.current_hours / daysSincePurchase) * 30,
                    dataPoints: 0,
                    reliability: 'estimated'
                };
            }
            return null;
        }

        const firstReading = readings[0];
        const lastReading = readings[readings.length - 1];
        const hoursDelta = lastReading.reading - firstReading.reading;
        const daysDelta = Math.max(1,
            (new Date(lastReading.recorded_at) - new Date(firstReading.recorded_at)) / (1000 * 60 * 60 * 24)
        );

        const hoursPerDay = hoursDelta / daysDelta;

        return {
            hoursPerDay: Math.round(hoursPerDay * 100) / 100,
            hoursPerWeek: Math.round(hoursPerDay * 7 * 100) / 100,
            hoursPerMonth: Math.round(hoursPerDay * 30 * 100) / 100,
            dataPoints: readings.length,
            reliability: readings.length >= 10 ? 'high' : readings.length >= 5 ? 'medium' : 'low'
        };
    }

    /**
     * Predict when next service will be due based on usage rate
     */
    predictNextService(forkliftId) {
        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) return null;

        const usageRate = this.calculateUsageRate(forkliftId);
        if (!usageRate || usageRate.hoursPerDay <= 0) return null;

        const predictions = [];

        // Hours-based prediction
        if (forklift.next_service_hours && forklift.current_hours) {
            const hoursRemaining = forklift.next_service_hours - forklift.current_hours;
            if (hoursRemaining > 0) {
                const daysUntilService = hoursRemaining / usageRate.hoursPerDay;
                const predictedDate = new Date();
                predictedDate.setDate(predictedDate.getDate() + Math.round(daysUntilService));

                predictions.push({
                    type: 'hours_based',
                    predictedDate: predictedDate.toISOString().split('T')[0],
                    daysUntil: Math.round(daysUntilService),
                    hoursRemaining: Math.round(hoursRemaining),
                    confidence: usageRate.reliability === 'high' ? 0.90 :
                               usageRate.reliability === 'medium' ? 0.75 : 0.60,
                    basis: `Based on ${usageRate.hoursPerDay.toFixed(1)} hrs/day usage rate`
                });
            }
        }

        // Date-based prediction (if service interval is date-based)
        if (forklift.next_service_date) {
            const nextServiceDate = new Date(forklift.next_service_date);
            const today = new Date();
            const daysUntil = Math.ceil((nextServiceDate - today) / (1000 * 60 * 60 * 24));

            predictions.push({
                type: 'date_based',
                predictedDate: forklift.next_service_date,
                daysUntil,
                confidence: 0.95,
                basis: 'Scheduled service interval'
            });
        }

        // Return the soonest prediction
        if (predictions.length === 0) return null;

        predictions.sort((a, b) => new Date(a.predictedDate) - new Date(b.predictedDate));

        return {
            forkliftId,
            currentHours: forklift.current_hours,
            usageRate,
            predictions,
            recommendedAction: predictions[0].daysUntil <= 7 ? 'Schedule now' :
                              predictions[0].daysUntil <= 14 ? 'Plan service' :
                              predictions[0].daysUntil <= 30 ? 'Monitor' : 'OK'
        };
    }

    /**
     * Analyze maintenance history for failure patterns
     */
    detectFailurePatterns(forkliftId, daysBack = 180) {
        const maintenanceHistory = db.raw.prepare(`
            SELECT description, category, type, service_date, work_performed
            FROM maintenance_records
            WHERE forklift_id = ?
              AND service_date >= date('now', '-' || ? || ' days')
              AND status = 'completed'
            ORDER BY service_date DESC
        `).all(forkliftId, daysBack);

        if (maintenanceHistory.length < 2) return [];

        const detectedPatterns = [];

        // Create searchable text from maintenance records
        const maintenanceText = maintenanceHistory.map(m =>
            `${m.description || ''} ${m.work_performed || ''} ${m.category || ''}`.toLowerCase()
        );

        // Check each failure pattern
        for (const pattern of FAILURE_PATTERNS) {
            let matchCount = 0;
            const matchedSequence = [];

            for (const keyword of pattern.sequence) {
                const keywordLower = keyword.toLowerCase().replace(/_/g, ' ');
                const found = maintenanceText.some(text => text.includes(keywordLower));
                if (found) {
                    matchCount++;
                    matchedSequence.push(keyword);
                }
            }

            // If at least 2/3 of the sequence is matched, flag it
            if (matchCount >= Math.ceil(pattern.sequence.length * 0.66)) {
                const confidenceAdjusted = pattern.confidence * (matchCount / pattern.sequence.length);

                detectedPatterns.push({
                    patternName: pattern.name,
                    prediction: pattern.prediction,
                    confidence: Math.round(confidenceAdjusted * 100),
                    urgency: pattern.urgency,
                    matchedIndicators: matchedSequence,
                    totalIndicators: pattern.sequence.length,
                    recommendedAction: `Schedule inspection within ${pattern.lookaheadDays} days`,
                    estimatedTimeToFailure: `${pattern.lookaheadDays} days`
                });
            }
        }

        return detectedPatterns;
    }

    /**
     * Estimate component health based on operating hours
     */
    getComponentHealth(forkliftId) {
        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) return null;

        // Get last service for each category
        const lastServices = db.raw.prepare(`
            SELECT category, MAX(service_date) as last_service_date, MAX(hours_at_service) as hours_at_service
            FROM maintenance_records
            WHERE forklift_id = ? AND status = 'completed' AND category IS NOT NULL
            GROUP BY category
        `).all(forkliftId);

        const serviceMap = {};
        lastServices.forEach(s => {
            serviceMap[s.category] = {
                lastServiceDate: s.last_service_date,
                hoursAtService: s.hours_at_service || 0
            };
        });

        const componentHealth = [];
        const fuelTypeComponents = forklift.fuel_type === 'electric' ?
            ['battery', 'charger', 'contactor', 'drive_motor', 'drive_controller'] :
            ['spark_plugs', 'fuel_filter', 'air_filter', 'lpg_regulator'];

        // Filter components based on fuel type
        const relevantComponents = Object.entries(COMPONENT_LIFECYCLES).filter(([name, data]) => {
            if (forklift.fuel_type === 'electric' && ['spark_plugs', 'fuel_filter', 'air_filter', 'lpg_regulator'].includes(name)) {
                return false;
            }
            if (forklift.fuel_type !== 'electric' && ['battery', 'charger', 'contactor'].includes(name)) {
                return false;
            }
            return true;
        });

        for (const [componentName, lifecycle] of relevantComponents) {
            const categoryService = serviceMap[lifecycle.category];
            const hoursSinceService = categoryService ?
                forklift.current_hours - (categoryService.hoursAtService || 0) :
                forklift.current_hours;

            const lifeUsedPercent = Math.min(100, (hoursSinceService / lifecycle.expectedHours) * 100);
            const remainingHours = Math.max(0, lifecycle.expectedHours - hoursSinceService);

            let status = 'good';
            let urgency = 'none';

            if (lifeUsedPercent >= 100) {
                status = 'overdue';
                urgency = 'critical';
            } else if (lifeUsedPercent >= lifecycle.warningThreshold * 100) {
                status = 'due_soon';
                urgency = 'high';
            } else if (lifeUsedPercent >= 70) {
                status = 'monitor';
                urgency = 'medium';
            }

            componentHealth.push({
                component: componentName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                componentKey: componentName,
                category: lifecycle.category,
                expectedLifeHours: lifecycle.expectedHours,
                hoursSinceService,
                remainingHours: Math.round(remainingHours),
                lifeUsedPercent: Math.round(lifeUsedPercent),
                status,
                urgency
            });
        }

        // Sort by urgency and life used
        componentHealth.sort((a, b) => {
            const urgencyOrder = { critical: 0, high: 1, medium: 2, none: 3 };
            if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
                return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            }
            return b.lifeUsedPercent - a.lifeUsedPercent;
        });

        return {
            forkliftId,
            currentHours: forklift.current_hours,
            fuelType: forklift.fuel_type,
            components: componentHealth,
            criticalCount: componentHealth.filter(c => c.urgency === 'critical').length,
            warningCount: componentHealth.filter(c => c.urgency === 'high').length
        };
    }

    /**
     * Generate comprehensive predictions for a single forklift
     */
    generateForkliftPredictions(forkliftId) {
        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) return null;

        const servicePrediction = this.predictNextService(forkliftId);
        const failurePatterns = this.detectFailurePatterns(forkliftId);
        const componentHealth = this.getComponentHealth(forkliftId);

        // Calculate overall prediction score
        let urgencyScore = 0;
        let predictions = [];

        // Add service predictions
        if (servicePrediction && servicePrediction.predictions.length > 0) {
            const soonest = servicePrediction.predictions[0];
            if (soonest.daysUntil <= 7) urgencyScore += 30;
            else if (soonest.daysUntil <= 14) urgencyScore += 20;
            else if (soonest.daysUntil <= 30) urgencyScore += 10;

            predictions.push({
                type: 'scheduled_service',
                title: 'Preventive Maintenance Due',
                description: `Service predicted in ${soonest.daysUntil} days (${soonest.predictedDate})`,
                confidence: Math.round(soonest.confidence * 100),
                urgency: soonest.daysUntil <= 7 ? 'critical' : soonest.daysUntil <= 14 ? 'high' : 'medium',
                daysUntil: soonest.daysUntil,
                predictedDate: soonest.predictedDate
            });
        }

        // Add failure pattern predictions
        for (const pattern of failurePatterns) {
            if (pattern.urgency === 'critical') urgencyScore += 40;
            else if (pattern.urgency === 'high') urgencyScore += 25;
            else urgencyScore += 15;

            predictions.push({
                type: 'failure_pattern',
                title: pattern.prediction,
                description: `Detected ${pattern.matchedIndicators.length}/${pattern.totalIndicators} warning signs`,
                confidence: pattern.confidence,
                urgency: pattern.urgency,
                patternName: pattern.patternName,
                matchedIndicators: pattern.matchedIndicators
            });
        }

        // Add component health warnings
        if (componentHealth) {
            const criticalComponents = componentHealth.components.filter(c => c.urgency === 'critical');
            const warningComponents = componentHealth.components.filter(c => c.urgency === 'high');

            for (const comp of criticalComponents.slice(0, 3)) {
                urgencyScore += 35;
                predictions.push({
                    type: 'component_lifecycle',
                    title: `${comp.component} Replacement Overdue`,
                    description: `${comp.lifeUsedPercent}% of expected life used (${comp.hoursSinceService} hrs)`,
                    confidence: 85,
                    urgency: 'critical',
                    component: comp.componentKey,
                    category: comp.category
                });
            }

            for (const comp of warningComponents.slice(0, 2)) {
                urgencyScore += 15;
                predictions.push({
                    type: 'component_lifecycle',
                    title: `${comp.component} Approaching End of Life`,
                    description: `${comp.remainingHours} hours remaining (${comp.lifeUsedPercent}% used)`,
                    confidence: 75,
                    urgency: 'high',
                    component: comp.componentKey,
                    category: comp.category
                });
            }
        }

        // Sort predictions by urgency
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

        return {
            forkliftId,
            forkliftModel: forklift.model,
            location: forklift.location_name,
            currentHours: forklift.current_hours,
            riskScore: forklift.risk_score,
            urgencyScore: Math.min(100, urgencyScore),
            overallStatus: urgencyScore >= 50 ? 'critical' : urgencyScore >= 30 ? 'warning' : 'ok',
            predictions,
            servicePrediction,
            componentHealth,
            failurePatterns,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Generate predictions for entire fleet
     */
    generateFleetPredictions() {
        const forklifts = db.forklifts.findAll({ excludeRetired: true });
        const fleetPredictions = [];

        for (const forklift of forklifts) {
            const prediction = this.generateForkliftPredictions(forklift.id);
            if (prediction && prediction.predictions.length > 0) {
                fleetPredictions.push(prediction);
            }
        }

        // Sort by urgency score (highest first)
        fleetPredictions.sort((a, b) => b.urgencyScore - a.urgencyScore);

        // Generate summary stats
        const summary = {
            totalUnits: forklifts.length,
            unitsWithPredictions: fleetPredictions.length,
            criticalCount: fleetPredictions.filter(p => p.overallStatus === 'critical').length,
            warningCount: fleetPredictions.filter(p => p.overallStatus === 'warning').length,
            okCount: fleetPredictions.filter(p => p.overallStatus === 'ok').length,
            topPredictions: fleetPredictions.slice(0, 10).map(p => ({
                forkliftId: p.forkliftId,
                model: p.forkliftModel,
                location: p.location,
                urgencyScore: p.urgencyScore,
                status: p.overallStatus,
                topPrediction: p.predictions[0]
            }))
        };

        return {
            summary,
            predictions: fleetPredictions,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Get optimized maintenance schedule based on predictions
     */
    getOptimizedSchedule(daysAhead = 30) {
        const fleetData = this.generateFleetPredictions();
        const schedule = [];

        for (const unitPrediction of fleetData.predictions) {
            if (unitPrediction.servicePrediction) {
                const soonest = unitPrediction.servicePrediction.predictions[0];
                if (soonest && soonest.daysUntil <= daysAhead) {
                    schedule.push({
                        forkliftId: unitPrediction.forkliftId,
                        model: unitPrediction.forkliftModel,
                        location: unitPrediction.location,
                        serviceType: 'Preventive Maintenance',
                        predictedDate: soonest.predictedDate,
                        daysUntil: soonest.daysUntil,
                        confidence: soonest.confidence,
                        priority: soonest.daysUntil <= 7 ? 'critical' :
                                 soonest.daysUntil <= 14 ? 'high' : 'medium'
                    });
                }
            }

            // Add critical component replacements
            if (unitPrediction.componentHealth) {
                const critical = unitPrediction.componentHealth.components
                    .filter(c => c.urgency === 'critical');

                for (const comp of critical) {
                    schedule.push({
                        forkliftId: unitPrediction.forkliftId,
                        model: unitPrediction.forkliftModel,
                        location: unitPrediction.location,
                        serviceType: `${comp.component} Replacement`,
                        predictedDate: new Date().toISOString().split('T')[0],
                        daysUntil: 0,
                        confidence: 85,
                        priority: 'critical',
                        component: comp.componentKey
                    });
                }
            }
        }

        // Sort by priority and date
        const priorityOrder = { critical: 0, high: 1, medium: 2 };
        schedule.sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            return a.daysUntil - b.daysUntil;
        });

        return {
            schedule,
            totalItems: schedule.length,
            criticalItems: schedule.filter(s => s.priority === 'critical').length,
            daysAhead,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Create prediction-based alerts
     */
    createPredictionAlerts() {
        const fleetData = this.generateFleetPredictions();
        const alertsCreated = [];

        for (const unitPrediction of fleetData.predictions) {
            // Skip if no critical/high predictions
            if (unitPrediction.overallStatus === 'ok') continue;

            for (const prediction of unitPrediction.predictions) {
                if (prediction.urgency !== 'critical' && prediction.urgency !== 'high') continue;

                // Check for existing prediction alert to avoid duplicates
                const recurrenceKey = `prediction_${unitPrediction.forkliftId}_${prediction.type}_${prediction.title.substring(0, 30)}`;

                const existing = db.raw.prepare(`
                    SELECT id FROM alerts
                    WHERE recurrence_key = ? AND is_resolved = 0
                `).get(recurrenceKey);

                if (existing) continue;

                // Create alert
                const alert = db.alerts.create({
                    forklift_id: unitPrediction.forkliftId,
                    type: 'lifecycle_alert',
                    severity: prediction.urgency,
                    title: `Predicted: ${prediction.title}`,
                    message: prediction.description,
                    context_data: {
                        prediction_type: prediction.type,
                        confidence: prediction.confidence,
                        predicted_date: prediction.predictedDate || null,
                        component: prediction.component || null,
                        pattern_name: prediction.patternName || null
                    },
                    is_recurring: true,
                    recurrence_key: recurrenceKey
                });

                alertsCreated.push(alert);
            }
        }

        return alertsCreated;
    }
}

module.exports = new PredictiveMaintenanceService();
