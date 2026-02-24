const Leaderboard = require('../models/Leaderboard');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const Contest = require('../models/Contest');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Problem = require('../models/Problem');
const { collections } = require('../config/astra');
const { ObjectId } = require('bson');

// Get FULL batch leaderboard (NO FILTERS)
const getBatchLeaderboard = async (req, res) => {
    try {
        const { batchId } = req.params;

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

        // Process every student in the batch
        const enrichedLeaderboard = (await Promise.all(
            allBatchStudents.map(async (batchUser) => {
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
                const scoreCalculator = require('../utils/scoreCalculator');
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
                // Use != null so a genuine 0 value is preserved (not skipped by ||).
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
            })
        )).filter(item => item !== null);


        // Sort by overall score descending
        enrichedLeaderboard.sort((a, b) => b.overallScore - a.overallScore);

        // === GLOBAL RANK CALCULATION ===
        // Uses the EXACT same method as the Dashboard's global rank card:
        //   countDocuments('leaderboard', { overallScore: { $gt: score } }) + 1
        // This is proven to work in Astra DB. Keyed by overallScore.
        // Results cached in Redis for 5 min — zero DB queries on warm cache.
        const { countDocuments } = require('../utils/dbHelper');
        const redis = require('../config/redis').getRedis();
        const rankCacheKey = `global:ranks:${batchId}`;
        let scoreRankMap = {};

        try {
            const cached = await redis.get(rankCacheKey);
            if (cached) scoreRankMap = JSON.parse(cached);
        } catch (_) { }

        // Unique overallScore values in this batch (typically 10-30 for 100 students)
        const uniqueScores = [...new Set(enrichedLeaderboard.map(e => e.overallScore))];
        const missing = uniqueScores.filter(s => scoreRankMap[s] === undefined);

        if (missing.length > 0) {
            // BUG #5 FIX: Changed from Promise.all (N parallel DB queries) to sequential for...of.
            // Previously, 100 unique scores would fire 100 simultaneous countDocuments calls,
            // exhausting Astra DB's connection pool and causing cascading timeouts for all other
            // in-flight requests. Sequential execution is slightly slower but safe under load.
            for (const score of missing) {
                try {
                    const higherCount = await countDocuments('leaderboard', { overallScore: { $gt: score } });
                    scoreRankMap[score] = higherCount + 1;
                } catch (e) {
                    console.error('[GlobalRank] countDocuments failed for score=' + score + ':', e.message);
                    scoreRankMap[score] = null; // will be patched below
                }
            }
            try { await redis.setex(rankCacheKey, 300, JSON.stringify(scoreRankMap)); } catch (_) { }
        }

        // Assign batch rank and global rank
        enrichedLeaderboard.forEach((item, index) => {
            item.rank = index + 1;
            const gr = scoreRankMap[item.overallScore];
            // gr null means countDocuments failed for this score — show batch rank as proxy
            item.globalRank = (gr && gr > 0) ? gr : (index + 1);
        });

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

        res.json({
            success: true,
            count: enrichedLeaderboard.length,
            batchName: batch?.name || 'Batch Leaderboard',
            contests: contestsWithMaxScore,
            leaderboard: enrichedLeaderboard
        });
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

        // Fix #18: getLeaderboard already fetched and enriched user data.
        // We only need section which isn't included in the base enrichment.
        // Fetch it with a targeted projection to avoid a full user re-fetch.
        const studentIds = leaderboard.map(e => e.studentId);
        const sectionMap = new Map();
        if (studentIds.length > 0) {
            const sectionDocs = await collections.users.find(
                { _id: { $in: studentIds } },
                { projection: { 'profile.section': 1 } }
            ).toArray();
            sectionDocs.forEach(u => sectionMap.set(u._id.toString(), u.profile?.section || 'N/A'));
        }

        // Enrich with section data
        const enrichedLeaderboard = leaderboard.map((entry) => {
            const section = sectionMap.get(entry.studentId.toString()) || 'N/A';
            return {
                rank: entry.rank,
                studentId: entry.studentId,
                rollNumber: entry.rollNumber,
                fullName: entry.fullName,
                username: entry.username,
                branch: entry.branch || 'N/A',
                section: section,
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
