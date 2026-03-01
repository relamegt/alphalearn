// backend/config/queue.js
// BUG #1 FIX: Do NOT call getRedis() at module-load time.
// queue.js is required by scoreWorker.js which is required by server.js BEFORE
// initRedis() is ever called on line 143 of server.js. Calling getRedis() here
// would create a premature second Redis connection that BullMQ's Queue and Worker
// would each hold separately, causing connection pool exhaustion and silent job drops.
// Solution: Create the Queue lazily inside addScoreJob() so Redis is guaranteed
// to be initialized before the Queue is first used.

const { Queue } = require('bullmq');
const { getNewRedisClient } = require('./redis');

let scoreQueue = null;
let executionQueue = null;

// Lazily initialize the queue (only on first use, after Redis is ready)
const getScoreQueue = () => {
    if (!scoreQueue) {
        scoreQueue = new Queue('score-recalculation', {
            // HIGH-6 FIX: dedicated connection — BullMQ Queue must not share the app's
            // singleton Redis client (which is used for pub/sub, caching, locking).
            connection: getNewRedisClient()
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

const getExecutionQueue = () => {
    if (!executionQueue) {
        executionQueue = new Queue('code-execution', {
            connection: getNewRedisClient()
        });
    }
    return executionQueue;
};

const addExecutionJob = async (jobData) => {
    try {
        await getExecutionQueue().add('execute', jobData, {
            attempts: 1, // Don't retry code executions automatically, let user retry
            removeOnComplete: true,
            removeOnFail: 100
        });
        console.log(`[Queue] Added execution job for user: ${jobData.studentId}, problem: ${jobData.problemId}`);
    } catch (error) {
        console.error('[Queue] Failed to add execution job:', error);
    }
};

module.exports = {
    getScoreQueue,
    addScoreJob,
    getExecutionQueue,
    addExecutionJob
};
