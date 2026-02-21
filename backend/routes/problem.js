const express = require('express');
const router = express.Router();
const multer = require('multer');
const problemController = require('../controllers/problemController');
const { verifyToken } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');
const { validateProblemCreation, validateObjectId, validateFileUpload } = require('../middleware/validation');
const { fileUploadLimiter } = require('../middleware/rateLimiter');
const Problem = require('../models/Problem');

const resolveProblemSlug = async (req, res, next, problemId) => {
    if (problemId && problemId !== 'bulk' && !/^[0-9a-fA-F]{24}$/.test(problemId)) {
        try {
            const problem = await Problem.findById(problemId);
            if (problem) {
                req.params.problemId = problem._id.toString();
            } else {
                return res.status(404).json({ success: false, message: 'Problem not found' });
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Server error resolving problem' });
        }
    }
    next();
};

router.param('problemId', resolveProblemSlug);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(verifyToken);

// Public problem routes (all authenticated users)
router.get('/', problemController.getAllProblems);
router.get('/difficulty/count', problemController.getDifficultyWiseCount);
router.get('/:problemId', validateObjectId('problemId'), problemController.getProblemById);

// Admin-only routes
router.post('/', adminOnly, validateProblemCreation, problemController.createProblem);
router.post('/bulk', adminOnly, upload.single('file'), fileUploadLimiter, validateFileUpload, problemController.bulkCreateProblems);
router.put('/:problemId', adminOnly, validateObjectId('problemId'), problemController.updateProblem);
router.put('/:problemId/solution-code', adminOnly, validateObjectId('problemId'), problemController.setSolutionCode);
router.delete('/:problemId', adminOnly, validateObjectId('problemId'), problemController.deleteProblem);

module.exports = router;
