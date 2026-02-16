const Submission = require('../models/Submission');
const Problem = require('../models/Problem');
const Progress = require('../models/Progress');
const Leaderboard = require('../models/Leaderboard');
const { executeWithTestCases, validateCode } = require('../services/pistonService');

// Run code (sample test cases only)
const runCode = async (req, res) => {
    try {
        const { problemId, code, language } = req.body;

        // Validate code
        const validation = validateCode(code, language);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Code validation failed',
                errors: validation.errors
            });
        }

        // Get problem
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        // Get sample test cases only
        const sampleTestCases = await Problem.getSampleTestCases(problemId);

        // Execute code
        const result = await executeWithTestCases(language, code, sampleTestCases, problem.timeLimit);

        res.json({
            success: true,
            message: 'Code executed successfully',
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases,
            results: result.results
        });
    } catch (error) {
        console.error('Run code error:', error);
        res.status(500).json({
            success: false,
            message: 'Code execution failed',
            error: error.message
        });
    }
};

// Submit code (all test cases)
const submitCode = async (req, res) => {
    try {
        const { problemId, code, language } = req.body;
        const studentId = req.user.userId;

        // Validate code
        const validation = validateCode(code, language);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                message: 'Code validation failed',
                errors: validation.errors
            });
        }

        // Get problem
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        // Get all test cases
        const allTestCases = await Problem.getAllTestCases(problemId);

        // Execute code
        const result = await executeWithTestCases(language, code, allTestCases, problem.timeLimit);

        // Create submission
        const submission = await Submission.create({
            studentId,
            problemId,
            code,
            language,
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases
        });

        // Update progress if accepted
        if (result.verdict === 'Accepted') {
            await Progress.updateProblemsSolved(studentId, problemId);
            await Progress.recalculateSectionProgress(studentId);
            await Progress.updateStreak(studentId);

            // Update leaderboard
            await Leaderboard.recalculateScores(studentId);
        }

        res.json({
            success: true,
            message: 'Code submitted successfully',
            submission: {
                id: submission._id,
                verdict: submission.verdict,
                testCasesPassed: submission.testCasesPassed,
                totalTestCases: submission.totalTestCases,
                submittedAt: submission.submittedAt
            },
            results: result.results.map(r => ({
                input: r.isHidden ? 'Hidden' : r.input,
                expectedOutput: r.isHidden ? 'Hidden' : r.expectedOutput,
                actualOutput: r.isHidden ? (r.passed ? 'Hidden' : 'Wrong Answer') : r.actualOutput,
                passed: r.passed
            }))
        });
    } catch (error) {
        console.error('Submit code error:', error);
        res.status(500).json({
            success: false,
            message: 'Code submission failed',
            error: error.message
        });
    }
};

// Get submission by ID
const getSubmissionById = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const submission = await Submission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        // Check ownership
        if (req.user.role === 'student' && submission.studentId.toString() !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            submission
        });
    } catch (error) {
        console.error('Get submission by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submission',
            error: error.message
        });
    }
};

// Get student submissions
const getStudentSubmissions = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;
        const { limit = 100 } = req.query;

        // Check ownership
        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const submissions = await Submission.findByStudent(studentId, parseInt(limit));

        res.json({
            success: true,
            count: submissions.length,
            submissions
        });
    } catch (error) {
        console.error('Get student submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submissions',
            error: error.message
        });
    }
};

// Get recent submissions
const getRecentSubmissions = async (req, res) => {
    try {
        const studentId = req.user.userId;
        const { limit = 10 } = req.query;

        const submissions = await Submission.findRecentSubmissions(studentId, parseInt(limit));

        res.json({
            success: true,
            count: submissions.length,
            submissions
        });
    } catch (error) {
        console.error('Get recent submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent submissions',
            error: error.message
        });
    }
};

// Get submission statistics
const getSubmissionStatistics = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;

        // Check ownership
        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const stats = await Submission.getStatistics(studentId);

        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Get submission statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

module.exports = {
    runCode,
    submitCode,
    getSubmissionById,
    getStudentSubmissions,
    getRecentSubmissions,
    getSubmissionStatistics
};
