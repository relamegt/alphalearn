const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

class Problem {
    // Create new problem
    static async create(problemData) {
        const problem = {
            _id: new ObjectId(),
            title: problemData.title,
            section: problemData.section,
            difficulty: problemData.difficulty, // 'Easy' | 'Medium' | 'Hard'
            points: problemData.difficulty === 'Easy' ? 20 : problemData.difficulty === 'Medium' ? 50 : 100,
            description: problemData.description,
            constraints: problemData.constraints || [],
            examples: problemData.examples || [],
            testCases: problemData.testCases || [],
            timeLimit: problemData.timeLimit || 2000,
            editorial: problemData.editorial || {
                approach: null,
                solution: null,
                complexity: null
            },
            // Admin-provided reference solution per language (used for custom test case expected output)
            solutionCode: problemData.solutionCode || {},
            isContestProblem: problemData.isContestProblem || false,
            contestId: problemData.contestId ? new ObjectId(problemData.contestId) : null,
            createdBy: new ObjectId(problemData.createdBy),
            createdAt: new Date()
        };


        const result = await collections.problems.insertOne(problem);
        return { ...problem, _id: result.insertedId };
    }

    // Find problem by ID
    static async findById(problemId) {
        return await collections.problems.findOne({ _id: new ObjectId(problemId) });
    }

    // Find problems by IDs — preserves input order (critical for leaderboard columns)
    static async findByIds(problemIds) {
        const objectIds = problemIds.map(id => new ObjectId(id));
        const problems = await collections.problems.find({ _id: { $in: objectIds } }).toArray();
        // Sort to match the original problemIds order
        const idOrder = problemIds.map(id => id.toString());
        problems.sort((a, b) => idOrder.indexOf(a._id.toString()) - idOrder.indexOf(b._id.toString()));
        return problems;
    }

    // Find all problems (practice problems only)
    static async findAll() {
        return await collections.problems.find({ isContestProblem: false }).sort({ section: 1, difficulty: 1 }).toArray();
    }

    // Find problems by section
    static async findBySection(section) {
        return await collections.problems.find({ section, isContestProblem: false }).toArray();
    }

    // Find problems by difficulty
    static async findByDifficulty(difficulty) {
        return await collections.problems.find({ difficulty, isContestProblem: false }).toArray();
    }

    // Find problems by section and difficulty
    static async findBySectionAndDifficulty(section, difficulty) {
        return await collections.problems.find({ section, difficulty, isContestProblem: false }).toArray();
    }

    // Find contest problems
    static async findContestProblems(contestId) {
        return await collections.problems.find({
            contestId: new ObjectId(contestId),
            isContestProblem: true
        }).toArray();
    }

    // Update problem
    static async update(problemId, updateData) {
        // Recalculate points if difficulty changed
        if (updateData.difficulty) {
            updateData.points = updateData.difficulty === 'Easy' ? 20 : updateData.difficulty === 'Medium' ? 50 : 100;
        }

        return await collections.problems.updateOne(
            { _id: new ObjectId(problemId) },
            { $set: updateData }
        );
    }

    // Delete problem
    static async delete(problemId) {
        return await collections.problems.deleteOne({ _id: new ObjectId(problemId) });
    }

    // Delete contest problems (when contest is deleted)
    static async deleteContestProblems(contestId) {
        return await collections.problems.deleteMany({
            contestId: new ObjectId(contestId),
            isContestProblem: true
        });
    }

    // Bulk create problems (JSON upload)
    static async bulkCreate(problemsData, createdBy) {
        const problems = problemsData.map(p => ({
            _id: new ObjectId(),
            title: p.title,
            section: p.section,
            difficulty: p.difficulty,
            points: p.difficulty === 'Easy' ? 20 : p.difficulty === 'Medium' ? 50 : 100,
            description: p.description,
            constraints: p.constraints || [],
            examples: p.examples || [],
            testCases: p.testCases || [],
            timeLimit: p.timeLimit || 2000,
            editorial: p.editorial || { approach: null, solution: null, complexity: null },
            isContestProblem: p.isContestProblem || false,
            contestId: p.contestId ? new ObjectId(p.contestId) : null,
            createdBy: new ObjectId(createdBy),
            createdAt: new Date()
        }));

        const result = await collections.problems.insertMany(problems);
        return result;
    }

    // Get section-wise problem count
    static async getSectionWiseCount() {
        const sections = [
            'Introduction', 'Arrays', 'Strings', 'Math', 'Sorting', 'Searching',
            'Recursion', 'Backtracking', 'Dynamic Programming', 'Graphs', 'Trees',
            'Heaps', 'Advanced Topics'
        ];

        const sectionCounts = await Promise.all(
            sections.map(async (section) => {
                const problems = await collections.problems.find({ section, isContestProblem: false }).toArray();
                return { section, count: problems.length };
            })
        );

        return sectionCounts;
    }

    // Get difficulty-wise problem count
    static async getDifficultyWiseCount() {
        const easyProblems = await collections.problems.find({ difficulty: 'Easy', isContestProblem: false }).toArray();
        const mediumProblems = await collections.problems.find({ difficulty: 'Medium', isContestProblem: false }).toArray();
        const hardProblems = await collections.problems.find({ difficulty: 'Hard', isContestProblem: false }).toArray();

        return {
            easy: easyProblems.length,
            medium: mediumProblems.length,
            hard: hardProblems.length
        };
    }

    /// Count total problems
    static async count() {
        try {
            const problems = await collections.problems.find({}).toArray();
            return problems.length;
        } catch (error) {
            console.error('Count problems error:', error);
            throw error;
        }
    }


    // Get problem test cases (for code execution)
    static async getTestCases(problemId) {
        const problem = await Problem.findById(problemId);
        return problem ? problem.testCases : [];
    }

    // Get sample test cases only (for "Run Code")
    static async getSampleTestCases(problemId) {
        const problem = await Problem.findById(problemId);
        return problem ? problem.testCases.filter(tc => !tc.isHidden) : [];
    }

    // Get all test cases (for "Submit")
    static async getAllTestCases(problemId) {
        const problem = await Problem.findById(problemId);
        return problem ? problem.testCases : [];
    }

    // Set admin solution code (per language) for custom test case expected output
    static async setSolutionCode(problemId, language, code) {
        return await collections.problems.updateOne(
            { _id: new ObjectId(problemId) },
            { $set: { [`solutionCode.${language}`]: code } }
        );
    }

    // Get the solution code for a specific language
    static async getSolutionCode(problemId, language) {
        const problem = await Problem.findById(problemId);
        return problem?.solutionCode?.[language] || null;
    }
}

module.exports = Problem;
