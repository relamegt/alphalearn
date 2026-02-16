const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class UserStats {
    // Initialize stats (run once on first deployment)
    static async initialize() {
        try {
            const existingStats = await collections.userStats.findOne({ _id: 'platform_stats' });
            if (!existingStats) {
                await collections.userStats.insertOne({
                    _id: 'platform_stats',
                    totalUsersEverCreated: 0,
                    createdAt: new Date(),
                    lastUpdated: new Date()
                });
                console.log('✅ UserStats initialized');
            }
        } catch (error) {
            console.error('UserStats initialization error:', error);
        }
    }

    // Increment total users count (called when user is created)
    static async incrementTotalUsers() {
        try {
            await collections.userStats.updateOne(
                { _id: 'platform_stats' },
                {
                    $inc: { totalUsersEverCreated: 1 },
                    $set: { lastUpdated: new Date() }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Increment total users error:', error);
        }
    }

    // Get total users ever created (for homepage)
    static async getTotalUsersCount() {
        try {
            const stats = await collections.userStats.findOne({ _id: 'platform_stats' });
            return stats?.totalUsersEverCreated || 0;
        } catch (error) {
            console.error('Get total users count error:', error);
            return 0;
        }
    }
}

module.exports = UserStats;
