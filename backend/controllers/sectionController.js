const Section = require('../models/Section');
const Problem = require('../models/Problem');

// Create Section
exports.createSection = async (req, res, next) => {
    try {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const section = await Section.create({ title });
        res.status(201).json({ success: true, section });
    } catch (error) {
        next(error);
    }
};

// Get All Sections
exports.getAllSections = async (req, res, next) => {
    try {
        const sections = await Section.findAll();
        res.json({ success: true, sections });
    } catch (error) {
        next(error);
    }
};

// Get Section by ID
exports.getSectionById = async (req, res, next) => {
    try {
        const section = await Section.findById(req.params.id);
        if (!section) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json({ success: true, section });
    } catch (error) {
        next(error);
    }
};

// Update Section
exports.updateSection = async (req, res, next) => {
    try {
        const { title } = req.body;
        const result = await Section.update(req.params.id, { title });
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json({ success: true, message: 'Section updated successfully' });
    } catch (error) {
        next(error);
    }
};

// Delete Section
exports.deleteSection = async (req, res, next) => {
    try {
        const result = await Section.delete(req.params.id);
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json({ success: true, message: 'Section deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Create Subsection
exports.addSubsection = async (req, res, next) => {
    try {
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ message: 'Subsection title is required' });
        }
        const { result, subsection } = await Section.addSubsection(req.params.id, title);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.status(201).json({ success: true, subsection });
    } catch (error) {
        next(error);
    }
};

// Update Subsection
exports.updateSubsection = async (req, res, next) => {
    try {
        const { title } = req.body;
        const { sectionId, subsectionId } = req.params;

        const result = await Section.updateSubsection(sectionId, subsectionId, title);
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Section or Subsection not found' });
        }
        res.json({ success: true, message: 'Subsection updated successfully' });
    } catch (error) {
        next(error);
    }
};

// Delete Subsection
exports.deleteSubsection = async (req, res, next) => {
    try {
        const { sectionId, subsectionId } = req.params;
        const result = await Section.deleteSubsection(sectionId, subsectionId);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Section not found' });
        }
        res.json({ success: true, message: 'Subsection deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// Add Problem(s) to Subsection
exports.addProblemToSubsection = async (req, res, next) => {
    try {
        const { sectionId, subsectionId } = req.params;
        const { problemIds } = req.body; // Expecting array of IDs

        if (!problemIds || (Array.isArray(problemIds) && problemIds.length === 0)) {
            return res.status(400).json({ message: 'Problem IDs are required' });
        }

        const ids = Array.isArray(problemIds) ? problemIds : [problemIds];

        // Verify section exists first
        const section = await Section.findById(sectionId);
        if (!section) {
            console.error(`Section not found for ID: ${sectionId}`);
            return res.status(404).json({ message: 'Section not found' });
        }

        // Verify subsection exists
        const subsectionExists = section.subsections && section.subsections.some(sub => sub._id.toString() === subsectionId);
        if (!subsectionExists) {
            console.error(`Subsection not found for ID: ${subsectionId} in section ${sectionId}`);
            return res.status(404).json({ message: 'Subsection not found' });
        }

        const result = await Section.addProblemToSubsection(sectionId, subsectionId, ids);

        console.log(`Adding problems to section ${sectionId}, subsection ${subsectionId}`);
        console.log('Update result:', result);

        if (result.matchedCount === 0) {
            // This should ideally not happen if checks passed, unless race condition or query mismatch
            console.error(`Update failed (matchedCount 0) for IDs: ${sectionId}, ${subsectionId}`);
            return res.status(404).json({ message: 'Section or Subsection not found during update' });
        }

        res.json({ success: true, message: `${ids.length} problem(s) added to subsection` });
    } catch (error) {
        next(error);
    }
};

// Remove Problem(s) from Subsection
exports.removeProblemFromSubsection = async (req, res, next) => {
    try {
        const { sectionId, subsectionId } = req.params;
        // Check body for multiple IDs first, fallback to params for single ID (backward compatibility)
        const { problemIds } = req.body;
        const paramProblemId = req.params.problemId;

        let ids = [];
        if (problemIds) {
            ids = Array.isArray(problemIds) ? problemIds : [problemIds];
        } else if (paramProblemId) {
            ids = [paramProblemId];
        } else {
            return res.status(400).json({ message: 'Problem ID(s) are required' });
        }

        const result = await Section.removeProblemFromSubsection(sectionId, subsectionId, ids);

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Section or Subsection not found' });
        }

        res.json({ success: true, message: 'Problem(s) removed from subsection' });
    } catch (error) {
        next(error);
    }
};
