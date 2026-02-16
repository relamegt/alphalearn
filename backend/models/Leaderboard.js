const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Leaderboard {
  // Create or update leaderboard entry
  static async upsert(leaderboardData) {
    const entry = {
      batchId: new ObjectId(leaderboardData.batchId),
      studentId: new ObjectId(leaderboardData.studentId),
      rollNumber: leaderboardData.rollNumber,
      username: leaderboardData.username,
      alphaLearnBasicScore: leaderboardData.alphaLearnBasicScore || 0,
      alphaLearnPrimaryScore: leaderboardData.alphaLearnPrimaryScore || 0, // Internal contests - NOT in overall
      externalScores: {
        hackerrank: leaderboardData.externalScores?.hackerrank || 0,
        leetcode: leaderboardData.externalScores?.leetcode || 0,
        codechef: leaderboardData.externalScores?.codechef || 0,
        codeforces: leaderboardData.externalScores?.codeforces || 0,
        interviewbit: leaderboardData.externalScores?.interviewbit || 0,
        spoj: leaderboardData.externalScores?.spoj || 0
      },
      overallScore: 0, // Calculated below (excludes alphaLearnPrimaryScore)
      rank: 0,
      globalRank: 0,
      lastUpdated: new Date()
    };

    // Calculate overall score (excludes alphaLearnPrimaryScore)
    entry.overallScore =
      entry.alphaLearnBasicScore +
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

  // Update AlphaLearn Basic Score (practice problems)
  static async updateAlphaLearnBasicScore(studentId, score) {
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
          alphaLearnBasicScore: score,
          overallScore: newOverallScore,
          lastUpdated: new Date()
        }
      }
    );
  }

  // Update AlphaLearn Primary Score (internal contests - NOT in overall)
  static async updateAlphaLearnPrimaryScore(studentId, score) {
    return await collections.leaderboard.updateOne(
      { studentId: new ObjectId(studentId) },
      {
        $set: {
          alphaLearnPrimaryScore: score,
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
      (entry.alphaLearnBasicScore || 0) +
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

    // Calculate AlphaLearn Basic Score
    const solvedCounts = await Submission.getSolvedCountByDifficulty(studentId);
    const alphaLearnBasicScore =
      (solvedCounts.easy * 20) +
      (solvedCounts.medium * 50) +
      (solvedCounts.hard * 100);

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

    // Update leaderboard
    const User = require('./User');
    const user = await User.findById(studentId);

    return await Leaderboard.upsert({
      batchId: user.batchId,
      studentId: studentId,
      rollNumber: user.education?.rollNumber || 'N/A',
      username: user.email.split('@')[0],
      alphaLearnBasicScore,
      alphaLearnPrimaryScore: 0, // Separate calculation for contests
      externalScores
    });
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

  // Get student rank in batch
  static async getStudentRank(studentId) {
    const entry = await Leaderboard.findByStudent(studentId);
    if (!entry) return null;

    const batchLeaderboard = await Leaderboard.findByBatch(entry.batchId);
    const rank = batchLeaderboard.findIndex(e => e.studentId.toString() === studentId.toString()) + 1;

    return {
      rank,
      totalStudents: batchLeaderboard.length,
      score: entry.overallScore
    };
  }
}

module.exports = Leaderboard;
