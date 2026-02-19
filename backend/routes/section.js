const express = require('express');
const router = express.Router();
const {
    createSection,
    getAllSections,
    getSectionById,
    updateSection,
    deleteSection,
    addSubsection,
    updateSubsection,
    deleteSubsection,
    addProblemToSubsection,
    removeProblemFromSubsection
} = require('../controllers/sectionController');
const { verifyToken } = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');

// Base authentication required for all routes
router.use(verifyToken);

// Public (Authenticted) Routes
router.route('/')
    .get(getAllSections)
    .post(adminOnly, createSection);

router.route('/:id')
    .get(getSectionById)
    .put(adminOnly, updateSection)
    .delete(adminOnly, deleteSection);

// Admin Only Routes for Subsections & Problems
router.use(adminOnly);

router.route('/:id/subsections')
    .post(addSubsection);

router.route('/:sectionId/subsections/:subsectionId')
    .put(updateSubsection)
    .delete(deleteSubsection);

router.route('/:sectionId/subsections/:subsectionId/problems')
    .post(addProblemToSubsection)
    .delete(removeProblemFromSubsection); // Allow DELETE on base route with body

router.route('/:sectionId/subsections/:subsectionId/problems/:problemId')
    .delete(removeProblemFromSubsection);

module.exports = router;
