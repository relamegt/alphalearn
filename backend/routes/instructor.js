const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const contestController = require('../controllers/contestController');
const submissionController = require('../controllers/submissionController');
const { verifyToken } = require('../middleware/auth');
const { instructorOrAdmin } = require('../middleware/roleGuard');
const { validateContestCreation, validateObjectId } = require('../middleware/validation');

router.use(verifyToken, instructorOrAdmin);

// Student profile management (plagiarism handling)
router.post('/students/:studentId/reset', validateObjectId('studentId'), profileController.resetStudentProfile);

// Get all students (for instructors to view their batch students)
router.get('/students', profileController.getAllStudentsForInstructor);

// View student data
router.get('/students/:studentId/submissions', validateObjectId('studentId'), submissionController.getStudentSubmissions);
router.get('/students/:studentId/statistics', validateObjectId('studentId'), submissionController.getSubmissionStatistics);
router.get('/students/:studentId/external-profiles', validateObjectId('studentId'), profileController.getExternalProfiles);

module.exports = router;
