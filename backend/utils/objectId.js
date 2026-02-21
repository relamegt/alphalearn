/**
 * objectId.js
 * -----------
 * Safe ObjectId helpers for backend use.
 *
 * RULE: slugs are only for frontend URL routing.
 * All DB queries must use ObjectIds.
 * Use these helpers wherever a problemId/contestId/batchId might be a slug.
 */
const { ObjectId } = require('bson');

/**
 * Returns true if the string is a valid 24-char hex ObjectId.
 */
const isValidObjectId = (id) => {
    if (!id) return false;
    try {
        return /^[0-9a-fA-F]{24}$/.test(id.toString());
    } catch {
        return false;
    }
};

/**
 * Safely converts a value to ObjectId.
 * If already an ObjectId, returns as-is.
 * If a valid 24-char hex string, converts.
 * Otherwise throws a clear error.
 */
const toObjectId = (id, label = 'id') => {
    if (!id) throw new Error(`${label} is required`);
    if (id instanceof ObjectId) return id;
    if (isValidObjectId(id)) return new ObjectId(id.toString());
    throw new Error(`${label} "${id}" is not a valid ObjectId — slugs must be resolved to ObjectId before DB operations`);
};

/**
 * Resolves a problemId that might be a slug or ObjectId string.
 * If it's a valid ObjectId string → returns ObjectId directly.
 * If it's a slug → looks up in DB and returns the problem's _id.
 * Returns null if not found.
 */
const resolveProblemId = async (problemId) => {
    if (!problemId) return null;
    if (isValidObjectId(problemId)) return new ObjectId(problemId.toString());

    // It's a slug — resolve via DB
    const { collections } = require('../config/astra');
    const problem = await collections.problems.findOne({ slug: problemId.toString() });
    return problem ? problem._id : null;
};

/**
 * Resolves a contestId that might be a slug or ObjectId string.
 */
const resolveContestId = async (contestId) => {
    if (!contestId) return null;
    if (isValidObjectId(contestId)) return new ObjectId(contestId.toString());

    const { collections } = require('../config/astra');
    const contest = await collections.contests.findOne({ slug: contestId.toString() });
    return contest ? contest._id : null;
};

module.exports = { isValidObjectId, toObjectId, resolveProblemId, resolveContestId };
