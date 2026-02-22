const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

// Generate a unique batch slug: tries clean slug first, then appends -2, -3, etc. if taken
async function uniqueBatchSlug(name) {
    const base = (name || 'batch').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let candidate = base;
    let counter = 2;
    while (true) {
        const existing = await collections.batches.findOne({ slug: candidate });
        if (!existing) return candidate;
        candidate = `${base}-${counter}`;
        counter++;
    }
}

class Batch {
    // Create new batch
    static async create(batchData) {
        // Auto-calculate deleteOn date (e.g., "2022-2026" → delete on 2027-01-01)
        const endYear = new Date(batchData.endDate).getFullYear();
        const deleteOn = new Date(endYear + 1, 0, 1); // January 1 of next year

        const batch = {
            _id: new ObjectId(),
            slug: await uniqueBatchSlug(batchData.name),
            name: batchData.name,
            startDate: new Date(batchData.startDate),
            endDate: new Date(batchData.endDate),
            deleteOn: deleteOn,
            status: 'active',
            description: batchData.description || '',
            studentCount: 0,
            // Educational details for all students in this batch
            education: {
                institution: batchData.education?.institution || null,
                degree: batchData.education?.degree || null,
                startYear: batchData.education?.startYear || new Date(batchData.startDate).getFullYear(),
                endYear: batchData.education?.endYear || new Date(batchData.endDate).getFullYear()
            },
            // Available branches for this batch (e.g., CSE, IT, AIML)
            branches: batchData.branches || [],
            createdBy: new ObjectId(batchData.createdBy),
            createdAt: new Date()
        };

        const result = await collections.batches.insertOne(batch);
        return { ...batch, _id: result.insertedId };
    }

    // Find batch by ID
    static async findById(batchId) {
        return await collections.batches.findOne({ _id: new ObjectId(batchId) });
    }

    // Find batches by IDs
    static async findByIds(batchIds) {
        const objectIds = batchIds.map(id => new ObjectId(id));
        return await collections.batches.find({ _id: { $in: objectIds } }).toArray();
    }

    // Find all active batches
    static async findActive() {
        return await collections.batches.find({ status: 'active' }).toArray();
    }

    // Find all batches (including expired)
    static async findAll() {
        return await collections.batches.find({}).sort({ createdAt: -1 }).toArray();
    }

    // Update batch
    static async update(batchId, updateData) {
        // Recalculate deleteOn if endDate changed
        if (updateData.endDate) {
            const endYear = new Date(updateData.endDate).getFullYear();
            updateData.deleteOn = new Date(endYear + 1, 0, 1);
        }

        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            { $set: updateData }
        );
    }

    // Extend batch expiry (manual extension by admin)
    static async extendExpiry(batchId, newEndDate) {
        const endYear = new Date(newEndDate).getFullYear();
        const newDeleteOn = new Date(endYear + 1, 0, 1);

        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            {
                $set: {
                    endDate: new Date(newEndDate),
                    deleteOn: newDeleteOn,
                    status: 'active'
                }
            }
        );
    }

    // Mark batch as expired
    static async markAsExpired(batchId) {
        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            { $set: { status: 'expired' } }
        );
    }

    // Update student count
    static async updateStudentCount(batchId, count) {
        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            { $set: { studentCount: count } }
        );
    }

    // Increment student count
    static async incrementStudentCount(batchId) {
        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            { $inc: { studentCount: 1 } }
        );
    }

    // Decrement student count
    static async decrementStudentCount(batchId) {
        return await collections.batches.updateOne(
            { _id: new ObjectId(batchId) },
            { $inc: { studentCount: -1 } }
        );
    }

    // Find batches expiring soon (7 days before)
    static async findExpiringBatches() {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        return await collections.batches.find({
            status: 'active',
            deleteOn: {
                $lte: sevenDaysFromNow,
                $gte: new Date()
            }
        }).toArray();
    }

    // Find expired batches (for cron job)
    static async findExpiredBatches() {
        return await collections.batches.find({
            status: 'active',
            deleteOn: { $lte: new Date() }
        }).toArray();
    }

    // Delete batch with complete cascade (deletes batch and ALL users + their data)
    static async delete(batchId) {
        const batchObjectId = new ObjectId(batchId);
        const batch = await Batch.findById(batchId);

        if (!batch) {
            throw new Error('Batch not found');
        }

        // Import User model
        const User = require('./User');

        // Get all users in batch
        const usersInBatch = await collections.users.find({
            batchId: batchObjectId
        }).toArray();

        // Separate students and instructors
        const prevStudents = usersInBatch.filter(u => u.role === 'student');
        const prevInstructors = usersInBatch.filter(u => u.role === 'instructor');

        const studentIds = prevStudents.map(u => u._id);
        const instructorIds = prevInstructors.map(u => u._id);

        // 1. Handle Students: Delete ALL data (cascade)
        if (studentIds.length > 0) {
            await Promise.all([
                // Delete user accounts
                collections.users.deleteMany({ _id: { $in: studentIds } }),

                // Delete all practice submissions
                collections.submissions.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all progress
                collections.progress.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all contest submissions
                collections.contestSubmissions.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all external profiles
                collections.externalProfiles.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all leaderboard entries
                collections.leaderboard.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all contest leaderboard entries
                collections.contestLeaderboard?.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all notifications
                collections.notifications?.deleteMany({ userId: { $in: studentIds } }),

                // Delete all sessions
                collections.sessions?.deleteMany({ userId: { $in: studentIds } }),

                // Delete all saved problems
                collections.savedProblems?.deleteMany({ studentId: { $in: studentIds } }),

                // Delete all discussion posts
                collections.discussions?.deleteMany({ userId: { $in: studentIds } }),

                // Delete all comments
                collections.comments?.deleteMany({ userId: { $in: studentIds } })
            ]);
        }

        // 2. Handle Instructors: Preserve account, just unassign from batch
        if (instructorIds.length > 0) {
            await collections.users.updateMany(
                { _id: { $in: instructorIds } },
                { $set: { batchId: null } }
            );
        }

        // Delete all contests associated with this batch
        await collections.contests.deleteMany({ batchId: batchObjectId });

        // Delete the batch itself
        await collections.batches.deleteOne({ _id: batchObjectId });

        return {
            success: true,
            message: 'Batch deleted. Students deleted. Instructors unassigned.',
            batchName: batch.name,
            studentsDeleted: studentIds.length,
            instructorsUnassigned: instructorIds.length,
            note: 'Instructors were preserved.'
        };
    }

    // Get batch statistics
    static async getStatistics(batchId) {
        try {
            const batch = await this.findById(batchId);
            if (!batch) {
                throw new Error('Batch not found');
            }

            const User = require('./User');
            const Submission = require('./Submission');
            const Problem = require('./Problem');

            // Get all students in batch
            const students = await User.getStudentsByBatch(batchId);
            const studentCount = students.length;

            // Get total problems
            const allProblems = await collections.problems.find({}).toArray();
            const totalProblems = allProblems.length;

            // Get student IDs
            const studentIds = students.map(s => s._id);

            // Fetch all submissions for these students in one query
            const allSubmissions = await collections.submissions.find({
                studentId: { $in: studentIds }
            }).toArray();

            // Calculate submission statistics
            let totalSubmissions = allSubmissions.length;
            let acceptedSubmissions = 0;
            let problemsSolved = new Set();

            allSubmissions.forEach(sub => {
                if (sub.verdict === 'Accepted') {
                    acceptedSubmissions++;
                    problemsSolved.add(sub.problemId.toString());
                }
            });

            const averageSubmissionsPerStudent = studentCount > 0
                ? (totalSubmissions / studentCount).toFixed(2)
                : 0;

            const averageAcceptanceRate = totalSubmissions > 0
                ? ((acceptedSubmissions / totalSubmissions) * 100).toFixed(2)
                : 0;

            return {
                batch: {
                    name: batch.name,
                    status: batch.status,
                    startDate: batch.startDate,
                    endDate: batch.endDate,
                    deleteOn: batch.deleteOn,
                    studentCount: batch.studentCount
                },
                students: {
                    total: studentCount,
                    active: students.filter(s => s.isActive).length
                },
                problems: {
                    total: totalProblems,
                    solved: problemsSolved.size,
                    solvedPercentage: totalProblems > 0
                        ? ((problemsSolved.size / totalProblems) * 100).toFixed(2)
                        : 0
                },
                submissions: {
                    total: totalSubmissions,
                    accepted: acceptedSubmissions,
                    averagePerStudent: averageSubmissionsPerStudent,
                    acceptanceRate: averageAcceptanceRate
                }
            };
        } catch (error) {
            console.error('Get batch statistics error:', error);
            throw error;
        }
    }
}

module.exports = Batch;
