// backend/config/queue.js
// BUG #1 FIX: Do NOT call getRedis() at module-load time.
// queue.js is required by scoreWorker.js which is required by server.js BEFORE
// initRedis() is ever called on line 143 of server.js. Calling getRedis() here
// would create a premature second Redis connection that BullMQ's Queue and Worker
// would each hold separately, causing connection pool exhaustion and silent job drops.
// Solution: Create the Queue lazily inside addScoreJob() so Redis is guaranteed
// to be initialized before the Queue is first used.

const { Queue } = require('bullmq');
const { getRedis } = require('./redis');

let scoreQueue = null;

// Lazily initialize the queue (only on first use, after Redis is ready)
const getScoreQueue = () => {
    if (!scoreQueue) {
        scoreQueue = new Queue('score-recalculation', {
            connection: getRedis()
        });
    }
    return scoreQueue;
};

const addScoreJob = async (studentId) => {
    try {
        await getScoreQueue().add('recalculate', { studentId }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            },
            removeOnComplete: true,
            removeOnFail: 100 // Keep last 100 failed jobs
        });
        console.log(`[Queue] Added score recalculation job for user: ${studentId}`);
    } catch (error) {
        console.error('[Queue] Failed to add job:', error);
    }
};

module.exports = {
    getScoreQueue,
    addScoreJob
};
