/**
 * Alert Service
 * Handles alert creation, delivery, and management
 */

const db = require('../config/sqlite-database');

class AlertService {
    constructor() {
        // Alert severity levels
        this.severityLevels = ['low', 'medium', 'high', 'critical'];

        // Alert types
        this.alertTypes = [
            'maintenance_due',
            'maintenance_overdue',
            'hour_anomaly',
            'high_risk',
            'downtime',
            'rental_active',
            'cost_threshold',
            'service_reminder',
            'inspection_due',
            'warranty_expiring',
            'lifecycle_alert',
            'custom'
        ];
    }

    /**
     * Create a new alert
     */
    createAlert(data) {
        // Validate alert type
        if (!this.alertTypes.includes(data.type)) {
            throw new Error(`Invalid alert type: ${data.type}`);
        }

        // Check for duplicate recurring alerts
        if (data.recurrence_key) {
            const existing = db.alerts.findAll({
                isResolved: false
            }).filter(a => {
                const context = a.context_data ? JSON.parse(a.context_data) : {};
                return a.recurrence_key === data.recurrence_key ||
                       (a.forklift_id === data.forklift_id && a.type === data.type && !a.is_resolved);
            });

            if (existing.length > 0) {
                return existing[0]; // Return existing alert instead of creating duplicate
            }
        }

        const alert = db.alerts.create(data);

        // Queue notifications
        this.queueNotifications(alert);

        return alert;
    }

    /**
     * Queue notifications for an alert
     */
    async queueNotifications(alert) {
        const emailEnabled = db.settings.get('alert_email_enabled') === 'true';
        const smsEnabled = db.settings.get('alert_sms_enabled') === 'true';

        // Only send notifications for high severity alerts immediately
        if (alert.severity === 'critical' || alert.severity === 'high') {
            if (emailEnabled) {
                await this.sendEmailNotification(alert);
            }
            if (smsEnabled) {
                await this.sendSmsNotification(alert);
            }
        }

        // Check for webhooks
        await this.triggerWebhooks(alert);
    }

    /**
     * Send email notification (placeholder - would integrate with nodemailer)
     */
    async sendEmailNotification(alert) {
        // In production, this would use nodemailer or similar
        console.log(`[EMAIL] Alert ${alert.id}: ${alert.title}`);

        // Update alert record
        db.raw.prepare(`
            UPDATE alerts SET email_sent = 1, email_sent_at = datetime('now')
            WHERE id = ?
        `).run(alert.id);

        return true;
    }

    /**
     * Send SMS notification (placeholder - would integrate with Twilio)
     */
    async sendSmsNotification(alert) {
        // In production, this would use Twilio or similar
        console.log(`[SMS] Alert ${alert.id}: ${alert.title}`);

        // Update alert record
        db.raw.prepare(`
            UPDATE alerts SET sms_sent = 1, sms_sent_at = datetime('now')
            WHERE id = ?
        `).run(alert.id);

        return true;
    }

    /**
     * Trigger webhooks for alert
     */
    async triggerWebhooks(alert) {
        const webhooks = db.raw.prepare(`
            SELECT * FROM webhooks WHERE is_active = 1
        `).all();

        for (const webhook of webhooks) {
            const events = JSON.parse(webhook.events || '[]');

            // Check if webhook should trigger for this alert type
            if (events.includes(alert.type) || events.includes('all')) {
                try {
                    // In production, this would make HTTP request to webhook URL
                    console.log(`[WEBHOOK] ${webhook.name}: Alert ${alert.id}`);

                    db.raw.prepare(`
                        UPDATE webhooks
                        SET last_triggered_at = datetime('now'),
                            last_status_code = 200,
                            consecutive_failures = 0
                        WHERE id = ?
                    `).run(webhook.id);

                    db.raw.prepare(`
                        UPDATE alerts SET webhook_sent = 1, webhook_sent_at = datetime('now')
                        WHERE id = ?
                    `).run(alert.id);

                } catch (error) {
                    db.raw.prepare(`
                        UPDATE webhooks
                        SET consecutive_failures = consecutive_failures + 1,
                            last_status_code = 500
                        WHERE id = ?
                    `).run(webhook.id);
                }
            }
        }
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId, userId) {
        const alert = db.alerts.findById(alertId);
        if (!alert) {
            throw new Error(`Alert ${alertId} not found`);
        }

        return db.alerts.acknowledge(alertId, userId);
    }

    /**
     * Resolve an alert
     */
    resolveAlert(alertId, userId, notes = null) {
        const alert = db.alerts.findById(alertId);
        if (!alert) {
            throw new Error(`Alert ${alertId} not found`);
        }

        return db.alerts.resolve(alertId, userId, notes);
    }

    /**
     * Snooze an alert
     */
    snoozeAlert(alertId, userId, snoozeUntil) {
        const alert = db.alerts.findById(alertId);
        if (!alert) {
            throw new Error(`Alert ${alertId} not found`);
        }

        // Log the snooze action
        db.raw.prepare(`
            INSERT INTO alert_acknowledgments (alert_id, user_id, action, snooze_until)
            VALUES (?, ?, 'snoozed', ?)
        `).run(alertId, userId, snoozeUntil);

        // Temporarily deactivate the alert
        db.raw.prepare(`
            UPDATE alerts SET is_active = 0 WHERE id = ?
        `).run(alertId);

        return db.alerts.findById(alertId);
    }

    /**
     * Reactivate snoozed alerts that have passed their snooze time
     */
    reactivateSnoozedAlerts() {
        const snoozed = db.raw.prepare(`
            SELECT DISTINCT a.id
            FROM alerts a
            JOIN alert_acknowledgments aa ON a.id = aa.alert_id
            WHERE aa.action = 'snoozed'
            AND aa.snooze_until <= datetime('now')
            AND a.is_active = 0
            AND a.is_resolved = 0
        `).all();

        for (const alert of snoozed) {
            db.raw.prepare(`
                UPDATE alerts SET is_active = 1 WHERE id = ?
            `).run(alert.id);
        }

        return snoozed.length;
    }

    /**
     * Get active alerts with filters
     */
    getActiveAlerts(options = {}) {
        return db.alerts.findAll({
            ...options,
            isActive: true,
            isResolved: false
        });
    }

    /**
     * Get alert statistics
     */
    getAlertStats() {
        return db.alerts.getStats();
    }

    /**
     * Get alert history for a forklift
     */
    getForkliftAlerts(forkliftId, options = {}) {
        return db.alerts.findAll({
            forkliftId,
            limit: options.limit || 50
        });
    }

    /**
     * Get alert acknowledgment history
     */
    getAlertHistory(alertId) {
        return db.raw.prepare(`
            SELECT aa.*, u.first_name || ' ' || u.last_name as user_name
            FROM alert_acknowledgments aa
            LEFT JOIN users u ON aa.user_id = u.id
            WHERE aa.alert_id = ?
            ORDER BY aa.created_at DESC
        `).all(alertId);
    }

    /**
     * Bulk acknowledge alerts
     */
    bulkAcknowledge(alertIds, userId) {
        const results = [];
        for (const id of alertIds) {
            try {
                const alert = this.acknowledgeAlert(id, userId);
                results.push({ id, success: true, alert });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }
        return results;
    }

    /**
     * Bulk resolve alerts
     */
    bulkResolve(alertIds, userId, notes = null) {
        const results = [];
        for (const id of alertIds) {
            try {
                const alert = this.resolveAlert(id, userId, notes);
                results.push({ id, success: true, alert });
            } catch (error) {
                results.push({ id, success: false, error: error.message });
            }
        }
        return results;
    }

    /**
     * Create custom alert
     */
    createCustomAlert(data, createdBy = null) {
        return this.createAlert({
            ...data,
            type: 'custom'
        });
    }

    /**
     * Get alerts dashboard summary
     */
    getDashboardSummary() {
        const stats = this.getAlertStats();
        const activeAlerts = this.getActiveAlerts({ limit: 10 });

        // Group by type
        const byType = {};
        activeAlerts.forEach(alert => {
            if (!byType[alert.type]) {
                byType[alert.type] = 0;
            }
            byType[alert.type]++;
        });

        // Get trend (alerts created in last 7 days vs previous 7 days)
        const last7Days = db.raw.prepare(`
            SELECT COUNT(*) as count FROM alerts
            WHERE created_at >= date('now', '-7 days')
        `).get().count;

        const previous7Days = db.raw.prepare(`
            SELECT COUNT(*) as count FROM alerts
            WHERE created_at >= date('now', '-14 days')
            AND created_at < date('now', '-7 days')
        `).get().count;

        const trend = previous7Days > 0
            ? ((last7Days - previous7Days) / previous7Days) * 100
            : 0;

        return {
            total_active: stats.active_alerts,
            by_severity: {
                critical: stats.critical_count,
                high: stats.high_count,
                medium: stats.medium_count,
                low: stats.low_count
            },
            by_type: byType,
            recent_alerts: activeAlerts,
            trend_7_day: {
                current_week: last7Days,
                previous_week: previous7Days,
                change_percent: Math.round(trend)
            }
        };
    }

    /**
     * Run scheduled alert checks
     */
    async runScheduledChecks() {
        const results = {
            maintenance_alerts: 0,
            risk_alerts: 0,
            snoozed_reactivated: 0
        };

        // Import services
        const maintenanceService = require('./maintenanceService');
        const riskAssessmentService = require('./riskAssessmentService');

        // Check maintenance due
        const maintenanceAlerts = maintenanceService.checkMaintenanceAlerts();
        results.maintenance_alerts = maintenanceAlerts.length;

        // Reactivate snoozed alerts
        results.snoozed_reactivated = this.reactivateSnoozedAlerts();

        return results;
    }

    /**
     * Create webhook
     */
    createWebhook(data, createdBy = null) {
        const stmt = db.raw.prepare(`
            INSERT INTO webhooks (name, url, secret, events, created_by)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            data.name,
            data.url,
            data.secret || null,
            JSON.stringify(data.events || ['all']),
            createdBy
        );

        return db.raw.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
    }

    /**
     * Get webhooks
     */
    getWebhooks() {
        return db.raw.prepare('SELECT * FROM webhooks ORDER BY name').all();
    }

    /**
     * Update webhook
     */
    updateWebhook(id, data) {
        const fields = [];
        const values = [];

        if (data.name !== undefined) {
            fields.push('name = ?');
            values.push(data.name);
        }
        if (data.url !== undefined) {
            fields.push('url = ?');
            values.push(data.url);
        }
        if (data.secret !== undefined) {
            fields.push('secret = ?');
            values.push(data.secret);
        }
        if (data.events !== undefined) {
            fields.push('events = ?');
            values.push(JSON.stringify(data.events));
        }
        if (data.is_active !== undefined) {
            fields.push('is_active = ?');
            values.push(data.is_active ? 1 : 0);
        }

        if (fields.length === 0) {
            return db.raw.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
        }

        fields.push('updated_at = datetime("now")');
        values.push(id);

        db.raw.prepare(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return db.raw.prepare('SELECT * FROM webhooks WHERE id = ?').get(id);
    }

    /**
     * Delete webhook
     */
    deleteWebhook(id) {
        return db.raw.prepare('DELETE FROM webhooks WHERE id = ?').run(id).changes > 0;
    }
}

module.exports = new AlertService();
