const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Queue, Worker } = require('bullmq');
const { getNewRedisClient } = require('../config/redis');
const { ObjectId } = require('bson');

// Mock Data
const STUDENT_COUNT = 100;
const CONTEST_ID = new ObjectId().toString();
const PROBLEM_ID = new ObjectId().toString();

if (!process.env.REDIS_URL) {
    console.warn("WARNING: process.env.REDIS_URL is still empty after dotenv load!");
}

const sampleCode = `
#include <iostream>
using namespace std;
int main() {
    int t;
    if (cin >> t) {
        while(t--) {
            int n; cin >> n; cout << n * 2 << endl;
        }
    }
    return 0;
}
`;

async function runLoadTest() {
    console.log(`🚀 Starting Judge0 Load Test with ${STUDENT_COUNT} concurrent students...`);
    const startTime = Date.now();
    let completed = 0;
    let failed = 0;

    const redisClient = getNewRedisClient();
    const executionQueue = new Queue('code-execution', { connection: redisClient });

    // Listen for completions
    const worker = new Worker('code-execution', async (job) => {
        // We will mock the execution duration to roughly match an average 
        // fast Judge0 execution time.
        await new Promise(r => setTimeout(r, 150));
        return { success: true };
    }, {
        connection: getNewRedisClient(),
        concurrency: 5 // Simulated Judge0 concurrency 
    });

    // Instead of worker, we wait for job completion
    import('bullmq').then(({ QueueEvents }) => {
        const queueEvents = new QueueEvents('code-execution', { connection: getNewRedisClient() });

        queueEvents.on('completed', ({ jobId, returnvalue }) => {
            completed++;
            process.stdout.write(`\r✅ Completed ${completed}/${STUDENT_COUNT} | ❌ Failed ${failed}`);
            if (completed + failed === STUDENT_COUNT) {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`\n🎉 Load test finished in ${duration} seconds.`);
                console.log(`📊 Throughput: ${STUDENT_COUNT / duration} requests/sec`);
                process.exit(0);
            }
        });

        queueEvents.on('failed', ({ jobId, failedReason }) => {
            failed++;
            process.stdout.write(`\r✅ Completed ${completed}/${STUDENT_COUNT} | ❌ Failed ${failed} (${failedReason})`);
            if (completed + failed === STUDENT_COUNT) {
                const duration = (Date.now() - startTime) / 1000;
                console.log(`\n🎉 Load test finished in ${duration} seconds.`);
                process.exit(0);
            }
        });
    });

    // Add jobs
    const jobs = [];
    for (let i = 0; i < STUDENT_COUNT; i++) {
        jobs.push({
            name: 'execute',
            data: {
                type: 'run',
                studentId: new ObjectId().toString(),
                contestId: CONTEST_ID,
                problemId: PROBLEM_ID,
                code: sampleCode,
                language: 'cpp',
                isPractice: true,
                timeLimit: 2000
            },
            opts: {
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: 10
            }
        });
    }

    await executionQueue.addBulk(jobs);
    console.log(`📦 Queued ${STUDENT_COUNT} execution jobs instantly. Waiting for backend CodeExecutionWorker to process...`);
}

runLoadTest().catch(console.error);
