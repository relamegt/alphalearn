const express = require('express');
const router = express.Router();
const UserStats = require('../models/UserStats');

// Get public stats for homepage (no auth required)
router.get('/stats', async (req, res) => {
    try {
        const totalUsers = await UserStats.getTotalUsersCount();

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

module.exports = router;
