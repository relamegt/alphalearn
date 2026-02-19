const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Contest {
    // Create new contest
    static async create(contestData) {
        const contest = {
            _id: new ObjectId(),
            title: contestData.title,
            description: contestData.description || '',
            startTime: new Date(contestData.startTime),
            endTime: new Date(contestData.endTime),
            problems: contestData.problems.map(p => new ObjectId(p)),
            createdBy: new ObjectId(contestData.createdBy),
            proctoringEnabled: contestData.proctoringEnabled !== false,
            tabSwitchLimit: contestData.tabSwitchLimit || 3,
            maxViolations: contestData.maxViolations || 5,
            batchId: new ObjectId(contestData.batchId),
            createdAt: new Date()
        };

        const result = await collections.contests.insertOne(contest);
        return { ...contest, _id: result.insertedId };
    }

    // Find contest by ID
    static async findById(contestId) {
        return await collections.contests.findOne({ _id: new ObjectId(contestId) });
    }

    // Find contests by batch
    static async findByBatchId(batchId) {
        return await collections.contests.find({ batchId: new ObjectId(batchId) }).sort({ startTime: -1 }).toArray();
    }

    // Find active contests
    static async findActiveContests(batchId) {
        const now = new Date();
        return await collections.contests.find({
            batchId: new ObjectId(batchId),
            startTime: { $lte: now },
            endTime: { $gte: now }
        }).toArray();
    }

    // Find upcoming contests
    static async findUpcomingContests(batchId) {
        const now = new Date();
        return await collections.contests.find({
            batchId: new ObjectId(batchId),
            startTime: { $gt: now }
        }).sort({ startTime: 1 }).toArray();
    }

    // Find past contests
    static async findPastContests(batchId) {
        const now = new Date();
        return await collections.contests.find({
            batchId: new ObjectId(batchId),
            endTime: { $lt: now }
        }).sort({ endTime: -1 }).toArray();
    }

    // Find multiple contests with query
    static async find(query = {}, options = {}) {
        try {
            return await collections.contests.find(query, options).toArray();
        } catch (error) {
            console.error('Find contests error:', error);
            throw error;
        }
    }

    // Update contest
    static async update(contestId, updateData) {
        if (updateData.problems) {
            updateData.problems = updateData.problems.map(p => new ObjectId(p));
        }
        if (updateData.startTime) {
            updateData.startTime = new Date(updateData.startTime);
        }
        if (updateData.endTime) {
            updateData.endTime = new Date(updateData.endTime);
        }

        return await collections.contests.updateOne(
            { _id: new ObjectId(contestId) },
            { $set: updateData }
        );
    }

    // Delete contest
    static async delete(contestId) {
        return await collections.contests.deleteOne({ _id: new ObjectId(contestId) });
    }

    // Delete contests by batch (for batch deletion)
    static async deleteByBatchId(batchId) {
        return await collections.contests.deleteMany({ batchId: new ObjectId(batchId) });
    }

    // Check if contest is active
    static async isActive(contestId) {
        const contest = await Contest.findById(contestId);
        if (!contest) return false;

        const now = new Date();
        return now >= contest.startTime && now <= contest.endTime;
    }

    // Check if contest has started
    static async hasStarted(contestId) {
        const contest = await Contest.findById(contestId);
        if (!contest) return false;

        return new Date() >= contest.startTime;
    }

    // Check if contest has ended
    static async hasEnded(contestId) {
        const contest = await Contest.findById(contestId);
        if (!contest) return false;

        return new Date() > contest.endTime;
    }

    // Get contest duration in minutes
    static async getDuration(contestId) {
        const contest = await Contest.findById(contestId);
        if (!contest) return 0;

        const durationMs = contest.endTime - contest.startTime;
        return Math.floor(durationMs / (1000 * 60));
    }

    // Count contests by batch
    static async countByBatch(batchId) {
        try {
            const contests = await collections.contests.find({
                batchId: new ObjectId(batchId)
            }).toArray();
            return contests.length;
        } catch (error) {
            console.error('Count contests error:', error);
            throw error;
        }
    }


    // Get contest statistics
    static async getStatistics(contestId) {
        const ContestSubmission = require('./ContestSubmission');
        const contest = await Contest.findById(contestId);
        if (!contest) return null;

        const submissions = await ContestSubmission.findByContest(contestId);
        const uniqueParticipants = [...new Set(submissions.map(s => s.studentId.toString()))];

        return {
            contest,
            totalParticipants: uniqueParticipants.length,
            totalSubmissions: submissions.length,
            problemCount: contest.problems.length
        };
    }
}

module.exports = Contest;
