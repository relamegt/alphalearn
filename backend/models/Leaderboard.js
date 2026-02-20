const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

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

  // Get batch leaderboard with ranks
  static async getBatchLeaderboard(batchId, filters = {}) {
    const query = { batchId: new ObjectId(batchId) };

    // Apply filters (section, timeline, branch)
    if (filters.section) {
      // Section filtering requires joining with submissions - handled in controller
    }

    const leaderboard = await collections.leaderboard
      .find(query)
      .sort({ overallScore: -1 })
      .toArray();

    // Calculate ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Calculate global ranks (across all batches)
    const allEntries = await collections.leaderboard.find({}).sort({ overallScore: -1 }).toArray();
    const globalRankMap = new Map();
    allEntries.forEach((entry, index) => {
      globalRankMap.set(entry.studentId.toString(), index + 1);
    });

    leaderboard.forEach(entry => {
      entry.globalRank = globalRankMap.get(entry.studentId.toString()) || 0;
    });

    // Update ranks in database
    await Promise.all(
      leaderboard.map(entry =>
        collections.leaderboard.updateOne(
          { _id: entry._id },
          { $set: { rank: entry.rank, globalRank: entry.globalRank } }
        )
      )
    );

    return leaderboard;
  }

  // Update Alpha Coins (in-platform problems)
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

    return await collections.leaderboard.updateOne(
      { studentId: new ObjectId(studentId) },
      {
        $set: {
          alphaCoins: score,
          overallScore: newOverallScore,
          lastUpdated: new Date()
        }
      }
    );
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

    return await collections.leaderboard.updateOne(
      { studentId: new ObjectId(studentId) },
      {
        $set: {
          [`externalScores.${platform}`]: score,
          overallScore: newOverallScore,
          lastUpdated: new Date()
        }
      }
    );
  }

  // Recalculate all scores for a student
  static async recalculateScores(studentId) {
    const Submission = require('./Submission');
    const ExternalProfile = require('./ExternalProfile');
    const scoreCalculator = require('../utils/scoreCalculator');
    // Add missing requirements for Contest Score
    const ContestSubmission = require('./ContestSubmission');
    const Contest = require('./Contest');
    const User = require('./User'); // Moved up

    // Get User for Batch ID
    const user = await User.findById(studentId);
    if (!user) return null;

    // 1. Calculate Practice Score (AlphaLearn Basic)
    const solvedCounts = await Submission.getSolvedCountByDifficulty(studentId);
    const practiceScore =
      (solvedCounts.easy * 20) +
      (solvedCounts.medium * 50) +
      (solvedCounts.hard * 100);

    // 2. Calculate Internal Contest Score
    let contestScore = 0;
    if (user.batchId) {
      try {
        const batchContests = await Contest.findByBatchId(user.batchId);
        if (batchContests && batchContests.length > 0) {
          const batchContestIds = new Set(batchContests.map(c => c._id.toString()));

          for (const cid of batchContestIds) {
            const scoreData = await ContestSubmission.calculateScore(studentId, cid);
            contestScore += (scoreData.score || 0);
          }
        }
      } catch (err) {
        console.error('Error calculating contest score:', err);
      }
    }

    const alphaCoins = practiceScore + contestScore;

    // Sync User.alphacoins with the calculated value (source of truth for display)
    try {
      await collections.users.updateOne(
        { _id: new ObjectId(studentId) },
        { $set: { alphacoins: alphaCoins } }
      );
    } catch (syncErr) {
      console.error('Failed to sync user alphacoins:', syncErr.message);
    }

    // Get external scores
    const externalProfiles = await ExternalProfile.findByStudent(studentId);
    const externalScores = {
      hackerrank: 0,
      leetcode: 0,
      codechef: 0,
      codeforces: 0,
      interviewbit: 0,
      spoj: 0
    };

    for (const profile of externalProfiles) {
      const score = scoreCalculator.calculatePlatformScore(profile.platform, profile.stats);
      externalScores[profile.platform] = score;
    }

    // Build leaderboard entry — batchId may be null for unbatched students
    const leaderboardData = {
      studentId: studentId,
      rollNumber: user.education?.rollNumber || 'N/A',
      username: user.email.split('@')[0],
      alphaCoins,
      externalScores
    };

    // Only set batchId if user has one
    if (user.batchId) {
      leaderboardData.batchId = user.batchId;
    } else {
      // Use a placeholder ObjectId for unbatched students
      leaderboardData.batchId = null;
    }

    return await Leaderboard.upsertByStudent(leaderboardData);
  }

  // Delete leaderboard entry by student
  static async deleteByStudent(studentId) {
    return await collections.leaderboard.deleteOne({ studentId: new ObjectId(studentId) });
  }

  // Delete leaderboard entries by batch
  static async deleteByBatch(batchId) {
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

    // Batch Rank
    const batchLeaderboard = await collections.leaderboard
      .find({ batchId: entry.batchId })
      .sort({ overallScore: -1 })
      .toArray();

    const batchRank = batchLeaderboard.findIndex(e => e.studentId.toString() === studentId.toString()) + 1;

    // Global Rank
    // limit to 10000 for performance (approximate rank if > 10000)
    const globalRank = await collections.leaderboard.countDocuments(
      { overallScore: { $gt: entry.overallScore } },
      10000
    ) + 1;

    return {
      batchRank,
      globalRank,
      totalStudents: batchLeaderboard.length,
      score: entry.overallScore,
      details: entry // return full entry for breakdown
    };
  }
}

module.exports = Leaderboard;
