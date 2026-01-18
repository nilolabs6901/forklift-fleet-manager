const express = require('express');
const router = express.Router();
const Alert = require('../../models/Alert');
const Forklift = require('../../models/Forklift');

// GET all alerts
router.get('/', (req, res) => {
  try {
    const { severity, resolved, forklift, limit } = req.query;
    const alerts = Alert.findAll({
      severity,
      isResolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      forkliftId: forklift,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET alert stats
router.get('/stats', (req, res) => {
  try {
    const stats = Alert.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET active alerts
router.get('/active', (req, res) => {
  try {
    const alerts = Alert.getActiveAlerts();
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET severity breakdown
router.get('/severity', (req, res) => {
  try {
    const breakdown = Alert.getSeverityBreakdown();
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single alert
router.get('/:id', (req, res) => {
  try {
    const alert = Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create alert
router.post('/', (req, res) => {
  try {
    const { type, title } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        error: 'Alert type and title are required'
      });
    }

    // Verify forklift exists if provided
    if (req.body.forklift_id) {
      const forklift = Forklift.findById(req.body.forklift_id);
      if (!forklift) {
        return res.status(404).json({ success: false, error: 'Forklift not found' });
      }
    }

    const alert = Alert.create(req.body);

    // Recalculate forklift risk level if associated
    if (req.body.forklift_id) {
      Forklift.recalculateRiskLevel(req.body.forklift_id);
    }

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT resolve alert
router.put('/:id/resolve', (req, res) => {
  try {
    const alert = Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const { resolved_by } = req.body;
    const resolved = Alert.resolve(req.params.id, resolved_by);

    // Recalculate forklift risk level if associated
    if (alert.forklift_id) {
      Forklift.recalculateRiskLevel(alert.forklift_id);
    }

    res.json({ success: true, data: resolved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT unresolve alert
router.put('/:id/unresolve', (req, res) => {
  try {
    const alert = Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const unresolved = Alert.unresolve(req.params.id);

    // Recalculate forklift risk level if associated
    if (alert.forklift_id) {
      Forklift.recalculateRiskLevel(alert.forklift_id);
    }

    res.json({ success: true, data: unresolved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE alert
router.delete('/:id', (req, res) => {
  try {
    const alert = Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    const forkliftId = alert.forklift_id;
    Alert.delete(req.params.id);

    // Recalculate forklift risk level if associated
    if (forkliftId) {
      Forklift.recalculateRiskLevel(forkliftId);
    }

    res.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
