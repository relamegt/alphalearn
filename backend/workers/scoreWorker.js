// backend/workers/scoreWorker.js
// HIGH-6 FIX: BullMQ requires a dedicated Redis connection per Worker — it must NOT
// share the app's singleton Redis client used for pub/sub and caching. Sharing caused
// command interleaving errors and silently dropped jobs on Upstash (strict conn limits).
// startScoreWorker() is called AFTER initRedis() in server.js so getNewRedisClient() is safe.
const { Worker } = require('bullmq');
const Leaderboard = require('../models/Leaderboard');
const { getNewRedisClient } = require('../config/redis');

const startScoreWorker = () => {
    // Each BullMQ Worker needs its own dedicated connection — never share with pub/sub client.
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
        connection: getNewRedisClient(), // dedicated connection per BullMQ requirement
        concurrency: 5
    });

    worker.on('completed', (job) => {
        console.log(`[Worker] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error('[Worker] Worker error:', err.message);
    });

    console.log('👷 Score Recalculation Worker started');
    return worker;
};

module.exports = { startScoreWorker };
