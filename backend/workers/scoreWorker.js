// backend/workers/scoreWorker.js
// BUG #1 FIX (continued): Worker also gets its Redis connection lazily via getRedis()
// which is safe here because startScoreWorker() is called AFTER initRedis() in server.js.
const { Worker } = require('bullmq');
const Leaderboard = require('../models/Leaderboard');
const { getRedis } = require('../config/redis');

const startScoreWorker = () => {
    const worker = new Worker('score-recalculation', async (job) => {
        const { studentId } = job.data;
        console.log(`[Worker] Processing score recalculation for: ${studentId}`);

        try {
            await Leaderboard.recalculateScores(studentId);
            console.log(`[Worker] Successfully recalculated scores for: ${studentId}`);
        } catch (error) {
            console.error(`[Worker] Error recalculating scores for ${studentId}:`, error);
            throw error; // Let BullMQ handle retry
        }
    }, {
        connection: getRedis(),
        concurrency: 5 // Increased to 5 for better throughput while monitoring Redis limits
    });

    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job.id} failed:`, err);
    });

    console.log('👷 Score Recalculation Worker started');
    return worker;
};

module.exports = { startScoreWorker };
