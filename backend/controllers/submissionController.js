const Submission = require('../models/Submission');
const Problem = require('../models/Problem');
const Progress = require('../models/Progress');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const { executeWithTestCases, validateCode } = require('../services/judge0Service');

// Run code (sample test cases only, or custom input)
const runCode = async (req, res) => {
    console.log('\n📥 [API] POST /student/code/run');
    try {
        const { problemId, code, language, customInput, customInputs } = req.body;
        const isCustom = customInput !== undefined && customInput !== null && customInput !== '';
        const isMultiCustom = Array.isArray(customInputs) && customInputs.length > 0;
        console.log(`   Problem: ${problemId}, Lang: ${language}, CustomInput: ${isCustom}, MultiCustom: ${isMultiCustom}`);
        console.log(`   customInputs received: ${customInputs ? `Array(${customInputs.length}) → isCustom flags: [${customInputs.map(c => c.isCustom).join(', ')}]` : 'undefined/null'}`);


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

        // Helper: get solution code
        const getSolutionCode = () => {
            const solCode = problem.solutionCode?.[language] ||
                Object.values(problem.solutionCode || {}).find(c => c);
            const solLang = problem.solutionCode?.[language]
                ? language
                : Object.keys(problem.solutionCode || {}).find(k => problem.solutionCode[k]);
            return { solCode, solLang };
        };

        let results = [];
        let finalVerdict = 'Accepted';
        let totalPassed = 0;

        if (isMultiCustom) {
            // ── Multi-case mode: array of { input, expectedOutput? } ────────────────
            // Separate cases that have a known expectedOutput vs those that need solution
            const casesNeedingSolution = customInputs.filter(c => c.expectedOutput === undefined || c.expectedOutput === null);

            // Run user code against all inputs in one batch
            const userTestCases = customInputs.map(c => ({ input: c.input, output: c.expectedOutput ?? undefined, isHidden: false }));
            const userResult = await executeWithTestCases(language, code, userTestCases, problem.timeLimit);

            // For cases that need expected output, run solution code once
            let solOutputMap = {};
            if (casesNeedingSolution.length > 0) {
                const { solCode, solLang } = getSolutionCode();
                if (solCode && solLang) {
                    try {
                        const solCases = casesNeedingSolution.map(c => ({ input: c.input, output: undefined, isHidden: false }));
                        const solResult = await executeWithTestCases(solLang, solCode, solCases, problem.timeLimit);
                        casesNeedingSolution.forEach((c, idx) => {
                            solOutputMap[c.input] = solResult.results[idx]?.actualOutput ?? null;
                        });
                    } catch (solErr) {
                        console.warn('   ⚠️ Solution code execution failed:', solErr.message);
                    }
                }
            }

            // Build final results
            results = customInputs.map((c, i) => {
                const userOut = userResult.results[i]?.actualOutput ?? '';
                const userVerdict = userResult.results[i]?.verdict ?? userResult.verdict;
                const userError = userResult.results[i]?.error ?? null;
                const expectedOut = c.expectedOutput ?? solOutputMap[c.input] ?? null;
                const passed = expectedOut !== null
                    ? (userOut?.trim() === expectedOut?.trim())
                    : (userVerdict === 'Accepted' || !userError);
                return {
                    input: c.input,
                    expectedOutput: expectedOut ?? '(No reference solution available)',
                    actualOutput: userOut,
                    passed,
                    verdict: passed ? 'Accepted' : (userError ? userVerdict : 'Wrong Answer'),
                    error: userError,
                    isHidden: false,
                    isCustom: c.isCustom ?? false,
                    hasSolution: expectedOut !== null
                };
            });

            totalPassed = results.filter(r => r.passed).length;
            finalVerdict = results.every(r => r.passed) ? 'Accepted'
                : results.some(r => r.verdict === 'Compilation Error') ? 'Compilation Error'
                    : results.some(r => r.verdict === 'Runtime Error') ? 'Runtime Error'
                        : results.some(r => r.verdict === 'TLE') ? 'TLE'
                            : 'Wrong Answer';

            console.log(`   📋 [MultiCustom] Total results: ${results.length}, Custom: ${results.filter(r => r.isCustom).length}, Standard: ${results.filter(r => !r.isCustom).length}`);
            console.log(`   Results map:`, results.map((r, i) => `[${i}] isCustom=${r.isCustom} passed=${r.passed} verdict=${r.verdict}`));

        } else if (isCustom) {
            // ── Single custom input mode ──────────────────────────────────────────
            // Run user code
            const userTestCase = [{ input: customInput, output: undefined, isHidden: false }];
            const userResult = await executeWithTestCases(language, code, userTestCase, problem.timeLimit);
            const userOutput = userResult.results[0]?.actualOutput ?? '';
            const userVerdict = userResult.results[0]?.verdict ?? userResult.verdict;
            const userError = userResult.results[0]?.error ?? userResult.error;

            // Try to get expected output from solution code
            let expectedOutput = null;
            const { solCode, solLang } = getSolutionCode();

            if (solCode && solLang) {
                try {
                    const solResult = await executeWithTestCases(
                        solLang, solCode,
                        [{ input: customInput, output: undefined, isHidden: false }],
                        problem.timeLimit
                    );
                    expectedOutput = solResult.results[0]?.actualOutput ?? null;
                    console.log(`   📋 Solution code ran for expected output`);
                } catch (solErr) {
                    console.warn('   ⚠️ Solution code execution failed:', solErr.message);
                }
            }

            // Build result
            const passed = expectedOutput !== null
                ? (userOutput?.trim() === expectedOutput?.trim())
                : (userVerdict === 'Accepted' || userVerdict === 'No output');

            results = [{
                input: customInput,
                expectedOutput: expectedOutput ?? '(No reference solution available)',
                actualOutput: userOutput,
                passed,
                verdict: expectedOutput !== null
                    ? (passed ? 'Accepted' : 'Wrong Answer')
                    : userVerdict,
                error: userError,
                isHidden: false,
                isCustom: true,
                hasSolution: !!expectedOutput
            }];
            totalPassed = passed ? 1 : 0;
            finalVerdict = results[0].verdict;

        } else {
            // ── Sample test cases mode ─────────────────────────────────────
            const testCases = await Problem.getSampleTestCases(problemId);
            const result = await executeWithTestCases(language, code, testCases, problem.timeLimit);
            results = result.results.map(r => ({
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                passed: r.passed,
                verdict: r.verdict,
                error: r.error,
                isHidden: false,
                isCustom: false,
                hasSolution: true
            }));
            totalPassed = result.testCasesPassed;
            finalVerdict = result.verdict;
        }

        console.log(`   ✅ Run Complete: ${finalVerdict} (${totalPassed}/${results.length})`);

        res.json({
            success: true,
            message: 'Code executed successfully',
            verdict: finalVerdict,
            testCasesPassed: totalPassed,
            totalTestCases: results.length,
            results,
            error: results.find(r => r.error)?.error || null,
            isCustomInput: isCustom || isMultiCustom
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
        if (result.verdict === 'Accepted' && req.user.role === 'student') {
            // Check if problem was ALREADY in progress before this submission
            // Progress.updateProblemsSolved is called AFTER this block, so if the
            // problemId is already in progress.problemsSolved it was solved before
            const progress = await Progress.findByStudent(studentId);
            const alreadyInProgress = progress?.problemsSolved?.some(
                id => id.toString() === problemId.toString()
            ) || false;
            isFirstSolve = !alreadyInProgress;

            if (isFirstSolve) {
                // Award coins atomically (thread-safe $inc)
                coinsEarned = problem.points || 0;
                await User.addCoins(studentId, coinsEarned);
                console.log(`   💰 Coins Awarded: +${coinsEarned} to student ${studentId}`);
            } else {
                console.log(`   ℹ️ Problem already solved before - no duplicate coins`);
            }

            // Always update progress and leaderboard on accepted
            try {
                await Progress.updateProblemsSolved(studentId, problemId);
                await Promise.all([
                    Progress.recalculateSectionProgress(studentId),
                    Progress.updateStreak(studentId),
                    Leaderboard.recalculateScores(studentId)
                ]);
            } catch (progressErr) {
                console.error('   ⚠️ Progress/Leaderboard update error (non-fatal):', progressErr.message);
            }
        }

        // Get updated coin total for the user
        if (req.user.role === 'student') {
            totalCoins = await User.getCoins(studentId);
        }

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
