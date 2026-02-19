// backend/routes/contest.js (Add finish route)
const express = require('express');
const router = express.Router();
const contestController = require('../controllers/contestController');
const { verifyToken } = require('../middleware/auth');
const { instructorOrAdmin, studentOnly } = require('../middleware/roleGuard');
const { validateSubmission, validateObjectId, validateContestCreation } = require('../middleware/validation');
const { codeExecutionLimiter } = require('../middleware/rateLimiter');

router.use(verifyToken);

// Public contest routes
router.get('/batch/:batchId', validateObjectId('batchId'), contestController.getContestsByBatch);
router.get('/:contestId', validateObjectId('contestId'), contestController.getContestById);

// Contest Management
router.post('/', instructorOrAdmin, validateContestCreation, contestController.createContest);
router.put('/:contestId', instructorOrAdmin, validateObjectId('contestId'), contestController.updateContest);
router.delete('/:contestId', instructorOrAdmin, validateObjectId('contestId'), contestController.deleteContest);
router.get('/:contestId/statistics', instructorOrAdmin, validateObjectId('contestId'), contestController.getContestStatistics);
router.get('/:contestId/violations/:studentId', validateObjectId('contestId'), validateObjectId('studentId'), contestController.getProctoringViolations);

// Student contest participation
router.post('/:contestId/run', studentOnly, codeExecutionLimiter, contestController.runContestCode);
router.post('/:contestId/submit', studentOnly, codeExecutionLimiter, validateSubmission, contestController.submitContestCode);
router.post('/:contestId/violation', studentOnly, validateObjectId('contestId'), contestController.logViolation); // NEW
router.post('/:contestId/finish', studentOnly, validateObjectId('contestId'), contestController.finishContest); // NEW
router.get('/:contestId/submissions', studentOnly, validateObjectId('contestId'), contestController.getStudentContestSubmissions);
router.get('/:contestId/leaderboard', validateObjectId('contestId'), contestController.getContestLeaderboard);

module.exports = router;
