const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const leaderboardController = require('../controllers/leaderboardController');
const { verifyToken } = require('../middleware/auth');
const { instructorOrAdmin, checkOwnership } = require('../middleware/roleGuard');
const { validateObjectId } = require('../middleware/validation');
const { reportLimiter } = require('../middleware/rateLimiter');

router.use(verifyToken);

// Leaderboards - SINGLE CALL, NO FILTERS
router.get('/leaderboard/batch/:batchId', validateObjectId('batchId'), leaderboardController.getBatchLeaderboard);
router.get('/leaderboard/batch/:batchId/external-all', validateObjectId('batchId'), leaderboardController.getAllExternalData); // NEW: Get ALL platforms at once
router.get('/leaderboard/contest/:contestId', validateObjectId('contestId'), leaderboardController.getInternalContestLeaderboard);
router.get('/leaderboard/top', leaderboardController.getTopPerformers);
router.get('/leaderboard/student/:studentId/rank', validateObjectId('studentId'), leaderboardController.getStudentRank);

// Reports (Admin/Instructor only)
router.get('/batch/:batchId', instructorOrAdmin, validateObjectId('batchId'), reportLimiter, reportController.getReport);
router.get('/batch/:batchId/export/csv', instructorOrAdmin, validateObjectId('batchId'), reportLimiter, reportController.exportCSVReport);
router.get('/batch/:batchId/export/pdf', instructorOrAdmin, validateObjectId('batchId'), reportLimiter, reportController.exportPDFReport);
router.get('/batch/:batchId/analytics', instructorOrAdmin, validateObjectId('batchId'), reportController.getBatchAnalytics);

// Contest reports
router.get('/contest/:contestId', instructorOrAdmin, validateObjectId('contestId'), reportController.getContestReport);
router.get('/contest/:contestId/export/csv', instructorOrAdmin, validateObjectId('contestId'), reportLimiter, reportController.exportContestCSV);

// Student reports
router.get('/student/:studentId', validateObjectId('studentId'), checkOwnership('studentId'), reportController.getStudentDetailedReport);

module.exports = router;
