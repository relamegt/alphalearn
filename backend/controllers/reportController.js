const { getReportData, generateCSVReport, generatePDFReport, generateContestReport, getStudentReport } = require('../services/reportService');

// Get report data (preview)
const getReport = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { branch, timeline, section } = req.query;

        const filters = {};
        if (branch) filters.branch = branch;
        if (timeline) filters.timeline = timeline;
        if (section) filters.section = section;

        const data = await getReportData(batchId, filters);

        res.json({
            success: true,
            count: data.length,
            data
        });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
};

// Export report as CSV
const exportCSVReport = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { branch, timeline, section } = req.query;

        const filters = {};
        if (branch) filters.branch = branch;
        if (timeline) filters.timeline = timeline;
        if (section) filters.section = section;

        const result = await generateCSVReport(batchId, filters);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.data);
    } catch (error) {
        console.error('Export CSV report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export CSV report',
            error: error.message
        });
    }
};

// Export report as PDF
const exportPDFReport = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { branch, timeline, section } = req.query;

        const filters = {};
        if (branch) filters.branch = branch;
        if (timeline) filters.timeline = timeline;
        if (section) filters.section = section;

        const result = await generatePDFReport(batchId, filters);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.data);
    } catch (error) {
        console.error('Export PDF report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export PDF report',
            error: error.message
        });
    }
};

// Get contest report
const getContestReport = async (req, res) => {
    try {
        const { contestId } = req.params;

        const result = await generateContestReport(contestId);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            report: result
        });
    } catch (error) {
        console.error('Get contest report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate contest report',
            error: error.message
        });
    }
};

// Export contest report as CSV
const exportContestCSV = async (req, res) => {
    try {
        const { contestId } = req.params;

        const result = await generateContestReport(contestId);

        if (!result.success) {
            return res.status(500).json(result);
        }

        const { generateCSV } = require('../services/csvService');
        const headers = [
            'rank',
            'rollNumber',
            'username',
            'score',
            'time',
            'problemsSolved',
            'tabSwitchCount',
            'tabSwitchDuration',
            'pasteAttempts'
        ];

        const csv = generateCSV(result.leaderboard, headers);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="contest_${contestId}_report_${Date.now()}.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('Export contest CSV error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export contest report',
            error: error.message
        });
    }
};

// Get student detailed report
const getStudentDetailedReport = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Check permissions
        if (req.user.role === 'student' && studentId !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const result = await getStudentReport(studentId);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json({
            success: true,
            report: result
        });
    } catch (error) {
        console.error('Get student detailed report error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate student report',
            error: error.message
        });
    }
};

// Get batch analytics
const getBatchAnalytics = async (req, res) => {
    try {
        const { batchId } = req.params;

        const Batch = require('../models/Batch');
        const User = require('../models/User');
        const Problem = require('../models/Problem');
        const Submission = require('../models/Submission');
        const Contest = require('../models/Contest');

        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        const students = await User.getStudentsByBatch(batchId);
        const totalProblems = await Problem.count();
        const contests = await Contest.findByBatchId(batchId);
        const studentIds = students.map(s => s._id);

        // Fix: Manual aggregation by iterating through chunks of students because DataStax API doesn't support aggregate
        const CHUNK_SIZE = 500;
        let totalSubmissions = 0;
        let totalAccepted = 0;

        for (let i = 0; i < studentIds.length; i += CHUNK_SIZE) {
            const chunkIds = studentIds.slice(i, i + CHUNK_SIZE);
            const [chunkTotal, chunkAccepted] = await Promise.all([
                collections.submissions.countDocuments({ studentId: { $in: chunkIds } }, { upperBound: 1000000 }),
                collections.submissions.countDocuments({ studentId: { $in: chunkIds }, verdict: 'Accepted' }, { upperBound: 1000000 })
            ]);

            totalSubmissions += chunkTotal;
            totalAccepted += chunkAccepted;
        }

        res.json({
            success: true,
            analytics: {
                batch: {
                    name: batch.name,
                    studentCount: students.length,
                    startDate: batch.startDate,
                    endDate: batch.endDate,
                    status: batch.status
                },
                problems: {
                    total: totalProblems
                },
                submissions: {
                    total: totalSubmissions,
                    accepted: totalAccepted,
                    acceptanceRate: totalSubmissions > 0 ? ((totalAccepted / totalSubmissions) * 100).toFixed(2) : 0
                },
                contests: {
                    total: contests.length,
                    active: contests.filter(c => c.endTime > new Date()).length,
                    completed: contests.filter(c => c.endTime <= new Date()).length
                }
            }
        });
    } catch (error) {
        console.error('Get batch analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch batch analytics',
            error: error.message
        });
    }
};

module.exports = {
    getReport,
    exportCSVReport,
    exportPDFReport,
    getContestReport,
    exportContestCSV,
    getStudentDetailedReport,
    getBatchAnalytics
};
