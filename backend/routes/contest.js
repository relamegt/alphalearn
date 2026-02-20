// backend/routes/contest.js (Add finish route)
const express = require('express');
const router = express.Router();
const contestController = require('../controllers/contestController');
const { verifyToken } = require('../middleware/auth');
const { instructorOrAdmin, studentOnly, requireRole } = require('../middleware/roleGuard');
const { validateSubmission, validateObjectId, validateContestCreation } = require('../middleware/validation');
const { codeExecutionLimiter } = require('../middleware/rateLimiter');

// Public contest joining routes BEFORE verifyToken
router.get('/public/:contestId', validateObjectId('contestId'), contestController.getPublicContestInfo);
router.post('/register-spot', contestController.registerSpotUser);

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

// Participant routes (now explicitly open to all supported roles)
router.post('/:contestId/run', requireRole('student', 'instructor', 'admin'), codeExecutionLimiter, contestController.runContestCode);
router.post('/:contestId/submit', requireRole('student', 'instructor', 'admin'), codeExecutionLimiter, validateSubmission, contestController.submitContestCode);
router.post('/:contestId/violation', requireRole('student', 'instructor', 'admin'), validateObjectId('contestId'), contestController.logViolation); // NEW
router.post('/:contestId/finish', requireRole('student', 'instructor', 'admin'), validateObjectId('contestId'), contestController.finishContest); // NEW
router.get('/:contestId/submissions', requireRole('student', 'instructor', 'admin'), validateObjectId('contestId'), contestController.getStudentContestSubmissions);
router.get('/:contestId/leaderboard', validateObjectId('contestId'), contestController.getContestLeaderboard);

module.exports = router;
