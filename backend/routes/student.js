const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const profileController = require('../controllers/profileController');
const { verifyToken, requireProfileCompletion } = require('../middleware/auth');
const { studentOnly, requireBatch } = require('../middleware/roleGuard');
const { validateSubmission, validateExternalProfile, validateProfileUpdate, validateObjectId } = require('../middleware/validation');
const { codeExecutionLimiter, profileSyncLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(verifyToken, studentOnly);

// Most routes require profile completion (except profile update)
router.use((req, res, next) => {
    // Allow profile update and dashboard without profile completion
    if (req.path === '/profile' || req.path === '/dashboard') {
        return next();
    }
    // All other routes require profile completion
    requireProfileCompletion(req, res, next);
});

// Dashboard (allowed without profile completion)
router.get('/dashboard', profileController.getDashboardData);

// Profile management (allowed without profile completion)
router.put('/profile', validateProfileUpdate, profileController.updateProfile);
router.post('/profile/reset', profileController.resetStudentProfile);

// External profiles
router.post('/external-profiles', validateExternalProfile, profileController.linkExternalProfile);
router.get('/external-profiles', profileController.getExternalProfiles);
router.delete('/external-profiles/:profileId', validateObjectId('profileId'), profileController.deleteExternalProfile);
router.post('/external-profiles/sync', profileSyncLimiter, requireBatch, profileController.manualSyncProfiles);

// Code submission
router.post('/code/run', codeExecutionLimiter, validateSubmission, submissionController.runCode);
router.post('/code/submit', codeExecutionLimiter, validateSubmission, submissionController.submitCode);

// Submissions
router.get('/submissions', submissionController.getStudentSubmissions);
router.get('/submissions/recent', submissionController.getRecentSubmissions);
router.get('/submissions/:submissionId', validateObjectId('submissionId'), submissionController.getSubmissionById);
router.get('/statistics', submissionController.getSubmissionStatistics);

module.exports = router;
