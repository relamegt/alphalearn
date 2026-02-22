const Leaderboard = require('../models/Leaderboard');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const Contest = require('../models/Contest');
const User = require('../models/User');
const Batch = require('../models/Batch');
const Problem = require('../models/Problem');

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

        // Build map of studentId -> { contestId -> baseScore }
        // Compute the actual leaderboard for all contests in this batch so we have their actual dynamic scores.
        const contestScoresByStudent = new Map(); // studentId -> Map(contestId -> score)

        await Promise.all(allContests.map(async (contest) => {
            const cid = contest._id.toString();
            try {
                const cLeaderboard = await ContestSubmission.getLeaderboard(cid);
                cLeaderboard.forEach(ce => {
                    // Check if they actually participated
                    const participated = ce.isCompleted || (ce.problems && Object.values(ce.problems).some(p => p.tries > 0));
                    if (participated) {
                        const sidStr = ce.studentId.toString();
                        if (!contestScoresByStudent.has(sidStr)) {
                            contestScoresByStudent.set(sidStr, new Map());
                        }
                        contestScoresByStudent.get(sidStr).set(cid, ce.score);
                    }
                });
            } catch (e) {
                console.error(`Failed to fetch leaderboard for contest ${cid}:`, e.message);
            }
        }));

        // Process every student in the batch
        const enrichedLeaderboard = (await Promise.all(
            allBatchStudents.map(async (batchUser) => {
                const user = batchUser;
                const studentId = batchUser._id.toString();

                // Get leaderboard entry or use stub for contest-only participants
                const entry = leaderboardMap.get(studentId) || {
                    studentId,
                    rank: 9999,
                    globalRank: 9999,
                    rollNumber: user.education?.rollNumber || 'N/A',
                    username: user.username || user.email?.split('@')[0] || 'N/A',
                    overallScore: 0,
                    alphaCoins: user.alphacoins || 0,
                    alphaKnowledgeBasicScore: 0,
                    externalScores: {},
                    lastUpdated: user.createdAt
                };

                const externalProfiles = await ExternalProfile.findByStudent(studentId);

                // Detailed Stats Builder
                const detailedStats = {};
                const platforms = ['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit'];
                platforms.forEach(p => {
                    const profile = externalProfiles.find(ep => ep.platform === p);
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

                // Compute externalTotal from live externalProfiles fetched above (not stale entry)
                const scoreCalculator = require('../utils/scoreCalculator');
                let externalTotal = 0;
                externalProfiles.forEach(profile => {
                    externalTotal += scoreCalculator.calculatePlatformScore(profile.platform, profile.stats) || 0;
                });

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

        // Re-assign ranks
        enrichedLeaderboard.forEach((item, index) => {
            item.rank = index + 1;
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

                        const user = await User.findById(profile.studentId);
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
        const leaderboard = await ContestSubmission.getLeaderboard(contestId, currentUserId);

        let problems = [];
        if (contest.problems && contest.problems.length > 0) {
            problems = await Problem.findByIds(contest.problems);
        }

        // Enrich with user data
        const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
                const user = await User.findById(entry.studentId);
                return {
                    rank: entry.rank,
                    studentId: entry.studentId,
                    rollNumber: entry.rollNumber,
                    fullName: entry.fullName,
                    username: entry.username,
                    branch: user?.education?.branch || 'N/A',
                    section: user?.profile?.section || 'N/A',
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
            })
        );

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
