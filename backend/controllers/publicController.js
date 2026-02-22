const User = require('../models/User');
const Submission = require('../models/Submission');
const Progress = require('../models/Progress');
const ExternalProfile = require('../models/ExternalProfile');

const getPublicProfile = async (req, res) => {
    try {
        const { username } = req.params;

        // Find user by username or email prefix
        const user = await User.findByUsername(username);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let canViewProfile = false;
        let canViewPrivateDetails = false;
        let canViewDashboard = false;

        const isPublicProfile = user.isPublicProfile !== false;
        const targetRole = user.role; // role of the profile being viewed

        // Admin and instructor profiles are never publicly accessible to students
        const isPrivilegedProfile = targetRole === 'admin' || targetRole === 'instructor';

        if (req.user) {
            const requesterId = req.user.userId;
            const requesterRole = req.user.role;
            const requesterBatchIds = [req.user.batchId, ...(req.user.assignedBatches || [])]
                .filter(Boolean)
                .map(id => id.toString());

            const userBatchId = user.batchId ? user.batchId.toString() : null;
            const isSameBatch = userBatchId && requesterBatchIds.includes(userBatchId);

            // Self can view everything
            if (requesterId === user._id.toString()) {
                canViewProfile = true;
                canViewPrivateDetails = true;
                canViewDashboard = true;
            } else if (requesterRole === 'admin') {
                // Admins can view all profiles
                canViewProfile = true;
                canViewPrivateDetails = true;
                canViewDashboard = true;
            } else if (requesterRole === 'instructor' && isSameBatch) {
                // Instructors can view all profiles in their batch
                canViewProfile = true;
                canViewPrivateDetails = true;
                canViewDashboard = true;
            } else if (requesterRole === 'student' && isSameBatch && !isPrivilegedProfile) {
                // Students can only view other STUDENT profiles in the same batch
                canViewProfile = true;
                canViewDashboard = true;
            }
        }

        // Public profiles are visible to anyone — BUT only if target is a student
        // Admin/instructor profiles are never exposed publicly to non-admins/non-instructors
        if (isPublicProfile && !isPrivilegedProfile) {
            canViewProfile = true;
        }

        if (!canViewProfile) {
            // Give a generic "not available" message for admin/instructor profiles
            // so students can't even confirm the user exists
            if (isPrivilegedProfile) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            return res.status(403).json({
                success: false,
                message: 'Private profile cannot be viewed'
            });
        }

        const studentId = user._id.toString();

        let dashboard = null;

        // Only fetch dashboard if allowed and if the target user is a student
        if (canViewDashboard && user.role === 'student') {
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
                Object.entries(heatmapData || {})
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

            dashboard = {
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
            };
        }

        const userResponse = {
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username || user.email.split('@')[0],
            education: user.education,
            profilePicture: user.profile?.profilePicture,
            aboutMe: user.profile?.aboutMe,
            role: user.role
        };

        if (canViewPrivateDetails) {
            userResponse.email = user.email;
            userResponse.phone = user.profile?.phone;
            userResponse.whatsapp = user.profile?.whatsapp;
            userResponse.tshirtSize = user.profile?.tshirtSize;
            userResponse.gender = user.profile?.gender;
            userResponse.dob = user.profile?.dob;
            userResponse.address = user.profile?.address;
            userResponse.createdAt = user.createdAt;
            userResponse.lastLogin = user.lastLogin;
            userResponse.isActive = user.isActive;
            userResponse.canViewPrivateDetails = true;
        }

        res.json({
            success: true,
            user: userResponse,
            dashboard: dashboard
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

const checkUsername = async (req, res) => {
    try {
        const { username } = req.params;

        // Basic validation
        if (!username || username.trim().length < 3) {
            return res.json({
                success: true,
                available: false,
                message: 'Username must be at least 3 characters long'
            });
        }
        if (username.trim().length > 10) {
            return res.json({
                success: true,
                available: false,
                message: 'Username cannot be longer than 10 characters'
            });
        }

        const validRegex = /^[a-z0-9_.]+$/;
        if (!validRegex.test(username)) {
            return res.json({
                success: true,
                available: false,
                message: 'Only lowercase letters, numbers, dots and underscores allowed'
            });
        }
        if (!/^[a-z]/.test(username)) {
            return res.json({
                success: true,
                available: false,
                message: 'Username must start with a letter'
            });
        }

        const user = await User.findByUsernameExact(username);

        res.json({
            success: true,
            available: !user,
            message: user ? 'Username is already taken' : 'Username is available'
        });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check username',
            error: error.message
        });
    }
};

module.exports = {
    getPublicProfile,
    checkUsername
};
