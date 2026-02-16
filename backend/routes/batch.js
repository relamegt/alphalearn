const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { verifyToken } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get batch details by ID
router.get('/:batchId', batchController.getBatchById);

module.exports = router;
