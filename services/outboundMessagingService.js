/**
 * Outbound Messaging Service
 * Sends proactive alerts and notifications to users via their preferred channel
 * Integrates with the channel adapter service for multi-channel delivery
 */

const channelAdapter = require('./channelAdapterService');
const db = require('../config/sqlite-database');

class OutboundMessagingService {
    constructor() {
        this.defaultChannel = process.env.DEFAULT_NOTIFICATION_CHANNEL || 'email';
    }

    /**
     * Send an alert notification to a user
     */
    async sendAlert(alert, recipient) {
        const channel = recipient.preferredChannel || this.defaultChannel;
        const to = recipient.channelAddress; // phone, email, chat ID, etc.

        if (!to) {
            console.warn(`[Outbound] No address for recipient, skipping alert ${alert.id}`);
            return { success: false, error: 'No recipient address' };
        }

        const severityIcon = {
            critical: 'CRITICAL',
            high: 'HIGH',
            medium: 'MEDIUM',
            low: 'LOW'
        };

        const text = `**Fleet Shield Alert — ${severityIcon[alert.severity] || 'ALERT'}**\n\n` +
            `**${alert.title}**\n${alert.message || ''}\n\n` +
            (alert.forklift_id ? `**Unit:** ${alert.forklift_id}\n` : '') +
            `**Type:** ${(alert.type || '').replace(/_/g, ' ')}\n` +
            `**Severity:** ${alert.severity}\n` +
            `**Time:** ${new Date().toLocaleString()}`;

        const data = {
            rows: [
                { label: 'Alert', value: alert.title },
                { label: 'Severity', value: (alert.severity || '').toUpperCase() },
                ...(alert.forklift_id ? [{ label: 'Unit', value: alert.forklift_id }] : []),
                { label: 'Type', value: (alert.type || '').replace(/_/g, ' ') }
            ]
        };

        try {
            const result = await channelAdapter.sendMessage(channel, to, text, data);
            console.log(`[Outbound] Alert "${alert.title}" sent via ${channel} to ${to}: ${result.success}`);
            return result;
        } catch (error) {
            console.error(`[Outbound] Failed to send alert via ${channel}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send a maintenance reminder
     */
    async sendMaintenanceReminder(forklift, recipient) {
        const channel = recipient.preferredChannel || this.defaultChannel;
        const to = recipient.channelAddress;

        if (!to) return { success: false, error: 'No recipient address' };

        const daysOverdue = forklift.next_service_date
            ? Math.floor((new Date() - new Date(forklift.next_service_date)) / (1000 * 60 * 60 * 24))
            : 0;

        const text = `**Maintenance Reminder**\n\n` +
            `**${forklift.id}** (${forklift.manufacturer || ''} ${forklift.model || ''}) ` +
            `${daysOverdue > 0 ? `is **${daysOverdue} days overdue** for service.` : 'has service coming up soon.'}\n\n` +
            `**Hours:** ${(forklift.current_hours || 0).toLocaleString()}\n` +
            `**Location:** ${forklift.location_name || 'Unassigned'}\n` +
            `**Due Date:** ${forklift.next_service_date || 'Not set'}`;

        const data = {
            rows: [
                { label: 'Unit', value: forklift.id },
                { label: 'Status', value: daysOverdue > 0 ? `${daysOverdue} days overdue` : 'Due soon' },
                { label: 'Hours', value: (forklift.current_hours || 0).toLocaleString() },
                { label: 'Location', value: forklift.location_name || 'Unassigned' }
            ]
        };

        try {
            return await channelAdapter.sendMessage(channel, to, text, data);
        } catch (error) {
            console.error(`[Outbound] Maintenance reminder failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send a report to a recipient
     */
    async sendReport(reportText, reportData, recipient, subject) {
        const channel = recipient.preferredChannel || this.defaultChannel;
        const to = recipient.channelAddress;

        if (!to) return { success: false, error: 'No recipient address' };

        try {
            if (channel === 'email') {
                return await channelAdapter.getAdapter('email').sendMessage(
                    to, reportText, reportData, subject || 'Fleet Shield Report'
                );
            }
            return await channelAdapter.sendMessage(channel, to, reportText, reportData);
        } catch (error) {
            console.error(`[Outbound] Report send failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Broadcast a message to multiple recipients
     */
    async broadcast(text, data, recipients) {
        const results = [];
        for (const recipient of recipients) {
            const result = await this.sendAlert(
                { title: 'Fleet Shield Notification', message: text, severity: 'low', type: 'notification' },
                recipient
            );
            results.push({ recipient: recipient.channelAddress, ...result });
        }
        return results;
    }

    /**
     * Send invoice discrepancy notification
     */
    async sendInvoiceDiscrepancy(invoice, discrepancy, recipient) {
        const channel = recipient.preferredChannel || this.defaultChannel;
        const to = recipient.channelAddress;

        if (!to) return { success: false, error: 'No recipient address' };

        const text = `**Invoice Discrepancy Detected**\n\n` +
            `**Invoice:** ${invoice.invoice_number || 'Unknown'}\n` +
            `**Vendor:** ${invoice.vendor || 'Unknown'}\n` +
            `**Issue:** ${discrepancy}\n\n` +
            (invoice.forklift_id ? `**Unit:** ${invoice.forklift_id}\n` : '') +
            `**Amount:** $${(invoice.total_amount || 0).toLocaleString()}\n` +
            `**Date:** ${new Date().toLocaleString()}`;

        const data = {
            rows: [
                { label: 'Invoice', value: invoice.invoice_number || 'N/A' },
                { label: 'Vendor', value: invoice.vendor || 'N/A' },
                { label: 'Amount', value: '$' + (invoice.total_amount || 0).toLocaleString() },
                { label: 'Issue', value: discrepancy }
            ]
        };

        try {
            return await channelAdapter.sendMessage(channel, to, text, data);
        } catch (error) {
            console.error(`[Outbound] Invoice discrepancy notification failed:`, error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new OutboundMessagingService();
