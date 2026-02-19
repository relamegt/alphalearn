const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class ExternalProfile {
    // Create new external profile link
    static async create(profileData) {
        const profile = {
            _id: new ObjectId(),
            studentId: new ObjectId(profileData.studentId),
            platform: profileData.platform, // 'leetcode' | 'codechef' | 'codeforces' | 'hackerrank' | 'interviewbit' | 'spoj'
            username: profileData.username,
            stats: {
                problemsSolved: 0,
                rating: 0,
                totalContests: 0,
                rank: 0
            },
            allContests: [], // Store ALL contests (no limit)
            lastSynced: new Date(),
            nextSyncAllowed: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        };

        const result = await collections.externalProfiles.insertOne(profile);
        return { ...profile, _id: result.insertedId };
    }

    // Find profile by ID
    static async findById(profileId) {
        return await collections.externalProfiles.findOne({ _id: new ObjectId(profileId) });
    }

    // Find profiles by student
    static async findByStudent(studentId) {
        return await collections.externalProfiles.find({ studentId: new ObjectId(studentId) }).toArray();
    }

    // Find profile by student and platform
    static async findByStudentAndPlatform(studentId, platform) {
        return await collections.externalProfiles.findOne({
            studentId: new ObjectId(studentId),
            platform: platform.toLowerCase()
        });
    }

    // Update profile stats and ALL contest data
    static async updateStats(profileId, stats, allContests) {
        return await collections.externalProfiles.updateOne(
            { _id: new ObjectId(profileId) },
            {
                $set: {
                    stats: stats,
                    allContests: allContests, // Store ALL contests
                    lastSynced: new Date()
                }
            }
        );
    }

    // Update next sync allowed date (manual sync restriction)
    static async updateNextSyncAllowed(profileId, nextSyncDate) {
        return await collections.externalProfiles.updateOne(
            { _id: new ObjectId(profileId) },
            { $set: { nextSyncAllowed: nextSyncDate } }
        );
    }

    // Check if manual sync is allowed (1 attempt per week)
    static async canManualSync(studentId) {
        // ALLOW UNLIMITED SYNC IN DEVELOPMENT MODE
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            return { allowed: true };
        }

        const profiles = await ExternalProfile.findByStudent(studentId);
        const now = new Date();

        for (const profile of profiles) {
            if (profile.nextSyncAllowed > now) {
                return {
                    allowed: false,
                    nextAllowedDate: profile.nextSyncAllowed
                };
            }
        }

        return { allowed: true };
    }

    // Get profiles needing auto-sync (24 hours passed)
    static async findProfilesNeedingSync() {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return await collections.externalProfiles.find({
            lastSynced: { $lt: twentyFourHoursAgo }
        }).toArray();
    }

    // Delete profile
    static async delete(profileId) {
        return await collections.externalProfiles.deleteOne({ _id: new ObjectId(profileId) });
    }

    // Delete profiles by student (for batch deletion)
    static async deleteByStudent(studentId) {
        return await collections.externalProfiles.deleteMany({ studentId: new ObjectId(studentId) });
    }

    // Get all contests for a platform
    static async getAllContests(profileId) {
        const profile = await ExternalProfile.findById(profileId);
        return profile ? profile.allContests : [];
    }

    // Get latest contest for a platform
    static async getLatestContest(profileId) {
        const profile = await ExternalProfile.findById(profileId);
        if (!profile || !profile.allContests || profile.allContests.length === 0) {
            return null;
        }

        // Sort by start time descending
        const sortedContests = profile.allContests.sort((a, b) =>
            new Date(b.startTime) - new Date(a.startTime)
        );

        return sortedContests[0];
    }

    // Get external profile statistics for student
    static async getStudentExternalStats(studentId) {
        const profiles = await ExternalProfile.findByStudent(studentId);

        const stats = {};
        profiles.forEach(profile => {
            stats[profile.platform] = {
                username: profile.username,
                problemsSolved: profile.stats.problemsSolved,
                rating: profile.stats.rating,
                totalContests: profile.stats.totalContests,
                rank: profile.stats.rank,
                allContests: profile.allContests, // Include ALL contests
                lastSynced: profile.lastSynced
            };
        });

        return stats;
    }

    // Update username
    static async updateUsername(profileId, newUsername) {
        return await collections.externalProfiles.updateOne(
            { _id: new ObjectId(profileId) },
            { $set: { username: newUsername } }
        );
    }

    // Generic update
    static async update(profileId, updateData) {
        return await collections.externalProfiles.updateOne(
            { _id: new ObjectId(profileId) },
            { $set: updateData }
        );
    }

    // Get batch-wide external stats (for leaderboard)
    static async getBatchExternalStats(batchId) {
        const User = require('./User');
        const students = await User.getStudentsByBatch(batchId);
        const studentIds = students.map(s => s._id);

        const profiles = await collections.externalProfiles.find({
            studentId: { $in: studentIds }
        }).toArray();

        return profiles;
    }
}

module.exports = ExternalProfile;
