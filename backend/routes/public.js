const express = require('express');
const router = express.Router();
const User = require('../models/User');
const publicController = require('../controllers/publicController');
const { optionalAuth } = require('../middleware/auth');

// Get public stats for homepage (no auth required)
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await User.getTotalUsersCount();

        res.json({
            success: true,
            stats: {
                totalUsersEverCreated: totalUsers
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stats'
        });
    }
});

// Get user public profile
router.get('/profile/:username', optionalAuth, publicController.getPublicProfile);

// Check if username exists
router.get('/check-username/:username', publicController.checkUsername);

module.exports = router;
