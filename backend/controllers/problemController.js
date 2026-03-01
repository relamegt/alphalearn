const Problem = require('../models/Problem');
const Progress = require('../models/Progress');
const { parseProblemJSON } = require('../services/csvService');

// Create single problem
const createProblem = async (req, res) => {
    try {
        const problemData = {
            ...req.body,
            createdBy: req.user.userId
        };

        const problem = await Problem.create(problemData);

        res.status(201).json({
            success: true,
            message: 'Problem created successfully',
            problem
        });
    } catch (error) {
        console.error('Create problem error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create problem',
            error: error.message
        });
    }
};

// Bulk create problems via JSON
const bulkCreateProblems = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'JSON file is required'
            });
        }

        // Parse JSON
        const parseResult = parseProblemJSON(req.file.buffer);
        if (!parseResult.success) {
            return res.status(400).json(parseResult);
        }

        // Bulk create
        const result = await Problem.bulkCreate(parseResult.problems, req.user.userId);

        res.status(201).json({
            success: true,
            message: `${parseResult.problems.length} problems created successfully`,
            count: parseResult.problems.length
        });
    } catch (error) {
        console.error('Bulk create problems error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create problems',
            error: error.message
        });
    }
};

// Get all problems
const getAllProblems = async (req, res) => {
    try {
        const { difficulty } = req.query;

        let problems;
        if (difficulty) {
            problems = await Problem.findByDifficulty(difficulty);
        } else {
            problems = await Problem.findAll();
        }

        let solvedProblemIds = [];
        if (req.user && req.user.role === 'student') {
            const progress = await Progress.findByStudent(req.user.userId);
            if (progress && progress.problemsSolved) {
                solvedProblemIds = progress.problemsSolved.map(id => id.toString());
            }
        }

        res.json({
            success: true,
            count: problems.length,
            problems: problems.map(p => ({
                id: p.slug || p._id,
                _id: p._id,
                title: p.title,
                difficulty: p.difficulty,
                points: p.points,
                createdAt: p.createdAt,
                isSolved: solvedProblemIds.includes(p._id.toString())
            }))
        });
    } catch (error) {
        console.error('Get all problems error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch problems',
            error: error.message
        });
    }
};

// Get problem by ID
const getProblemById = async (req, res) => {
    try {
        const { problemId } = req.params;

        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        // Hide hidden test cases and reference solution for students
        if (req.user.role === 'student') {
            problem.testCases = problem.testCases.map(tc => ({
                ...tc,
                input: tc.isHidden ? 'Hidden' : tc.input,
                output: tc.isHidden ? 'Hidden' : tc.output
            }));
            delete problem.solutionCode;
        }

        res.json({
            success: true,
            problem
        });
    } catch (error) {
        console.error('Get problem by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch problem',
            error: error.message
        });
    }
};

// Update problem
const updateProblem = async (req, res) => {
    try {
        const { problemId } = req.params;
        const updateData = req.body;

        await Problem.update(problemId, updateData);

        const updatedProblem = await Problem.findById(problemId);

        res.json({
            success: true,
            message: 'Problem updated successfully',
            problem: updatedProblem
        });
    } catch (error) {
        console.error('Update problem error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update problem',
            error: error.message
        });
    }
};

// Delete problem
const deleteProblem = async (req, res) => {
    try {
        const { problemId } = req.params;

        // Delete related submissions
        await require('../models/Submission').deleteByProblem(problemId);

        await Problem.delete(problemId);

        res.json({
            success: true,
            message: 'Problem deleted successfully'
        });
    } catch (error) {
        console.error('Delete problem error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete problem',
            error: error.message
        });
    }
};

// Bulk delete problems
const bulkDeleteProblems = async (req, res) => {
    try {
        const { problemIds } = req.body;

        if (!problemIds || !Array.isArray(problemIds) || problemIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Array of problemIds is required' });
        }

        // Delete related submissions for all problems
        for (const problemId of problemIds) {
            await require('../models/Submission').deleteByProblem(problemId);
            await Problem.delete(problemId);
        }

        res.json({
            success: true,
            message: `${problemIds.length} problems deleted successfully`
        });
    } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete problems', error: error.message });
    }
};

// Get difficulty-wise problem count
const getDifficultyWiseCount = async (req, res) => {
    try {
        const counts = await Problem.getDifficultyWiseCount();

        res.json({
            success: true,
            difficultyCounts: counts
        });
    } catch (error) {
        console.error('Get difficulty-wise count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch difficulty counts',
            error: error.message
        });
    }
};

// Set solution code for a problem (admin)
const setSolutionCode = async (req, res) => {
    try {
        const { problemId } = req.params;
        const { language, code } = req.body;

        if (!language || !code) {
            return res.status(400).json({ success: false, message: 'language and code are required' });
        }

        const allowedLanguages = ['c', 'cpp', 'java', 'python', 'javascript', 'csharp'];
        if (!allowedLanguages.includes(language)) {
            return res.status(400).json({ success: false, message: `Language must be one of: ${allowedLanguages.join(', ')}` });
        }

        await Problem.setSolutionCode(problemId, language, code);

        res.json({
            success: true,
            message: `Solution code set for ${language} on problem ${problemId}`
        });
    } catch (error) {
        console.error('Set solution code error:', error);
        res.status(500).json({ success: false, message: 'Failed to set solution code', error: error.message });
    }
};

// View editorial
const viewEditorial = async (req, res) => {
    try {
        const { problemId } = req.params;
        const studentId = req.user.userId;

        await Progress.markEditorialViewed(studentId, problemId);

        res.json({
            success: true,
            message: 'Editorial marked as viewed. Coins will not be awarded.'
        });
    } catch (error) {
        console.error('View editorial error:', error);
        res.status(500).json({ success: false, message: 'Failed to view editorial', error: error.message });
    }
};

module.exports = {
    createProblem,
    bulkCreateProblems,
    getAllProblems,
    getProblemById,
    updateProblem,
    deleteProblem,
    bulkDeleteProblems,
    getDifficultyWiseCount,
    setSolutionCode,
    viewEditorial
};
