const { ObjectId } = require('bson');
const { collections } = require('../config/astra');
const { getRedis } = require('../config/redis');

const GLOBAL_RANK_KEY = 'leaderboard:global';

class Leaderboard {
  // Create or update leaderboard entry (requires batchId)
  static async upsert(leaderboardData) {
    return await Leaderboard.upsertByStudent(leaderboardData);
  }

  // Upsert leaderboard entry — batchId may be null
  static async upsertByStudent(leaderboardData) {
    const entry = {
      studentId: new ObjectId(leaderboardData.studentId),
      rollNumber: leaderboardData.rollNumber || 'N/A',
      username: leaderboardData.username || 'Unknown',
      alphaCoins: leaderboardData.alphaCoins || 0,
      externalScores: {
        hackerrank: leaderboardData.externalScores?.hackerrank || 0,
        leetcode: leaderboardData.externalScores?.leetcode || 0,
        codechef: leaderboardData.externalScores?.codechef || 0,
        codeforces: leaderboardData.externalScores?.codeforces || 0,
        interviewbit: leaderboardData.externalScores?.interviewbit || 0,
        spoj: leaderboardData.externalScores?.spoj || 0
      },
      overallScore: 0,
      rank: 0,
      globalRank: 0,
      lastUpdated: new Date()
    };

    // Only set batchId if provided and valid
    if (leaderboardData.batchId) {
      try {
        entry.batchId = new ObjectId(leaderboardData.batchId);
      } catch {
        // invalid batchId — skip
      }
    }

    // Calculate overall score
    entry.overallScore =
      entry.alphaCoins +
      entry.externalScores.hackerrank +
      entry.externalScores.leetcode +
      entry.externalScores.codechef +
      entry.externalScores.codeforces +
      entry.externalScores.interviewbit +
      entry.externalScores.spoj;

    const result = await collections.leaderboard.updateOne(
      { studentId: entry.studentId },
      { $set: entry },
      { upsert: true }
    );

    // Sync with Redis Global Leaderboard for O(log N) ranking
    try {
      const redis = getRedis();
      await redis.zadd(GLOBAL_RANK_KEY, entry.overallScore, entry.studentId.toString());
    } catch (err) {
      console.error('[Redis] Failed to sync global rank:', err.message);
    }

    return result;
  }

  // Find leaderboard entry by student
  static async findByStudent(studentId) {
    return await collections.leaderboard.findOne({ studentId: new ObjectId(studentId) });
  }

  // Find leaderboard by batch
  static async findByBatch(batchId, limit = 100) {
    return await collections.leaderboard
      .find({ batchId: new ObjectId(batchId) })
      .sort({ overallScore: -1 })
      .limit(limit)
      .toArray();
  }

  static async _getGlobalRanksFromScores(leaderboardEntries) {
    if (!leaderboardEntries || leaderboardEntries.length === 0) return new Map();
    try {
      const { countDocuments } = require('../utils/dbHelper');
      const uniqueScores = [...new Set(leaderboardEntries.map(e => e.overallScore || 0))];
      const scoreRanks = {};

      // BUG #5 FIX: Sequential for...of instead of Promise.all to prevent N parallel
      // countDocuments calls from exhausting the Astra DB connection pool.
      for (const score of uniqueScores) {
        try {
          const count = await countDocuments('leaderboard', { overallScore: { $gt: score } });
          scoreRanks[score] = count + 1;
        } catch (err) {
          scoreRanks[score] = 0;
        }
      }

      const rankMap = new Map();
      leaderboardEntries.forEach(entry => {
        if (entry.studentId) {
          rankMap.set(entry.studentId.toString(), scoreRanks[entry.overallScore || 0] || 0);
        }
      });
      return rankMap;
    } catch (err) {
      console.error('[DB] Failed to get global ranks:', err.message);
      return new Map();
    }
  }

  // Get batch leaderboard with ranks
  static async getBatchLeaderboard(batchId, filters = {}) {
    const query = { batchId: new ObjectId(batchId) };

    const leaderboard = await collections.leaderboard
      .find(query)
      .sort({ overallScore: -1 })
      .toArray();

    // Calculate ranks (in-memory for the batch)
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Extract accurate Global Ranks using parallel score counting
    const rankMap = await Leaderboard._getGlobalRanksFromScores(leaderboard);
    leaderboard.forEach((entry) => {
      entry.globalRank = rankMap.get(entry.studentId.toString()) || 0;
    });

    return leaderboard;
  }

  // Update Alpha Coins
  static async updateAlphaCoins(studentId, score) {
    const entry = await Leaderboard.findByStudent(studentId);
    if (!entry) return;

    const newOverallScore =
      score +
      (entry.externalScores?.hackerrank || 0) +
      (entry.externalScores?.leetcode || 0) +
      (entry.externalScores?.codechef || 0) +
      (entry.externalScores?.codeforces || 0) +
      (entry.externalScores?.interviewbit || 0) +
      (entry.externalScores?.spoj || 0);

    const result = await collections.leaderboard.updateOne(
      { studentId: new ObjectId(studentId) },
      {
        $set: {
          alphaCoins: score,
          overallScore: newOverallScore,
          lastUpdated: new Date()
        }
      }
    );

    // Sync Redis
    try {
      await getRedis().zadd(GLOBAL_RANK_KEY, newOverallScore, studentId.toString());
    } catch (e) { }

    return result;
  }

  // Update external platform score
  static async updateExternalScore(studentId, platform, score) {
    const entry = await Leaderboard.findByStudent(studentId);
    if (!entry) return;

    entry.externalScores[platform] = score;

    const newOverallScore =
      (entry.alphaCoins || 0) +
      (entry.externalScores.hackerrank || 0) +
      (entry.externalScores.leetcode || 0) +
      (entry.externalScores.codechef || 0) +
      (entry.externalScores.codeforces || 0) +
      (entry.externalScores.interviewbit || 0) +
      (entry.externalScores.spoj || 0);

    const result = await collections.leaderboard.updateOne(
      { studentId: new ObjectId(studentId) },
      {
        $set: {
          [`externalScores.${platform}`]: score,
          overallScore: newOverallScore,
          lastUpdated: new Date()
        }
      }
    );

    // Sync Redis
    try {
      await getRedis().zadd(GLOBAL_RANK_KEY, newOverallScore, studentId.toString());
    } catch (e) { }

    return result;
  }

  // Recalculate all scores for a student
  static async recalculateScores(studentId) {
    const redis = getRedis();
    const lockKey = `lock:recalculate:${studentId.toString()}`;

    // 1. Try to acquire a lock for 30 seconds to prevent race conditions
    const lockAcquired = await redis.set(lockKey, 'locked', 'NX', 'EX', 30);
    if (!lockAcquired) {
      console.log(`[Leaderboard] Recalculation already in progress for ${studentId}, skipping.`);
      return null;
    }

    try {
      const User = require('./User');
      const collections = require('../config/astra').collections;

      const user = await User.findById(studentId);
      if (!user) return null;

      if (user.role !== 'student') return null;
      if (user.batchId === null && user.email.startsWith('spot_')) return null;
      // 1. Practice Score — stream accepted submissions and aggregate in-memory
      // Using cursor instead of .toArray() to avoid RAM explosion for active students.
      const practiceSubmissionsCursor = collections.submissions.find({
        studentId: new ObjectId(studentId),
        verdict: 'Accepted'
      });

      const uniquePracticeProblemIds = new Set();
      for await (const sub of practiceSubmissionsCursor) {
        if (sub.problemId) uniquePracticeProblemIds.add(sub.problemId.toString());
      }

      let practiceScore = 0;
      if (uniquePracticeProblemIds.size > 0) {
        const practiceProblems = await collections.problems.find({
          _id: { $in: Array.from(uniquePracticeProblemIds).map(id => new ObjectId(id)) }
        }).toArray();

        practiceProblems.forEach(p => {
          if (p.difficulty === 'easy' || p.difficulty === 'Easy') practiceScore += 20;
          else if (p.difficulty === 'medium' || p.difficulty === 'Medium') practiceScore += 50;
          else practiceScore += 100;
        });
      }

      // 2. Contest Score — stream accepted contest submissions
      const contestSubmissionsCursor = collections.contestSubmissions.find({
        studentId: new ObjectId(studentId),
        verdict: 'Accepted'
      });

      const uniqueContestProblems = new Map(); // key: "contestId_problemId"
      for await (const sub of contestSubmissionsCursor) {
        if (sub.contestId && sub.problemId) {
          const key = sub.contestId.toString() + '_' + sub.problemId.toString();
          if (!uniqueContestProblems.has(key)) {
            uniqueContestProblems.set(key, sub.problemId.toString());
          }
        }
      }

      let contestScore = 0;
      const uniqueContestProblemIds = [...new Set(Array.from(uniqueContestProblems.values()))];
      if (uniqueContestProblemIds.length > 0) {
        const contestProblems = await collections.problems.find({
          _id: { $in: uniqueContestProblemIds.map(id => new ObjectId(id)) }
        }).toArray();
        const problemPointsMap = new Map(contestProblems.map(p => [p._id.toString(), p.points || 0]));

        for (const pidStr of uniqueContestProblems.values()) {
          if (problemPointsMap.has(pidStr)) {
            contestScore += problemPointsMap.get(pidStr);
          }
        }
      }

      const alphaCoins = practiceScore + contestScore;

      try {
        await collections.users.updateOne(
          { _id: new ObjectId(studentId) },
          { $set: { alphacoins: alphaCoins } }
        );
      } catch (syncErr) {
        console.error('Failed to sync user alphacoins:', syncErr.message);
      }

      const ExternalProfile = require('./ExternalProfile');
      const scoreCalculator = require('../utils/scoreCalculator');
      const externalProfiles = await ExternalProfile.findByStudent(studentId);
      const externalScores = {
        hackerrank: 0, leetcode: 0, codechef: 0, codeforces: 0, interviewbit: 0, spoj: 0
      };

      for (const profile of externalProfiles) {
        const score = scoreCalculator.calculatePlatformScore(profile.platform, profile.stats);
        externalScores[profile.platform] = score;
      }

      const leaderboardData = {
        studentId: studentId,
        rollNumber: user.education?.rollNumber || 'N/A',
        username: user.email.split('@')[0],
        alphaCoins,
        externalScores,
        batchId: user.batchId || null
      };

      return await Leaderboard.upsertByStudent(leaderboardData);
    } finally {
      // 2. Always release the lock
      await redis.del(lockKey);
    }
  }

  // Delete leaderboard entry by student
  static async deleteByStudent(studentId) {
    try {
      await getRedis().zrem(GLOBAL_RANK_KEY, studentId.toString());
    } catch (e) { }
    return await collections.leaderboard.deleteOne({ studentId: new ObjectId(studentId) });
  }

  // Delete leaderboard entries by batch
  static async deleteByBatch(batchId) {
    try {
      const redis = getRedis();
      // Stream IDs from DB to avoid loading all entries into RAM
      const entriesCursor = collections.leaderboard.find(
        { batchId: new ObjectId(batchId) },
        { projection: { studentId: 1 } }
      );

      const pipeline = redis.pipeline();
      let hasEntries = false;
      for await (const entry of entriesCursor) {
        pipeline.zrem(GLOBAL_RANK_KEY, entry.studentId.toString());
        hasEntries = true;
      }
      if (hasEntries) {
        await pipeline.exec();
      }
    } catch (e) {
      console.error('[deleteByBatch] Redis cleanup error (non-fatal):', e.message);
    }
    return await collections.leaderboard.deleteMany({ batchId: new ObjectId(batchId) });
  }

  // Get top performers (global)
  static async getTopPerformers(limit = 10) {
    return await collections.leaderboard
      .find({})
      .sort({ overallScore: -1 })
      .limit(limit)
      .toArray();
  }

  // Get student rank in batch and globally
  static async getStudentRank(studentId) {
    const entry = await Leaderboard.findByStudent(studentId);
    if (!entry) return null;

    const { countDocuments } = require('../utils/dbHelper');

    // Fetch batch context without heavy DB queries
    const batchRank = await countDocuments('leaderboard', {
      batchId: entry.batchId,
      overallScore: { $gt: entry.overallScore }
    }) + 1;

    const totalStudentsInBatch = await countDocuments('leaderboard', {
      batchId: entry.batchId
    });

    // Global Rank calculated dynamically
    const globalRank = await countDocuments('leaderboard', {
      overallScore: { $gt: entry.overallScore }
    }) + 1;

    return {
      batchRank,
      globalRank,
      totalStudents: totalStudentsInBatch,
      score: entry.overallScore,
      details: entry
    };
  }
}

module.exports = Leaderboard;
