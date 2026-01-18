const express = require('express');
const router = express.Router();
const Forklift = require('../../models/Forklift');

// GET all forklifts
router.get('/', (req, res) => {
  try {
    const { status, location, risk, search } = req.query;
    const forklifts = Forklift.findAll({
      status,
      locationId: location,
      riskLevel: risk,
      search
    });
    res.json({ success: true, count: forklifts.length, data: forklifts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET forklift stats
router.get('/stats', (req, res) => {
  try {
    const stats = Forklift.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single forklift
router.get('/:id', (req, res) => {
  try {
    const forklift = Forklift.findById(req.params.id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: 'Forklift not found' });
    }
    res.json({ success: true, data: forklift });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET forklift maintenance history
router.get('/:id/maintenance', (req, res) => {
  try {
    const records = Forklift.getMaintenanceHistory(req.params.id);
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET forklift alerts
router.get('/:id/alerts', (req, res) => {
  try {
    const alerts = Forklift.getAlerts(req.params.id);
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET forklift hour logs
router.get('/:id/hours', (req, res) => {
  try {
    const logs = Forklift.getHourLogs(req.params.id);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create forklift
router.post('/', (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Forklift ID is required' });
    }

    // Check for duplicate
    const existing = Forklift.findById(id);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Forklift ID already exists' });
    }

    const forklift = Forklift.create(req.body);
    res.status(201).json({ success: true, data: forklift });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update forklift
router.put('/:id', (req, res) => {
  try {
    const forklift = Forklift.findById(req.params.id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: 'Forklift not found' });
    }

    const updated = Forklift.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update forklift hours
router.put('/:id/hours', (req, res) => {
  try {
    const { hours, logged_by } = req.body;

    if (hours === undefined) {
      return res.status(400).json({ success: false, error: 'Hours value is required' });
    }

    const forklift = Forklift.findById(req.params.id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: 'Forklift not found' });
    }

    const updated = Forklift.updateHours(req.params.id, hours, logged_by);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE forklift
router.delete('/:id', (req, res) => {
  try {
    const forklift = Forklift.findById(req.params.id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: 'Forklift not found' });
    }

    Forklift.delete(req.params.id);
    res.json({ success: true, message: 'Forklift deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
