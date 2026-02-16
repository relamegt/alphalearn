const cron = require('node-cron');
const { autoSyncProfiles } = require('../services/profileSyncService');

// Cron job: Daily at 12:00 AM IST (midnight) - Fetch ALL contest data
const profileSyncJob = cron.schedule('0 0 * * *', async () => {
    console.log('🔄 Running daily profile sync job at 12:00 AM IST...');

    try {
        const result = await autoSyncProfiles();

        if (result.success) {
            console.log(`✅ Profile sync completed: ${result.syncedCount} profiles synced`);
        } else {
            console.error('❌ Profile sync failed:', result.message);
        }
    } catch (error) {
        console.error('❌ Profile sync job error:', error);
    }
}, {
    timezone: "Asia/Kolkata"
});

// Start the cron job
const startProfileSyncJob = () => {
    profileSyncJob.start();
    console.log('✅ Profile sync cron job started (Daily at 12:00 AM IST)');
};

// Stop the cron job
const stopProfileSyncJob = () => {
    profileSyncJob.stop();
    console.log('⛔ Profile sync cron job stopped');
};

module.exports = {
    profileSyncJob,
    startProfileSyncJob,
    stopProfileSyncJob
};
