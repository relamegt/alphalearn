// Calculate platform-specific scores based on PRD formulas

// LeetCode Score: (LCPS*10 + (LCR-1300)²/10 + LCNC*50)
const calculateLeetCodeScore = (stats) => {
    const problemsSolved = stats.problemsSolved || 0;
    const rating = stats.rating || 1300;
    const totalContests = stats.totalContests || 0;

    const problemScore = problemsSolved * 10;
    const ratingScore = rating > 1300 ? Math.pow(rating - 1300, 2) / 10 : 0;
    const contestScore = totalContests * 50;

    return Math.round(problemScore + ratingScore + contestScore);
};

// CodeChef Score: (CCPS*2 + (CCR-1200)²/10 + CCNC*50)
const calculateCodeChefScore = (stats) => {
    const problemsSolved = stats.problemsSolved || 0;
    const rating = stats.rating || 1200;
    const totalContests = stats.totalContests || 0;

    const problemScore = problemsSolved * 2;
    const ratingScore = rating > 1200 ? Math.pow(rating - 1200, 2) / 10 : 0;
    const contestScore = totalContests * 50;

    return Math.round(problemScore + ratingScore + contestScore);
};

// Codeforces Score: (CFPS*2 + (CFR-800)²/10 + CFNC*50)
const calculateCodeforcesScore = (stats) => {
    const problemsSolved = stats.problemsSolved || 0;
    const rating = stats.rating || 800;
    const totalContests = stats.totalContests || 0;

    const problemScore = problemsSolved * 2;
    const ratingScore = rating > 800 ? Math.pow(rating - 800, 2) / 10 : 0;
    const contestScore = totalContests * 50;

    return Math.round(problemScore + ratingScore + contestScore);
};

// HackerRank Score: Total score (DS + Algo combined)
const calculateHackerRankScore = (stats) => {
    return stats.rating || 0;
};

// InterviewBit Score: IBS/5
const calculateInterviewBitScore = (stats) => {
    const totalScore = stats.rating || 0;
    return Math.round(totalScore / 5);
};

// SPOJ Score: (SP*500 + SPS*20)
const calculateSPOJScore = (stats) => {
    const rank = stats.rank || 0;
    const problemsSolved = stats.problemsSolved || 0;

    const rankScore = rank * 500;
    const problemScore = problemsSolved * 20;

    return Math.round(rankScore + problemScore);
};

// Main function to calculate score based on platform
const calculatePlatformScore = (platform, stats) => {
    switch (platform.toLowerCase()) {
        case 'leetcode':
            return calculateLeetCodeScore(stats);
        case 'codechef':
            return calculateCodeChefScore(stats);
        case 'codeforces':
            return calculateCodeforcesScore(stats);
        case 'hackerrank':
            return calculateHackerRankScore(stats);
        case 'interviewbit':
            return calculateInterviewBitScore(stats);
        case 'spoj':
            return calculateSPOJScore(stats);
        default:
            return 0;
    }
};

// Calculate overall score (excludes AlphaLearn Primary - internal contests)
const calculateOverallScore = (alphaLearnBasicScore, externalScores) => {
    const leetcodeScore = externalScores.leetcode || 0;
    const codechefScore = externalScores.codechef || 0;
    const codeforcesScore = externalScores.codeforces || 0;
    const hackerrankScore = externalScores.hackerrank || 0;
    const interviewbitScore = externalScores.interviewbit || 0;
    const spojScore = externalScores.spoj || 0;

    return (
        alphaLearnBasicScore +
        leetcodeScore +
        codechefScore +
        codeforcesScore +
        hackerrankScore +
        interviewbitScore +
        spojScore
    );
};

module.exports = {
    calculateLeetCodeScore,
    calculateCodeChefScore,
    calculateCodeforcesScore,
    calculateHackerRankScore,
    calculateInterviewBitScore,
    calculateSPOJScore,
    calculatePlatformScore,
    calculateOverallScore
};
