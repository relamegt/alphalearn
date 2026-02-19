const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Submission {
    // Create new submission
    static async create(submissionData) {
        const submission = {
            _id: new ObjectId(),
            studentId: new ObjectId(submissionData.studentId),
            problemId: new ObjectId(submissionData.problemId),
            code: submissionData.code,
            language: submissionData.language, // 'c' | 'cpp' | 'java' | 'python' | 'javascript'
            verdict: submissionData.verdict, // 'Accepted' | 'Wrong Answer' | 'TLE' | 'Runtime Error' | 'Compilation Error'
            testCasesPassed: submissionData.testCasesPassed,
            totalTestCases: submissionData.totalTestCases,
            submittedAt: new Date()
        };

        const result = await collections.submissions.insertOne(submission);
        return { ...submission, _id: result.insertedId };
    }

    // Find submission by ID
    static async findById(submissionId) {
        return await collections.submissions.findOne({ _id: new ObjectId(submissionId) });
    }

    // Find all submissions by student
    static async findByStudent(studentId, limit = 100) {
        return await collections.submissions
            .find({ studentId: new ObjectId(studentId) })
            .sort({ submittedAt: -1 })
            .limit(limit)
            .toArray();
    }

    // Find submissions by student and problem
    static async findByStudentAndProblem(studentId, problemId) {
        return await collections.submissions
            .find({
                studentId: new ObjectId(studentId),
                problemId: new ObjectId(problemId)
            })
            .sort({ submittedAt: -1 })
            .toArray();
    }

    // Find recent submissions (last N submissions) with problem details
    static async findRecentSubmissions(studentId, limit = 10) {
        const submissions = await collections.submissions
            .find({ studentId: new ObjectId(studentId) })
            .sort({ submittedAt: -1 })
            .limit(limit)
            .toArray();

        // Populate problem titles manually
        const Problem = require('./Problem');

        const populatedSubmissions = await Promise.all(submissions.map(async (sub) => {
            const problem = await Problem.findById(sub.problemId);
            return {
                ...sub,
                problemTitle: problem ? problem.title : 'Unknown Problem',
                problemDifficulty: problem ? problem.difficulty : 'Medium'
            };
        }));

        return populatedSubmissions;
    }

    // Find all recent submissions (global) with details
    static async findAllRecentSubmissions(limit = 10) {
        return await collections.submissions.aggregate([
            { $sort: { submittedAt: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $lookup: {
                    from: 'problems',
                    localField: 'problemId',
                    foreignField: '_id',
                    as: 'problem'
                }
            },
            { $unwind: '$problem' },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    language: 1,
                    verdict: 1,
                    submittedAt: 1,
                    user: { username: 1, email: 1 },
                    problem: { title: 1 }
                }
            }
        ]).toArray();
    }

    // Get submission heatmap data (365 days)
    static async getHeatmapData(studentId) {
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);

        const submissions = await collections.submissions
            .find({
                studentId: new ObjectId(studentId),
                submittedAt: { $gte: oneYearAgo }
            })
            .toArray();

        // Group by date
        const heatmapData = {};
        submissions.forEach(sub => {
            const dateKey = sub.submittedAt.toDateString();
            heatmapData[dateKey] = (heatmapData[dateKey] || 0) + 1;
        });

        return heatmapData;
    }

    // Get verdict breakdown (pie chart data)
    static async getVerdictData(studentId) {
        const submissions = await collections.submissions
            .find({ studentId: new ObjectId(studentId) })
            .toArray();

        const verdictCounts = {
            'Accepted': 0,
            'Partially Accepted': 0,
            'Wrong Answer': 0,
            'Time Limit Exceeded': 0,
            'Runtime Error': 0,
            'Compilation Error': 0
        };

        submissions.forEach(sub => {
            if (sub.verdict === 'Accepted') {
                verdictCounts['Accepted']++;
            } else if (sub.testCasesPassed > 0 && sub.testCasesPassed < sub.totalTestCases) {
                verdictCounts['Partially Accepted']++;
            } else if (sub.verdict === 'Wrong Answer') {
                verdictCounts['Wrong Answer']++;
            } else if (sub.verdict === 'TLE') {
                verdictCounts['Time Limit Exceeded']++;
            } else if (sub.verdict === 'Runtime Error') {
                verdictCounts['Runtime Error']++;
            } else if (sub.verdict === 'Compilation Error') {
                verdictCounts['Compilation Error']++;
            }
        });

        return verdictCounts;
    }

    // Get language usage statistics
    static async getLanguageStats(studentId) {
        const submissions = await collections.submissions
            .find({
                studentId: new ObjectId(studentId),
                verdict: 'Accepted'
            })
            .toArray();

        const languageCounts = {};
        submissions.forEach(sub => {
            languageCounts[sub.language] = (languageCounts[sub.language] || 0) + 1;
        });

        return languageCounts;
    }

    // Check if problem is solved by student
    static async isProblemSolved(studentId, problemId) {
        const acceptedSubmission = await collections.submissions.findOne({
            studentId: new ObjectId(studentId),
            problemId: new ObjectId(problemId),
            verdict: 'Accepted'
        });

        return acceptedSubmission !== null;
    }

    // Get solved problems by student
    static async getSolvedProblems(studentId) {
        const acceptedSubmissions = await collections.submissions
            .find({
                studentId: new ObjectId(studentId),
                verdict: 'Accepted'
            })
            .toArray();

        // Get unique problem IDs
        const uniqueProblemIds = [...new Set(acceptedSubmissions.map(sub => sub.problemId.toString()))];
        return uniqueProblemIds.map(id => new ObjectId(id));
    }
    // backend/models/ContestSubmission.js (Add this method)
    // Add to existing ContestSubmission class

    static async getProblemStatistics(contestId) {
        const submissions = await ContestSubmission.findByContest(contestId);
        const Contest = require('./Contest');
        const contest = await Contest.findById(contestId);

        if (!contest) return [];

        const problemStats = contest.problems.map(problemId => {
            const problemSubs = submissions.filter(s => s.problemId.toString() === problemId.toString());
            const accepted = problemSubs.filter(s => s.verdict === 'Accepted').length;
            const uniqueSolvers = new Set(
                problemSubs.filter(s => s.verdict === 'Accepted').map(s => s.studentId.toString())
            ).size;

            return {
                problemId,
                totalSubmissions: problemSubs.length,
                acceptedSubmissions: accepted,
                uniqueSolvers,
                acceptanceRate: problemSubs.length > 0 ? ((accepted / problemSubs.length) * 100).toFixed(2) : 0
            };
        });

        return problemStats;
    }

    // Get solved problems count by difficulty
    static async getSolvedCountByDifficulty(studentId) {
        const Problem = require('./Problem');
        const solvedProblemIds = await Submission.getSolvedProblems(studentId);

        const solvedProblems = await Promise.all(
            solvedProblemIds.map(id => Problem.findById(id))
        );

        const counts = { easy: 0, medium: 0, hard: 0 };
        solvedProblems.forEach(problem => {
            if (problem) {
                if (problem.difficulty === 'Easy') counts.easy++;
                else if (problem.difficulty === 'Medium') counts.medium++;
                else if (problem.difficulty === 'Hard') counts.hard++;
            }
        });

        return counts;
    }

    // Delete submissions by student (for batch deletion)
    static async deleteByStudent(studentId) {
        return await collections.submissions.deleteMany({ studentId: new ObjectId(studentId) });
    }

    // Delete submissions by problem
    static async deleteByProblem(problemId) {
        return await collections.submissions.deleteMany({ problemId: new ObjectId(problemId) });
    }

    // Get submission statistics
    static async getStatistics(studentId) {
        const submissions = await collections.submissions.find({ studentId: new ObjectId(studentId) }).toArray();

        const stats = {
            totalSubmissions: submissions.length,
            acceptedSubmissions: submissions.filter(s => s.verdict === 'Accepted').length,
            wrongAnswers: submissions.filter(s => s.verdict === 'Wrong Answer').length,
            timeouts: submissions.filter(s => s.verdict === 'TLE').length,
            runtimeErrors: submissions.filter(s => s.verdict === 'Runtime Error').length,
            compilationErrors: submissions.filter(s => s.verdict === 'Compilation Error').length,
            acceptanceRate: 0
        };

        if (stats.totalSubmissions > 0) {
            stats.acceptanceRate = ((stats.acceptedSubmissions / stats.totalSubmissions) * 100).toFixed(2);
        }

        return stats;
    }

    // Check if a student has solved a problem (accepted at least once)
    static async isProblemSolved(studentId, problemId) {
        const submission = await collections.submissions.findOne({
            studentId: new ObjectId(studentId),
            problemId: new ObjectId(problemId),
            verdict: 'Accepted'
        });
        return !!submission;
    }
}

module.exports = Submission;
