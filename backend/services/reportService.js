const PDFDocument = require('pdfkit');
const { generateCSV } = require('./csvService');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const Submission = require('../models/Submission');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const { calculatePlatformScore } = require('../utils/scoreCalculator');

// Get comprehensive report data
const getReportData = async (batchId, filters = {}) => {
    try {
        const leaderboard = await Leaderboard.getBatchLeaderboard(batchId, filters);
        const reportData = [];

        for (const entry of leaderboard) {
            const user = await User.findById(entry.studentId);
            if (!user) continue;

            // Get AlphaLearn internal contest scores (Primary - NOT in overall)
            const contestSubmissions = await ContestSubmission.findByStudent(entry.studentId);
            const uniqueContests = [...new Set(contestSubmissions.map(cs => cs.contestId.toString()))];

            let alphaLearnPrimaryScore = 0;
            for (const contestId of uniqueContests) {
                const scoreData = await ContestSubmission.calculateScore(entry.studentId, contestId);
                alphaLearnPrimaryScore += scoreData.score;
            }

            reportData.push({
                rank: entry.rank,
                globalRank: entry.globalRank,
                rollNumber: user.education?.rollNumber || 'N/A',
                name: `${user.firstName} ${user.lastName}`,
                branch: user.education?.stream || 'N/A',
                username: user.email.split('@')[0],
                hackerrank: entry.externalScores.hackerrank,
                alphaLearnBasic: entry.alphaLearnBasicScore,
                alphaLearnPrimary: alphaLearnPrimaryScore, // Internal contests - NOT in overall
                leetcode: entry.externalScores.leetcode,
                interviewbit: entry.externalScores.interviewbit,
                codechef: entry.externalScores.codechef,
                codeforces: entry.externalScores.codeforces,
                spoj: entry.externalScores.spoj,
                overallScore: entry.overallScore // Excludes alphaLearnPrimary
            });
        }

        // Apply filters
        if (filters.branch) {
            return reportData.filter(r => r.branch === filters.branch);
        }

        if (filters.timeline) {
            // Timeline filtering would require submission date filtering
            // This is a simplified version
        }

        return reportData;
    } catch (error) {
        console.error('Error generating report data:', error);
        throw error;
    }
};

// Generate CSV report
const generateCSVReport = async (batchId, filters = {}) => {
    try {
        const data = await getReportData(batchId, filters);

        const headers = [
            'rank',
            'globalRank',
            'rollNumber',
            'name',
            'branch',
            'username',
            'hackerrank',
            'alphaLearnBasic',
            'alphaLearnPrimary',
            'leetcode',
            'interviewbit',
            'codechef',
            'codeforces',
            'spoj',
            'overallScore'
        ];

        const csv = generateCSV(data, headers);

        return {
            success: true,
            data: csv,
            filename: `alphalearn_report_${Date.now()}.csv`
        };
    } catch (error) {
        console.error('Error generating CSV report:', error);
        return {
            success: false,
            message: 'Failed to generate CSV report',
            error: error.message
        };
    }
};

// Generate PDF report
const generatePDFReport = async (batchId, filters = {}) => {
    try {
        const data = await getReportData(batchId, filters);

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: 30
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve({
                    success: true,
                    data: pdfBuffer,
                    filename: `alphalearn_report_${Date.now()}.pdf`
                });
            });
            doc.on('error', reject);

            // Header
            doc.fontSize(18).font('Helvetica-Bold').text('AlphaLearn - Batch Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(2);

            // Table header
            const tableTop = doc.y;
            const columnWidth = 55;
            const columns = [
                { header: 'Rank', key: 'rank', x: 30 },
                { header: 'Global', key: 'globalRank', x: 85 },
                { header: 'Roll No', key: 'rollNumber', x: 140 },
                { header: 'Name', key: 'name', x: 210 },
                { header: 'Branch', key: 'branch', x: 280 },
                { header: 'HR', key: 'hackerrank', x: 340 },
                { header: 'AI-B', key: 'alphaLearnBasic', x: 385 },
                { header: 'AI-P', key: 'alphaLearnPrimary', x: 430 },
                { header: 'LC', key: 'leetcode', x: 475 },
                { header: 'IB', key: 'interviewbit', x: 520 },
                { header: 'CC', key: 'codechef', x: 565 },
                { header: 'CF', key: 'codeforces', x: 610 },
                { header: 'SP', key: 'spoj', x: 655 },
                { header: 'Overall', key: 'overallScore', x: 700 }
            ];

            doc.fontSize(9).font('Helvetica-Bold');
            columns.forEach(col => {
                doc.text(col.header, col.x, tableTop, { width: columnWidth, align: 'center' });
            });

            doc.moveTo(30, tableTop + 15).lineTo(770, tableTop + 15).stroke();

            // Table rows
            let yPosition = tableTop + 20;
            doc.fontSize(8).font('Helvetica');

            data.slice(0, 50).forEach((row, index) => {
                if (yPosition > 500) {
                    doc.addPage();
                    yPosition = 30;
                }

                columns.forEach(col => {
                    const value = row[col.key]?.toString() || '0';
                    doc.text(value, col.x, yPosition, { width: columnWidth, align: 'center' });
                });

                yPosition += 15;
            });

            // Footer
            doc.fontSize(8).text('© 2026 AlphaLearn. All rights reserved.', 30, 550, { align: 'center' });

            doc.end();
        });
    } catch (error) {
        console.error('Error generating PDF report:', error);
        return {
            success: false,
            message: 'Failed to generate PDF report',
            error: error.message
        };
    }
};

// Generate contest report (internal contests)
const generateContestReport = async (contestId) => {
    try {
        const Contest = require('../models/Contest');
        const contest = await Contest.findById(contestId);

        if (!contest) {
            throw new Error('Contest not found');
        }

        const leaderboard = await ContestSubmission.getLeaderboard(contestId);

        return {
            success: true,
            contest: {
                title: contest.title,
                startTime: contest.startTime,
                endTime: contest.endTime,
                participants: leaderboard.length
            },
            leaderboard
        };
    } catch (error) {
        console.error('Error generating contest report:', error);
        return {
            success: false,
            message: 'Failed to generate contest report',
            error: error.message
        };
    }
};

// Get student detailed report
const getStudentReport = async (studentId) => {
    try {
        const user = await User.findById(studentId);
        if (!user || user.role !== 'student') {
            throw new Error('Student not found');
        }

        const submissions = await Submission.findByStudent(studentId);
        const progress = await require('../models/Progress').findByStudent(studentId);
        const externalProfiles = await ExternalProfile.findByStudent(studentId);
        const leaderboardEntry = await Leaderboard.findByStudent(studentId);
        const contestSubmissions = await ContestSubmission.findByStudent(studentId);

        // Calculate statistics
        const solvedCounts = await Submission.getSolvedCountByDifficulty(studentId);
        const verdictData = await Submission.getVerdictData(studentId);
        const languageStats = await Submission.getLanguageStats(studentId);

        return {
            success: true,
            student: {
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                rollNumber: user.education?.rollNumber,
                branch: user.education?.stream
            },
            progress: {
                problemsSolved: progress?.problemsSolved.length || 0,
                easy: solvedCounts.easy,
                medium: solvedCounts.medium,
                hard: solvedCounts.hard,
                streakDays: progress?.streakDays || 0,
                totalTimeSpent: progress?.totalTimeSpent || 0
            },
            submissions: {
                total: submissions.length,
                verdictBreakdown: verdictData,
                languageUsage: languageStats
            },
            externalProfiles: externalProfiles.map(p => ({
                platform: p.platform,
                username: p.username,
                rating: p.stats.rating,
                problemsSolved: p.stats.problemsSolved,
                totalContests: p.stats.totalContests
            })),
            leaderboard: {
                rank: leaderboardEntry?.rank || 0,
                globalRank: leaderboardEntry?.globalRank || 0,
                overallScore: leaderboardEntry?.overallScore || 0
            },
            contests: {
                participated: contestSubmissions.length,
                uniqueContests: [...new Set(contestSubmissions.map(cs => cs.contestId.toString()))].length
            }
        };
    } catch (error) {
        console.error('Error generating student report:', error);
        return {
            success: false,
            message: 'Failed to generate student report',
            error: error.message
        };
    }
};

module.exports = {
    getReportData,
    generateCSVReport,
    generatePDFReport,
    generateContestReport,
    getStudentReport
};
