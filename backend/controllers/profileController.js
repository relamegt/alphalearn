const User = require('../models/User');
const ExternalProfile = require('../models/ExternalProfile');
const Submission = require('../models/Submission');
const Progress = require('../models/Progress');
const { syncStudentProfiles, syncBatchProfiles } = require('../services/profileSyncService');
const { sendProfileResetNotification } = require('../services/emailService');


// Get student dashboard data
const getDashboardData = async (req, res) => {
    try {
        const studentId = req.user.userId;

        // Get heatmap data
        const heatmapData = await Submission.getHeatmapData(studentId);

        // Get verdict data
        const verdictData = await Submission.getVerdictData(studentId);

        // Get recent submissions
        const recentSubmissions = await Submission.findRecentSubmissions(studentId, 10);

        // Get language stats
        const languageStats = await Submission.getLanguageStats(studentId);

        // Get progress
        const progress = await Progress.getStatistics(studentId);

        // Get external profile stats
        const externalStats = await ExternalProfile.getStudentExternalStats(studentId);

        res.json({
            success: true,
            dashboard: {
                userSubmissionsHeatMapData: heatmapData,
                userVerdictData: verdictData,
                recentSubmissions: recentSubmissions.map(s => ({
                    submittedAt: s.submittedAt,
                    problemTitle: 'Problem Title',
                    problemSlug: 'problem-slug',
                    verdict: s.verdict,
                    language: s.language,
                    contestSlug: 'alphalearn-practice'
                })),
                languageAcceptedSubmissions: languageStats,
                progress,
                externalContestStats: externalStats
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

        // If instructor has a batchId, show only their batch students
        if (instructor.batchId) {
            students = await User.getStudentsByBatch(instructor.batchId);
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

// Reset student profile - ONLY AlphaLearn practice data
const resetStudentProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const requesterId = req.user.userId;
        const requester = await User.findById(requesterId);

        const student = await User.findById(studentId);
        if (!student || student.role !== 'student') {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Check authorization: Admin can reset anyone, Instructor can reset only their batch
        if (req.user.role === 'instructor') {
            if (!requester.batchId || student.batchId?.toString() !== requester.batchId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only reset students in your batch'
                });
            }
        }

        // Reset only AlphaLearn practice data (preserves contests)
        const resetResult = await User.resetStudentProfile(studentId);

        // Send notification email
        await sendProfileResetNotification(
            student.email,
            `${student.firstName || 'Student'} ${student.lastName || ''}`.trim(),
            `${requester.firstName || 'Instructor'} ${requester.lastName || ''}`.trim()
        );

        res.json({
            success: true,
            message: 'AlphaLearn practice data reset successfully',
            details: {
                cleared: resetResult.cleared,
                preserved: resetResult.preserved,
                note: 'Only AlphaLearn practice submissions, progress, and coins were cleared. Contest records, external profiles, personal info, education details, and batch assignment have been preserved.'
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

