// backend/controllers/contestController.js (COMPLETE WITH ALL FEATURES)
const Contest = require('../models/Contest');
const ContestSubmission = require('../models/ContestSubmission');
const Problem = require('../models/Problem');
const { executeWithTestCases, validateCode } = require('../services/judge0Service');
const { notifyLeaderboardUpdate, notifySubmission, notifyViolation } = require('../config/websocket');

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
        const { status } = req.query;
        const studentId = req.user.userId; // Get current user ID

        let contests;

        // Handle 'all' batch request (Admin/Instructor only)
        if (batchId === 'all') {
            if (req.user.role === 'student') {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            contests = await Contest.findAll();
        } else if (status === 'active') {
            contests = await Contest.findActiveContests(batchId);
        } else if (status === 'upcoming') {
            contests = await Contest.findUpcomingContests(batchId);
        } else if (status === 'past') {
            contests = await Contest.findPastContests(batchId);
        } else {
            contests = await Contest.findByBatchId(batchId);
        }

        // For students, add isSubmitted flag for each contest
        if (req.user.role === 'student') {
            const contestsWithSubmissionStatus = await Promise.all(
                contests.map(async (contest) => {
                    try {
                        const isSubmitted = await ContestSubmission.hasSubmittedContest(
                            studentId,
                            contest._id
                        );

                        return {
                            ...contest,
                            isSubmitted
                        };
                    } catch (error) {
                        console.error(`Error checking submission for contest ${contest._id}:`, error);
                        return {
                            ...contest,
                            isSubmitted: false
                        };
                    }
                })
            );

            return res.json({
                success: true,
                count: contestsWithSubmissionStatus.length,
                contests: contestsWithSubmissionStatus
            });
        }

        // For instructors/admins, return without isSubmitted
        res.json({
            success: true,
            count: contests.length,
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

        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({
                success: false,
                message: 'Contest not found'
            });
        }

        // Check if contest submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contestId);

        // Get solved problems
        const solvedProblems = await ContestSubmission.getAcceptedProblems(studentId, contestId);
        const solvedProblemIds = solvedProblems.map(p => p.toString());

        // Get contest problems
        const problems = await Promise.all(
            contest.problems.map(async (problemId) => {
                const problem = await Problem.findById(problemId);
                if (!problem) return null;

                const isProblemSolved = solvedProblemIds.includes(problemId.toString());

                // Hide test cases and editorial during active contest
                if (req.user.role === 'student' && await Contest.isActive(contestId)) {
                    problem.testCases = problem.testCases.map(tc => ({
                        input: tc.isHidden ? 'Hidden' : tc.input,
                        output: tc.isHidden ? 'Hidden' : tc.output,
                        isHidden: tc.isHidden
                    }));
                    problem.editorial = null;
                }

                return {
                    ...problem,
                    isLocked: isProblemSolved || hasSubmitted,
                    isSolved: isProblemSolved
                };
            })
        );

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

        // If it's a global contest (batchId === null), clean up spot users
        // Spot users are ONLY identified by the registeredForContest tag set during registerSpotUser.
        // Normal registered users who participated never get this tag, so they are NEVER touched.
        if (contest.batchId === null) {
            const User = require('../models/User');
            const { collections } = require('../config/astra');
            const { ObjectId } = require('bson');

            // Find ONLY users tagged as registered for THIS specific contest.
            // This field is exclusively set in registerSpotUser — normal users never have it.
            const spotUsers = await collections.users.find({
                registeredForContest: new ObjectId(contestId)
            }).toArray();

            for (const spotUser of spotUsers) {
                // Double-safety check: only delete if the email pattern confirms it's a spot user.
                // This prevents any edge-case where a normal user somehow has the tag.
                if (
                    spotUser.email &&
                    spotUser.email.startsWith('spot_') &&
                    spotUser.role === 'student'
                ) {
                    await User.delete(spotUser._id.toString());
                } else {
                    console.warn(
                        `[deleteContest] Skipping user ${spotUser._id} — ` +
                        `has registeredForContest tag but does not look like a spot user (email: ${spotUser.email})`
                    );
                }
            }

            console.log(`[deleteContest] Deleted ${spotUsers.length} spot user(s) for contest ${contestId}`);
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


// Submit code in contest with all features
const submitContestCode = async (req, res) => {
    try {
        const { contestId } = req.params;
        const {
            problemId, code, language,
            tabSwitchCount = 0,
            tabSwitchDuration = 0,
            pasteAttempts = 0,
            fullscreenExits = 0,
            isAutoSubmit = false,
            isPractice = false
        } = req.body;
        const studentId = req.user.userId;
        const isPracticeMode = isPractice === true || isPractice === 'true';

        // 1. Basic Validation
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
            // Practice Mode: Completely Ephemeral
            const allTestCases = await Problem.getAllTestCases(problemId);
            const result = await executeWithTestCases(language, code, allTestCases, problem.timeLimit);

            return res.json({
                success: true,
                message: result.verdict === 'Accepted' ? 'Practice submission passed!' : 'Practice submission completed',
                isPractice: true,
                submission: {
                    _id: 'temporary-practice-id', // Use _id for compatibility
                    verdict: result.verdict,
                    testCasesPassed: result.testCasesPassed,
                    totalTestCases: result.totalTestCases,
                    submittedAt: new Date(),
                    tabSwitchCount: 0,
                    tabSwitchDuration: 0,
                    pasteAttempts: 0,
                    fullscreenExits: 0
                },
                results: result.results.map(r => ({
                    input: r.input,
                    expectedOutput: r.expectedOutput,
                    actualOutput: r.actualOutput,
                    error: r.error,
                    passed: r.passed,
                    isHidden: r.isHidden, // Keep hidden test cases hidden in practice mode
                    actualOutput: r.isHidden ? (r.passed ? 'Hidden' : 'Hidden') : r.actualOutput, // Double check to not leak actual output
                    expectedOutput: r.isHidden ? 'Hidden' : r.expectedOutput,
                    input: r.isHidden ? 'Hidden' : r.input
                }))
            });
        }

        // 3b. Normal Contest Submission Flow
        // Check if contest is submitted (completed)
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contestId);
        if (hasSubmitted) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted. No further submissions allowed.'
            });
        }

        // Check if problem already solved
        const isProblemSolved = await ContestSubmission.isProblemSolved(studentId, contestId, problemId);
        if (isProblemSolved && !isAutoSubmit) {
            return res.status(400).json({
                success: false,
                message: 'Problem already solved. Cannot submit again.'
            });
        }

        const now = new Date();
        const isActive = now >= contest.startTime && now <= contest.endTime;

        if (!isActive && !isAutoSubmit) {
            return res.status(400).json({
                success: false,
                message: 'Contest is not active'
            });
        }

        // Check if max violations exceeded (for manual submissions)
        const totalViolations = tabSwitchCount + fullscreenExits;
        if (contest.proctoringEnabled && !isAutoSubmit && totalViolations >= contest.maxViolations) {
            notifyViolation(contestId, studentId, {
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

        // Execute code against all test cases
        const allTestCases = await Problem.getAllTestCases(problemId);
        const result = await executeWithTestCases(language, code, allTestCases, problem.timeLimit);

        // Create contest submission
        const submission = await ContestSubmission.create({
            contestId,
            studentId,
            problemId,
            code,
            language,
            verdict: result.verdict,
            testCasesPassed: result.testCasesPassed,
            totalTestCases: result.totalTestCases,
            tabSwitchCount,
            tabSwitchDuration,
            pasteAttempts,
            fullscreenExits,
            isAutoSubmit
        });

        // Broadcast updates via WebSocket
        try {
            const leaderboard = await ContestSubmission.getLeaderboard(contestId);
            notifyLeaderboardUpdate(contestId, leaderboard);

            notifySubmission(contestId, {
                studentId,
                problemId,
                verdict: result.verdict,
                timestamp: submission.submittedAt,
                isAutoSubmit
            });
        } catch (wsError) {
            console.error('WebSocket notification error:', wsError);
        }

        res.json({
            success: true,
            message: isAutoSubmit
                ? 'Code auto-submitted due to violations'
                : result.verdict === 'Accepted'
                    ? 'Problem solved! Submission locked.'
                    : 'Code submitted successfully',
            submission: {
                id: submission._id,
                verdict: submission.verdict,
                testCasesPassed: submission.testCasesPassed,
                totalTestCases: submission.totalTestCases,
                submittedAt: submission.submittedAt,
                isAutoSubmit,
                problemLocked: result.verdict === 'Accepted'
            },
            results: result.results.map(r => ({
                input: r.isHidden ? 'Hidden' : r.input,
                expectedOutput: r.isHidden ? 'Hidden' : r.expectedOutput,
                actualOutput: r.isHidden ? (r.passed ? 'Hidden' : 'Wrong Answer') : r.actualOutput,
                passed: r.passed,
                isHidden: r.isHidden,
                verdict: r.verdict,
                error: r.error
            }))
        });
    } catch (error) {
        console.error('Submit contest code error:', error);
        res.status(500).json({
            success: false,
            message: 'Code submission failed',
            error: error.message
        });
    }
};

// Run code in contest (Sample test cases only - no submission)
const runContestCode = async (req, res) => {
    try {
        const { contestId } = req.params;
        const { problemId, code, language, isPractice = false } = req.body;
        const studentId = req.user.userId;
        const isPracticeMode = isPractice === true || isPractice === 'true';

        // Check if contest is submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contestId);
        if (hasSubmitted && !isPracticeMode) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted. Cannot run code.'
            });
        }

        // Check if problem already solved
        // Check if problem already solved
        const isProblemSolved = await ContestSubmission.isProblemSolved(studentId, contestId, problemId);
        if (isProblemSolved && !isPracticeMode) {
            return res.status(400).json({
                success: false,
                message: 'Problem already solved. Cannot run code.'
            });
        }

        // Check if contest exists
        const contest = await Contest.findById(contestId);
        if (!contest) {
            return res.status(404).json({
                success: false,
                message: 'Contest not found'
            });
        }

        // Validate code
        if (!code || !code.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Code cannot be empty'
            });
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
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        // Get test cases (All for practice, Sample for contest)
        // For 'Run', strictly ONLY expose non-hidden (sample) test cases.
        // We never run against hidden cases for 'Run' action.
        let testCases = await Problem.getAllTestCases(problemId);
        testCases = testCases.filter(tc => !tc.isHidden);

        if (testCases.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No sample test cases available for this problem'
            });
        }

        // Execute code
        const result = await executeWithTestCases(language, code, testCases, problem.timeLimit);

        res.json({
            success: true,
            message: 'Code executed successfully',
            results: result.results.map(r => ({
                input: r.input,
                expectedOutput: r.expectedOutput,
                actualOutput: r.actualOutput,
                passed: r.passed,
                verdict: r.verdict,
                error: r.error,
                isHidden: r.isHidden
            }))
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
    try {
        const { contestId } = req.params;
        const studentId = req.user.userId;
        // Frontend sends current tracked violation counts as the definitive snapshot
        const { finalViolations } = req.body || {};

        // Check if already submitted
        const hasSubmitted = await ContestSubmission.hasSubmittedContest(studentId, contestId);
        if (hasSubmitted) {
            return res.status(400).json({
                success: false,
                message: 'Contest already submitted'
            });
        }

        // Calculate final score
        const scoreData = await ContestSubmission.calculateScore(studentId, contestId);

        // Build violation snapshot — prefer frontend's live count; fall back to DB logs
        let violationSnapshot = finalViolations || {};
        if (!finalViolations) {
            // No snapshot from frontend — aggregate from existing violation log records
            const dbViolations = await ContestSubmission.getProctoringViolations(studentId, contestId);
            violationSnapshot = {
                tabSwitchCount: dbViolations.totalTabSwitches,
                tabSwitchDuration: dbViolations.totalTabSwitchDuration,
                fullscreenExits: dbViolations.totalFullscreenExits,
                pasteAttempts: dbViolations.totalPasteAttempts
            };
        }
        const totalViolations = (violationSnapshot.tabSwitchCount || 0) + (violationSnapshot.fullscreenExits || 0);

        // Mark contest as completed — stores violation snapshot on the COMPLETED record
        await ContestSubmission.markContestCompleted(studentId, contestId, scoreData.score, violationSnapshot);

        // Recalculate and sync global leaderboard scores for this student.
        // This ensures the internal contest score gets added to their overallScore & alphacoins immediately
        if (req.user.role === 'student') {
            try {
                const Leaderboard = require('../models/Leaderboard');
                await Leaderboard.recalculateScores(studentId);
            } catch (scoreErr) {
                console.error('Failed to recalculate score after contest:', scoreErr);
            }
        }

        // Update live leaderboard
        try {
            const leaderboard = await ContestSubmission.getLeaderboard(contestId);
            notifyLeaderboardUpdate(contestId, leaderboard);
        } catch (wsError) {
            console.error('WebSocket notification error:', wsError);
        }

        res.json({
            success: true,
            message: 'Contest submitted successfully',
            finalScore: scoreData.score,
            problemsSolved: scoreData.problemsSolved,
            totalViolations
        });
    } catch (error) {
        console.error('Finish contest error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit contest',
            error: error.message
        });
    }
};


// Get contest leaderboard with real-time support
const getContestLeaderboard = async (req, res) => {
    try {
        const { contestId } = req.params;
        const currentUserId = req.user?.userId || req.user?._id;

        const leaderboard = await ContestSubmission.getLeaderboard(contestId, currentUserId);
        const contest = await Contest.findById(contestId);

        // Populate problem titles manually keeping original order
        if (contest && contest.problems) {
            const problems = await Problem.findByIds(contest.problems);
            contest.problems = problems.map(p => ({ _id: p._id, title: p.title }));
        }

        // Count total enrolled students for this contest's batch
        let totalParticipants = leaderboard.length;
        if (contest?.batchId) {
            try {
                const User = require('../models/User');
                const batchStudents = await User.getStudentsByBatch(contest.batchId.toString());
                totalParticipants = batchStudents.length;
            } catch (e) { /* silent fallback */ }
        }

        res.json({
            success: true,
            count: leaderboard.length,
            totalParticipants,
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

        await ContestSubmission.logViolation(studentId, contestId, violations);

        // Broadcast leaderboard update so violations appear live during contest
        try {
            const { notifyLeaderboardUpdate } = require('../config/websocket');
            const leaderboard = await ContestSubmission.getLeaderboard(contestId);
            notifyLeaderboardUpdate(contestId, leaderboard);
        } catch (wsError) {
            console.error('WebSocket notification error in logViolation:', wsError);
        }

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

        // Use the resolved real ObjectId string — NOT the raw slug from req.body
        const resolvedContestId = contest._id.toString();

        // Check if they already exist (very rudimentary, they're temporary anyway)
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
        console.error('Register spot user error:', error);
        res.status(500).json({ success: false, message: 'Failed to register. ' + error.message });
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
    registerSpotUser
};
