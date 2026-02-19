const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class ContestSubmission {
    // Create new contest submission
    static async create(submissionData) {
        const submission = {
            _id: new ObjectId(),
            contestId: new ObjectId(submissionData.contestId),
            studentId: new ObjectId(submissionData.studentId),
            // problemId is null for contest-completion markers
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
            // Marker to identify if this record represents finishing the contest
            isFinalContestSubmission: submissionData.isFinalContestSubmission || false
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

    // --- FIXED: Mark contest completed by adding a marker record ---
    static async markContestCompleted(studentId, contestId, score, violations) {
        return await this.create({
            studentId,
            contestId,
            verdict: 'COMPLETED',
            isFinalContestSubmission: true,
            code: `Final Score: ${score}`,
            tabSwitchCount: violations.totalTabSwitches || 0,
            pasteAttempts: violations.totalPasteAttempts || 0,
            fullscreenExits: violations.totalFullscreenExits || 0
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
        const submissions = await collections.contestSubmissions
            .find({
                studentId: new ObjectId(studentId),
                contestId: new ObjectId(contestId)
            })
            .toArray();

        const violations = { totalTabSwitches: 0, totalTabSwitchDuration: 0, totalPasteAttempts: 0, totalFullscreenExits: 0 };
        submissions.forEach(sub => {
            violations.totalTabSwitches += sub.tabSwitchCount || 0;
            violations.totalTabSwitchDuration += sub.tabSwitchDuration || 0;
            violations.totalPasteAttempts += sub.pasteAttempts || 0;
            violations.totalFullscreenExits += sub.fullscreenExits || 0;
        });
        return violations;
    }

    static async deleteByContest(contestId) {
        return await collections.contestSubmissions.deleteMany({ contestId: new ObjectId(contestId) });
    }

    static async getLeaderboard(contestId) {
        const User = require('./User');
        const submissions = await this.findByContest(contestId);
        const participantIds = [...new Set(submissions.map(s => s.studentId.toString()))];

        const leaderboardData = await Promise.all(
            participantIds.map(async (studentId) => {
                const user = await User.findById(studentId);
                const scoreData = await this.calculateScore(studentId, contestId);
                const violations = await this.getProctoringViolations(studentId, contestId);
                const isCompleted = await this.hasSubmittedContest(studentId, 'contestId' in submissions[0] ? submissions[0].contestId : contestId);

                return {
                    studentId: new ObjectId(studentId),
                    rollNumber: user?.education?.rollNumber || 'N/A',
                    username: user?.email?.split('@')[0] || 'Unknown',
                    score: scoreData.score,
                    time: scoreData.time,
                    problemsSolved: scoreData.problemsSolved,
                    tabSwitchCount: violations.totalTabSwitches,
                    tabSwitchDuration: violations.totalTabSwitchDuration,
                    pasteAttempts: violations.totalPasteAttempts,
                    fullscreenExits: violations.totalFullscreenExits,
                    isCompleted
                };
            })
        );

        leaderboardData.sort((a, b) => (b.score !== a.score) ? b.score - a.score : a.time - b.time);
        leaderboardData.forEach((entry, index) => { entry.rank = index + 1; });
        return leaderboardData;
    }
}

module.exports = ContestSubmission;