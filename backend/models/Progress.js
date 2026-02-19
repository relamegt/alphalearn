const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Progress {
    // Create new progress record
    static async create(studentId) {
        const progress = {
            _id: new ObjectId(),
            studentId: new ObjectId(studentId),
            problemsSolved: [],
            sectionProgress: [
                { section: 'Introduction', solved: 0, total: 0 },
                { section: 'Arrays', solved: 0, total: 0 },
                { section: 'Strings', solved: 0, total: 0 },
                { section: 'Math', solved: 0, total: 0 },
                { section: 'Sorting', solved: 0, total: 0 },
                { section: 'Searching', solved: 0, total: 0 },
                { section: 'Recursion', solved: 0, total: 0 },
                { section: 'Backtracking', solved: 0, total: 0 },
                { section: 'Dynamic Programming', solved: 0, total: 0 },
                { section: 'Graphs', solved: 0, total: 0 },
                { section: 'Trees', solved: 0, total: 0 },
                { section: 'Heaps', solved: 0, total: 0 },
                { section: 'Advanced Topics', solved: 0, total: 0 }
            ],
            streakDays: 0,
            maxStreakDays: 0,
            lastActiveDate: new Date(),
            totalTimeSpent: 0 // in minutes
        };

        const result = await collections.progress.insertOne(progress);
        return { ...progress, _id: result.insertedId };
    }

    // Find progress by student ID
    static async findByStudent(studentId) {
        return await collections.progress.findOne({ studentId: new ObjectId(studentId) });
    }

    // Update problems solved
    static async updateProblemsSolved(studentId, problemId) {
        const progress = await Progress.findByStudent(studentId);

        if (!progress) {
            await Progress.create(studentId);
        }

        // Add problem to solved list if not already present
        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId) },
            {
                $addToSet: { problemsSolved: new ObjectId(problemId) },
                $set: { lastActiveDate: new Date() }
            }
        );
    }

    // Update section progress
    static async updateSectionProgress(studentId, section, solvedCount, totalCount) {
        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId), 'sectionProgress.section': section },
            {
                $set: {
                    'sectionProgress.$.solved': solvedCount,
                    'sectionProgress.$.total': totalCount
                }
            }
        );
    }

    // Recalculate section progress
    static async recalculateSectionProgress(studentId) {
        const Problem = require('./Problem');
        const Submission = require('./Submission');

        const sections = [
            'Introduction', 'Arrays', 'Strings', 'Math', 'Sorting', 'Searching',
            'Recursion', 'Backtracking', 'Dynamic Programming', 'Graphs', 'Trees',
            'Heaps', 'Advanced Topics'
        ];

        const sectionProgress = await Promise.all(
            sections.map(async (section) => {
                const sectionProblems = await Problem.findBySection(section);
                const totalCount = sectionProblems.length;

                const solvedCount = await Promise.all(
                    sectionProblems.map(async (problem) => {
                        return await Submission.isProblemSolved(studentId, problem._id);
                    })
                );

                return {
                    section,
                    solved: solvedCount.filter(Boolean).length,
                    total: totalCount
                };
            })
        );

        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId) },
            { $set: { sectionProgress } }
        );
    }

    // Update streak
    static async updateStreak(studentId) {
        const progress = await Progress.findByStudent(studentId);
        if (!progress) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastActive = new Date(progress.lastActiveDate);
        lastActive.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

        let newStreak = progress.streakDays;

        if (daysDiff === 0) {
            // Same day, no change
            newStreak = progress.streakDays;
        } else if (daysDiff === 1) {
            // Consecutive day, increment streak
            newStreak = progress.streakDays + 1;
        } else {
            // Streak broken, reset to 1
            newStreak = 1;
        }

        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId) },
            {
                $set: {
                    streakDays: newStreak,
                    maxStreakDays: Math.max(newStreak, progress.maxStreakDays || 0),
                    lastActiveDate: new Date()
                }
            }
        );
    }

    // Add time spent
    static async addTimeSpent(studentId, minutes) {
        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId) },
            {
                $inc: { totalTimeSpent: minutes },
                $set: { lastActiveDate: new Date() }
            }
        );
    }

    // Get progress statistics
    static async getStatistics(studentId) {
        const progress = await Progress.findByStudent(studentId);
        if (!progress) {
            return {
                problemsSolved: 0,
                sectionProgress: [],
                streakDays: 0,
                totalTimeSpent: 0
            };
        }

        const Problem = require('./Problem');
        const totalProblems = await Problem.count();

        return {
            problemsSolved: progress.problemsSolved.length,
            totalProblems,
            sectionProgress: progress.sectionProgress,
            streakDays: progress.streakDays,
            maxStreakDays: progress.maxStreakDays || 0,
            totalTimeSpent: progress.totalTimeSpent,
            lastActiveDate: progress.lastActiveDate
        };
    }

    // Delete progress by student
    static async deleteByStudent(studentId) {
        return await collections.progress.deleteOne({ studentId: new ObjectId(studentId) });
    }

    // Reset progress (for profile reset)
    static async reset(studentId) {
        return await collections.progress.updateOne(
            { studentId: new ObjectId(studentId) },
            {
                $set: {
                    problemsSolved: [],
                    sectionProgress: [
                        { section: 'Introduction', solved: 0, total: 0 },
                        { section: 'Arrays', solved: 0, total: 0 },
                        { section: 'Strings', solved: 0, total: 0 },
                        { section: 'Math', solved: 0, total: 0 },
                        { section: 'Sorting', solved: 0, total: 0 },
                        { section: 'Searching', solved: 0, total: 0 },
                        { section: 'Recursion', solved: 0, total: 0 },
                        { section: 'Backtracking', solved: 0, total: 0 },
                        { section: 'Dynamic Programming', solved: 0, total: 0 },
                        { section: 'Graphs', solved: 0, total: 0 },
                        { section: 'Trees', solved: 0, total: 0 },
                        { section: 'Heaps', solved: 0, total: 0 },
                        { section: 'Advanced Topics', solved: 0, total: 0 }
                    ],
                    streakDays: 0,
                    lastActiveDate: new Date(),
                    totalTimeSpent: 0
                }
            }
        );
    }
}

module.exports = Progress;
