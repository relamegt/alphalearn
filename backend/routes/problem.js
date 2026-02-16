const express = require('express');
const router = express.Router();
const multer = require('multer');
const problemController = require('../controllers/problemController');
const { verifyToken } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');
const { validateProblemCreation, validateObjectId, validateFileUpload } = require('../middleware/validation');
const { fileUploadLimiter } = require('../middleware/rateLimiter');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(verifyToken);

// Public problem routes (all authenticated users)
router.get('/', problemController.getAllProblems);
router.get('/sections/count', problemController.getSectionWiseCount);
router.get('/difficulty/count', problemController.getDifficultyWiseCount);
router.get('/:problemId', validateObjectId('problemId'), problemController.getProblemById);

// Admin-only routes
router.post('/', adminOnly, validateProblemCreation, problemController.createProblem);
router.post('/bulk', adminOnly, upload.single('file'), fileUploadLimiter, validateFileUpload, problemController.bulkCreateProblems);
router.put('/:problemId', adminOnly, validateObjectId('problemId'), problemController.updateProblem);
router.delete('/:problemId', adminOnly, validateObjectId('problemId'), problemController.deleteProblem);

module.exports = router;
