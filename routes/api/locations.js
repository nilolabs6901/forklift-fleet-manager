const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const Forklift = require('../../models/Forklift');

// GET all locations
router.get('/', (req, res) => {
  try {
    const locations = Location.findAll();
    res.json({ success: true, count: locations.length, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET location stats
router.get('/stats', (req, res) => {
  try {
    const stats = Location.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single location
router.get('/:id', (req, res) => {
  try {
    const location = Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET forklifts at location
router.get('/:id/forklifts', (req, res) => {
  try {
    const forklifts = Forklift.getByLocation(req.params.id);
    res.json({ success: true, count: forklifts.length, data: forklifts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create location
router.post('/', (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Location name is required' });
    }

    // Check for duplicate
    const existing = Location.findByName(name);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Location name already exists' });
    }

    const location = Location.create(req.body);
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update location
router.put('/:id', (req, res) => {
  try {
    const location = Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    const updated = Location.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE location
router.delete('/:id', (req, res) => {
  try {
    const location = Location.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    // Check if location has forklifts
    const forklifts = Forklift.getByLocation(req.params.id);
    if (forklifts.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete location with assigned forklifts'
      });
    }

    Location.delete(req.params.id);
    res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
