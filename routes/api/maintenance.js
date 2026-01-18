const express = require('express');
const router = express.Router();
const MaintenanceRecord = require('../../models/MaintenanceRecord');
const Forklift = require('../../models/Forklift');

// GET all maintenance records
router.get('/', (req, res) => {
  try {
    const { forklift, type, status, limit } = req.query;
    const records = MaintenanceRecord.findAll({
      forkliftId: forklift,
      type,
      status,
      limit: limit ? parseInt(limit) : undefined
    });
    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET maintenance stats
router.get('/stats', (req, res) => {
  try {
    const stats = MaintenanceRecord.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET maintenance due
router.get('/due', (req, res) => {
  try {
    const due = MaintenanceRecord.getMaintenanceDue();
    res.json({ success: true, count: due.length, data: due });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET maintenance type breakdown
router.get('/types', (req, res) => {
  try {
    const breakdown = MaintenanceRecord.getTypeBreakdown();
    res.json({ success: true, data: breakdown });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET monthly costs
router.get('/costs/monthly', (req, res) => {
  try {
    const { months } = req.query;
    const costs = MaintenanceRecord.getMonthlyCosts(months ? parseInt(months) : 12);
    res.json({ success: true, data: costs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single maintenance record
router.get('/:id', (req, res) => {
  try {
    const record = MaintenanceRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Maintenance record not found' });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create maintenance record
router.post('/', (req, res) => {
  try {
    const { forklift_id, type } = req.body;

    if (!forklift_id || !type) {
      return res.status(400).json({
        success: false,
        error: 'Forklift ID and maintenance type are required'
      });
    }

    // Verify forklift exists
    const forklift = Forklift.findById(forklift_id);
    if (!forklift) {
      return res.status(404).json({ success: false, error: 'Forklift not found' });
    }

    const record = MaintenanceRecord.create(req.body);

    // Recalculate forklift risk level
    Forklift.recalculateRiskLevel(forklift_id);

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update maintenance record
router.put('/:id', (req, res) => {
  try {
    const record = MaintenanceRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Maintenance record not found' });
    }

    const updated = MaintenanceRecord.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE maintenance record
router.delete('/:id', (req, res) => {
  try {
    const record = MaintenanceRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Maintenance record not found' });
    }

    MaintenanceRecord.delete(req.params.id);
    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
