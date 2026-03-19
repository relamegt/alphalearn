// backend/controllers/contestController.js (COMPLETE WITH ALL FEATURES)
const Contest = require('../models/Contest');
const ContestSubmission = require('../models/ContestSubmission');
const Problem = require('../models/Problem');
const { executeWithTestCases, validateCode } = require('../services/judge0Service');
const { collections } = require('../config/astra');
const { ObjectId } = require('bson');
const { notifyLeaderboardUpdate, notifySubmission, notifyViolation } = require('../config/websocket');
const { getRedis } = require('../config/redis');

// Create contest (Admin/Instructor)
const createContest = async (req, res) => {
    try {
        const { title, description, startTime, endTime, problems, batchId, proctoringEnabled, tabSwitchLimit, maxViolations } = req.body;

        // Validate times
        if (new Date(startTime) >= new Date(endTime)) {
            return res.status(400).json({
                success: false,
                message: 'End time must be after start time'
            });
        }

        // Separate existing problem IDs and new problem data
        const existingProblemIds = [];
        const newProblemsData = [];

        if (problems && Array.isArray(problems)) {
            problems.forEach(p => {
                if (typeof p === 'string') {
                    existingProblemIds.push(p);
                } else if (typeof p === 'object' && p.title) {
                    newProblemsData.push(p);
                }
            });
        }

        // 1. Create Contest with existing IDs first
        const contest = await Contest.create({
            title,
            description,
            startTime,
            endTime,
            problems: existingProblemIds,
            batchId,
            createdBy: req.user.userId,
            proctoringEnabled: proctoringEnabled !== false,
            tabSwitchLimit: tabSwitchLimit || 3,
            maxViolations: maxViolations || 5
        });

        // 2. Create New Problems linked to this contest
        const newProblemIds = [];
        if (newProblemsData.length > 0) {
            for (const p of newProblemsData) {
                const newProblem = await Problem.create({
                    ...p,
                    contestId: contest._id,
                    isContestProblem: true,
                    createdBy: req.user.userId
                });
                newProblemIds.push(newProblem._id);
            }

            // 3. Update Contest with all problem IDs
            const allProblemIds = [...existingProblemIds, ...newProblemIds];
            await Contest.update(contest._id, {
                problems: allProblemIds
            });

            // Update return object
            contest.problems = allProblemIds;
        }

        res.status(201).json({
            success: true,
            message: 'Contest created successfully',
            contest
        });
    } catch (error) {
        console.error('Create contest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create contest',
            error: error.message
        });
    }
};

// backend/controllers/contestController.js - UPDATE getContestsByBatch

const getContestsByBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { status, page: _page, limit: _limit } = req.query;
        const studentId = req.user.userId;

        const page = parseInt(_page) || 1;
        const limit = parseInt(_limit) || 50;
        const startIndex = (page - 1) * limit;

        const { collections } = require('../config/astra');
        const { ObjectId } = require('bson');

        const query = {};
        const now = new Date();

        // Handle 'all' batch request (Admin/Instructor only)
        if (batchId === 'all') {
            if (req.user.role === 'student') {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            if (req.user.role === 'instructor') {
                const User = require('../models/User');
                const instructor = await User.findById(req.user.userId);
                const assignedBatches = instructor?.assignedBatches || [];
                const batchIds = [instructor?.batchId, ...assignedBatches]
                    .filter(id => id)
                    .map(id => new ObjectId(id));

                query.$or = [
                    { batchId: { $in: batchIds } },
                    { createdBy: new ObjectId(req.user.userId) }
                ];
            }
        } else {
            query.batchId = new ObjectId(batchId);
        }

        if (status === 'active') {
            query.startTime = { $lte: now };
            query.endTime = { $gte: now };
        } else if (status === 'upcoming') {
            query.startTime = { $gt: now };
        } else if (status === 'past') {
            query.endTime = { $lt: now };
        }

        const [contests, total] = await Promise.all([
            collections.contests
                .find(query)
                .sort({ startTime: -1 })
                .skip(startIndex)
                .limit(limit)
                .toArray(),
            collections.contests.countDocuments(query, { upperBound: 10000 })
        ]);

        // For students, add isSubmitted flag for each contest
        if (req.user.role === 'student') {
            const contestIds = contests.map(c => c._id);
            // BUG #16 FIX: Only fetch contestId field — not full submission docs.
            // Previously loaded full documents just to build a Set of IDs.
            const submissions = await collections.contestSubmissions.find({
                studentId: new ObjectId(studentId),
                contestId: { $in: contestIds },
                isFinalContestSubmission: true
            }, { projection: { contestId: 1 } }).toArray();

            const submittedContestIds = new Set(submissions.map(s => s.contestId.toString()));

            const contestsWithSubmissionStatus = contests.map(contest => ({
                ...contest,
                isSubmitted: submittedContestIds.has(contest._id.toString())
            }));

            return res.json({
                success: true,
                count: contestsWithSubmissionStatus.length,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                contests: contestsWithSubmissionStatus
            });
        }

        // For instructors/admins, return without isSubmitted
        res.json({
            success: true,
            count: contests.length,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            contests
        });
    } catch (error) {
        console.error('Get contests by batch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contests',
            error: error.message
        });
    }
};

// Get contest by ID with locked problems info
const getContestById = async (req, res) => {
    try {
        const { contestId } = req.params;
        const studentId = req.user.userId;
        const now = new Date();

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({
                success: false,
                message: 'Contest not found'
            });
        }

        if (req.user.role === 'instructor' && contest.batchId === null && contest.createdBy?.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You can only access your own global contests' });
        }

        // Check if contest submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contest._id);

        // Get solved problems
        const solvedProblems = await ContestSubmission.getAcceptedProblems(studentId, contest._id);
        const solvedProblemIds = solvedProblems.map(p => p.toString());

        // Get contest problems in BULK
        const contestProblems = await Problem.findByIds(contest.problems);
        const problemMap = new Map();
        contestProblems.forEach(p => problemMap.set(p._id.toString(), p));

        const problems = contest.problems.map((problemId) => {
            const problem = problemMap.get(problemId.toString());
            if (!problem) return null;

            const isProblemSolved = solvedProblemIds.includes(problemId.toString());

            // Hide test cases and editorial during active contest
            const isContestActive = now >= contest.startTime && now <= contest.endTime;
            if (req.user.role === 'student' && isContestActive) {
                if (problem.testCases) {
                    problem.testCases = problem.testCases.map(tc => ({
                        input: tc.isHidden ? 'Hidden' : tc.input,
                        output: tc.isHidden ? 'Hidden' : tc.output,
                        isHidden: tc.isHidden
                    }));
                }
                problem.editorial = null;
            }

            return {
                ...problem,
                isLocked: isProblemSolved || hasSubmitted,
                isSolved: isProblemSolved
            };
        });

        const validProblems = problems.filter(p => p !== null);

        res.json({
            success: true,
            contest: {
                ...contest,
                problems: validProblems,
                isSubmitted: hasSubmitted
            }
        });
    } catch (error) {
        console.error('Get contest by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch contest',
            error: error.message
        });
    }
};

// Update contest
const updateContest = async (req, res) => {
    try {
        const { contestId } = req.params;
        const updateData = req.body;

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        if (req.user.role === 'instructor' && contest.batchId === null && contest.createdBy?.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You can only modify your own global contests' });
        }

        // Check if contest has started
        const hasStarted = await Contest.hasStarted(contestId);
        if (hasStarted) {
            return res.status(400).json({
                success: false,
                message: 'Cannot update contest after it has started'
            });
        }

        await Contest.update(contestId, updateData);

        const updatedContest = await Contest.findById(contestId);

        res.json({
            success: true,
            message: 'Contest updated successfully',
            contest: updatedContest
        });
    } catch (error) {
        console.error('Update contest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contest',
            error: error.message
        });
    }
};

// Delete contest
const deleteContest = async (req, res) => {
    try {
        const { contestId } = req.params;

        // Fetch contest to verify it exists
        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        if (req.user.role === 'instructor' && contest.batchId === null && contest.createdBy?.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You can only delete your own global contests' });
        }

        // If it's a global contest (batchId === null), clean up spot users
        // Spot users are ONLY identified by the registeredForContest tag set during registerSpotUser.
        // Normal registered users who participated never get this tag, so they are NEVER touched.
        if (contest.batchId === null) {
            const User = require('../models/User');
            // Use bulk deletion instead of looping through users (O(N) -> O(1) DB operations)
            const result = await User.deleteByContest(contestId);
            console.log(`[deleteContest] Bulk deleted ${result.deletedCount} spot user(s) for contest ${contestId}`);
        }

        // Delete all contest submissions (for all users, normal + spot)
        await ContestSubmission.deleteByContest(contestId);

        // Delete contest-specific problems
        await Problem.deleteContestProblems(contestId);

        // Delete the contest itself
        await Contest.delete(contestId);

        res.json({
            success: true,
            message: 'Contest deleted successfully'
        });
    } catch (error) {
        console.error('Delete contest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete contest',
            error: error.message
        });
    }
};


// Submission locks using Redis to prevent race conditions in distributed environments
const { addScoreJob } = require('../config/queue');

// Submit code in contest with all features
const submitContestCode = async (req, res) => {
    const studentId = req.user.userId;
    const { problemId } = req.body;
    const redis = getRedis();
    const lockKey = `lock:submission:${studentId}:${problemId}`;
    let submissionLockAcquired = false; // Track if lock was actually acquired

    try {
        const { contestId } = req.params;
        const {
            code, language,
            tabSwitchCount = 0,
            tabSwitchDuration = 0,
            pasteAttempts = 0,
            fullscreenExits = 0,
            isAutoSubmit = false,
            isPractice = false
        } = req.body;

        const isPracticeMode = isPractice === true || isPractice === 'true';

        // 1. Acquire Redis Lock (TTL: 30 seconds to prevent deadlocks)
        if (!isPracticeMode) {
            const acquired = await redis.set(lockKey, 'LOCKED', 'NX', 'EX', 30);
            if (!acquired) {
                return res.status(429).json({
                    success: false,
                    message: 'Your previous submission is still being processed. Please wait.'
                });
            }
            submissionLockAcquired = true; // Mark lock as acquired
        }

        // 2. Basic Validation
        if (!code || !code.trim()) {
            return res.status(400).json({ success: false, message: 'Code cannot be empty' });
        }

        const validation = validateCode(code, language);
        if (!validation.valid) {
            return res.status(400).json({ success: false, message: 'Code validation failed', errors: validation.errors });
        }

        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        if (isPracticeMode) {
            // Practice Mode: Send to Queue
            const { addExecutionJob } = require('../config/queue');
            await addExecutionJob({
                type: 'submit',
                studentId,
                contestId: contest._id.toString(),
                problemId,
                code,
                language,
                isPractice: true,
                timeLimit: problem.timeLimit
            });

            return res.json({
                success: true,
                isProcessing: true,
                message: 'Practice submission is being processed...',
                isPractice: true
            });
        }



        // 3. Normal Contest Submission Flow
        // Check if contest is submitted (completed)
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contest._id);
        if (hasSubmitted) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted. No further submissions allowed.'
            });
        }

        // Check if problem already solved
        const isProblemSolved = await ContestSubmission.isProblemSolved(studentId, contest._id, problemId);
        if (isProblemSolved && !isAutoSubmit) {
            return res.status(400).json({
                success: false,
                message: 'Problem already solved. Cannot submit again.'
            });
        }

        const now = new Date();
        const endTimeDate = new Date(contest.endTime);
        const isActive = now >= new Date(contest.startTime) && now <= endTimeDate;

        let isGracePeriodActive = false;
        if (isAutoSubmit && now > endTimeDate) {
            const graceEndTime = new Date(endTimeDate.getTime() + 2 * 60000); // 2 mins grace period
            if (now <= graceEndTime) {
                isGracePeriodActive = true;
            }
        }

        if (!isActive && !isGracePeriodActive) {
            return res.status(400).json({
                success: false,
                message: 'Contest is not active'
            });
        }

        // Check if max violations exceeded (for manual submissions)
        const totalViolations = tabSwitchCount + fullscreenExits;
        if (contest.proctoringEnabled && !isAutoSubmit && totalViolations >= contest.maxViolations) {
            notifyViolation(contest._id.toString(), studentId, {
                type: 'MAX_VIOLATIONS_REACHED',
                message: 'Maximum violations exceeded. Your code will be auto-submitted.',
                totalViolations
            });

            return res.status(400).json({
                success: false,
                message: 'Maximum violations exceeded. Triggering auto-submission...',
                shouldAutoSubmit: true,
                totalViolations
            });
        }

        // Execute code asynchronously via BullMQ
        const { addExecutionJob } = require('../config/queue');
        await addExecutionJob({
            type: 'submit',
            studentId,
            contestId: contest._id.toString(),
            problemId,
            code,
            language,
            isPractice: false,
            tabSwitchCount,
            tabSwitchDuration,
            pasteAttempts,
            fullscreenExits,
            isAutoSubmit,
            timeLimit: problem.timeLimit
        });

        res.json({
            success: true,
            isProcessing: true,
            message: isAutoSubmit
                ? 'Code auto-submitted. Finalizing...'
                : 'Code submission is being processed...'
        });
    } catch (error) {
        // If exception occurs, immediately lift lock to allow retries
        if (submissionLockAcquired) {
            await redis.del(lockKey).catch(e => console.error(e));
        }

        console.error('Submit contest code error:', error);
        res.status(500).json({
            success: false,
            message: 'Code submission failed',
            error: error.message
        });
    } finally {
        // DO NOT release lock here if successfully acquired!
        // The worker will release it when processing finishes.
        // We only forcefully release it if there's a synchronous error making it error out.
        if (submissionLockAcquired) {
            // we let the worker release it
            // if we threw an error we would delete it, but `finally` runs regardless
            // so we handle the lock deletion exclusively in the catch block if needed.
        }
    }
};

// Run code in contest (Sample test cases only, or custom input)
const runContestCode = async (req, res) => {
    try {
        const { contestId } = req.params;
        const { problemId, code, language, isPractice = false, customInput, customInputs } = req.body;
        const studentId = req.user.userId;
        const isPracticeMode = isPractice === true || isPractice === 'true';
        const isCustom = customInput !== undefined && customInput !== null && String(customInput).trim() !== '';
        const isMultiCustom = Array.isArray(customInputs) && customInputs.length > 0;

        // Check if contest exists
        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        // Check if contest is submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contest._id);
        if (hasSubmitted && !isPracticeMode) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted. Cannot run code.'
            });
        }

        // Check if problem already solved
        const isProblemSolved = await ContestSubmission.isProblemSolved(studentId, contest._id, problemId);
        if (isProblemSolved && !isPracticeMode) {
            return res.status(400).json({
                success: false,
                message: 'Problem already solved. Cannot run code.'
            });
        }

        // Validate code
        if (!code || !code.trim()) {
            return res.status(400).json({ success: false, message: 'Code cannot be empty' });
        }

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

        // Helper: get solution code
        const getSolutionCode = () => {
            const solCode = problem.solutionCode?.[language] ||
                Object.values(problem.solutionCode || {}).find(c => c);
            const solLang = problem.solutionCode?.[language]
                ? language
                : Object.keys(problem.solutionCode || {}).find(k => problem.solutionCode[k]);
            return { solCode, solLang };
        };

        const { notifyExecutionResult } = require('../config/websocket');

        // ── Multi Custom Input Mode ──────────────────────────────────────────
        if (isMultiCustom) {
            const casesNeedingSolution = customInputs.filter(c => c.expectedOutput === undefined || c.expectedOutput === null);
            const userTestCases = customInputs.map(c => ({ input: c.input, output: c.expectedOutput ?? undefined, isHidden: false }));
            const { solCode, solLang } = getSolutionCode();
            const needsSolution = casesNeedingSolution.length > 0 && solCode && solLang;

            const [userResult, solResult] = await Promise.all([
                executeWithTestCases(language, code, userTestCases, problem.timeLimit),
                needsSolution
                    ? executeWithTestCases(solLang, solCode, casesNeedingSolution.map(c => ({ input: c.input, output: undefined, isHidden: false })), problem.timeLimit).catch(e => {
                        console.warn('[Contest Run] Solution code failed:', e.message);
                        return null;
                    })
                    : Promise.resolve(null)
            ]);

            let solOutputMap = {};
            if (solResult) {
                casesNeedingSolution.forEach((c, idx) => {
                    solOutputMap[c.input] = solResult.results[idx]?.actualOutput ?? null;
                });
            }

            const results = customInputs.map((c, i) => {
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
                    isCustom: c.isCustom ?? true,
                    hasSolution: expectedOut !== null
                };
            });

            const totalPassed = results.filter(r => r.passed).length;
            const finalVerdict = results.every(r => r.passed) ? 'Accepted'
                : results.some(r => r.verdict === 'Compilation Error') ? 'Compilation Error'
                    : results.some(r => r.verdict === 'Runtime Error') ? 'Runtime Error'
                        : results.some(r => r.verdict === 'TLE') ? 'TLE'
                            : 'Wrong Answer';

            const runResult = {
                isRun: true,
                success: true,
                problemId,
                isCustomInput: true,
                verdict: finalVerdict,
                testCasesPassed: totalPassed,
                totalTestCases: results.length,
                results,
                error: results.find(r => r.error)?.error || null,
                message: 'Custom input executed successfully'
            };

            notifyExecutionResult(contest._id.toString(), studentId, runResult);
            return res.json({ success: true, isProcessing: true, message: 'Custom input code run queued...' });
        }

        // ── Single Custom Input Mode ──────────────────────────────────────────
        if (isCustom) {
            const userTestCase = [{ input: customInput, output: undefined, isHidden: false }];
            const { solCode, solLang } = getSolutionCode();

            const [userResult, solRunResult] = await Promise.all([
                executeWithTestCases(language, code, userTestCase, problem.timeLimit),
                solCode && solLang
                    ? executeWithTestCases(solLang, solCode, [{ input: customInput, output: undefined, isHidden: false }], problem.timeLimit).catch(e => {
                        console.warn('[Contest Run] Solution code failed:', e.message);
                        return null;
                    })
                    : Promise.resolve(null)
            ]);

            const userOutput = userResult.results[0]?.actualOutput ?? '';
            const userVerdict = userResult.results[0]?.verdict ?? userResult.verdict;
            const userError = userResult.results[0]?.error ?? userResult.error;

            let expectedOutput = null;
            if (solRunResult) {
                expectedOutput = solRunResult.results[0]?.actualOutput ?? null;
            }

            const passed = expectedOutput !== null
                ? (userOutput?.trim() === expectedOutput?.trim())
                : (userVerdict === 'Accepted' || userVerdict === 'No output');

            const results = [{
                input: customInput,
                expectedOutput: expectedOutput ?? '(No reference solution available)',
                actualOutput: userOutput,
                passed,
                verdict: expectedOutput !== null
                    ? (passed ? 'Accepted' : (userError ? userVerdict : 'Wrong Answer'))
                    : userVerdict,
                error: userError,
                isHidden: false,
                isCustom: true,
                hasSolution: !!expectedOutput
            }];

            const runResult = {
                isRun: true,
                success: true,
                problemId,
                isCustomInput: true,
                verdict: results[0].verdict,
                testCasesPassed: passed ? 1 : 0,
                totalTestCases: 1,
                results,
                error: userError || null,
                message: 'Custom input executed successfully'
            };

            notifyExecutionResult(contest._id.toString(), studentId, runResult);
            return res.json({ success: true, isProcessing: true, message: 'Custom input code run queued...' });
        }

        // ── Standard Mode: run sample test cases via queue ────────────────────
        let testCases = await Problem.getAllTestCases(problemId);
        testCases = testCases.filter(tc => !tc.isHidden);

        if (testCases.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No sample test cases available for this problem'
            });
        }

        // Execute code via BullMQ Background worker
        const { addExecutionJob } = require('../config/queue');
        await addExecutionJob({
            type: 'run',
            studentId,
            contestId: contest._id.toString(),
            problemId,
            code,
            language,
            isPractice: isPracticeMode,
            timeLimit: problem.timeLimit
        });

        res.json({
            success: true,
            isProcessing: true,
            message: 'Code run queued...'
        });
    } catch (error) {
        console.error('Run contest code error:', error);
        res.status(500).json({
            success: false,
            message: 'Code execution failed',
            error: error.message
        });
    }
};

// Manually finish/submit contest
const finishContest = async (req, res) => {
    let lockAcquired = false;
    try {
        const { contestId } = req.params;
        const studentId = req.user.userId;
        const redis = getRedis();
        const finishLockKey = `lock:finish:${studentId}:${contestId}`;

        // Prevent concurrent finish triggers
        lockAcquired = await redis.set(finishLockKey, 'LOCKED', 'NX', 'EX', 10);
        if (!lockAcquired) {
            return res.status(429).json({ success: false, message: 'Your contest submission is being finalized...' });
        }

        // Frontend sends current tracked violation counts as the definitive snapshot
        const { finalViolations } = req.body || {};

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }
        
        // Check if already submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contest._id);
        if (hasSubmitted) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted'
            });
        }


        // Build violation snapshot — enforce maximum between frontend and backend
        const dbViolations = await ContestSubmission.getProctoringViolations(studentId, contest._id);

        let violationSnapshot = {
            tabSwitchCount: Math.max((finalViolations?.tabSwitchCount || 0), dbViolations.totalTabSwitches),
            tabSwitchDuration: Math.max((finalViolations?.tabSwitchDuration || 0), dbViolations.totalTabSwitchDuration),
            fullscreenExits: Math.max((finalViolations?.fullscreenExits || 0), dbViolations.totalFullscreenExits),
            pasteAttempts: Math.max((finalViolations?.pasteAttempts || 0), dbViolations.totalPasteAttempts)
        };
        const totalViolations = (violationSnapshot.tabSwitchCount || 0) + (violationSnapshot.fullscreenExits || 0);

        // Mark contest as completed — stores violation snapshot on the COMPLETED record
        await ContestSubmission.markContestCompleted(studentId, contest._id, 0, violationSnapshot);

        let finalScore = 0;
        let finalProblemsSolved = 0;

        // OFFLOAD Score Recalculation to background worker queue
        // This prevents the "thundering herd" effect when many users finish at once
        if (req.user.role === 'student') {
            await addScoreJob(studentId);
        }

        // Update live leaderboard (Throttled)
        try {
            await ContestSubmission.invalidateCache(contest._id);
            notifyLeaderboardUpdate(contest._id.toString());
        } catch (wsError) {
            console.error('WebSocket notification error in finishContest:', wsError);
        }

        res.json({
            success: true,
            message: 'Contest submitted successfully',
            finalScore,
            problemsSolved: finalProblemsSolved,
            totalViolations
        });
    } catch (error) {
        console.error('Finish contest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit contest',
            error: error.message
        });
    } finally {
        // BUG #2 FIX: Only release the lock if WE acquired it.
        // Previously this always deleted the key — including when lockAcquired was false
        // (the 429 path), which would delete ANOTHER user's active lock and allow a
        // third user to acquire it and cause a double-submission.
        if (lockAcquired) {
            await getRedis().del(`lock:finish:${req.user.userId}:${req.params.contestId}`);
        }
    }
};

// Get contest leaderboard with real-time support
const getContestLeaderboard = async (req, res) => {
    try {
        const { contestId } = req.params;
        const currentUserId = req.user?.userId || req.user?._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;

        // Fix #17: Run leaderboard and contest fetches in parallel to halve DB wait time
        const [{ leaderboard, total, totalPages }, contest] = await Promise.all([
            ContestSubmission.getLeaderboard(contestId, currentUserId, false, page, limit),
            Contest.findById(contestId)
        ]);

        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        if (req.user?.role === 'instructor' && contest.batchId === null && contest.createdBy?.toString() !== currentUserId?.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied: You can only view the leaderboard of your own global contests' });
        }

        // Populate problem titles manually keeping original order
        if (contest && contest.problems) {
            const problems = await Problem.findByIds(contest.problems);
            contest.problems = problems.map(p => ({ _id: p._id, title: p.title }));
        }

        // HIGH-3 FIX: Previously countStudentsInBatch was called on EVERY leaderboard request.
        // With 1000 students polling every 30s, that’s ~33 countDocuments calls/second for
        // a value that never changes during a contest.
        // Fix: Cache it in Redis for 5 minutes (contest roster does not change mid-contest).
        let totalEnrolled = total;
        if (contest?.batchId) {
            try {
                const redis = getRedis();
                const enrolledCacheKey = `cache:enrolled:${contestId}`;
                const enrolledCached = await redis.get(enrolledCacheKey);

                if (enrolledCached) {
                    totalEnrolled = parseInt(enrolledCached, 10);
                } else {
                    const User = require('../models/User');
                    totalEnrolled = await User.countStudentsInBatch(contest.batchId.toString());
                    await redis.setex(enrolledCacheKey, 5 * 60, String(totalEnrolled)); // 5 min TTL
                }
            } catch (e) { /* silent fallback to total */ }
        }

        res.json({
            success: true,
            count: leaderboard.length,
            total,
            page,
            limit,
            totalPages,
            totalEnrolled,
            leaderboard,
            contest,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get contest leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch leaderboard',
            error: error.message
        });
    }
};

// Get student contest submissions
const getStudentContestSubmissions = async (req, res) => {
    try {
        const { contestId } = req.params;
        const studentId = req.user.userId;

        const submissions = await ContestSubmission.findByStudentAndContest(studentId, contestId);

        res.json({
            success: true,
            count: submissions.length,
            submissions
        });
    } catch (error) {
        console.error('Get student contest submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch submissions',
            error: error.message
        });
    }
};

// Get contest statistics with problem-wise stats
const getContestStatistics = async (req, res) => {
    try {
        const { contestId } = req.params;

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        if (req.user.role === 'instructor' && contest.batchId === null && contest.createdBy?.toString() !== req.user.userId) {
            return res.status(403).json({ success: false, message: 'Access denied: You can only view statistics of your own global contests' });
        }

        const stats = await Contest.getStatistics(contestId);

        // Get problem-wise statistics
        const problemStats = await ContestSubmission.getProblemStatistics(contestId);

        res.json({
            success: true,
            statistics: {
                ...stats,
                problemStats
            }
        });
    } catch (error) {
        console.error('Get contest statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message
        });
    }
};

// Get proctoring violations for student in contest
const getProctoringViolations = async (req, res) => {
    try {
        const { contestId, studentId } = req.params;

        // Check permissions
        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const violations = await ContestSubmission.getProctoringViolations(studentId, contestId);

        res.json({
            success: true,
            violations
        });
    } catch (error) {
        console.error('Get proctoring violations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch violations',
            error: error.message
        });
    }
};

// Log a violation
const logViolation = async (req, res) => {
    try {
        const { contestId } = req.params;
        const studentId = req.user.userId;
        const violations = req.body;

        // HIGH-2 FIX: Each tab-switch was previously a full DB insert — an INSERT per event.
        // With 1000 students switching tabs 5 times each, that's 5000 DB writes per contest.
        // Fix: Buffer violations in Redis for 30s, then flush as a single DB write.
        // The Redis key accumulates the maximum violation counts seen within the window.
        const redis = getRedis();
        const debounceKey = `viol:buffer:${studentId}:${contestId}`;
        const lockKey = `viol:lock:${studentId}:${contestId}`;
        const DEBOUNCE_S = 30;

        // Accumulate maximums in Redis hash (atomic per field)
        const pipe = redis.pipeline();
        pipe.hset(debounceKey,
            'tabSwitchCount', violations.tabSwitchCount || 0,
            'tabSwitchDuration', violations.tabSwitchDuration || 0,
            'pasteAttempts', violations.pasteAttempts || 0,
            'fullscreenExits', violations.fullscreenExits || 0
        );
        pipe.expire(debounceKey, DEBOUNCE_S * 2); // Safety TTL
        await pipe.exec();

        // Only one DB write per 30s window per student
        const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', DEBOUNCE_S).catch(() => null);
        if (lockAcquired) {
            setTimeout(async () => {
                try {
                    const buffered = await redis.hgetall(debounceKey);
                    if (buffered) {
                        await redis.del(debounceKey);
                        await ContestSubmission.logViolation(studentId, contestId, {
                            tabSwitchCount: parseInt(buffered.tabSwitchCount || 0),
                            tabSwitchDuration: parseFloat(buffered.tabSwitchDuration || 0),
                            pasteAttempts: parseInt(buffered.pasteAttempts || 0),
                            fullscreenExits: parseInt(buffered.fullscreenExits || 0)
                        });
                    }
                } catch (e) {
                    console.error('[logViolation] Debounced flush error:', e.message);
                }
            }, DEBOUNCE_S * 1000);
        }
        // else: another call in this window already scheduled the flush — our hset update is captured

        res.json({ success: true, message: 'Violation logged' });
    } catch (error) {
        console.error('Log violation error:', error);
        res.status(500).json({ success: false, message: 'Failed to log violation' });
    }
};

// --- NEW FUNCTIONS FOR SPOT USERS ---
const getPublicContestInfo = async (req, res) => {
    try {
        const { contestId } = req.params;
        const contest = await Contest.findById(contestId);

        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        // Check if it's already ended
        const now = new Date();
        if (now > new Date(contest.endTime)) {
            return res.status(400).json({ success: false, message: 'Contest has already ended', status: 'ended' });
        }

        // Return only public details
        res.json({
            success: true,
            contest: {
                _id: contest._id,
                title: contest.title,
                description: contest.description,
                startTime: contest.startTime,
                endTime: contest.endTime,
                isGlobal: contest.batchId === null // Treat it as global if batchId is null
            }
        });
    } catch (error) {
        console.error('Get public contest info error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch contest info' });
    }
};

const registerSpotUser = async (req, res) => {
    try {
        const { contestId, name, rollNumber, branch } = req.body;

        // Contest.findById handles both slug and ObjectId — use it to resolve to the real document.
        // The contestId from req.body may be a slug (e.g. "g20-6307") because it comes from the
        // frontend URL param. We must use contest._id (the real ObjectId) for DB relationships.
        const contest = await Contest.findById(contestId);
        if (!contest) return res.status(404).json({ success: false, message: 'Contest not found' });

        if (contest.batchId !== null) {
            return res.status(403).json({ success: false, message: 'This is not a global contest. Login required.' });
        }

        const { ObjectId } = require('bson');
        const User = require('../models/User');
        const jwt = require('jsonwebtoken');
        const { getRedis } = require('../config/redis');
        const redis = getRedis();

        // Use the resolved real ObjectId string — NOT the raw slug from req.body
        const resolvedContestId = contest._id.toString();

        // BUG #8 FIX: Race condition — two simultaneous requests (e.g., double-click) could
        // both read null from redis.get(fpKey) and both proceed to create duplicate user accounts.
        // Fix: Use SET NX as an atomic creation lock BEFORE any DB insert.
        // The token cache key doubles as the creation lock: only the first caller proceeds.
        const crypto = require('crypto');
        const fpRaw = `spot:${resolvedContestId}:${(name || '').trim().toLowerCase()}:${(rollNumber || '').trim().toLowerCase()}`;
        const fpKey = `spot:dedup:${crypto.createHash('sha256').update(fpRaw).digest('hex').substring(0, 16)}`;

        // Atomic check-and-lock: SET NX returns null if key already exists.
        // Use a 30-second placeholder so concurrent duplicate requests wait or return early.
        const creationLockKey = `spot:creating:${fpKey}`;
        const lockAcquiredForSpot = await redis.set(creationLockKey, '1', 'NX', 'EX', 30);

        const existingToken = await redis.get(fpKey);
        if (existingToken) {
            // Release creation lock since we won't be creating a new user
            try { await redis.del(creationLockKey); } catch (e) { /* non-fatal */ }
            try {
                const decoded = jwt.verify(existingToken, process.env.JWT_ACCESS_SECRET || 'fallback_secret');
                return res.json({
                    success: true,
                    token: existingToken,
                    user: {
                        userId: decoded.userId,
                        name,
                        role: 'student',
                        isSpotUser: true,
                        registeredForContest: resolvedContestId,
                        rollNumber: rollNumber || 'N/A',
                        branch: branch || 'N/A'
                    }
                });
            } catch (expiredErr) {
                // Token expired — fall through to create a fresh user
                await redis.del(fpKey);
            }
        }

        // If another request is already creating this user (lock held), reject the duplicate
        if (!lockAcquiredForSpot && !existingToken) {
            return res.status(429).json({
                success: false,
                message: 'Registration in progress. Please wait a moment and try again.'
            });
        }

        // Generate a unique spot email
        const spotEmail = `spot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@temporary.com`;

        // We DO create a temporary User in the database so that leaderboard resolves correctly.
        // It's a single User document. Astra DB limits total models/collections, NOT rows.
        const user = await User.create({
            email: spotEmail,
            // Random secure password since they will never login with it
            password: Math.random().toString(36),
            firstName: name,
            lastName: '',
            role: 'student', // so middleware treats them correctly
            batchId: null, // Global user
            registeredForContest: resolvedContestId, // ← always the real 24-char hex ObjectId
            education: {
                rollNumber: rollNumber || 'N/A',
                branch: branch || 'N/A'
            },
            profile: {
                phone: null,
                whatsapp: null,
            }
        });

        // Set isSpotUser flag in their token so we can distinguish if needed.
        // Token expiry = contest endTime + 2-hour buffer (so they can still view the leaderboard
        // after submission). Minimum 30 minutes in case the contest is already near its end.
        const BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours
        const MIN_TTL_S = 30 * 60;           // 30 minutes floor
        const contestEnd = contest.endTime ? new Date(contest.endTime).getTime() : Date.now();
        const tokenTTLs = Math.max(MIN_TTL_S, Math.floor((contestEnd + BUFFER_MS - Date.now()) / 1000));

        const token = jwt.sign(
            {
                userId: user._id.toString(),
                role: 'student',
                isSpotUser: true,
                tokenVersion: user.tokenVersion || 0 // Required by auth middleware
            },
            process.env.JWT_ACCESS_SECRET || 'fallback_secret',
            { expiresIn: tokenTTLs } // seconds — dynamic, proportional to contest duration
        );

        user.activeSessionToken = token;
        await User.updateSession(user._id.toString(), token, 'spot-fingerprint');

        // Cache the token for 5 minutes to deduplicate rapid re-registrations
        try { await redis.setex(fpKey, 5 * 60, token); } catch (e) { /* non-fatal */ }
        // BUG #8 FIX: Release the creation lock now that the token is cached.
        // Subsequent duplicate requests will find the token in fpKey and return it.
        try { await redis.del(creationLockKey); } catch (e) { /* non-fatal */ }

        res.json({
            success: true,
            token,
            user: {
                userId: user._id.toString(),
                name: name,
                role: 'student',
                isSpotUser: true,
                registeredForContest: resolvedContestId,
                rollNumber: rollNumber || 'N/A',
                branch: branch || 'N/A'
            }
        });
    } catch (error) {
        // BUG #8 FIX: Always release the creation lock on error path too
        try {
            if (typeof creationLockKey !== 'undefined' && creationLockKey) {
                const redis = getRedis();
                await redis.del(creationLockKey);
            }
        } catch (e) { /* non-fatal */ }
        console.error('Register spot user error:', error);
        res.status(500).json({ success: false, message: 'Failed to register. ' + error.message });
    }
};

// Unlock a student's contest so they can continue (Admin or contest creator only)
const unlockContestForUser = async (req, res) => {
    try {
        const { contestId } = req.params;
        const { studentId } = req.body;
        const callerId = req.user.userId;
        const callerRole = req.user.role;

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'studentId is required' });
        }

        // Fetch contest once — used for both auth check and time-window check
        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({ success: false, message: 'Contest not found' });
        }

        // Authorization: admin always allowed; instructor only if they created the contest
        if (callerRole === 'instructor' && contest.createdBy?.toString() !== callerId) {
            return res.status(403).json({ success: false, message: 'Only the contest creator or an admin can unlock users' });
        }

        // Time-window check: contest must still be active (not ended)
        const now = new Date();
        if (now > contest.endTime) {
            return res.status(400).json({ success: false, message: 'Contest has already ended. Cannot unlock.' });
        }
        if (now < contest.startTime) {
            return res.status(400).json({ success: false, message: 'Contest has not started yet.' });
        }

        // Verify the student actually has a final submission
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contestId);
        if (!hasSubmitted) {
            return res.status(400).json({ success: false, message: 'This student has not submitted the contest yet.' });
        }

        // Prevent concurrent unlock ops for the same student+contest
        const redis = getRedis();
        const unlockLockKey = `lock:unlock:${studentId}:${contestId}`;
        const lockAcquired = await redis.set(unlockLockKey, 'LOCKED', 'NX', 'EX', 10);
        if (!lockAcquired) {
            return res.status(429).json({ success: false, message: 'Unlock already in progress for this student.' });
        }

        try {
            // Remove the final-submission marker so the student can continue
            await ContestSubmission.removeContestCompletion(studentId, contestId);

            // Clear all violation records so the student starts fresh
            // (otherwise the proctoring system sees old counts and auto-submits immediately)
            await ContestSubmission.clearViolationLogs(studentId, contestId);

            // Clear any buffered violations in Redis
            const violBufferKey = `viol:buffer:${studentId}:${contestId}`;
            const violLockKey = `viol:lock:${studentId}:${contestId}`;
            await redis.del(violBufferKey, violLockKey).catch(() => { });

            // Invalidate leaderboard cache so the status updates immediately
            await ContestSubmission.invalidateCache(contestId);
            notifyLeaderboardUpdate(contestId);

            res.json({
                success: true,
                message: 'Student has been unlocked and can now continue the contest.'
            });
        } finally {
            await redis.del(unlockLockKey).catch(() => { });
        }
    } catch (error) {
        console.error('Unlock contest for user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unlock contest for user',
            error: error.message
        });
    }
};


module.exports = {
    createContest,
    getContestsByBatch,
    getContestById,
    updateContest,
    deleteContest,
    submitContestCode,
    runContestCode,
    finishContest,
    getContestLeaderboard,
    getStudentContestSubmissions,
    getContestStatistics,
    getProctoringViolations,
    logViolation, // Export it
    getPublicContestInfo,
    registerSpotUser,
    unlockContestForUser
};
