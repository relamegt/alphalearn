const User = require('../models/User');
const ExternalProfile = require('../models/ExternalProfile');
const Submission = require('../models/Submission');
const Progress = require('../models/Progress');
// NOTE: Leaderboard is NOT required at the top level — it causes a circular dependency.
// It is lazy-required inside getDashboardData instead (see below).
const { syncStudentProfiles, syncBatchProfiles } = require('../services/profileSyncService');
const { sendProfileResetNotification } = require('../services/emailService');


// Get student dashboard data
const getDashboardData = async (req, res) => {
    try {
        const studentId = req.user.userId;

        // Get heatmap data (keys are Date.toDateString() e.g. "Mon Feb 21 2026")
        const heatmapData = await Submission.getHeatmapData(studentId);

        // Get verdict data
        const verdictData = await Submission.getVerdictData(studentId);

        // Get recent submissions
        const recentSubmissions = await Submission.findRecentSubmissions(studentId, 5);

        // Get language stats
        const languageStats = await Submission.getLanguageStats(studentId);

        // Get progress (base stats from DB)
        const progress = await Progress.getStatistics(studentId);

        // ── Compute current streak & max streak from heatmap (source of truth) ──
        // These are guaranteed to match the graph since both use the same heatmap data.
        const activeDateStrings = new Set(
            Object.entries(heatmapData)
                .filter(([, count]) => count > 0)
                .map(([dateStr]) => dateStr)
        );

        // Walk backwards from today to find current streak
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);
        while (activeDateStrings.has(checkDate.toDateString())) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        }
        // If nothing today, check if streak ran through yesterday
        if (currentStreak === 0) {
            checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - 1);
            while (activeDateStrings.has(checkDate.toDateString())) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            }
        }

        // Walk all active dates ascending to compute max streak
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

        // Override stale DB streak values with accurate heatmap-derived values
        if (progress) {
            progress.streakDays = currentStreak;
            progress.maxStreakDays = maxStreak;
        }
        // ────────────────────────────────────────────────────────────────────────

        // Get external profile stats
        const externalStats = await ExternalProfile.getStudentExternalStats(studentId);

        // Lazy-require Leaderboard to break the circular dependency chain:
        // profileController → Leaderboard → Contest/Submission/User → ... → profileController
        // At startup Node caches Leaderboard as {} (incomplete), so static methods are missing.
        // A lazy require inside the async function call runs AFTER all modules have settled,
        // guaranteeing we get the fully-constructed Leaderboard class.
        let leaderboardStats = null;
        try {
            const LeaderboardModel = require('../models/Leaderboard');
            if (typeof LeaderboardModel.getStudentRank === 'function') {
                leaderboardStats = await LeaderboardModel.getStudentRank(studentId);
            } else {
                console.warn('Leaderboard.getStudentRank is not a function — circular dep may still be present');
            }
        } catch (lbErr) {
            console.error('Leaderboard stats fetch failed (non-fatal):', lbErr.message);
        }

        res.json({
            success: true,
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
        console.error('Get dashboard data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message
        });
    }
};


// Update profile
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const updateData = {};

        // Profile fields
        if (req.body.profilePicture) updateData['profile.profilePicture'] = req.body.profilePicture;
        if (req.body.phone) updateData['profile.phone'] = req.body.phone;
        if (req.body.whatsapp) updateData['profile.whatsapp'] = req.body.whatsapp;
        if (req.body.dob) updateData['profile.dob'] = new Date(req.body.dob);
        if (req.body.gender) updateData['profile.gender'] = req.body.gender;
        if (req.body.tshirtSize) updateData['profile.tshirtSize'] = req.body.tshirtSize;
        if (req.body.aboutMe) updateData['profile.aboutMe'] = req.body.aboutMe;

        // Address
        if (req.body.address) {
            Object.keys(req.body.address).forEach(key => {
                updateData[`profile.address.${key}`] = req.body.address[key];
            });
        }

        // Social links
        if (req.body.socialLinks) {
            Object.keys(req.body.socialLinks).forEach(key => {
                updateData[`profile.socialLinks.${key}`] = req.body.socialLinks[key];
            });
        }

        // Professional links
        if (req.body.professionalLinks) {
            Object.keys(req.body.professionalLinks).forEach(key => {
                updateData[`profile.professionalLinks.${key}`] = req.body.professionalLinks[key];
            });
        }

        // Skills
        if (req.body.skills) updateData.skills = req.body.skills;

        // Education (students only)
        if (req.user.role === 'student' && req.body.education) {
            Object.keys(req.body.education).forEach(key => {
                updateData[`education.${key}`] = req.body.education[key];
            });
        }

        await User.updateProfile(userId, updateData);

        const updatedUser = await User.findById(userId);

        res.json({
            success: true,
            message: 'Profile updated successfully',
            profile: updatedUser.profile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error.message
        });
    }
};


// Link external profile
const linkExternalProfile = async (req, res) => {
    try {
        const { platform, username } = req.body;
        const studentId = req.user.userId;

        // Check if profile already exists for this platform
        let profile = await ExternalProfile.findByStudentAndPlatform(studentId, platform);

        if (profile) {
            // If the handle is different, update it and reset sync status to force a refresh
            if (profile.username !== username) {
                await ExternalProfile.update(profile._id, {
                    username,
                    lastSynced: new Date(0) // Forces immediate sync on next run
                });
                // Fetch the updated version to return in response
                profile = await ExternalProfile.findById(profile._id);

                // Trigger an immediate re-sync for the new username
                await require('../services/profileSyncService').syncProfile(profile._id);
            }
        } else {
            // Create new profile if it doesn't exist
            profile = await ExternalProfile.create({
                studentId,
                platform,
                username
            });

            // Initial sync for the brand new profile
            await require('../services/profileSyncService').syncProfile(profile._id);
        }

        res.status(profile ? 200 : 201).json({
            success: true,
            message: 'External profile updated successfully',
            profile
        });
    } catch (error) {
        console.error('Link external profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to link external profile',
            error: error.message
        });
    }
};


// Manual sync (1 attempt per week - triggers full batch update)
const manualSyncProfiles = async (req, res) => {
    try {
        const studentId = req.user.userId;

        // Check if manual sync is allowed
        const canSync = await ExternalProfile.canManualSync(studentId);
        if (!canSync.allowed) {
            return res.status(429).json({
                success: false,
                message: 'Manual sync allowed once per week',
                nextAllowedDate: canSync.nextAllowedDate
            });
        }

        // Get user's batch
        const user = await User.findById(studentId);
        if (!user.batchId) {
            return res.status(400).json({
                success: false,
                message: 'You must be assigned to a batch'
            });
        }

        // Sync entire batch (triggered by one student)
        const result = await syncBatchProfiles(user.batchId);

        // Update next sync allowed date for all students in batch (ONLY IN PRODUCTION)
        let nextSyncDate = null;

        if (process.env.NODE_ENV === 'production') {
            const students = await User.getStudentsByBatch(user.batchId);
            nextSyncDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            for (const student of students) {
                const profiles = await ExternalProfile.findByStudent(student._id);
                for (const profile of profiles) {
                    await ExternalProfile.updateNextSyncAllowed(profile._id, nextSyncDate);
                }
            }
        } else {
            // In development, next sync allowed immediately
            nextSyncDate = new Date();
        }

        res.json({
            success: true,
            message: 'Batch profiles synced successfully',
            nextSyncAllowed: nextSyncDate,
            result
        });
    } catch (error) {
        console.error('Manual sync profiles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync profiles',
            error: error.message
        });
    }
};


// Get external profiles
const getExternalProfiles = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;

        // Check ownership
        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const profiles = await ExternalProfile.findByStudent(studentId);

        res.json({
            success: true,
            count: profiles.length,
            profiles
        });
    } catch (error) {
        console.error('Get external profiles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch external profiles',
            error: error.message
        });
    }
};


// Delete external profile
const deleteExternalProfile = async (req, res) => {
    try {
        const { profileId } = req.params;

        const profile = await ExternalProfile.findById(profileId);
        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        // Check ownership
        if (req.user.role === 'student' && profile.studentId.toString() !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await ExternalProfile.delete(profileId);

        // Recalculate leaderboard
        await require('../models/Leaderboard').recalculateScores(profile.studentId);

        res.json({
            success: true,
            message: 'External profile deleted successfully'
        });
    } catch (error) {
        console.error('Delete external profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete external profile',
            error: error.message
        });
    }
};


// Get all students for instructor (filtered by their batch)
const getAllStudentsForInstructor = async (req, res) => {
    try {
        const instructorId = req.user.userId;
        const instructor = await User.findById(instructorId);

        let students;

        // If instructor has batchId or assignedBatches, show students from all
        if (instructor.batchId || (instructor.assignedBatches && instructor.assignedBatches.length > 0)) {
            const batchIds = [instructor.batchId, ...(instructor.assignedBatches || [])].filter(id => id);
            // Deduplicate
            const uniqueBatchIds = [...new Set(batchIds.map(id => id.toString()))];

            students = await User.getStudentsByBatches(uniqueBatchIds);
        } else if (req.user.role === 'admin') {
            // Admins can see all students
            students = await User.findByRole('student');
        } else {
            return res.status(403).json({
                success: false,
                message: 'Instructor must be assigned to a batch'
            });
        }

        res.json({
            success: true,
            count: students.length,
            students: students.map(s => ({
                id: s._id,
                email: s.email,
                firstName: s.firstName,
                lastName: s.lastName,
                rollNumber: s.education?.rollNumber || 'N/A',
                branch: s.education?.branch || 'N/A',
                batchId: s.batchId,
                isActive: s.isActive,
                profileCompleted: s.profileCompleted || false
            }))
        });
    } catch (error) {
        console.error('Get students for instructor error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch students',
            error: error.message
        });
    }
};

// Reset student profile - ONLY AlphaKnowledge practice data
const resetStudentProfile = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;
        const requesterId = req.user.userId;
        const requester = await User.findById(requesterId);

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isSelf = requesterId === studentId;
        const isAdmin = req.user.role === 'admin';
        const isInstructor = req.user.role === 'instructor';

        // Authorization Logic
        if (!isAdmin && !isSelf) {
            if (isInstructor) {
                // Instructor can only reset STUDENTS in their ASSIGNED BATCHES
                const instructorBatches = [requester.batchId, ...(requester.assignedBatches || [])]
                    .filter(id => id)
                    .map(id => id.toString());

                const studentBatchId = student.batchId ? student.batchId.toString() : null;

                if (student.role !== 'student' || !studentBatchId || !instructorBatches.includes(studentBatchId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'You can only reset students in your assigned batches'
                    });
                }
            } else {
                // Students cannot reset others
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }
        }

        // Reset only AlphaKnowledge practice data (preserves contests)
        const resetResult = await User.resetStudentProfile(studentId);

        // Send notification email
        await sendProfileResetNotification(
            student.email,
            `${student.firstName || 'Student'} ${student.lastName || ''}`.trim(),
            `${requester.firstName || 'Instructor'} ${requester.lastName || ''}`.trim()
        );

        res.json({
            success: true,
            message: 'AlphaKnowledge practice data reset successfully',
            details: {
                cleared: resetResult.cleared,
                preserved: resetResult.preserved,
                note: 'Only AlphaKnowledge practice submissions, progress, and coins were cleared. Contest records, external profiles, personal info, education details, and batch assignment have been preserved.'
            }
        });
    } catch (error) {
        console.error('Reset student profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset student profile',
            error: error.message
        });
    }
};

// Export functions (remove searchStudents)
module.exports = {
    getDashboardData,
    updateProfile,
    linkExternalProfile,
    manualSyncProfiles,
    getExternalProfiles,
    deleteExternalProfile,
    resetStudentProfile,
    getAllStudentsForInstructor
};

