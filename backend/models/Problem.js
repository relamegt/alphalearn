const { ObjectId } = require('bson');
const { collections } = require('../config/astra');

const slugify = text => text ? text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') : 'problem';

// Generate a unique slug: tries clean slug first, then appends -2, -3, etc. only if already taken
async function uniqueSlug(title) {
    const base = slugify(title) || 'problem';
    let candidate = base;
    let counter = 2;
    while (true) {
        const existing = await collections.problems.findOne({ slug: candidate });
        if (!existing) return candidate;
        candidate = `${base}-${counter}`;
        counter++;
    }
}

class Problem {
    // Create new problem
    static async create(problemData) {
        const problem = {
            _id: new ObjectId(),
            slug: await uniqueSlug(problemData.title),
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
            editorialLink: problemData.editorialLink || null,
            videoUrl: problemData.videoUrl || null,
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

    // Find problem by ID or Slug
    static async findById(problemId) {
        try {
            return await collections.problems.findOne({ _id: new ObjectId(problemId) });
        } catch (e) {
            // Not a valid ObjectId, search by slug
            return await collections.problems.findOne({ slug: problemId });
        }
    }

    // Find problems by IDs — preserves input order 
    static async findByIds(problemIds) {
        const objectIds = problemIds.filter(id => {
            try { new ObjectId(id); return true; } catch { return false; }
        }).map(id => new ObjectId(id));

        const slugs = problemIds.filter(id => {
            try { new ObjectId(id); return false; } catch { return true; }
        });

        const query = {};
        if (objectIds.length > 0 && slugs.length > 0) {
            query.$or = [{ _id: { $in: objectIds } }, { slug: { $in: slugs } }];
        } else if (objectIds.length > 0) {
            query._id = { $in: objectIds };
        } else if (slugs.length > 0) {
            query.slug = { $in: slugs };
        } else {
            return [];
        }

        const problems = await collections.problems.find(query).toArray();
        // Sort to match the original problemIds order
        const idOrder = problemIds.map(id => id.toString());
        problems.sort((a, b) => {
            // Check both ID and slug when matching order
            const idxA = Math.max(idOrder.indexOf(a._id.toString()), idOrder.indexOf(a.slug || ''));
            const idxB = Math.max(idOrder.indexOf(b._id.toString()), idOrder.indexOf(b.slug || ''));
            return idxA - idxB;
        });
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

        let query = {};
        try {
            query._id = new ObjectId(problemId);
        } catch (e) {
            query.slug = problemId;
        }

        return await collections.problems.updateOne(
            query,
            { $set: updateData }
        );
    }

    // Delete problem
    static async delete(problemId) {
        let query = {};
        try {
            query._id = new ObjectId(problemId);
        } catch (e) {
            query.slug = problemId;
        }
        return await collections.problems.deleteOne(query);
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
        const problems = await Promise.all(problemsData.map(async p => ({
            _id: new ObjectId(),
            slug: await uniqueSlug(p.title),
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
            editorialLink: p.editorialLink || null,
            videoUrl: p.videoUrl || null,
            isContestProblem: p.isContestProblem || false,
            contestId: p.contestId ? new ObjectId(p.contestId) : null,
            createdBy: new ObjectId(createdBy),
            createdAt: new Date()
        })));
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
                const count = await collections.problems.countDocuments({ section, isContestProblem: false }, { upperBound: 5000 });
                return { section, count };
            })
        );

        return sectionCounts;
    }

    // Get difficulty-wise problem count
    static async getDifficultyWiseCount() {
        const [easy, medium, hard] = await Promise.all([
            collections.problems.countDocuments({ difficulty: 'Easy', isContestProblem: false }, { upperBound: 5000 }),
            collections.problems.countDocuments({ difficulty: 'Medium', isContestProblem: false }, { upperBound: 5000 }),
            collections.problems.countDocuments({ difficulty: 'Hard', isContestProblem: false }, { upperBound: 5000 })
        ]);

        return { easy, medium, hard };
    }

    /// Count total problems
    static async count() {
        try {
            return await collections.problems.countDocuments({}, { upperBound: 10000 });
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
        let query = {};
        try {
            query._id = new ObjectId(problemId);
        } catch (e) {
            query.slug = problemId;
        }

        return await collections.problems.updateOne(
            query,
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
