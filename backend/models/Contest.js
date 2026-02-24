const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

// Helper: resolve a problem identifier (ObjectId string or slug) to an ObjectId.
// Returns null if the problem cannot be found.
async function resolveProblemId(idOrSlug) {
    // Fast path: already a valid 24-char hex ObjectId string
    if (/^[0-9a-fA-F]{24}$/.test(idOrSlug)) {
        return new ObjectId(idOrSlug);
    }
    // If passed an actual ObjectId instance
    if (idOrSlug instanceof ObjectId) {
        return idOrSlug;
    }
    // Slow path: treat as slug and look up
    const problem = await collections.problems.findOne({ slug: idOrSlug });
    if (problem) {
        return problem._id;
    }
    return null; // problem not found
}

// Generate a unique contest slug: tries clean slug first, then appends -2, -3, etc. if taken
async function uniqueContestSlug(title) {
    const base = (title || 'contest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    let candidate = base;
    let counter = 2;
    while (true) {
        const existing = await collections.contests.findOne({ slug: candidate });
        if (!existing) return candidate;
        candidate = `${base}-${counter}`;
        counter++;
    }
}

class Contest {
    // Create new contest
    static async create(contestData) {
        const contest = {
            _id: new ObjectId(),
            slug: await uniqueContestSlug(contestData.title),
            title: contestData.title,
            description: contestData.description || '',
            startTime: new Date(contestData.startTime),
            endTime: new Date(contestData.endTime),
            problems: await Promise.all(contestData.problems.map(async p => await resolveProblemId(p.toString ? p.toString() : String(p)))).then(ids => ids.filter(Boolean)),
            createdBy: new ObjectId(contestData.createdBy),

            proctoringEnabled: contestData.proctoringEnabled !== false,
            tabSwitchLimit: contestData.tabSwitchLimit || 3,
            maxViolations: contestData.maxViolations || 5,
            batchId: contestData.batchId ? new ObjectId(contestData.batchId) : null,
            createdAt: new Date()
        };

        const result = await collections.contests.insertOne(contest);
        return { ...contest, _id: result.insertedId };
    }

    // Find contest by ID or slug
    static async findById(contestId) {
        let query = {};
        try {
            query._id = new ObjectId(contestId);
        } catch (e) {
            query.slug = contestId;
        }
        return await collections.contests.findOne(query);
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
        }).sort({ startTime: -1 }).toArray();
    }

    // Find ALL contests globally (Admin/Instructor)
    static async findAll() {
        return await collections.contests.find({}).sort({ startTime: -1 }).toArray();
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
            updateData.problems = (
                await Promise.all(updateData.problems.map(async p => {
                    const s = (p && p.toString) ? p.toString() : String(p);
                    return await resolveProblemId(s);
                }))
            ).filter(Boolean);
        }
        if (updateData.startTime) {
            updateData.startTime = new Date(updateData.startTime);
        }
        if (updateData.endTime) {
            updateData.endTime = new Date(updateData.endTime);
        }

        let query = {};
        try {
            query._id = new ObjectId(contestId);
        } catch (e) {
            query.slug = contestId;
        }

        return await collections.contests.updateOne(
            query,
            { $set: updateData }
        );
    }

    // Delete contest and its transient data
    static async delete(contestId) {
        let query = {};
        try {
            query._id = new ObjectId(contestId);
        } catch (e) {
            query.slug = contestId;
        }
        return await collections.contests.deleteOne(query);
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
            return await collections.contests.countDocuments({
                batchId: new ObjectId(batchId)
            }, { upperBound: 1000 });
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
