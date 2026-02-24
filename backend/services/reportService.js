const PDFDocument = require('pdfkit');
const { generateCSV } = require('./csvService');
const Leaderboard = require('../models/Leaderboard');
const User = require('../models/User');
const Submission = require('../models/Submission');
const ExternalProfile = require('../models/ExternalProfile');
const ContestSubmission = require('../models/ContestSubmission');
const { calculatePlatformScore } = require('../utils/scoreCalculator');
const { collections } = require('../config/astra'); // Fix #4: was missing, caused ReferenceError

const { ObjectId } = require('bson');

// Get comprehensive report data (MEMORY OPTIMIZED)
const getReportData = async (batchId, filters = {}) => {
    try {
        // 1. Fetch the leaderboard cursor
        // We still need the leaderboard records because they define the score sort order
        const leaderboardCursor = collections.leaderboard.find({ batchId: new ObjectId(batchId) }, {
            sort: { overallScore: -1 }
        });

        const reportData = [];
        const CHUNK_SIZE = 50; // Process 50 students at a time to balance RAM vs DB calls
        let currentChunk = [];

        // Fetch batch contests for internal score tracking
        const Contest = require('../models/Contest');
        const batchContests = await Contest.findByBatchId(batchId);
        const batchContestIds = Array.from(new Set(batchContests.map(c => new ObjectId(c._id))));

        let index = 0;
        for await (const entry of leaderboardCursor) {
            currentChunk.push(entry);

            if (currentChunk.length >= CHUNK_SIZE) {
                await processChunk(currentChunk, reportData, batchContestIds, index);
                index += currentChunk.length;
                currentChunk = [];
            }
        }

        // Process final chunk
        if (currentChunk.length > 0) {
            await processChunk(currentChunk, reportData, batchContestIds, index);
        }

        // Apply Filters
        let filteredData = reportData;
        if (filters.branch) {
            filteredData = filteredData.filter(r => r.branch === filters.branch);
        }
        if (filters.section) {
            filteredData = filteredData.filter(r => r.section === filters.section);
        }

        // Re-assign rank in case filters changed the count
        filteredData.forEach((entry, idx) => {
            entry.rank = idx + 1;
        });

        return filteredData;

    } catch (error) {
        console.error('Error generating report data:', error);
        throw error;
    }
};

// Helper to process a chunk of students
const processChunk = async (chunk, reportData, batchContestIds, startRank) => {
    const studentIds = chunk.map(e => new ObjectId(e.studentId));

    // Bulk fetch for THIS CHUNK ONLY
    const [users, allExternalProfiles, allContestSubmissions] = await Promise.all([
        collections.users.find({ _id: { $in: studentIds } }, { projection: { firstName: 1, lastName: 1, email: 1, 'education.rollNumber': 1, 'education.branch': 1, 'profile.section': 1, username: 1 } }).toArray(),
        collections.externalProfiles.find({ studentId: { $in: studentIds } }).toArray(),
        collections.contestSubmissions.find({
            studentId: { $in: studentIds },
            contestId: { $in: batchContestIds }
        }, { projection: { code: 0 } }).toArray()
    ]);

    const userMap = new Map(users.map(u => [u._id.toString(), u]));
    const profilesMap = new Map();
    allExternalProfiles.forEach(p => {
        const sid = p.studentId.toString();
        if (!profilesMap.has(sid)) profilesMap.set(sid, []);
        profilesMap.get(sid).push(p);
    });
    const submissionsMap = new Map();
    allContestSubmissions.forEach(s => {
        const sid = s.studentId.toString();
        if (!submissionsMap.has(sid)) submissionsMap.set(sid, []);
        submissionsMap.get(sid).push(s);
    });

    chunk.forEach((entry, idx) => {
        const userIdStr = entry.studentId.toString();
        const user = userMap.get(userIdStr);
        if (!user) return;

        const externalProfiles = profilesMap.get(userIdStr) || [];
        const detailedStats = {};
        const platforms = ['leetcode', 'codechef', 'codeforces', 'hackerrank', 'interviewbit'];

        platforms.forEach(p => {
            const profile = externalProfiles.find(ep => ep.platform === p);
            if (profile && profile.stats) {
                detailedStats[p] = {
                    problemsSolved: profile.stats.problemsSolved || 0,
                    rating: profile.stats.rating || 0,
                    totalContests: profile.stats.totalContests || 0,
                    dsScore: profile.stats.dsScore || 0,
                    algoScore: profile.stats.algoScore || 0
                };
            } else {
                detailedStats[p] = { problemsSolved: 0, rating: 0, totalContests: 0, dsScore: 0, algoScore: 0 };
            }
        });

        const contestSubmissions = submissionsMap.get(userIdStr) || [];
        const uniqueContests = [...new Set(contestSubmissions.map(cs => cs.contestId.toString()))];
        const internalContestsData = {};

        for (const contestId of uniqueContests) {
            const submission = contestSubmissions
                .filter(cs => cs.contestId.toString() === contestId)
                .sort((a, b) => b.score - a.score)[0];
            if (submission) internalContestsData[contestId] = submission.score || 0;
        }

        reportData.push({
            rank: startRank + idx + 1,
            globalRank: entry.globalRank,
            rollNumber: user.education?.rollNumber || 'N/A',
            name: `${user.firstName} ${user.lastName}`,
            branch: user.education?.branch || 'N/A',
            section: user.profile?.section || 'N/A',
            username: user.username || entry.username || user.email.split('@')[0],
            alphaCoins: entry.alphaCoins || 0,
            lastUpdated: entry.lastUpdated,
            hr_ds: detailedStats.hackerrank.dsScore,
            hr_algo: detailedStats.hackerrank.algoScore,
            hr_total: entry.externalScores.hackerrank || 0,
            lc_problems: detailedStats.leetcode.problemsSolved,
            lc_rating: detailedStats.leetcode.rating,
            lc_contests: detailedStats.leetcode.totalContests,
            lc_total: entry.externalScores.leetcode || 0,
            ib_problems: detailedStats.interviewbit.problemsSolved,
            ib_score: detailedStats.interviewbit.rating,
            ib_total: entry.externalScores.interviewbit || 0,
            cc_problems: detailedStats.codechef.problemsSolved,
            cc_rating: detailedStats.codechef.rating,
            cc_contests: detailedStats.codechef.totalContests,
            cc_total: entry.externalScores.codechef || 0,
            cf_problems: detailedStats.codeforces.problemsSolved,
            cf_rating: detailedStats.codeforces.rating,
            cf_contests: detailedStats.codeforces.totalContests,
            cf_total: entry.externalScores.codeforces || 0,
            overallScore: entry.overallScore || 0,
            internalContests: internalContestsData
        });
    });
};


// Generate CSV report
const generateCSVReport = async (batchId, filters = {}) => {
    try {
        const data = await getReportData(batchId, filters);

        // Fetch only contests for this specific batch
        const Contest = require('../models/Contest');
        const allContests = await Contest.findByBatchId(batchId);

        // Sort by start time (chronological order)
        const sortedContests = allContests.sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));

        // Calculate max score for each contest
        const internalContestHeaders = sortedContests.map(c => {
            const contestId = c._id.toString();
            let maxScore = 0;

            data.forEach(row => {
                const score = row.internalContests?.[contestId];
                if (score && score > maxScore) {
                    maxScore = score;
                }
            });

            return {
                id: contestId,
                title: c.title,
                maxScore: maxScore,
                fullLabel: `${c.title} [Max: ${maxScore}]`
            };
        });

        // Flatten internal contests into main object for CSV
        const flattenedData = data.map(row => {
            const flatRow = { ...row };
            internalContestHeaders.forEach(c => {
                const score = row.internalContests?.[c.id];
                flatRow[`contest_${c.id}`] = score !== undefined ? score : 'Not Participated';
            });
            delete flatRow.internalContests; // Remove object
            return flatRow;
        });

        const headers = [
            { key: 'rank', label: 'Rank' },
            { key: 'globalRank', label: 'Global Rank' },
            { key: 'rollNumber', label: 'Roll Number' },
            { key: 'name', label: 'Name' },
            { key: 'branch', label: 'Branch' },
            { key: 'username', label: 'Username' },
            { key: 'alphaCoins', label: 'Alpha Coins' },
            // External - Detailed
            { key: 'hr_ds', label: 'HR(DS)' },
            { key: 'hr_algo', label: 'HR(Algo)' },
            { key: 'hr_total', label: 'HR(Total)' },
            { key: 'lc_problems', label: 'LC(Probs)' },
            { key: 'lc_rating', label: 'LC(Rating)' },
            { key: 'lc_contests', label: 'LC(Contests)' },
            { key: 'lc_total', label: 'LC(Total)' },
            { key: 'ib_problems', label: 'IB(Probs)' },
            { key: 'ib_score', label: 'IB(Score)' },
            { key: 'ib_total', label: 'IB(Total)' },
            { key: 'cc_problems', label: 'CC(Probs)' },
            { key: 'cc_rating', label: 'CC(Rating)' },
            { key: 'cc_contests', label: 'CC(Contests)' },
            { key: 'cc_total', label: 'CC(Total)' },
            { key: 'cf_problems', label: 'CF(Probs)' },
            { key: 'cf_rating', label: 'CF(Rating)' },
            { key: 'cf_contests', label: 'CF(Contests)' },
            { key: 'cf_total', label: 'CF(Total)' },
            // Internal Contests
            ...internalContestHeaders.map(c => ({ key: `contest_${c.id}`, label: c.fullLabel })),
            { key: 'overallScore', label: 'Overall Score' }
        ];

        const csv = generateCSV(flattenedData, headers);

        return {
            success: true,
            data: csv,
            filename: `alphaknowledge_report_${Date.now()}.csv`
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

        // Fetch only contests for this specific batch
        const Contest = require('../models/Contest');
        const allContests = await Contest.findByBatchId(batchId);

        // Sort by start time (chronological order)
        const sortedContests = allContests.sort((a, b) => new Date(a.startTime || 0) - new Date(b.startTime || 0));

        // Calculate max score for each contest
        const internalContestHeaders = sortedContests.map(c => {
            const contestId = c._id.toString();
            let maxScore = 0;

            data.forEach(row => {
                const score = row.internalContests?.[contestId];
                if (score && score > maxScore) {
                    maxScore = score;
                }
            });

            return {
                _id: c._id,
                title: c.title,
                maxScore: maxScore
            };
        });

        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: 20
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve({
                    success: true,
                    data: pdfBuffer,
                    filename: `alphaknowledge_report_${Date.now()}.pdf`
                });
            });
            doc.on('error', reject);

            doc.fontSize(14).font('Helvetica-Bold').text('AlphaKnowledge - Detailed Batch Report', { align: 'center' });
            doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(1);

            const tableTop = doc.y;

            // Define Columns
            const columns = [
                { header: 'Rank', key: 'rank', width: 25 },
                { header: 'Roll', key: 'rollNumber', width: 50 },
                { header: 'Name', key: 'name', width: 70 },
                { header: 'Coins', key: 'alphaCoins', width: 35 },

                // HR
                { header: 'HR(DS)', key: 'hr_ds', width: 30 },
                { header: 'HR(Al)', key: 'hr_algo', width: 30 },
                { header: 'HR(T)', key: 'hr_total', width: 25 },

                // LC
                { header: 'LC(P)', key: 'lc_problems', width: 25 },
                { header: 'LC(R)', key: 'lc_rating', width: 30 },
                { header: 'LC(C)', key: 'lc_contests', width: 25 },
                { header: 'LC(T)', key: 'lc_total', width: 30 },

                // IB
                { header: 'IB(P)', key: 'ib_problems', width: 25 },
                { header: 'IB(S)', key: 'ib_score', width: 30 },
                { header: 'IB(T)', key: 'ib_total', width: 30 },

                // CC
                { header: 'CC(P)', key: 'cc_problems', width: 25 },
                { header: 'CC(R)', key: 'cc_rating', width: 30 },
                { header: 'CC(C)', key: 'cc_contests', width: 25 },
                { header: 'CC(T)', key: 'cc_total', width: 30 },

                // CF
                { header: 'CF(P)', key: 'cf_problems', width: 25 },
                { header: 'CF(R)', key: 'cf_rating', width: 30 },
                { header: 'CF(C)', key: 'cf_contests', width: 25 },
                { header: 'CF(T)', key: 'cf_total', width: 30 },
            ];

            // Add Internal Contest Columns Dynamically
            internalContestHeaders.forEach((c, idx) => {
                columns.push({ header: `C${idx + 1}`, key: `contest_${c._id}`, width: 25 });
                // Note: We use C1, C2... for PDF headers to save space, but data keys match CSV
            });

            // Add Overall Score at the end
            columns.push({ header: 'Total', key: 'overallScore', width: 40 });

            let x = 20;
            columns.forEach(col => {
                col.x = x;
                x += col.width;
            });

            doc.fontSize(7).font('Helvetica-Bold');
            columns.forEach(col => {
                doc.text(col.header, col.x, tableTop, { width: col.width, align: 'center' });
            });

            doc.moveTo(20, tableTop + 10).lineTo(x, tableTop + 10).stroke();

            let yPosition = tableTop + 15;
            doc.fontSize(6).font('Helvetica');

            data.forEach((row, index) => {
                if (yPosition > 550) {
                    doc.addPage();
                    yPosition = 30;
                    doc.fontSize(7).font('Helvetica-Bold');
                    columns.forEach(col => {
                        doc.text(col.header, col.x, yPosition, { width: col.width, align: 'center' });
                    });
                    yPosition += 10;
                    doc.fontSize(6).font('Helvetica');
                }

                // Flatten internal contests for PDF row (same as CSV)
                const flatRow = { ...row };
                internalContestHeaders.forEach(c => {
                    const score = row.internalContests?.[c._id.toString()];
                    flatRow[`contest_${c._id}`] = score !== undefined ? score : '-';
                });

                columns.forEach(col => {
                    let value = flatRow[col.key]; // Use flatRow to access contest keys
                    if (value === undefined || value === null) value = '0';
                    if (col.key === 'rollNumber') value = String(value).substring(0, 12);
                    if (col.key === 'name') value = String(value).substring(0, 15);

                    doc.text(String(value), col.x, yPosition, { width: col.width, align: 'center' });
                });

                yPosition += 10;
            });

            // Add Legend for Internal Contests if any
            if (internalContestHeaders.length > 0) {
                doc.addPage();
                doc.fontSize(10).font('Helvetica-Bold').text('Internal Contests Legend', { underline: true });
                doc.moveDown();
                doc.fontSize(8).font('Helvetica');

                internalContestHeaders.forEach((c, idx) => {
                    doc.text(`C${idx + 1}: ${c.title} - Max Score: ${c.maxScore}`);
                });
            }

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

        // Fix #5: getLeaderboard now returns { leaderboard, total, page, limit, totalPages }
        // We fetch all pages by using a large limit; previously called without destructuring.
        const { leaderboard, total } = await ContestSubmission.getLeaderboard(contestId, null, false, 1, 10000);

        return {
            success: true,
            contest: {
                title: contest.title,
                startTime: contest.startTime,
                endTime: contest.endTime,
                participants: total
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

        // BUG #11 FIX: Previously loaded up to 500 full submission documents (inc. code strings)
        // into memory per student. With 20 parallel admin report requests that's 10,000 docs.
        // Now: exclude code field (largest payload), cap to 100 submissions per student.
        const submissions = await Submission.findByStudent(studentId, 100);
        const progress = await require('../models/Progress').findByStudent(studentId);
        const externalProfiles = await ExternalProfile.findByStudent(studentId);
        const leaderboardEntry = await Leaderboard.findByStudent(studentId);
        // findByStudent with limit=100 no-code projection (already applied in Submission model)
        const contestSubmissions = await ContestSubmission.findByStudent(studentId, 100);

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
                branch: user.education?.branch
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
