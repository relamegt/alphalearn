const Leaderboard = require('../models/Leaderboard');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const Contest = require('../models/Contest');
const User = require('../models/User');

// Get FULL batch leaderboard (NO FILTERS)
const getBatchLeaderboard = async (req, res) => {
    try {
        const { batchId } = req.params;

        const leaderboard = await Leaderboard.getBatchLeaderboard(batchId);

        // Enrich with user data (branch, section)
        const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
                const user = await User.findById(entry.studentId);
                return {
                    rank: entry.rank,
                    globalRank: entry.globalRank,
                    rollNumber: entry.rollNumber,
                    username: entry.username,
                    overallScore: entry.overallScore,
                    alphaLearnBasicScore: entry.alphaLearnBasicScore,
                    alphaLearnPrimaryScore: entry.alphaLearnPrimaryScore,
                    externalScores: entry.externalScores || {},
                    branch: user?.education?.stream || 'N/A',
                    section: user?.profile?.section || 'N/A',
                    lastUpdated: entry.lastUpdated
                };
            })
        );

        res.json({
            success: true,
            count: enrichedLeaderboard.length,
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

        const PLATFORMS = ['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit', 'spoj'];

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
                            branch: user?.education?.stream || 'N/A',
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

        const leaderboard = await ContestSubmission.getLeaderboard(contestId);

        // Enrich with user data
        const enrichedLeaderboard = await Promise.all(
            leaderboard.map(async (entry) => {
                const user = await User.findById(entry.studentId);
                return {
                    rank: entry.rank,
                    studentId: entry.studentId,
                    rollNumber: entry.rollNumber,
                    username: entry.username,
                    branch: user?.education?.stream || 'N/A',
                    section: user?.profile?.section || 'N/A',
                    score: entry.score,
                    time: entry.time,
                    problemsSolved: entry.problemsSolved,
                    problemDetails: entry.problemDetails,
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
                totalProblems: contest.problems.length
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
