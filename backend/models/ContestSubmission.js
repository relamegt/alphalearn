const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class ContestSubmission {
    // Create new contest submission
    static async create(submissionData) {
        const submission = {
            _id: new ObjectId(),
            contestId: new ObjectId(submissionData.contestId),
            studentId: new ObjectId(submissionData.studentId),
            // problemId is null for contest-completion markers / violation logs
            problemId: submissionData.problemId ? new ObjectId(submissionData.problemId) : null,
            code: submissionData.code || '',
            language: submissionData.language || '',
            verdict: submissionData.verdict,
            testCasesPassed: submissionData.testCasesPassed || 0,
            totalTestCases: submissionData.totalTestCases || 0,
            submittedAt: new Date(),
            tabSwitchCount: submissionData.tabSwitchCount || 0,
            tabSwitchDuration: submissionData.tabSwitchDuration || 0,
            pasteAttempts: submissionData.pasteAttempts || 0,
            fullscreenExits: submissionData.fullscreenExits || 0,
            isAutoSubmit: submissionData.isAutoSubmit || false,
            isFinalContestSubmission: submissionData.isFinalContestSubmission || false,
            // Flag to distinguish dedicated violation event logs
            isViolationLog: submissionData.isViolationLog || false
        };

        const result = await collections.contestSubmissions.insertOne(submission);
        return { ...submission, _id: result.insertedId };
    }

    // --- FIXED: Check if student has finished the contest using the marker ---
    static async hasSubmittedContest(studentId, contestId) {
        const record = await collections.contestSubmissions.findOne({
            studentId: new ObjectId(studentId),
            contestId: new ObjectId(contestId),
            isFinalContestSubmission: true
        });
        return !!record;
    }

    // --- FIXED: Check if a problem is solved ---
    static async isProblemSolved(studentId, contestId, problemId) {
        const submission = await collections.contestSubmissions.findOne({
            studentId: new ObjectId(studentId),
            contestId: new ObjectId(contestId),
            problemId: new ObjectId(problemId),
            verdict: 'Accepted'
        });
        return !!submission;
    }

    // Mark contest completed — stores final violation snapshot as the single source of truth
    // violations param: { tabSwitchCount, tabSwitchDuration, fullscreenExits, pasteAttempts }
    static async markContestCompleted(studentId, contestId, score, violations = {}) {
        return await this.create({
            studentId,
            contestId,
            verdict: 'COMPLETED',
            isFinalContestSubmission: true,
            code: `Final Score: ${score}`,
            // Store the final aggregated violation snapshot from the live frontend state
            // This is the ground truth for post-contest leaderboard display
            tabSwitchCount: violations.tabSwitchCount || 0,
            tabSwitchDuration: violations.tabSwitchDuration || 0,
            fullscreenExits: violations.fullscreenExits || 0,
            pasteAttempts: violations.pasteAttempts || 0,
        });
    }

    // --- NEW: Log a violation without a code submission ---
    static async logViolation(studentId, contestId, violations) {
        return await this.create({
            studentId,
            contestId,
            verdict: 'VIOLATION_LOG',
            isFinalContestSubmission: false,
            isViolationLog: true, // New flag to distinguish logs
            code: '',
            tabSwitchCount: violations.tabSwitchCount || 0,
            tabSwitchDuration: violations.tabSwitchDuration || 0,
            pasteAttempts: violations.pasteAttempts || 0,
            fullscreenExits: violations.fullscreenExits || 0
        });
    }

    // --- NEW: Added for getContestStatistics ---
    static async getProblemStatistics(contestId) {
        const submissions = await this.findByContest(contestId);
        const stats = {};

        submissions.forEach(sub => {
            if (!sub.problemId) return; // Skip contest-completion markers
            const pid = sub.problemId.toString();
            if (!stats[pid]) {
                stats[pid] = { totalSubmissions: 0, acceptedCount: 0 };
            }
            stats[pid].totalSubmissions++;
            if (sub.verdict === 'Accepted') {
                stats[pid].acceptedCount++;
            }
        });
        return stats;
    }

    static async findById(submissionId) {

        return await collections.contestSubmissions.findOne({ _id: new ObjectId(submissionId) });
    }
    static async findByStudent(studentId) {
        return await collections.contestSubmissions
            .find({ studentId: new ObjectId(studentId) })
            .sort({ submittedAt: -1 })
            .toArray();
    }


    static async findByContest(contestId) {
        return await collections.contestSubmissions
            .find({ contestId: new ObjectId(contestId) })
            .sort({ submittedAt: -1 })
            .toArray();
    }

    static async findByStudentAndContest(studentId, contestId) {
        return await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                isFinalContestSubmission: false // Exclude markers from normal submission lists
            })
            .sort({ submittedAt: -1 })
            .toArray();
    }

    static async getAcceptedProblems(studentId, contestId) {
        const submissions = await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                verdict: 'Accepted'
            })
            .toArray();

        const uniqueProblemIds = [...new Set(submissions.map(s => s.problemId.toString()))];
        return uniqueProblemIds.map(id => new ObjectId(id));
    }

    static async calculateScore(studentId, contestId) {
        const Contest = require('./Contest');
        const Problem = require('./Problem');

        const contest = await Contest.findById(contestId);
        if (!contest) return { score: 0, time: 0, problemsSolved: 0 };

        const acceptedProblems = await this.getAcceptedProblems(studentId, contestId);
        let totalScore = 0;
        let totalTime = 0;

        for (const problemId of acceptedProblems) {
            const problem = await Problem.findById(problemId);
            if (problem) {
                totalScore += (problem.points || 0);
                const firstAccepted = await collections.contestSubmissions.findOne({
                    studentId: new ObjectId(studentId),
                    contestId: new ObjectId(contestId),
                    problemId: problemId,
                    verdict: 'Accepted'
                }, { sort: { submittedAt: 1 } });

                if (firstAccepted) {
                    const timeTaken = (new Date(firstAccepted.submittedAt) - new Date(contest.startTime)) / (1000 * 60);
                    totalTime += Math.max(0, timeTaken);
                }
            }
        }

        return {
            score: totalScore,
            time: Math.round(totalTime),
            problemsSolved: acceptedProblems.length
        };
    }

    static async getProctoringViolations(studentId, contestId) {
        // Strategy:
        // 1. If the student has a COMPLETED final submission that stores a violation snapshot,
        //    use it as the authoritative source (stored when finish was called).
        // 2. Otherwise, fall back to summing individual isViolationLog=true event records
        //    (in-progress contest or legacy data without snapshot).

        // Check for final submission with violation snapshot
        const finalSub = await collections.contestSubmissions.findOne({
            studentId: new ObjectId(studentId),
            contestId: new ObjectId(contestId),
            isFinalContestSubmission: true
        });

        if (finalSub && (finalSub.tabSwitchCount > 0 || finalSub.fullscreenExits > 0 ||
            finalSub.tabSwitchDuration > 0 || finalSub.pasteAttempts > 0)) {
            // Use the snapshot stored at contest completion time
            return {
                totalTabSwitches: finalSub.tabSwitchCount || 0,
                totalTabSwitchDuration: finalSub.tabSwitchDuration || 0,
                totalPasteAttempts: finalSub.pasteAttempts || 0,
                totalFullscreenExits: finalSub.fullscreenExits || 0
            };
        }

        // Fall back: sum from individual violation log events
        const violationLogs = await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId),
                isViolationLog: true
            })
            .toArray();

        const violations = { totalTabSwitches: 0, totalTabSwitchDuration: 0, totalPasteAttempts: 0, totalFullscreenExits: 0 };
        violationLogs.forEach(log => {
            violations.totalTabSwitches += log.tabSwitchCount || 0;
            violations.totalTabSwitchDuration += log.tabSwitchDuration || 0;
            violations.totalPasteAttempts += log.pasteAttempts || 0;
            violations.totalFullscreenExits += log.fullscreenExits || 0;
        });
        return violations;
    }


    static async deleteByContest(contestId) {
        return await collections.contestSubmissions.deleteMany({ contestId: new ObjectId(contestId) });
    }

    static async getLeaderboard(contestId) {
        const User = require('./User');
        const Problem = require('./Problem');
        const Contest = require('./Contest');

        const submissions = await this.findByContest(contestId);

        // Include ALL students from the contest's batch, not just those with submissions
        const contest = await Contest.findById(contestId);
        let participantIds = [...new Set(submissions.map(s => s.studentId.toString()))];

        if (contest && contest.batchId) {
            try {
                const batchStudents = await User.getStudentsByBatch(contest.batchId.toString());
                const batchStudentIds = batchStudents.map(u => u._id.toString());
                // Union of submitters + all batch students
                const allIds = new Set([...participantIds, ...batchStudentIds]);
                participantIds = [...allIds];
            } catch (e) {
                // If batch fetch fails, fall back to submission-based list
                console.error('[getLeaderboard] Failed to fetch batch students:', e.message);
            }
        }

        // Reuse already-fetched contest to get problem IDs + titles
        let contestProblems = [];
        if (contest && contest.problems) {
            contestProblems = await Problem.findByIds(contest.problems);
        }

        const leaderboardData = await Promise.all(
            participantIds.map(async (studentId) => {
                const user = await User.findById(studentId);
                if (!user || user.role !== 'student') return null;

                const scoreData = await this.calculateScore(studentId, contestId);
                const violations = await this.getProctoringViolations(studentId, contestId);

                // Get actual problem submissions (exclude markers and violation logs)
                const studentSubmissions = submissions.filter(
                    s => s.studentId.toString() === studentId.toString() &&
                        !s.isFinalContestSubmission && !s.isViolationLog
                );

                // Determine completion status
                const isCompleted = await this.hasSubmittedContest(studentId, contestId);

                // Build per-problem status using reliable problem IDs from Problem collection
                const problemsStatus = {};
                for (const prob of contestProblems) {
                    const pIdStr = prob._id.toString();
                    const pSubs = studentSubmissions.filter(
                        s => s.problemId && s.problemId.toString() === pIdStr
                    );

                    let status = 'Not Attempted';
                    let tries = pSubs.length;
                    let submittedAt = null;

                    if (tries > 0) {
                        const accepted = pSubs.filter(s => s.verdict === 'Accepted');
                        if (accepted.length > 0) {
                            status = 'Accepted';
                            accepted.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
                            submittedAt = accepted[0].submittedAt;
                        } else {
                            status = 'Wrong Answer';
                            pSubs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                            submittedAt = pSubs[0].submittedAt;
                        }
                    }

                    problemsStatus[pIdStr] = { status, tries, submittedAt };
                }

                // Compose full name from root-level firstName/lastName fields
                const firstName = (user?.firstName || '').trim();
                const lastName = (user?.lastName || '').trim();
                const fullName = [firstName, lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'N/A';

                return {
                    studentId: new ObjectId(studentId),
                    rollNumber: user?.education?.rollNumber || 'N/A',
                    fullName,
                    username: user?.email?.split('@')[0] || 'Unknown',
                    branch: user?.education?.branch || 'N/A',
                    score: scoreData.score,
                    time: scoreData.time,
                    problemsSolved: scoreData.problemsSolved,
                    tabSwitchCount: violations.totalTabSwitches,
                    tabSwitchDuration: violations.totalTabSwitchDuration,
                    pasteAttempts: violations.totalPasteAttempts,
                    fullscreenExits: violations.totalFullscreenExits,
                    isCompleted,
                    problems: problemsStatus
                };
            })
        );

        let finalLeaderboard = leaderboardData.filter(entry => entry !== null);
        finalLeaderboard.sort((a, b) => (b.score !== a.score) ? b.score - a.score : a.time - b.time);
        finalLeaderboard.forEach((entry, index) => { entry.rank = index + 1; });
        return finalLeaderboard;
    }
}

module.exports = ContestSubmission;