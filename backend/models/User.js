const { ObjectId } = require('bson');
const bcrypt = require('bcryptjs');
const { collections } = require('../config/astra');

class User {
    // Create new user (with stats tracking)
    static async create(userData) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const user = {
                _id: new ObjectId(),
                email: userData.email,
                password: hashedPassword,
                firstName: userData.firstName || null,
                lastName: userData.lastName || null,
                role: userData.role,
                batchId: userData.batchId ? new ObjectId(userData.batchId) : null,
                assignedBatches: userData.batchId ? [new ObjectId(userData.batchId)] : [],
                isActive: true,
                isFirstLogin: true,
                profileCompleted: false,
                activeSessionToken: null,
                deviceFingerprint: null,
                profile: {
                    profilePicture: userData.profile?.profilePicture || null,
                    phone: userData.profile?.phone || null,
                    whatsapp: userData.profile?.whatsapp || null,
                    dob: userData.profile?.dob || null,
                    gender: userData.profile?.gender || null,
                    tshirtSize: userData.profile?.tshirtSize || null,
                    aboutMe: userData.profile?.aboutMe || null,
                    address: {
                        building: userData.profile?.address?.building || null,
                        street: userData.profile?.address?.street || null,
                        city: userData.profile?.address?.city || null,
                        state: userData.profile?.address?.state || null,
                        postalCode: userData.profile?.address?.postalCode || null
                    },
                    socialLinks: {
                        facebook: userData.profile?.socialLinks?.facebook || null,
                        twitter: userData.profile?.socialLinks?.twitter || null,
                        quora: userData.profile?.socialLinks?.quora || null
                    },
                    professionalLinks: {
                        website: userData.profile?.professionalLinks?.website || null,
                        linkedin: userData.profile?.professionalLinks?.linkedin || null
                    }
                },
                education: userData.education || null,
                skills: userData.skills || [],
                createdAt: new Date(),
                lastLogin: null
            };

            await collections.users.insertOne(user);

            return user;
        } catch (error) {
            console.error('Create user error:', error);
            throw error;
        }
    }

    // Get total users count (for homepage stats)
    static async getTotalUsersCount() {
        try {
            // Count all users in the collection
            // This replaces the separate UserStats collection
            const count = await collections.users.countDocuments({}, { upperBound: 100000 });
            return count;
        } catch (error) {
            console.error('Get total users count error:', error);
            return 0;
        }
    }

    // Find user by email
    static async findByEmail(email) {
        return await collections.users.findOne({ email: email.toLowerCase() });
    }

    // Find user by ID
    static async findById(userId) {
        return await collections.users.findOne({ _id: new ObjectId(userId) });
    }

    // Find users by batch ID
    static async findByBatchId(batchId) {
        return await collections.users.find({ batchId: new ObjectId(batchId) }).toArray();
    }

    // Find all users by role
    static async findByRole(role) {
        return await collections.users.find({ role }).toArray();
    }

    // Find all users
    static async findAll() {
        return await collections.users.find({}).toArray();
    }

    // Compare password
    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    // Update session (alias for updateActiveSession)
    static async updateSession(userId, sessionToken, deviceFingerprint) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    activeSessionToken: sessionToken,
                    deviceFingerprint: deviceFingerprint,
                    lastLogin: new Date()
                }
            }
        );
    }

    // Update active session (SINGLE LOGIN ENFORCEMENT)
    static async updateActiveSession(userId, sessionToken, deviceFingerprint) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    activeSessionToken: sessionToken,
                    deviceFingerprint: deviceFingerprint,
                    lastLogin: new Date()
                }
            }
        );
    }

    // Update last login
    static async updateLastLogin(userId) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    lastLogin: new Date()
                }
            }
        );
    }

    // Verify active session
    static async verifyActiveSession(userId, sessionToken) {
        const user = await collections.users.findOne({
            _id: new ObjectId(userId),
            activeSessionToken: sessionToken
        });
        return user !== null;
    }

    // Clear session (logout)
    static async clearSession(userId) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    activeSessionToken: null,
                    deviceFingerprint: null
                }
            }
        );
    }

    // Invalidate session (logout) - alias for clearSession
    static async invalidateSession(userId) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    activeSessionToken: null,
                    deviceFingerprint: null
                }
            }
        );
    }

    // Update password
    static async updatePassword(userId, newPassword) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { password: hashedPassword } }
        );
    }

    // Update user (general update)
    static async update(userId, updateData) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );
    }

    // Update profile
    static async updateProfile(userId, profileData) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: profileData }
        );
    }

    // Update email (with verification)
    static async updateEmail(userId, newEmail) {
        return await collections.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { email: newEmail.toLowerCase() } }
        );
    }

    // Add batch to instructor
    static async addBatchToInstructor(userId, batchId) {
        const userObjectId = new ObjectId(userId);
        const batchObjectId = new ObjectId(batchId);

        return await collections.users.updateOne(
            { _id: userObjectId },
            {
                $addToSet: { assignedBatches: batchObjectId },
                $set: { batchId: batchObjectId } // Update current batchId to latest
            }
        );
    }

    // Remove batch from instructor
    static async removeBatchFromInstructor(userId, batchId) {
        const userObjectId = new ObjectId(userId);
        const batchObjectId = new ObjectId(batchId);

        // Remove from assignedBatches
        await collections.users.updateOne(
            { _id: userObjectId },
            { $pull: { assignedBatches: batchObjectId } }
        );

        // Check if current batchId is the one being removed
        // If so, update batchId to another assigned batch or null
        const user = await collections.users.findOne({ _id: userObjectId });
        if (user && user.batchId && user.batchId.toString() === batchObjectId.toString()) {
            const remainingBatches = user.assignedBatches || [];
            const newBatchId = remainingBatches.length > 0 ? remainingBatches[remainingBatches.length - 1] : null;

            await collections.users.updateOne(
                { _id: userObjectId },
                { $set: { batchId: newBatchId } }
            );
        }

        return { success: true };
    }

    // Mark first login as completed
    static async markFirstLoginComplete(userId) {
        try {
            await collections.users.updateOne(
                { _id: new ObjectId(userId) },
                {
                    $set: {
                        isFirstLogin: false,
                        profileCompleted: true,
                        updatedAt: new Date()
                    }
                }
            );
        } catch (error) {
            console.error('Mark first login complete error:', error);
            throw error;
        }
    }

    // Get users by batch
    static async getUsersByBatch(batchId) {
        try {
            const users = await collections.users.find({
                batchId: new ObjectId(batchId)
            }).toArray();
            return users;
        } catch (error) {
            console.error('Get users by batch error:', error);
            throw error;
        }
    }

    // Get instructors by batch
    static async getInstructorsByBatch(batchId) {
        try {
            const batchObjectId = new ObjectId(batchId);
            const instructors = await collections.users.find({
                role: 'instructor',
                $or: [
                    { batchId: batchObjectId },
                    { assignedBatches: batchObjectId }
                ]
            }).toArray();
            return instructors;
        } catch (error) {
            console.error('Get instructors by batch error:', error);
            throw error;
        }
    }

    // Get all students in a batch
    static async getStudentsByBatch(batchId) {
        return await collections.users.find({
            batchId: new ObjectId(batchId),
            role: 'student'
        }).toArray();
    }

    // Get all students in multiple batches
    static async getStudentsByBatches(batchIds) {
        try {
            const objectIds = batchIds.map(id => new ObjectId(id));
            return await collections.users.find({
                batchId: { $in: objectIds },
                role: 'student'
            }).toArray();
        } catch (error) {
            console.error('Get students by batches error:', error);
            throw error;
        }
    }

    // Count students in a batch
    static async countStudentsInBatch(batchId) {
        try {
            const students = await collections.users.find({
                batchId: new ObjectId(batchId),
                role: 'student'
            }).toArray();
            return students.length;
        } catch (error) {
            console.error('Count students in batch error:', error);
            throw error;
        }
    }

    // Count users by role
    static async countByRole(role) {
        try {
            const users = await collections.users.find({ role }).toArray();
            return users.length;
        } catch (error) {
            console.error('Count by role error:', error);
            throw error;
        }
    }

    // Bulk create users (CSV import with stats tracking)
    static async bulkCreate(usersData) {
        const users = await Promise.all(
            usersData.map(async (userData) => {
                const hashedPassword = await bcrypt.hash(userData.password, 10);
                return {
                    _id: new ObjectId(),
                    email: userData.email.toLowerCase(),
                    password: hashedPassword,
                    firstName: userData.firstName || null,
                    lastName: userData.lastName || null,
                    role: userData.role,
                    batchId: userData.batchId ? new ObjectId(userData.batchId) : null,
                    isActive: true,
                    isFirstLogin: true,
                    profileCompleted: false,
                    activeSessionToken: null,
                    deviceFingerprint: null,
                    profile: {
                        phone: userData.phone || null,
                        whatsapp: userData.whatsapp || null,
                        dob: null,
                        gender: null,
                        tshirtSize: null,
                        aboutMe: null,
                        address: { building: null, street: null, city: null, state: null, postalCode: null },
                        socialLinks: { facebook: null, twitter: null, quora: null },
                        professionalLinks: { website: null, linkedin: null }
                    },
                    education: userData.role === 'student' ? {
                        institution: userData.institution || null,
                        degree: userData.degree || null,
                        branch: userData.branch || null,
                        rollNumber: userData.rollNumber || null,
                        startYear: userData.startYear || null,
                        endYear: userData.endYear || null
                    } : null,
                    skills: [],
                    createdAt: new Date(),
                    lastLogin: null
                };
            })
        );

        const result = await collections.users.insertMany(users);

        return result;
    }

    // Complete user deletion - removes ALL user data from database
    static async deleteUserCompletely(userId) {
        const userObjectId = new ObjectId(userId);

        // Delete ALL data associated with this user
        const deletionResults = await Promise.all([
            // User account
            collections.users.deleteOne({ _id: userObjectId }),

            // All submissions (practice)
            collections.submissions.deleteMany({ studentId: userObjectId }),

            // All progress records
            collections.progress.deleteMany({ studentId: userObjectId }),

            // All contest submissions
            collections.contestSubmissions.deleteMany({ studentId: userObjectId }),

            // External profiles
            collections.externalProfiles.deleteMany({ studentId: userObjectId }),

            // Leaderboard entries (practice)
            collections.leaderboard.deleteMany({ studentId: userObjectId }),

            // Contest leaderboard entries
            collections.contestLeaderboard?.deleteMany({ studentId: userObjectId }),

            // Notifications
            collections.notifications?.deleteMany({ userId: userObjectId }),

            // Sessions
            collections.sessions?.deleteMany({ userId: userObjectId }),

            // Saved problems
            collections.savedProblems?.deleteMany({ studentId: userObjectId }),

            // Discussion posts
            collections.discussions?.deleteMany({ userId: userObjectId }),

            // Comments
            collections.comments?.deleteMany({ userId: userObjectId })
        ]);

        return {
            success: true,
            message: 'User and all associated data deleted permanently',
            deletedRecords: {
                user: deletionResults[0].deletedCount > 0,
                submissions: deletionResults[1].deletedCount,
                progress: deletionResults[2].deletedCount,
                contestSubmissions: deletionResults[3].deletedCount,
                externalProfiles: deletionResults[4].deletedCount,
                leaderboard: deletionResults[5].deletedCount,
                contestLeaderboard: deletionResults[6]?.deletedCount || 0,
                notifications: deletionResults[7]?.deletedCount || 0,
                sessions: deletionResults[8]?.deletedCount || 0,
                savedProblems: deletionResults[9]?.deletedCount || 0,
                discussions: deletionResults[10]?.deletedCount || 0,
                comments: deletionResults[11]?.deletedCount || 0
            },
            note: 'Total user count preserved for homepage statistics'
        };
    }

    // Delete user (alias to complete deletion)
    static async delete(userId) {
        return await User.deleteUserCompletely(userId);
    }

    // Delete multiple users by batch (cascade delete)
    static async deleteByBatchId(batchId) {
        const batchObjectId = new ObjectId(batchId);

        // Get all users in batch
        const usersInBatch = await collections.users.find({
            batchId: batchObjectId
        }).toArray();

        const userIds = usersInBatch.map(u => u._id);

        if (userIds.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        // Delete ALL data for ALL users in batch
        await Promise.all([
            // Delete all user accounts
            collections.users.deleteMany({ batchId: batchObjectId }),

            // Delete all practice submissions
            collections.submissions.deleteMany({ studentId: { $in: userIds } }),

            // Delete all progress
            collections.progress.deleteMany({ studentId: { $in: userIds } }),

            // Delete all contest submissions
            collections.contestSubmissions.deleteMany({ studentId: { $in: userIds } }),

            // Delete all external profiles
            collections.externalProfiles.deleteMany({ studentId: { $in: userIds } }),

            // Delete all leaderboard entries
            collections.leaderboard.deleteMany({ studentId: { $in: userIds } }),

            // Delete all contest leaderboard entries
            collections.contestLeaderboard?.deleteMany({ studentId: { $in: userIds } }),

            // Delete all notifications
            collections.notifications?.deleteMany({ userId: { $in: userIds } }),

            // Delete all sessions
            collections.sessions?.deleteMany({ userId: { $in: userIds } }),

            // Delete all saved problems
            collections.savedProblems?.deleteMany({ studentId: { $in: userIds } }),

            // Delete all discussion posts
            collections.discussions?.deleteMany({ userId: { $in: userIds } }),

            // Delete all comments
            collections.comments?.deleteMany({ userId: { $in: userIds } })
        ]);

        return {
            success: true,
            deletedCount: userIds.length,
            message: `Deleted ${userIds.length} users and all their data`
        };
    }

    // Reset student profile - Only AlphaLearn practice data (preserves contests)
    static async resetStudentProfile(studentId) {
        const student = await User.findById(studentId);
        if (!student) {
            throw new Error('User not found');
        }

        // Delete ONLY AlphaLearn practice submissions (NOT contest submissions)
        const deletedSubmissions = await collections.submissions.deleteMany({
            studentId: new ObjectId(studentId)
        });

        // Delete ONLY practice progress (NOT contest progress)
        const deletedProgress = await collections.progress.deleteMany({
            studentId: new ObjectId(studentId)
        });

        // Reset ONLY practice-related stats and coins (keep everything else)
        await collections.users.updateOne(
            { _id: new ObjectId(studentId) },
            {
                $set: {
                    alphacoins: 0,
                    'stats.problemsSolved': 0,
                    'stats.totalSubmissions': 0,
                    'stats.acceptedSubmissions': 0,
                    lastUpdated: new Date()
                }
            }
        );

        return {
            success: true,
            deletedSubmissions: deletedSubmissions.deletedCount,
            deletedProgress: deletedProgress.deletedCount,
            cleared: {
                practiceSubmissions: deletedSubmissions.deletedCount,
                practiceProgress: deletedProgress.deletedCount,
                alphacoins: true,
                practiceStats: true
            },
            preserved: {
                contestSubmissions: true,
                contestRecords: true,
                contestLeaderboard: true,
                externalProfiles: true,
                personalInfo: true,
                education: true,
                skills: true,
                batchAssignment: true,
                accountCredentials: true
            }
        };
    }
}

module.exports = User;
