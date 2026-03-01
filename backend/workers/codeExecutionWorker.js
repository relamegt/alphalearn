// backend/workers/codeExecutionWorker.js
const { Worker } = require('bullmq');
const { getNewRedisClient, getRedis } = require('../config/redis');
const Problem = require('../models/Problem');
const ContestSubmission = require('../models/ContestSubmission');
const { executeWithTestCases } = require('../services/judge0Service'); // Note: previously imported from pistonService indirectly in contestController
const { notifyLeaderboardUpdate, notifySubmission, notifyExecutionResult } = require('../config/websocket');

const startCodeExecutionWorker = () => {
    const worker = new Worker('code-execution', async (job) => {
        const data = job.data;
        console.log(`[Worker] Started ${data.type} execution for: ${data.studentId}, problem: ${data.problemId}`);

        try {
            let testCases = await Problem.getAllTestCases(data.problemId);

            if (data.type === 'run') {
                // Strictly ONLY expose non-hidden (sample) test cases
                testCases = testCases.filter(tc => !tc.isHidden);
            }

            // Execute code
            const result = await executeWithTestCases(data.language, data.code, testCases, data.timeLimit);

            if (data.type === 'run') {
                const runResult = {
                    isRun: true,
                    success: true,
                    message: 'Code executed successfully',
                    results: result.results.map(r => ({
                        input: r.input,
                        expectedOutput: r.expectedOutput,
                        actualOutput: r.actualOutput,
                        passed: r.passed,
                        verdict: r.verdict,
                        error: r.error,
                        isHidden: r.isHidden
                    }))
                };

                notifyExecutionResult(data.contestId, data.studentId, runResult);
                return runResult;
            }

            // If it's a practice submission
            if (data.type === 'submit' && data.isPractice) {
                const practiceResult = {
                    success: true,
                    isPractice: true,
                    message: result.verdict === 'Accepted' ? 'Practice submission passed!' : 'Practice submission completed',
                    submission: {
                        _id: 'temporary-practice-id',
                        verdict: result.verdict,
                        testCasesPassed: result.testCasesPassed,
                        totalTestCases: result.totalTestCases,
                        submittedAt: new Date(),
                        tabSwitchCount: 0,
                        tabSwitchDuration: 0,
                        pasteAttempts: 0,
                        fullscreenExits: 0
                    },
                    results: result.results.map(r => {
                        if (r.isHidden) {
                            return { passed: r.passed, isHidden: true, verdict: r.verdict };
                        }
                        return {
                            input: r.input,
                            expectedOutput: r.expectedOutput,
                            actualOutput: r.actualOutput,
                            passed: r.passed,
                            isHidden: false,
                            verdict: r.verdict,
                            error: r.error
                        };
                    })
                };

                notifyExecutionResult(data.contestId, data.studentId, practiceResult);
                return practiceResult;
            }

            // Normal Contest Submission Flow
            const submission = await ContestSubmission.create({
                contestId: data.contestId,
                studentId: data.studentId,
                problemId: data.problemId,
                code: data.code,
                language: data.language,
                verdict: result.verdict,
                testCasesPassed: result.testCasesPassed,
                totalTestCases: result.totalTestCases,
                tabSwitchCount: data.tabSwitchCount || 0,
                tabSwitchDuration: data.tabSwitchDuration || 0,
                pasteAttempts: data.pasteAttempts || 0,
                fullscreenExits: data.fullscreenExits || 0,
                isAutoSubmit: data.isAutoSubmit || false
            });

            const finalResult = {
                success: true,
                message: data.isAutoSubmit
                    ? 'Code auto-submitted due to violations'
                    : result.verdict === 'Accepted'
                        ? 'Problem solved! Submission locked.'
                        : 'Code submitted successfully',
                submission: {
                    id: submission._id,
                    verdict: submission.verdict,
                    testCasesPassed: submission.testCasesPassed,
                    totalTestCases: submission.totalTestCases,
                    submittedAt: submission.submittedAt,
                    isAutoSubmit: data.isAutoSubmit,
                    problemLocked: result.verdict === 'Accepted'
                },
                results: result.results.map(r => {
                    // Send minimal payload for hidden test cases
                    if (r.isHidden) {
                        return { passed: r.passed, isHidden: true, verdict: r.verdict };
                    }
                    return {
                        input: r.input,
                        expectedOutput: r.expectedOutput,
                        actualOutput: r.actualOutput,
                        passed: r.passed,
                        isHidden: false,
                        verdict: r.verdict,
                        error: r.error
                    };
                })
            };

            // Broadcast updates
            try {
                await ContestSubmission.invalidateCache(data.contestId);
                notifyLeaderboardUpdate(data.contestId);

                notifySubmission(data.contestId, {
                    studentId: data.studentId,
                    problemId: data.problemId,
                    verdict: result.verdict,
                    timestamp: submission.submittedAt,
                    isAutoSubmit: data.isAutoSubmit
                });

                notifyExecutionResult(data.contestId, data.studentId, finalResult);
            } catch (wsError) {
                console.error('[Worker] WebSocket notification error:', wsError);
            }

            return finalResult;
        } catch (error) {
            console.error(`[Worker] Error executing code for ${data.studentId}:`, error);

            // Send error result
            notifyExecutionResult(data.contestId, data.studentId, {
                success: false,
                isError: true,
                message: error.message || 'Execution failed'
            });
            throw error;
        } finally {
            // Remove Redis lock
            if (data.type === 'submit' && !data.isPractice) {
                const redis = getRedis();
                const lockKey = `lock:submission:${data.studentId}:${data.problemId}`;
                await redis.del(lockKey).catch(e => console.error(e));
            }
        }
    }, {
        connection: getNewRedisClient(),
        concurrency: 5 // Maintain piston API limit (5 req/sec is typical, 5 concurrency ensures safety)
    });

    worker.on('completed', (job) => {
        console.log(`[Worker] Execution Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Execution Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error('[Worker] Execution Worker error:', err.message);
    });

    console.log('👷 Code Execution Worker started (Concurrency: 5)');
    return worker;
};

module.exports = { startCodeExecutionWorker };
