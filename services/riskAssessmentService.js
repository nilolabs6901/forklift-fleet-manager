/**
 * Risk Assessment Service
 * Predictive algorithm for equipment lifecycle forecasting
 */

const db = require('../config/sqlite-database');

class RiskAssessmentService {
    constructor() {
        // Risk scoring weights
        this.weights = {
            age: 0.15,
            hours: 0.20,
            maintenanceCost: 0.25,
            repairFrequency: 0.20,
            downtime: 0.20
        };

        // Thresholds
        this.thresholds = {
            ageYears: { low: 3, medium: 6, high: 8, critical: 10 },
            hours: { low: 5000, medium: 10000, high: 15000, critical: 20000 },
            annualMaintenanceCostPercent: { low: 5, medium: 10, high: 15, critical: 20 }, // % of purchase price
            repairsPerYear: { low: 2, medium: 4, high: 6, critical: 8 },
            downtimeHoursPerYear: { low: 24, medium: 72, high: 168, critical: 336 }
        };
    }

    /**
     * Perform full risk assessment for a forklift
     */
    async assessForklift(forkliftId) {
        const forklift = db.forklifts.findById(forkliftId);
        if (!forklift) {
            throw new Error(`Forklift ${forkliftId} not found`);
        }

        // Gather data for assessment
        const maintenanceData = this.getMaintenanceMetrics(forkliftId);
        const downtimeData = this.getDowntimeMetrics(forkliftId);
        const ageData = this.getAgeMetrics(forklift);

        // Calculate individual scores (1-10 scale)
        const scores = {
            age: this.calculateAgeScore(ageData),
            hours: this.calculateHoursScore(forklift.current_hours || 0),
            maintenanceCost: this.calculateMaintenanceCostScore(maintenanceData, forklift),
            repairFrequency: this.calculateRepairFrequencyScore(maintenanceData),
            downtime: this.calculateDowntimeScore(downtimeData)
        };

        // Calculate weighted overall score
        const overallScore = Math.round(
            (scores.age * this.weights.age) +
            (scores.hours * this.weights.hours) +
            (scores.maintenanceCost * this.weights.maintenanceCost) +
            (scores.repairFrequency * this.weights.repairFrequency) +
            (scores.downtime * this.weights.downtime)
        );

        // Determine risk factors
        const riskFactors = this.identifyRiskFactors(scores, forklift, maintenanceData, downtimeData);

        // Generate recommendations
        const recommendations = this.generateRecommendations(overallScore, riskFactors, forklift);

        // Calculate financial projections
        const financials = this.calculateFinancialProjections(forklift, maintenanceData, downtimeData);

        // Determine repair vs replace recommendation
        const repairVsReplace = this.determineRepairVsReplace(overallScore, financials);

        // Create assessment record
        const assessment = db.riskAssessments.create({
            forklift_id: forkliftId,
            overall_score: overallScore,
            age_score: scores.age,
            hours_score: scores.hours,
            maintenance_cost_score: scores.maintenanceCost,
            repair_frequency_score: scores.repairFrequency,
            downtime_score: scores.downtime,
            risk_factors: riskFactors,
            recommendations: recommendations,
            repair_vs_replace: repairVsReplace.decision,
            replacement_urgency: repairVsReplace.urgency,
            estimated_remaining_life_months: financials.remainingLifeMonths,
            estimated_remaining_value: financials.currentValue,
            projected_annual_maintenance_cost: financials.projectedAnnualMaintenance,
            projected_downtime_cost: financials.projectedDowntimeCost,
            replacement_cost_estimate: financials.replacementCost,
            repair_cost_estimate: financials.projectedRepairCost,
            cost_savings_if_replaced: financials.savingsIfReplaced,
            roi_if_replaced: financials.roiIfReplaced,
            assessment_method: 'automated'
        });

        // Check if alert should be created
        if (overallScore >= 7) {
            this.createHighRiskAlert(forklift, assessment);
        }

        return assessment;
    }

    /**
     * Assess entire fleet
     */
    async assessFleet() {
        const forklifts = db.forklifts.findAll({ excludeRetired: true });
        const results = [];

        for (const forklift of forklifts) {
            try {
                const assessment = await this.assessForklift(forklift.id);
                results.push({ forkliftId: forklift.id, success: true, assessment });
            } catch (error) {
                results.push({ forkliftId: forklift.id, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Get maintenance metrics for scoring
     */
    getMaintenanceMetrics(forkliftId) {
        const twelveMonths = db.maintenance.getCostByForklift(forkliftId, 12);
        const allRecords = db.maintenance.findAll({ forkliftId });

        const repairs = allRecords.filter(m => m.type === 'repair' || m.type === 'emergency');
        const last12MonthsRepairs = repairs.filter(m => {
            const date = new Date(m.service_date);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            return date >= oneYearAgo;
        });

        return {
            totalCost12Months: twelveMonths?.total_cost || 0,
            laborCost12Months: twelveMonths?.labor_cost || 0,
            partsCost12Months: twelveMonths?.parts_cost || 0,
            serviceCount12Months: twelveMonths?.service_count || 0,
            repairCount12Months: last12MonthsRepairs.length,
            emergencyCount12Months: last12MonthsRepairs.filter(m => m.type === 'emergency').length,
            avgCostPerService: twelveMonths?.avg_cost || 0,
            totalLifetimeCost: allRecords.reduce((sum, m) => sum + (m.total_cost || 0), 0)
        };
    }

    /**
     * Get downtime metrics for scoring
     */
    getDowntimeMetrics(forkliftId) {
        const events = db.downtime.findAll({ forkliftId });
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const last12Months = events.filter(e => new Date(e.start_time) >= oneYearAgo);

        return {
            totalEvents12Months: last12Months.length,
            totalHours12Months: last12Months.reduce((sum, e) => sum + (e.duration_hours || 0), 0),
            unplannedEvents12Months: last12Months.filter(e => e.type === 'unplanned' || e.type === 'emergency').length,
            totalCost12Months: last12Months.reduce((sum, e) =>
                sum + ((e.duration_hours || 0) * (e.cost_per_hour_down || 150)), 0),
            avgDowntimePerEvent: last12Months.length > 0
                ? last12Months.reduce((sum, e) => sum + (e.duration_hours || 0), 0) / last12Months.length
                : 0
        };
    }

    /**
     * Get age-related metrics
     */
    getAgeMetrics(forklift) {
        const purchaseDate = forklift.purchase_date ? new Date(forklift.purchase_date) : null;
        const ageYears = purchaseDate
            ? (new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 365)
            : (forklift.year ? new Date().getFullYear() - forklift.year : 5);

        return {
            ageYears: ageYears,
            expectedLifespanYears: forklift.expected_lifespan_years || 10,
            percentOfLifeUsed: (ageYears / (forklift.expected_lifespan_years || 10)) * 100
        };
    }

    /**
     * Calculate age score (1-10)
     */
    calculateAgeScore(ageData) {
        const { ageYears } = ageData;
        const t = this.thresholds.ageYears;

        if (ageYears <= t.low) return 1;
        if (ageYears <= t.medium) return Math.ceil(1 + ((ageYears - t.low) / (t.medium - t.low)) * 3);
        if (ageYears <= t.high) return Math.ceil(4 + ((ageYears - t.medium) / (t.high - t.medium)) * 3);
        if (ageYears <= t.critical) return Math.ceil(7 + ((ageYears - t.high) / (t.critical - t.high)) * 2);
        return 10;
    }

    /**
     * Calculate hours score (1-10)
     */
    calculateHoursScore(hours) {
        const t = this.thresholds.hours;

        if (hours <= t.low) return 1;
        if (hours <= t.medium) return Math.ceil(1 + ((hours - t.low) / (t.medium - t.low)) * 3);
        if (hours <= t.high) return Math.ceil(4 + ((hours - t.medium) / (t.high - t.medium)) * 3);
        if (hours <= t.critical) return Math.ceil(7 + ((hours - t.high) / (t.critical - t.high)) * 2);
        return 10;
    }

    /**
     * Calculate maintenance cost score (1-10)
     */
    calculateMaintenanceCostScore(maintenanceData, forklift) {
        const purchasePrice = forklift.purchase_price || 25000; // Default estimate
        const costPercent = (maintenanceData.totalCost12Months / purchasePrice) * 100;
        const t = this.thresholds.annualMaintenanceCostPercent;

        if (costPercent <= t.low) return 1;
        if (costPercent <= t.medium) return Math.ceil(1 + ((costPercent - t.low) / (t.medium - t.low)) * 3);
        if (costPercent <= t.high) return Math.ceil(4 + ((costPercent - t.medium) / (t.high - t.medium)) * 3);
        if (costPercent <= t.critical) return Math.ceil(7 + ((costPercent - t.high) / (t.critical - t.high)) * 2);
        return 10;
    }

    /**
     * Calculate repair frequency score (1-10)
     */
    calculateRepairFrequencyScore(maintenanceData) {
        const repairs = maintenanceData.repairCount12Months;
        const t = this.thresholds.repairsPerYear;

        if (repairs <= t.low) return 1;
        if (repairs <= t.medium) return Math.ceil(1 + ((repairs - t.low) / (t.medium - t.low)) * 3);
        if (repairs <= t.high) return Math.ceil(4 + ((repairs - t.medium) / (t.high - t.medium)) * 3);
        if (repairs <= t.critical) return Math.ceil(7 + ((repairs - t.high) / (t.critical - t.high)) * 2);
        return 10;
    }

    /**
     * Calculate downtime score (1-10)
     */
    calculateDowntimeScore(downtimeData) {
        const hours = downtimeData.totalHours12Months;
        const t = this.thresholds.downtimeHoursPerYear;

        if (hours <= t.low) return 1;
        if (hours <= t.medium) return Math.ceil(1 + ((hours - t.low) / (t.medium - t.low)) * 3);
        if (hours <= t.high) return Math.ceil(4 + ((hours - t.medium) / (t.high - t.medium)) * 3);
        if (hours <= t.critical) return Math.ceil(7 + ((hours - t.high) / (t.critical - t.high)) * 2);
        return 10;
    }

    /**
     * Identify specific risk factors
     */
    identifyRiskFactors(scores, forklift, maintenanceData, downtimeData) {
        const factors = [];

        if (scores.age >= 7) {
            factors.push({
                category: 'age',
                severity: scores.age >= 9 ? 'critical' : 'high',
                description: `Equipment age is ${this.getAgeMetrics(forklift).ageYears.toFixed(1)} years`
            });
        }

        if (scores.hours >= 7) {
            factors.push({
                category: 'hours',
                severity: scores.hours >= 9 ? 'critical' : 'high',
                description: `Operating hours (${forklift.current_hours}) approaching end of life threshold`
            });
        }

        if (scores.maintenanceCost >= 7) {
            factors.push({
                category: 'maintenance_cost',
                severity: scores.maintenanceCost >= 9 ? 'critical' : 'high',
                description: `Annual maintenance cost ($${maintenanceData.totalCost12Months.toFixed(0)}) exceeds threshold`
            });
        }

        if (scores.repairFrequency >= 7) {
            factors.push({
                category: 'repair_frequency',
                severity: scores.repairFrequency >= 9 ? 'critical' : 'high',
                description: `${maintenanceData.repairCount12Months} repairs in last 12 months`
            });
        }

        if (maintenanceData.emergencyCount12Months >= 2) {
            factors.push({
                category: 'emergency_repairs',
                severity: maintenanceData.emergencyCount12Months >= 4 ? 'critical' : 'high',
                description: `${maintenanceData.emergencyCount12Months} emergency repairs in last 12 months`
            });
        }

        if (scores.downtime >= 7) {
            factors.push({
                category: 'downtime',
                severity: scores.downtime >= 9 ? 'critical' : 'high',
                description: `${downtimeData.totalHours12Months.toFixed(0)} hours of downtime in last 12 months`
            });
        }

        // Check maintenance status
        if (forklift.next_service_date && new Date(forklift.next_service_date) < new Date()) {
            factors.push({
                category: 'maintenance_overdue',
                severity: 'medium',
                description: 'Scheduled maintenance is overdue'
            });
        }

        return factors;
    }

    /**
     * Generate recommendations based on assessment
     */
    generateRecommendations(overallScore, riskFactors, forklift) {
        const recommendations = [];

        if (overallScore >= 9) {
            recommendations.push({
                priority: 'critical',
                action: 'Replace immediately',
                description: 'This unit has exceeded safe operating thresholds. Recommend immediate replacement to avoid safety issues and excessive costs.'
            });
        } else if (overallScore >= 7) {
            recommendations.push({
                priority: 'high',
                action: 'Plan replacement',
                description: 'This unit should be scheduled for replacement within the next 6-12 months. Consider adding to next fiscal year budget.'
            });
        } else if (overallScore >= 5) {
            recommendations.push({
                priority: 'medium',
                action: 'Monitor closely',
                description: 'Increase inspection frequency and track maintenance costs. Re-assess in 3 months.'
            });
        }

        // Add specific recommendations based on risk factors
        const maintenanceOverdue = riskFactors.find(f => f.category === 'maintenance_overdue');
        if (maintenanceOverdue) {
            recommendations.push({
                priority: 'high',
                action: 'Complete overdue maintenance',
                description: 'Schedule and complete overdue preventive maintenance immediately.'
            });
        }

        const highRepairs = riskFactors.find(f => f.category === 'repair_frequency');
        if (highRepairs) {
            recommendations.push({
                priority: 'medium',
                action: 'Root cause analysis',
                description: 'Conduct root cause analysis on frequent repairs to identify systemic issues.'
            });
        }

        const highDowntime = riskFactors.find(f => f.category === 'downtime');
        if (highDowntime) {
            recommendations.push({
                priority: 'medium',
                action: 'Improve reliability',
                description: 'Consider more frequent preventive maintenance or component upgrades to reduce unplanned downtime.'
            });
        }

        return recommendations;
    }

    /**
     * Calculate financial projections
     */
    calculateFinancialProjections(forklift, maintenanceData, downtimeData) {
        const purchasePrice = forklift.purchase_price || 25000;
        const depreciationRate = forklift.depreciation_rate || 0.15;
        const ageYears = this.getAgeMetrics(forklift).ageYears;

        // Calculate current value (declining balance depreciation)
        const currentValue = purchasePrice * Math.pow(1 - depreciationRate, ageYears);

        // Project annual maintenance cost (trending upward with age)
        const maintenanceTrend = 1 + (ageYears * 0.05); // 5% increase per year of age
        const projectedAnnualMaintenance = maintenanceData.totalCost12Months * maintenanceTrend;

        // Project downtime cost
        const projectedDowntimeCost = downtimeData.totalCost12Months * maintenanceTrend;

        // Replacement cost estimate (new equivalent unit)
        const replacementCost = purchasePrice * 1.2; // Assume 20% price increase for new model

        // Calculate remaining useful life
        const expectedLifeYears = forklift.expected_lifespan_years || 10;
        const remainingLifeMonths = Math.max(0, (expectedLifeYears - ageYears) * 12);

        // Calculate savings if replaced
        const yearsToCompare = Math.min(3, remainingLifeMonths / 12);
        const continueCost = (projectedAnnualMaintenance + projectedDowntimeCost) * yearsToCompare;
        const newUnitAnnualCost = purchasePrice * 0.03; // Estimate 3% maintenance for new unit
        const replaceCost = replacementCost + (newUnitAnnualCost * yearsToCompare);
        const savingsIfReplaced = continueCost - replaceCost + currentValue; // Include trade-in

        // Calculate ROI if replaced
        const roiIfReplaced = savingsIfReplaced > 0
            ? (savingsIfReplaced / (replacementCost - currentValue)) * 100
            : 0;

        return {
            currentValue: Math.round(currentValue),
            projectedAnnualMaintenance: Math.round(projectedAnnualMaintenance),
            projectedDowntimeCost: Math.round(projectedDowntimeCost),
            projectedRepairCost: Math.round(projectedAnnualMaintenance * 0.6), // 60% of maintenance is repairs
            replacementCost: Math.round(replacementCost),
            remainingLifeMonths: Math.round(remainingLifeMonths),
            savingsIfReplaced: Math.round(savingsIfReplaced),
            roiIfReplaced: Math.round(roiIfReplaced)
        };
    }

    /**
     * Determine repair vs replace decision
     */
    determineRepairVsReplace(overallScore, financials) {
        let decision, urgency;

        if (overallScore >= 9) {
            decision = 'replace';
            urgency = 'immediate';
        } else if (overallScore >= 7) {
            decision = financials.savingsIfReplaced > 0 ? 'replace' : 'monitor';
            urgency = 'within_6_months';
        } else if (overallScore >= 5) {
            decision = 'monitor';
            urgency = 'within_1_year';
        } else if (overallScore >= 3) {
            decision = 'repair';
            urgency = 'within_2_years';
        } else {
            decision = 'repair';
            urgency = 'not_needed';
        }

        return { decision, urgency };
    }

    /**
     * Create alert for high-risk equipment
     */
    createHighRiskAlert(forklift, assessment) {
        const existingAlert = db.alerts.findAll({
            forkliftId: forklift.id,
            type: 'high_risk',
            isResolved: false
        });

        // Don't create duplicate alerts
        if (existingAlert.length > 0) return;

        db.alerts.create({
            forklift_id: forklift.id,
            type: 'high_risk',
            severity: assessment.overall_score >= 9 ? 'critical' : 'high',
            title: `High Risk Unit: ${forklift.id}`,
            message: `Risk score ${assessment.overall_score}/10. ${assessment.repair_vs_replace === 'replace' ? 'Replacement recommended.' : 'Close monitoring required.'}`,
            context_data: {
                risk_score: assessment.overall_score,
                repair_vs_replace: assessment.repair_vs_replace,
                replacement_urgency: assessment.replacement_urgency
            },
            threshold_value: 7,
            actual_value: assessment.overall_score,
            recurrence_key: `high_risk_${forklift.id}`
        });
    }

    /**
     * Get fleet risk summary
     */
    getFleetRiskSummary() {
        const stats = db.forklifts.getStats();
        const highRiskUnits = db.forklifts.findAll({ riskLevel: 'high' });
        const criticalUnits = db.forklifts.findAll({ riskLevel: 'critical' });

        return {
            totalUnits: stats.total,
            criticalRisk: stats.critical_risk,
            highRisk: stats.high_risk,
            mediumRisk: stats.medium_risk,
            lowRisk: stats.low_risk,
            averageRiskScore: stats.avg_risk_score,
            unitsNeedingReplacement: [...highRiskUnits, ...criticalUnits].filter(f =>
                f.recommended_action === 'plan_replacement' || f.recommended_action === 'replace_immediately'
            ).length
        };
    }

    /**
     * Get replacement budget recommendations
     */
    getReplacementBudgetRecommendations(fiscalYear) {
        const highRiskUnits = [
            ...db.forklifts.findAll({ riskLevel: 'critical' }),
            ...db.forklifts.findAll({ riskLevel: 'high' })
        ];

        const recommendations = highRiskUnits
            .map(forklift => {
                const assessment = db.riskAssessments.getLatest(forklift.id);
                if (!assessment) return null;

                return {
                    forklift_id: forklift.id,
                    model: forklift.model,
                    location: forklift.location_name,
                    risk_score: assessment.overall_score,
                    current_hours: forklift.current_hours,
                    ytd_maintenance_cost: assessment.projected_annual_maintenance_cost,
                    replacement_cost: assessment.replacement_cost_estimate,
                    trade_in_value: assessment.estimated_remaining_value,
                    net_cost: assessment.replacement_cost_estimate - assessment.estimated_remaining_value,
                    annual_savings: assessment.cost_savings_if_replaced / 3, // 3-year comparison
                    payback_months: assessment.cost_savings_if_replaced > 0
                        ? Math.round((assessment.replacement_cost_estimate - assessment.estimated_remaining_value) / (assessment.cost_savings_if_replaced / 36))
                        : null,
                    urgency: assessment.replacement_urgency
                };
            })
            .filter(r => r !== null)
            .sort((a, b) => b.risk_score - a.risk_score);

        const totalBudgetNeeded = recommendations.reduce((sum, r) => sum + r.net_cost, 0);
        const projectedAnnualSavings = recommendations.reduce((sum, r) => sum + r.annual_savings, 0);

        return {
            fiscal_year: fiscalYear,
            recommendations,
            summary: {
                total_units_recommended: recommendations.length,
                total_budget_needed: totalBudgetNeeded,
                projected_annual_savings: projectedAnnualSavings,
                fleet_payback_months: projectedAnnualSavings > 0
                    ? Math.round(totalBudgetNeeded / (projectedAnnualSavings / 12))
                    : null
            }
        };
    }
}

module.exports = new RiskAssessmentService();
