const User = require('../models/User');
const Submission = require('../models/Submission');
const Progress = require('../models/Progress');
const ExternalProfile = require('../models/ExternalProfile');

const getPublicProfile = async (req, res) => {
    try {
        const { username } = req.params;

        // Find user by username
        const user = await User.findByUsername(username);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if profile is public
        if (!user.isPublicProfile) {
            return res.status(403).json({
                success: false,
                message: 'Private profile cannot be viewed'
            });
        }

        const studentId = user._id.toString();

        // Get heatmap data
        const heatmapData = await Submission.getHeatmapData(studentId);

        // Get verdict data
        const verdictData = await Submission.getVerdictData(studentId);

        // Get recent submissions
        const recentSubmissions = await Submission.findRecentSubmissions(studentId, 5);

        // Get language stats
        const languageStats = await Submission.getLanguageStats(studentId);

        // Get progress (base stats from DB)
        const progress = await Progress.getStatistics(studentId);

        // Compute streak
        const activeDateStrings = new Set(
            Object.entries(heatmapData)
                .filter(([, count]) => count > 0)
                .map(([dateStr]) => dateStr)
        );

        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);
        while (activeDateStrings.has(checkDate.toDateString())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        if (currentStreak === 0) {
            checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - 1);
            while (activeDateStrings.has(checkDate.toDateString())) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }

        const sortedDates = [...activeDateStrings]
            .map(ds => new Date(ds))
            .sort((a, b) => a - b);

        let maxStreak = 0;
        let runningStreak = 0;
        let prevDate = null;
        for (const d of sortedDates) {
            if (!prevDate) {
                runningStreak = 1;
            } else {
                const diff = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
                runningStreak = diff === 1 ? runningStreak + 1 : 1;
            }
            if (runningStreak > maxStreak) maxStreak = runningStreak;
            prevDate = d;
        }

        if (progress) {
            progress.streakDays = currentStreak;
            progress.maxStreakDays = maxStreak;
        }

        // Get external profile stats
        const externalStats = await ExternalProfile.getStudentExternalStats(studentId);

        let leaderboardStats = null;
        try {
            const LeaderboardModel = require('../models/Leaderboard');
            if (typeof LeaderboardModel.getStudentRank === 'function') {
                leaderboardStats = await LeaderboardModel.getStudentRank(studentId);
            }
        } catch (lbErr) {
            console.error('Leaderboard stats fetch failed (non-fatal):', lbErr.message);
        }

        res.json({
            success: true,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                education: user.education,
                profilePicture: user.profile?.profilePicture
            },
            dashboard: {
                userSubmissionsHeatMapData: heatmapData,
                userVerdictData: verdictData,
                recentSubmissions: recentSubmissions.map(s => ({
                    submittedAt: s.submittedAt,
                    problemTitle: s.problemTitle,
                    problemId: s.problemId,
                    problemSlug: s.problemSlug,
                    verdict: s.verdict,
                    language: s.language,
                    testCasesPassed: s.testCasesPassed,
                    totalTestCases: s.totalTestCases
                })),
                languageAcceptedSubmissions: languageStats,
                progress,
                externalContestStats: externalStats,
                leaderboardStats
            }
        });
    } catch (error) {
        console.error('Get public profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile data',
            error: error.message
        });
    }
};

module.exports = {
    getPublicProfile
};
