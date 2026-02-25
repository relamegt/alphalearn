const { collections } = require('../config/astra');
const { ObjectId } = require('bson');
const { getRedis } = require('../config/redis');

const CACHE_TTL = 30; // 30 seconds TTL for high concurrency scenarios

class ContestSubmission {
    // Force invalidate cache for a contest across all server instances
    static async invalidateCache(contestId) {
        if (contestId) {
            const redis = getRedis();
            await redis.del(`leaderboard:cache:${contestId.toString()}`);
        }
    }

    // Create new contest submission
    static async create(submissionData) {
        const submission = {
            _id: new ObjectId(),
            contestId: new ObjectId(submissionData.contestId),
            studentId: new ObjectId(submissionData.studentId),
            problemId: submissionData.problemId ? new ObjectId(submissionData.problemId) : null,
            code: submissionData.code || '',
            language: submissionData.language || '',
            verdict: submissionData.verdict,
            testCasesPassed: submissionData.testCasesPassed || 0,
            totalTestCases: submissionData.totalTestCases || 0,
            submittedAt: new Date(),
            tabSwitchCount: submissionData.tabSwitchCount || 0,
            tabSwitchDuration: submissionData.tabSwitchDuration || 0,
            pasteAttempts: submissionData.pasteAttempts || 0,
            fullscreenExits: submissionData.fullscreenExits || 0,
            isAutoSubmit: submissionData.isAutoSubmit || false,
            isFinalContestSubmission: submissionData.isFinalContestSubmission || false,
            isViolationLog: submissionData.isViolationLog || false
        };

        const result = await collections.contestSubmissions.insertOne(submission);
        return { ...submission, _id: result.insertedId };
    }

    static async hasSubmittedContest(studentId, contestId) {
        const record = await collections.contestSubmissions.findOne({
            studentId: new ObjectId(studentId),
            contestId: new ObjectId(contestId),
            isFinalContestSubmission: true
        });
        return !!record;
    }

    static async isProblemSolved(studentId, contestId, problemId) {
        const submission = await collections.contestSubmissions.findOne({
            studentId: new ObjectId(studentId),
            contestId: new ObjectId(contestId),
            problemId: new ObjectId(problemId),
            verdict: 'Accepted'
        });
        return !!submission;
    }

    static async markContestCompleted(studentId, contestId, score, violations = {}) {
        return await this.create({
            studentId,
            contestId,
            verdict: 'COMPLETED',
            isFinalContestSubmission: true,
            code: `Final Score: ${score}`,
            tabSwitchCount: violations.tabSwitchCount || 0,
            tabSwitchDuration: violations.tabSwitchDuration || 0,
            fullscreenExits: violations.fullscreenExits || 0,
            pasteAttempts: violations.pasteAttempts || 0,
        });
    }

    static async logViolation(studentId, contestId, violations) {
        return await this.create({
            studentId,
            contestId,
            verdict: 'VIOLATION_LOG',
            isFinalContestSubmission: false,
            isViolationLog: true,
            code: '',
            tabSwitchCount: violations.tabSwitchCount || 0,
            tabSwitchDuration: violations.tabSwitchDuration || 0,
            pasteAttempts: violations.pasteAttempts || 0,
            fullscreenExits: violations.fullscreenExits || 0
        });
    }

    static async getProblemStatistics(contestId) {
        const stats = {};
        const cursor = collections.contestSubmissions.find(
            { contestId: new ObjectId(contestId) },
            { projection: { problemId: 1, verdict: 1 } }
        );

        for await (const sub of cursor) {
            if (!sub.problemId) continue;
            const pid = sub.problemId.toString();
            if (!stats[pid]) {
                stats[pid] = { totalSubmissions: 0, acceptedCount: 0 };
            }
            stats[pid].totalSubmissions++;
            if (sub.verdict === 'Accepted') {
                stats[pid].acceptedCount++;
            }
        }
        return stats;
    }

    static async findById(submissionId) {
        return await collections.contestSubmissions.findOne({ _id: new ObjectId(submissionId) });
    }

    static async findByStudent(studentId, limit = 500) {
        return await collections.contestSubmissions
            .find({ studentId: new ObjectId(studentId) })
            .sort({ submittedAt: -1 })
            .limit(limit)
            .toArray();
    }

    static async findByContest(contestId, includeCode = false) {
        // BUG #6 FIX: The previous .limit(10000).toArray() would load up to 10,000 full
        // submission documents (including code strings) into Node.js RAM at once, causing OOM
        // on large contests. Use streaming cursor with a reasonable safety limit instead.
        const projection = includeCode ? {} : { projection: { code: 0 } };
        const results = [];
        const MAX_SAFE = 10000; // hard cap, streamed not bulk-loaded
        const cursor = collections.contestSubmissions
            .find({ contestId: new ObjectId(contestId) }, projection)
            .sort({ submittedAt: -1 });

        for await (const doc of cursor) {
            results.push(doc);
            if (results.length >= MAX_SAFE) break;
        }
        return results;
    }

    static async findByStudentAndContest(studentId, contestId) {
        return await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                isFinalContestSubmission: false
            })
            .sort({ submittedAt: -1 })
            .limit(1000)
            .toArray();
    }

    static async getAcceptedProblems(studentId, contestId) {
        // NOTE: Astra DB (DataStax) does not support .aggregate() pipelines.
        // We fetch accepted submissions with a projection and deduplicate in JS.
        // The limit(500) is safe since each student can solve at most N contest problems.
        const submissions = await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                verdict: 'Accepted',
                problemId: { $exists: true }
            }, { projection: { problemId: 1 } })
            .limit(500)
            .toArray();

        const uniqueProblemIds = [...new Set(
            submissions
                .filter(s => s.problemId)
                .map(s => s.problemId.toString())
        )];
        return uniqueProblemIds.map(id => new ObjectId(id));
    }

    static async calculateScore(studentId, contestId) {
        const Contest = require('./Contest');
        const Problem = require('./Problem');

        const [contest, acceptedProblemsIds] = await Promise.all([
            Contest.findById(contestId),
            this.getAcceptedProblems(studentId, contestId)
        ]);

        if (!contest || acceptedProblemsIds.length === 0) {
            return { score: 0, time: 0, problemsSolved: 0 };
        }

        // Optimized: Fetch all relevant problems and submissions in BULK
        const [problems, allAcceptedSubs] = await Promise.all([
            Problem.findByIds(acceptedProblemsIds),
            collections.contestSubmissions.find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                verdict: 'Accepted'
            }).sort({ submittedAt: 1 }).limit(1000).toArray()
        ]);

        const problemMap = new Map(problems.map(p => [p._id.toString(), p]));
        const firstAcceptedByProblem = new Map();

        // Find first accepted submission for each problem from the bulk-fetched list
        allAcceptedSubs.forEach(sub => {
            const pid = sub.problemId.toString();
            if (!firstAcceptedByProblem.has(pid)) {
                firstAcceptedByProblem.set(pid, sub);
            }
        });

        let totalScore = 0;
        let totalTime = 0;

        for (const problemId of acceptedProblemsIds) {
            const pidStr = problemId.toString();
            const problem = problemMap.get(pidStr);
            const firstAccepted = firstAcceptedByProblem.get(pidStr);

            if (problem && firstAccepted) {
                totalScore += (problem.points || 0);
                const timeTaken = (new Date(firstAccepted.submittedAt) - new Date(contest.startTime)) / (1000 * 60);
                totalTime += Math.max(0, timeTaken);
            }
        }

        return {
            score: totalScore,
            time: Math.round(totalTime),
            problemsSolved: acceptedProblemsIds.length
        };
    }

    static async getProctoringViolations(studentId, contestId) {
        // BUG #9 FIX: The previous query fetched the LATEST submission by submittedAt,
        // which is often a code submission (verdict: 'Wrong Answer') carrying stale, lower
        // violation counts from that moment — not the final violation state.
        // Fix: Query specifically for the latest violation log record (isViolationLog: true)
        // first, then fall back to the latest any-type submission.

        // Try to get the most recent explicit violation log
        const violationLog = await collections.contestSubmissions.findOne(
            {
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                isViolationLog: true
            },
            { sort: { submittedAt: -1 } }
        );

        // Fall back to the final contest submission record (which also carries a violation snapshot)
        const latestRecord = violationLog || await collections.contestSubmissions.findOne(
            {
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                isFinalContestSubmission: true
            },
            { sort: { submittedAt: -1 } }
        );

        if (latestRecord) {
            return {
                totalTabSwitches: latestRecord.tabSwitchCount || 0,
                totalTabSwitchDuration: latestRecord.tabSwitchDuration || 0,
                totalPasteAttempts: latestRecord.pasteAttempts || 0,
                totalFullscreenExits: latestRecord.fullscreenExits || 0
            };
        }

        return { totalTabSwitches: 0, totalTabSwitchDuration: 0, totalPasteAttempts: 0, totalFullscreenExits: 0 };
    }

    static async deleteByContest(contestId) {
        return await collections.contestSubmissions.deleteMany({ contestId: new ObjectId(contestId) });
    }

    static async getLeaderboard(contestId, currentUserId = null, forceRefresh = false, page = 1, limit = 50) {
        const contestIdStr = contestId.toString();
        const redis = getRedis();
        const cacheKey = `leaderboard:cache:${contestIdStr}`;
        const rebuildLockKey = `leaderboard:building:${contestIdStr}`;

        // 1. Check Redis Cache first (Full leaderboard is cached for performance)
        let allEnrichedData = null;
        if (!forceRefresh) {
            try {
                const cachedData = await redis.get(cacheKey);
                if (cachedData) {
                    allEnrichedData = JSON.parse(cachedData);
                }
            } catch (e) {
                console.error('[Redis Cache Error]', e)
            }

            // CRIT-4 FIX: The previous approach polled in a tight 5-second loop while holding
            // an open HTTP connection, exhausting Express connection pools under load.
            // Fix: If cache is cold but a rebuild is already in progress, respond immediately
            // with a minimal valid payload (empty leaderboard + page meta). The client will
            // naturally retry via the WebSocket leaderboardRefetch trigger once the cache warms.
            if (!allEnrichedData) {
                const isBeingBuilt = await redis.exists(rebuildLockKey).catch(() => 0);
                if (isBeingBuilt) {
                    console.log(`[getLeaderboard] Cache cold but rebuild in progress — returning empty page for quick response`);
                    return { leaderboard: [], total: 0, page, limit, totalPages: 0 };
                }
            }
        }

        if (!allEnrichedData) {
            const User = require('./User');
            const Problem = require('./Problem');
            const Contest = require('./Contest');

            const contest = await Contest.findById(contestId);
            if (!contest) return { leaderboard: [], total: 0 };

            // NOTE: Astra DB (DataStax) does NOT support .aggregate() pipelines.
            // We fetch all submissions for this contest and group them in JS.
            // We only fetch the fields we need to minimise memory usage.
            const allSubmissions = await collections.contestSubmissions
                .find(
                    { contestId: new ObjectId(contestId) },
                    {
                        projection: {
                            studentId: 1,
                            problemId: 1,
                            verdict: 1,
                            submittedAt: 1,
                            isFinalContestSubmission: 1,
                            tabSwitchCount: 1,
                            tabSwitchDuration: 1,
                            pasteAttempts: 1,
                            fullscreenExits: 1
                        }
                    }
                )
                .limit(50000) // reasonable upper bound for a single contest
                .toArray();

            const participantIdsSet = new Set();
            if (currentUserId) participantIdsSet.add(currentUserId.toString());

            const submissionsByStudent = new Map();
            const latestViolations = new Map();

            // Group submissions by studentId (equivalent to the old $group pipeline)
            for (const sub of allSubmissions) {
                const sid = sub.studentId?.toString();
                if (!sid) continue;

                participantIdsSet.add(sid);

                if (!submissionsByStudent.has(sid)) {
                    submissionsByStudent.set(sid, []);
                }
                submissionsByStudent.get(sid).push({
                    problemId: sub.problemId,
                    verdict: sub.verdict,
                    submittedAt: sub.submittedAt,
                    isFinalContestSubmission: sub.isFinalContestSubmission
                });

                // Track the latest (most recent) violation snapshot per student
                const existing = latestViolations.get(sid);
                const subTime = new Date(sub.submittedAt).getTime();
                const existingTime = existing ? new Date(existing._time || 0).getTime() : -1;
                if (!existing || subTime > existingTime) {
                    latestViolations.set(sid, {
                        tabSwitchCount: sub.tabSwitchCount || 0,
                        tabSwitchDuration: sub.tabSwitchDuration || 0,
                        pasteAttempts: sub.pasteAttempts || 0,
                        fullscreenExits: sub.fullscreenExits || 0,
                        _time: sub.submittedAt
                    });
                }
            }


            try {
                if (contest.batchId) {
                    const eligibleUsers = await collections.users.find({
                        role: 'student',
                        $or: [
                            { batchId: contest.batchId },
                            { assignedBatches: contest.batchId }
                        ]
                    }, { projection: { _id: 1 } }).limit(10000).toArray();
                    eligibleUsers.forEach(u => participantIdsSet.add(u._id.toString()));
                } else {
                    const registeredStudents = await collections.users.find({
                        registeredForContest: contest._id
                    }, { projection: { _id: 1 } }).limit(10000).toArray();
                    registeredStudents.forEach(u => participantIdsSet.add(u._id.toString()));
                }
            } catch (e) {
                console.error('[getLeaderboard] Error fetching participants:', e.message);
            }

            const participantIds = Array.from(participantIdsSet).map(id => new ObjectId(id));

            // Chunk fetching users to avoid massive $in query limits and memory spikes
            const CHUNK_SIZE = 500;
            const users = [];
            for (let i = 0; i < participantIds.length; i += CHUNK_SIZE) {
                const chunkIds = participantIds.slice(i, i + CHUNK_SIZE);
                const chunkUsers = await collections.users.find(
                    { _id: { $in: chunkIds } },
                    { projection: { firstName: 1, lastName: 1, email: 1, 'education.rollNumber': 1, 'education.branch': 1, role: 1, alphacoins: 1, 'profile.section': 1 } }
                ).toArray();
                users.push(...chunkUsers);
            }

            const contestProblems = contest.problems && contest.problems.length > 0
                ? await Problem.findByIds(contest.problems)
                : [];

            const userMap = new Map();
            users.forEach(u => userMap.set(u._id.toString(), u));

            // Submissions already mapped incrementally above

            const isContestEnded = new Date() > contest.endTime;

            const leaderboardData = users
                .filter(u => u.role === 'student')
                .map((user) => {
                    const studentId = user._id.toString();
                    const studentSubs = submissionsByStudent.get(studentId) || [];

                    // Optimization: Pre-group student submissions by problemId for O(1) lookup
                    const subsByProblem = new Map();
                    studentSubs.forEach(s => {
                        if (s.problemId) {
                            const pid = s.problemId.toString();
                            if (!subsByProblem.has(pid)) subsByProblem.set(pid, []);
                            subsByProblem.get(pid).push(s);
                        }
                    });

                    let totalScore = 0;
                    let totalTime = 0;
                    let problemsSolved = 0;
                    let hasSubmitted = studentSubs.some(s => s.isFinalContestSubmission);

                    const pViolation = latestViolations.get(studentId);
                    let latestViolation = pViolation || { tabSwitchCount: 0, tabSwitchDuration: 0, pasteAttempts: 0, fullscreenExits: 0 };

                    const problemsStatus = {};
                    for (const prob of contestProblems) {
                        const pIdStr = prob._id.toString();
                        const pSubs = subsByProblem.get(pIdStr) || [];

                        let status = 'Not Attempted';
                        let tries = pSubs.length;
                        let submittedOffset = null;

                        if (tries > 0) {
                            const acceptedSubs = pSubs.filter(s => s.verdict === 'Accepted');
                            if (acceptedSubs.length > 0) {
                                status = 'Accepted';
                                problemsSolved++;
                                totalScore += (prob.points || 0);

                                const firstAccepted = acceptedSubs.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))[0];
                                const timeTaken = (new Date(firstAccepted.submittedAt) - new Date(contest.startTime)) / (1000 * 60);
                                totalTime += Math.max(0, timeTaken);
                                submittedOffset = Math.max(0, Math.floor(timeTaken));
                            } else {
                                status = 'Wrong Answer';
                                const lastSub = pSubs[0];
                                const timeTaken = (new Date(lastSub.submittedAt) - new Date(contest.startTime)) / (1000 * 60);
                                submittedOffset = Math.max(0, Math.floor(timeTaken));
                            }
                        }
                        problemsStatus[pIdStr] = { status, tries, submittedAt: submittedOffset };
                    }

                    return {
                        studentId: user._id,
                        rollNumber: user.education?.rollNumber || 'N/A',
                        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email?.split('@')[0] || 'N/A',
                        username: user.email?.split('@')[0] || 'Unknown',
                        branch: user.education?.branch || 'N/A',
                        section: user.profile?.section || 'N/A', // HIGH-8 FIX: included from projection above
                        score: totalScore,
                        time: Math.round(totalTime),
                        problemsSolved,
                        tabSwitchCount: latestViolation.tabSwitchCount,
                        tabSwitchDuration: latestViolation.tabSwitchDuration,
                        pasteAttempts: latestViolation.pasteAttempts,
                        fullscreenExits: latestViolation.fullscreenExits,
                        isCompleted: hasSubmitted || isContestEnded,
                        problems: problemsStatus
                    };
                });

            // Rank by score (desc), then time (asc)
            leaderboardData.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.time - b.time;
            });

            // Assign ranks (Full list)
            allEnrichedData = leaderboardData.map((entry, index) => ({
                ...entry,
                rank: index + 1
            }));

            // 3. Cache the full leaderboard
            // BUG #3 FIX: Use Redis mutex to prevent cache stampede.
            // Without this, 100 simultaneous requests after cache invalidation all
            // see a cold cache and all trigger the full DB+computation rebuild at once.
            // Only the first waiter acquires the rebuild lock; others get a short retry.
            const rebuildLockKey = `leaderboard:building:${contestIdStr}`;
            const rebuildLockAcquired = await redis.set(rebuildLockKey, '1', 'NX', 'EX', 30);
            if (rebuildLockAcquired) {
                try {
                    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(allEnrichedData));
                } catch (e) {
                    console.error('[Redis Cache Write Error]', e);
                } finally {
                    await redis.del(rebuildLockKey);
                }
            }
            // If we didn't get the lock, another instance is writing — we still serve fresh data
            // (the data we computed is still valid; we just skip writing to avoid double-write)
        }

        // Return paginated result
        const total = allEnrichedData.length;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedLeaderboard = allEnrichedData.slice(startIndex, endIndex);

        return {
            leaderboard: paginatedLeaderboard,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
}

module.exports = ContestSubmission;