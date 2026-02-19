const Submission = require('../models/Submission');
const Problem = require('../models/Problem');
const Progress = require('../models/Progress');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const { executeWithTestCases, validateCode } = require('../services/judge0Service');

// Run code (sample test cases only)
const runCode = async (req, res) => {
    console.log('\n📥 [API] POST /student/code/run');
    try {
        const { problemId, code, language, customInput } = req.body;
        console.log(`   Problem: ${problemId}, Lang: ${language}, CustomInput: ${!!customInput}`);

        // Validate code
        const validation = validateCode(code, language);
        if (!validation.valid) {
            console.log('   ❌ Validation Failed:', validation.errors);
            return res.status(400).json({
                success: false,
                message: 'Code validation failed',
                errors: validation.errors
            });
        }

        // Get problem
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        // Determine test cases (Custom or Sample)
        let testCases;
        if (customInput !== undefined && customInput !== null) {
            testCases = [{ input: customInput, output: null, isHidden: false }];
        } else {
            testCases = await Problem.getSampleTestCases(problemId);
        }

        // Execute code
        const result = await executeWithTestCases(language, code, testCases, problem.timeLimit);

        console.log(`   ✅ Execution Complete: ${result.verdict}`);

        res.json({
            success: true,
            message: 'Code executed successfully',
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases,
            results: result.results.map(r => ({
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                passed: r.passed,
                verdict: r.verdict,
                error: r.error,
                isHidden: false // run mode - never hidden
            })),
            error: result.error
        });
    } catch (error) {
        console.error('   ❌ Controller Error:', error);
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

        console.log(`\n📥 [API] POST /student/code/submit - Problem: ${problemId}, Lang: ${language}, Student: ${studentId}`);

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
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        // Get all test cases (sample + hidden)
        const allTestCases = await Problem.getAllTestCases(problemId);

        // Execute code against all test cases
        const result = await executeWithTestCases(language, code, allTestCases, problem.timeLimit);

        // Create submission record
        const submission = await Submission.create({
            studentId,
            problemId,
            code,
            language,
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases
        });

        let coinsEarned = 0;
        let totalCoins = 0;
        let isFirstSolve = false;

        // Award coins only on Accepted verdict
        if (result.verdict === 'Accepted') {
            // Check if problem was ALREADY solved before this submission
            // We check for any prior accepted submission from before now
            const previouslySolved = await Submission.isProblemSolved(studentId, problemId);
            // Note: isProblemSolved will now return true since we just created the submission
            // So we need to check if there were >1 accepted submissions (the one we just created + any prior)
            // A more robust approach: we pass isFirstSolve based on whether progress already has it
            const progress = await Progress.findByStudent(studentId);
            const alreadyInProgress = progress?.problemsSolved?.some(
                id => id.toString() === problemId.toString()
            );
            isFirstSolve = !alreadyInProgress;

            if (isFirstSolve) {
                // Award coins atomically (thread-safe)
                coinsEarned = problem.points || 0;
                await User.addCoins(studentId, coinsEarned);
                console.log(`   💰 Coins Awarded: +${coinsEarned} to student ${studentId}`);
            } else {
                console.log(`   ℹ️ Problem already solved before - no duplicate coins`);
            }

            // Always update progress and leaderboard on accepted
            await Promise.all([
                Progress.updateProblemsSolved(studentId, problemId),
                Progress.recalculateSectionProgress(studentId),
                Progress.updateStreak(studentId),
                Leaderboard.recalculateScores(studentId)
            ]);
        }

        // Get updated coin total for the user
        const updatedUser = await User.findById(studentId);
        totalCoins = updatedUser?.alphacoins || 0;

        // Map results, masking hidden test cases
        const mappedResults = result.results.map(r => ({
            input: r.isHidden ? null : r.input,
            expectedOutput: r.isHidden ? null : r.expectedOutput,
            actualOutput: r.isHidden ? null : r.actualOutput,
            passed: r.passed,
            verdict: r.verdict,
            error: r.isHidden ? null : r.error,
            isHidden: r.isHidden || false
        }));

        console.log(`   ✅ Submit Complete: ${result.verdict} (${result.testCasesPassed}/${result.totalTestCases}), CoinsEarned: ${coinsEarned}`);

        res.json({
            success: true,
            message: 'Code submitted successfully',
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases,
            submission: {
                id: submission._id,
                verdict: submission.verdict,
                testCasesPassed: submission.testCasesPassed,
                totalTestCases: submission.totalTestCases,
                submittedAt: submission.submittedAt,
                coinsEarned,
                totalCoins,
                isFirstSolve
            },
            results: mappedResults,
            error: result.error,
            coinsEarned,
            totalCoins,
            isFirstSolve
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
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }

        if (req.user.role === 'student' && submission.studentId.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, submission });
    } catch (error) {
        console.error('Get submission by ID error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch submission', error: error.message });
    }
};

// Get student submissions
const getStudentSubmissions = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;
        const { limit = 100, problemId } = req.query;

        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        let submissions;
        if (problemId) {
            submissions = await Submission.findByStudentAndProblem(studentId, problemId);
        } else {
            submissions = await Submission.findByStudent(studentId, parseInt(limit));
        }

        res.json({ success: true, count: submissions.length, submissions });
    } catch (error) {
        console.error('Get student submissions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch submissions', error: error.message });
    }
};

// Get recent submissions
const getRecentSubmissions = async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;
        const { limit = 10 } = req.query;

        let submissions;
        if (role === 'admin' || role === 'instructor') {
            submissions = await Submission.findAllRecentSubmissions(parseInt(limit));
        } else if (role === 'student') {
            submissions = await Submission.findRecentSubmissions(userId, parseInt(limit));
        }

        res.json({ success: true, count: submissions.length, submissions });
    } catch (error) {
        console.error('Get recent submissions error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recent submissions', error: error.message });
    }
};

// Get submission statistics
const getSubmissionStatistics = async (req, res) => {
    try {
        const studentId = req.params.studentId || req.user.userId;

        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const stats = await Submission.getStatistics(studentId);
        res.json({ success: true, statistics: stats });
    } catch (error) {
        console.error('Get submission statistics error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
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
