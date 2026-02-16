const cron = require('node-cron');
const Batch = require('../models/Batch');
const User = require('../models/User');
const { sendBatchExpiryWarning } = require('../services/emailService');

// Cron job: Daily at 2:00 AM IST
const batchExpiryJob = cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Running batch expiry job at 2:00 AM IST...');

    try {
        const today = new Date();

        // Check for batches expiring today (hard delete)
        const expiredBatches = await Batch.findExpiredBatches();

        for (const batch of expiredBatches) {
            console.log(`⚠️ Deleting expired batch: ${batch.name}`);

            // Hard delete cascade
            const result = await Batch.deleteWithCascade(batch._id);

            console.log(`✅ Batch deleted: ${batch.name}, Students deleted: ${result.studentCount}`);
        }

        // Check for batches expiring in 7 days (send warning)
        const expiringBatches = await Batch.findExpiringBatches();

        for (const batch of expiringBatches) {
            console.log(`⚠️ Batch expiring soon: ${batch.name}, Expiry: ${batch.deleteOn}`);

            // Get admin and instructor emails
            const admins = await User.findByRole('admin');
            const instructors = await User.findByRole('instructor');

            const adminEmails = admins.map(a => a.email);
            const instructorEmails = instructors.map(i => i.email);

            // Send warning email
            await sendBatchExpiryWarning(
                adminEmails,
                instructorEmails,
                batch.name,
                batch.deleteOn,
                batch.studentCount
            );

            console.log(`📧 Expiry warning sent for batch: ${batch.name}`);
        }

        console.log('✅ Batch expiry job completed successfully');
    } catch (error) {
        console.error('❌ Batch expiry job error:', error);
    }
}, {
    timezone: "Asia/Kolkata"
});

// Start the cron job
const startBatchExpiryJob = () => {
    batchExpiryJob.start();
    console.log('✅ Batch expiry cron job started (Daily at 2:00 AM IST)');
};

// Stop the cron job
const stopBatchExpiryJob = () => {
    batchExpiryJob.stop();
    console.log('⛔ Batch expiry cron job stopped');
};

module.exports = {
    batchExpiryJob,
    startBatchExpiryJob,
    stopBatchExpiryJob
};
