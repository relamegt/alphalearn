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

            // Run user code against ALL inputs in one single Judge0 submission (1 credit)
            const userTestCases = customInputs.map(c => ({ input: c.input, output: c.expectedOutput ?? undefined, isHidden: false }));

            // Prepare solution run concurrently if needed (also 1 credit via harness)
            const { solCode, solLang } = getSolutionCode();
            const needsSolution = casesNeedingSolution.length > 0 && solCode && solLang;

            // Fire user + solution in parallel to halve wall-clock time
            const [userResult, solResult] = await Promise.all([
                executeWithTestCases(language, code, userTestCases, problem.timeLimit),
                needsSolution
                    ? executeWithTestCases(solLang, solCode, casesNeedingSolution.map(c => ({ input: c.input, output: undefined, isHidden: false })), problem.timeLimit).catch(e => {
                        console.warn('   ⚠️ Solution code execution failed:', e.message);
                        return null;
                    })
                    : Promise.resolve(null)
            ]);

            // Build solution output map from parallel result
            let solOutputMap = {};
            if (solResult) {
                casesNeedingSolution.forEach((c, idx) => {
                    solOutputMap[c.input] = solResult.results[idx]?.actualOutput ?? null;
                });
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
            const userTestCase = [{ input: customInput, output: undefined, isHidden: false }];
            const { solCode, solLang } = getSolutionCode();

            // Run user code + solution code in parallel (both use single-harness, 1 credit each)
            const [userResult, solRunResult] = await Promise.all([
                executeWithTestCases(language, code, userTestCase, problem.timeLimit),
                solCode && solLang
                    ? executeWithTestCases(solLang, solCode, [{ input: customInput, output: undefined, isHidden: false }], problem.timeLimit).catch(e => {
                        console.warn('   ⚠️ Solution code execution failed:', e.message);
                        return null;
                    })
                    : Promise.resolve(null)
            ]);

            const userOutput = userResult.results[0]?.actualOutput ?? '';
            const userVerdict = userResult.results[0]?.verdict ?? userResult.verdict;
            const userError = userResult.results[0]?.error ?? userResult.error;

            // Use the already-computed parallel solution result
            let expectedOutput = null;
            if (solRunResult) {
                expectedOutput = solRunResult.results[0]?.actualOutput ?? null;
                console.log(`   📋 Solution code ran in parallel for expected output`);
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
            // ── Sample test cases mode — use problem._id (ObjectId), not slug ───
            const testCases = await Problem.getSampleTestCases(problem._id);
            const result = await executeWithTestCases(language, code, testCases, problem.timeLimit, problem._id.toString());
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

        // Reuse already-fetched problem.testCases — avoids a second identical DB query
        const allTestCases = problem.testCases || [];

        // Execute code against all test cases — this is the main latency (Judge0)
        // Pass problem._id so the execution result cache is keyed per-problem (avoids collisions)
        const result = await executeWithTestCases(language, code, allTestCases, problem.timeLimit, problem._id.toString());

        // Generate a predictable local ID so the response is immediate;
        // the actual DB write happens in the background
        const { ObjectId } = require('bson');
        const tempSubmissionId = new ObjectId();
        const submittedAt = new Date();

        // Build mapped results immediately (sync, no DB needed)
        const mappedResults = result.results.map(r => ({
            input: r.isHidden ? null : r.input,
            expectedOutput: r.isHidden ? null : r.expectedOutput,
            actualOutput: r.isHidden ? null : r.actualOutput,
            passed: r.passed,
            verdict: r.verdict,
            error: r.isHidden ? null : r.error,
            isHidden: r.isHidden || false
        }));

        // ── Check if this is a first-time solve BEFORE sending response ────────────────
        // Required for the celebration animation to work correctly on the first try.
        let isFirstSolve = false;
        let coinsEarned = 0;

        if (result.verdict === 'Accepted' && req.user.role === 'student') {
            try {
                // Use Submission.isProblemSolved to check all past attempts regardless of practice/contest
                const Submission = require('../models/Submission');
                const alreadySolved = await Submission.isProblemSolved(studentId, problem._id);

                if (!alreadySolved) {
                    isFirstSolve = true;
                    // Reward coins ONLY for regular practice problems
                    if (!problem.isContestProblem) {
                        const Progress = require('../models/Progress');
                        const hasViewedEditorial = await Progress.hasViewedEditorial(studentId, problem._id);
                        if (!hasViewedEditorial) {
                            coinsEarned = problem.points || 0;
                        }
                    }
                }
            } catch (pErr) {
                console.warn('   ⚠️ Progress/Submission check failed in submit (pre-response):', pErr.message);
            }
        }

        // Respond immediately with the correct isFirstSolve/coinsEarned data
        console.log(`   ✅ Submit Complete: ${result.verdict} (${result.testCasesPassed}/${result.totalTestCases}), CoinsEarned: ${coinsEarned}`);
        res.json({
            success: true,
            message: 'Code submitted successfully',
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases,
            isFirstSolve,
            coinsEarned,
            submission: {
                id: tempSubmissionId,
                verdict: result.verdict,
                testCasesPassed: result.testCasesPassed,
                totalTestCases: result.totalTestCases,
                submittedAt,
                coinsEarned,
                totalCoins: 0,
                isFirstSolve
            },
            results: mappedResults,
            error: result.error,
            coinsEarned,
            totalCoins: 0,
            isFirstSolve
        });

        // ── All DB writes + coin logic run in background after response is sent ──
        Promise.resolve().then(async () => {
            try {
                const submission = await Submission.create({
                    studentId,
                    problemId: problem._id,
                    code,
                    language,
                    verdict: result.verdict,
                    testCasesPassed: result.testCasesPassed,
                    totalTestCases: result.totalTestCases
                });

                if (result.verdict === 'Accepted' && req.user.role === 'student' && !problem.isContestProblem) {
                    const progress = await Progress.findByStudent(studentId);
                    const alreadyInProgress = progress?.problemsSolved?.some(
                        id => id.toString() === problem._id.toString()
                    ) || false;
                    const isFirstSolve = !alreadyInProgress;

                    if (isFirstSolve) {
                        const hasViewedEditorial = await Progress.hasViewedEditorial(studentId, problem._id);
                        if (!hasViewedEditorial) {
                            const coinsEarned = problem.points || 0;
                            await User.addCoins(studentId, coinsEarned);
                            console.log(`   💰 Coins Awarded: +${coinsEarned} to student ${studentId}`);
                        } else {
                            console.log(`   ℹ️ Editorial was viewed - 0 coins awarded`);
                        }
                    } else {
                        console.log(`   ℹ️ Problem already solved before - no duplicate coins`);
                    }

                    await Progress.updateProblemsSolved(studentId, problem._id);
                    await Promise.all([
                        Progress.recalculateSectionProgress(studentId),
                        Progress.updateStreak(studentId)
                    ]);
                    const { addScoreJob } = require('../config/queue');
                    await addScoreJob(studentId);
                }
            } catch (bgErr) {
                console.error('   ⚠️ Background submission save error (non-fatal):', bgErr.message);
            }
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
            let actualProblemId = problemId;
            if (problemId && problemId !== 'global' && problemId !== 'all' && !/^[0-9a-fA-F]{24}$/.test(problemId)) {
                // Since problemId might be a slug passed in the query
                const Problem = require('../models/Problem');
                const problem = await Problem.findById(problemId);
                if (problem) {
                    actualProblemId = problem._id.toString();
                } else {
                    return res.status(404).json({ success: false, message: 'Problem not found' });
                }
            }
            submissions = await Submission.findByStudentAndProblem(studentId, actualProblemId);
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
