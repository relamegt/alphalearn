const Leaderboard = require('../models/Leaderboard');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const Contest = require('../models/Contest');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Problem = require('../models/Problem');
const { collections } = require('../config/astra');
const { ObjectId } = require('bson');
const { getRedis } = require('../config/redis');

const BATCH_LB_CACHE_TTL = 60; // 60s — fresh enough for a live session


// Get FULL batch leaderboard (NO FILTERS)
const getBatchLeaderboard = async (req, res) => {
    try {
        const { batchId } = req.params;
        const redis = getRedis();
        const cacheKey = `cache:batchlb:${batchId}`;

        // CRIT-2 FIX: Cache the computed leaderboard in Redis (60s TTL).
        // Building this from scratch for 1000 students is expensive; cache prevents
        // every page-open from triggering a full recompute.
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return res.json(JSON.parse(cached));
            }
        } catch (e) { /* proceed without cache on Redis error */ }

        // Get practice leaderboard entries (only students with practice submissions)
        const leaderboard = await Leaderboard.getBatchLeaderboard(batchId);

        // Fetch ONLY contests for this specific batch
        const allContests = await Contest.findByBatchId(batchId);
        allContests.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        const batchContestIds = new Set(allContests.map(c => c._id.toString()));

        // FIXED: Get ALL students in batch — not just those with practice submissions
        const allBatchStudents = await User.getStudentsByBatch(batchId);

        // Build lookup map: studentId -> leaderboard entry
        const leaderboardMap = new Map();
        leaderboard.forEach(entry => leaderboardMap.set(entry.studentId.toString(), entry));

        // Pre-fetch ALL external profiles for this batch to avoid N+1 queries
        const externalProfiles = await ExternalProfile.getBatchExternalStats(batchId);
        const externalProfilesMap = new Map();
        externalProfiles.forEach(p => {
            const sid = p.studentId.toString();
            if (!externalProfilesMap.has(sid)) externalProfilesMap.set(sid, []);
            externalProfilesMap.get(sid).push(p);
        });

        // Compute the actual leaderboard scores for all contests in this batch using a single bulk query
        const contestScoresByStudent = new Map(); // studentId -> Map(contestId -> score)

        // 3. Bulk fetch ALL submissions and problems for all contests in this batch
        const batchContestIdsArray = Array.from(batchContestIds).map(id => new ObjectId(id));

        // Stream submissions via async cursor instead of .toArray() to avoid RAM exhaustion
        // for large batches with many submissions.
        const submissionsCursor = collections.contestSubmissions.find({
            contestId: { $in: batchContestIdsArray }
        }, { projection: { studentId: 1, contestId: 1, verdict: 1, problemId: 1, submittedAt: 1 } });

        const allContestProblems = await collections.problems.find({
            contestId: { $in: batchContestIdsArray }
        }, { projection: { _id: 1, points: 1, contestId: 1 } }).toArray();

        const problemPointsMap = new Map();
        allContestProblems.forEach(p => problemPointsMap.set(p._id.toString(), p.points || 0));

        // Organize submissions by student and contest, and calculate scores in-memory
        const acceptedByStudentContest = new Map();

        for await (const sub of submissionsCursor) {
            if (sub.verdict === 'Accepted' && sub.problemId) {
                const sid = sub.studentId.toString();
                const cid = sub.contestId.toString();
                const pid = sub.problemId.toString();
                const key = `${sid}_${cid}_${pid}`;
                const subDate = new Date(sub.submittedAt).getTime();

                if (!acceptedByStudentContest.has(key) || subDate < acceptedByStudentContest.get(key)) {
                    acceptedByStudentContest.set(key, subDate);
                }
            }
        }

        // Sum up the points for each student per contest
        acceptedByStudentContest.forEach((_, key) => {
            const [sid, cid, pid] = key.split('_');
            const points = problemPointsMap.get(pid) || 0;

            if (!contestScoresByStudent.has(sid)) {
                contestScoresByStudent.set(sid, new Map());
            }
            const studentMap = contestScoresByStudent.get(sid);
            studentMap.set(cid, (studentMap.get(cid) || 0) + points);
        });

        // CRIT-2 FIX: Process students in chunks of 50 instead of Promise.all on all 1000 at once.
        // Running 1000 concurrent async operations in Promise.all saturates Node.js's thread pool
        // and blocks the event loop for seconds. Chunking keeps each burst small.
        const scoreCalculator = require('../utils/scoreCalculator');
        const CHUNK_SIZE = 50;
        const enrichedLeaderboard = [];

        for (let i = 0; i < allBatchStudents.length; i += CHUNK_SIZE) {
            const chunk = allBatchStudents.slice(i, i + CHUNK_SIZE);

            const chunkResults = chunk.map((batchUser) => {
                const user = batchUser;
                const studentId = batchUser._id.toString();

                // Get leaderboard entry or use stub for contest-only participants
                const entry = leaderboardMap.get(studentId) || {
                    studentId,
                    rank: 0,
                    globalRank: 0,
                    rollNumber: user.education?.rollNumber || 'N/A',
                    username: user.username || user.email?.split('@')[0] || 'N/A',
                    overallScore: 0,
                    alphaCoins: user.alphacoins || 0,
                    alphaKnowledgeBasicScore: 0,
                    externalScores: {},
                    lastUpdated: user.createdAt
                };

                // Compute externalTotal from profiles map (NO N+1)
                const studentProfiles = externalProfilesMap.get(studentId) || [];
                let externalTotal = 0;
                studentProfiles.forEach(profile => {
                    externalTotal += scoreCalculator.calculatePlatformScore(profile.platform, profile.stats) || 0;
                });

                // Detailed Stats Builder
                const detailedStats = {};
                const platforms = ['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit'];
                platforms.forEach(p => {
                    const profile = studentProfiles.find(ep => ep.platform === p);
                    if (profile) {
                        detailedStats[p] = {
                            problemsSolved: profile.stats.problemsSolved || 0,
                            rating: profile.stats.rating || 0,
                            totalContests: profile.stats.totalContests || 0
                        };
                    } else {
                        detailedStats[p] = { problemsSolved: 0, rating: 0, totalContests: 0 };
                    }
                });

                // Internal Contests Data - ONLY for this batch
                const internalContestsData = {};
                let internalTotalScore = 0;

                const studentContestMap = contestScoresByStudent.get(studentId);
                if (studentContestMap) {
                    for (const cid of batchContestIds) {
                        if (studentContestMap.has(cid)) {
                            const score = studentContestMap.get(cid);
                            internalContestsData[cid] = score;
                            internalTotalScore += score;
                        }
                    }
                }

                // alphaCoins = practice-only coins from the user document (source of truth).
                const alphaCoins = (user.alphacoins != null) ? user.alphacoins
                    : (entry.alphaCoins != null) ? entry.alphaCoins : 0;

                // overallScore = practice coins + external (NO internal contest scores)
                const overallScore = alphaCoins + externalTotal;

                return {
                    studentId: studentId.toString(),
                    rank: entry.rank,
                    globalRank: entry.globalRank,
                    rollNumber: user?.education?.rollNumber || entry.rollNumber || 'N/A',
                    name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || entry.username,
                    username: entry.username || user.username || 'N/A',
                    overallScore,
                    alphaCoins,
                    externalScores: entry.externalScores || {},
                    detailedStats: detailedStats,
                    internalContests: internalContestsData,
                    branch: user?.education?.branch || 'N/A',
                    lastUpdated: entry.lastUpdated
                };
            });

            enrichedLeaderboard.push(...chunkResults);
        }

        // Sort by overall score descending
        enrichedLeaderboard.sort((a, b) => b.overallScore - a.overallScore);

        // === GLOBAL RANK CALCULATION ===
        // Assign batch rank first
        enrichedLeaderboard.forEach((item, index) => {
            item.rank = index + 1;
        });

        // Use Redis ZSET pipeline for O(1) multi-fetch of Global Ranks instead of O(N) sequential DB queries
        try {
            const redis = require('../config/redis').getRedis();
            const GLOBAL_RANK_KEY = 'leaderboard:global';

            const pipeline = redis.pipeline();
            enrichedLeaderboard.forEach(item => {
                pipeline.zrevrank(GLOBAL_RANK_KEY, item.studentId);
            });
            const results = await pipeline.exec();

            enrichedLeaderboard.forEach((item, index) => {
                const [err, rank] = results[index];
                if (!err && rank !== null) {
                    item.globalRank = rank + 1;
                } else {
                    item.globalRank = item.rank; // fallback to batch rank
                }
            });
        } catch (e) {
            console.error('[GlobalRank Calculation] Pipeline failed:', e.message);
            enrichedLeaderboard.forEach((item) => {
                if (!item.globalRank) item.globalRank = item.rank;
            });
        }

        // Calculate max score for each contest across all students
        const contestsWithMaxScore = allContests.map(c => {
            const contestId = c._id.toString();
            let maxScore = 0;

            enrichedLeaderboard.forEach(entry => {
                const score = entry.internalContests?.[contestId];
                if (score !== undefined && score > maxScore) {
                    maxScore = score;
                }
            });

            return {
                id: c._id,
                title: c.title,
                startTime: c.startTime,
                endTime: c.endTime,
                maxScore: maxScore
            };
        });

        // Fetch batch details
        const batch = await Batch.findById(batchId);

        const responsePayload = {
            success: true,
            count: enrichedLeaderboard.length,
            batchName: batch?.name || 'Batch Leaderboard',
            contests: contestsWithMaxScore,
            leaderboard: enrichedLeaderboard
        };

        // CRIT-2 FIX: Write result to Redis cache (60s) so subsequent requests skip recompute.
        try {
            await redis.setex(cacheKey, BATCH_LB_CACHE_TTL, JSON.stringify(responsePayload));
        } catch (e) { /* non-fatal — serve fresh data */ }

        res.json(responsePayload);
    } catch (error) {
        console.error('Get batch leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard',
            error: error.message
        });
    }

};


// Get ALL EXTERNAL DATA (ALL PLATFORMS, ALL CONTESTS) - FETCH ONCE
const getAllExternalData = async (req, res) => {
    try {
        const { batchId } = req.params;

        // Get ALL external profiles for the batch
        const profiles = await ExternalProfile.getBatchExternalStats(batchId);

        // Fetch ALL users for this batch once to avoid N+1 queries
        const batchUsers = await User.getStudentsByBatch(batchId);
        const userMap = new Map();
        batchUsers.forEach(u => userMap.set(u._id.toString(), u));

        // Group by platform
        const platformData = {};

        const PLATFORMS = ['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit' /*, 'spoj' */];

        for (const platform of PLATFORMS) {
            const platformProfiles = profiles.filter(p => p.platform === platform);

            // Group contests by name for this platform
            const contestsMap = new Map();

            for (const profile of platformProfiles) {
                if (profile.allContests && Array.isArray(profile.allContests)) {
                    for (const contest of profile.allContests) {
                        if (!contestsMap.has(contest.contestName)) {
                            contestsMap.set(contest.contestName, {
                                contestName: contest.contestName,
                                startTime: contest.startTime,
                                participants: 0,
                                leaderboard: []
                            });
                        }

                        const contestData = contestsMap.get(contest.contestName);
                        contestData.participants++;

                        const user = userMap.get(profile.studentId.toString());
                        contestData.leaderboard.push({
                            rollNumber: user?.education?.rollNumber || 'N/A',
                            username: profile.username,
                            branch: user?.education?.branch || 'N/A',
                            section: user?.profile?.section || 'N/A',
                            globalRank: contest.globalRank,
                            rating: contest.rating,
                            problemsSolved: contest.problemsSolved
                        });
                    }
                }
            }

            // Convert map to array and sort
            const contests = Array.from(contestsMap.values()).map(contest => {
                contest.leaderboard.sort((a, b) => a.globalRank - b.globalRank);
                contest.leaderboard.forEach((entry, index) => {
                    entry.rank = index + 1;
                });
                return contest;
            });

            // Sort contests by start time (latest first)
            contests.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

            platformData[platform] = {
                platform,
                contestCount: contests.length,
                contests: contests
            };
        }

        res.json({
            success: true,
            platforms: platformData
        });
    } catch (error) {
        console.error('Get all external data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch external data',
            error: error.message
        });
    }
};

// Get FULL internal contest leaderboard
const getInternalContestLeaderboard = async (req, res) => {
    try {
        const { contestId } = req.params;

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({
                success: false,
                message: 'Contest not found'
            });
        }

        const currentUserId = req.user?.userId || req.user?._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const { leaderboard, total, totalPages } = await ContestSubmission.getLeaderboard(contestId, currentUserId, false, page, limit);

        let problems = [];
        if (contest.problems && contest.problems.length > 0) {
            problems = await Problem.findByIds(contest.problems);
        }

        // HIGH-8 FIX: getLeaderboard already fetched users. The section sub-query
        // that did a second DB round-trip has been eliminated by adding 'profile.section'
        // to the projection inside getLeaderboard's user chunk-fetch.
        // We build the section map from the data already in the leaderboard entries.
        const enrichedLeaderboard = leaderboard.map((entry) => {
            return {
                rank: entry.rank,
                studentId: entry.studentId,
                rollNumber: entry.rollNumber,
                fullName: entry.fullName,
                username: entry.username,
                branch: entry.branch || 'N/A',
                section: entry.section || 'N/A',
                score: entry.score,
                time: entry.time,
                problemsSolved: entry.problemsSolved,
                problems: entry.problems,
                tabSwitchCount: entry.tabSwitchCount || 0,
                tabSwitchDuration: entry.tabSwitchDuration || 0,
                fullscreenExits: entry.fullscreenExits || 0,
                pasteAttempts: entry.pasteAttempts || 0,
                violations: {
                    tabSwitches: entry.tabSwitchCount || 0,
                    tabSwitchDuration: entry.tabSwitchDuration || 0,
                    pasteAttempts: entry.pasteAttempts || 0,
                    fullscreenExits: entry.fullscreenExits || 0,
                    total: (entry.tabSwitchCount || 0) + (entry.pasteAttempts || 0) + (entry.fullscreenExits || 0)
                },
                isCompleted: entry.isCompleted || false
            };
        });

        res.json({
            success: true,
            contest: {
                _id: contest._id,
                title: contest.title,
                description: contest.description,
                startTime: contest.startTime,
                endTime: contest.endTime,
                proctoringEnabled: contest.proctoringEnabled,
                tabSwitchLimit: contest.tabSwitchLimit,
                maxViolations: contest.maxViolations,
                totalProblems: contest.problems.length,
                problems: problems
            },
            count: enrichedLeaderboard.length,
            total,
            page,
            limit,
            totalPages,
            leaderboard: enrichedLeaderboard
        });
    } catch (error) {
        console.error('Get internal contest leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch internal contest leaderboard',
            error: error.message
        });
    }
};


// Get student rank
const getStudentRank = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;

        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const rankInfo = await Leaderboard.getStudentRank(studentId);

        if (!rankInfo) {
            return res.status(404).json({
                success: false,
                message: 'Student not found in leaderboard'
            });
        }

        res.json({
            success: true,
            rankInfo
        });
    } catch (error) {
        console.error('Get student rank error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student rank',
            error: error.message
        });
    }
};

// Get top performers
const getTopPerformers = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const topPerformers = await Leaderboard.getTopPerformers(parseInt(limit));

        res.json({
            success: true,
            count: topPerformers.length,
            topPerformers: topPerformers.map(entry => ({
                rank: entry.globalRank,
                rollNumber: entry.rollNumber,
                username: entry.username,
                overallScore: entry.overallScore,
                batchId: entry.batchId
            }))
        });
    } catch (error) {
        console.error('Get top performers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch top performers',
            error: error.message
        });
    }
};

module.exports = {
    getBatchLeaderboard,
    getAllExternalData,
    getInternalContestLeaderboard,
    getStudentRank,
    getTopPerformers
};
