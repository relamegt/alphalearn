const axios = require('axios');
const cheerio = require('cheerio');
const ExternalProfile = require('../models/ExternalProfile');
const Leaderboard = require('../models/Leaderboard');
const puppeteer = require('puppeteer');
const Bottleneck = require('bottleneck');

// Initialize the limiter globally in this file
const limiter = new Bottleneck({
    minTime: 2000,        // Wait 2 seconds between each request
    maxConcurrent: 1      // Run only 1 request at a time
});
// Helper for consistent headers
const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
};

// ============================================
// LEETCODE - Fixed GraphQL Query with Correct Problem Count
// ============================================
const fetchLeetCodeStats = async (username) => {
    try {
        const response = await axios.post(
            'https://leetcode.com/graphql',
            {
                query: `
                query getUserProfile($username: String!) {
                  matchedUser(username: $username) {
                    username
                    submitStatsGlobal {
                      acSubmissionNum {
                        difficulty
                        count
                      }
                    }
                    profile {
                      ranking
                      reputation
                    }
                  }
                  allQuestionsCount {
                    difficulty
                    count
                  }
                  userContestRanking(username: $username) {
                    rating
                    globalRanking
                    attendedContestsCount
                    totalParticipants
                  }
                  userContestRankingHistory(username: $username) {
                    attended
                    rating
                    ranking
                    problemsSolved
                    contest {
                      title
                      startTime
                    }
                  }
                }
                `,
                variables: { username }
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': 'https://leetcode.com',
                    'Referer': `https://leetcode.com/${username}/`,
                    'User-Agent': COMMON_HEADERS['User-Agent']
                },
                timeout: 15000
            }
        );

        const data = response.data?.data;

        if (!data?.matchedUser) {
            throw new Error(`LeetCode user '${username}' not found`);
        }

        const user = data.matchedUser;
        const contestRanking = data.userContestRanking || {};
        const contestHistory = data.userContestRankingHistory || [];

        // Calculate total problems solved correctly (only Easy, Medium, Hard)
        const submissionStats = user.submitStatsGlobal?.acSubmissionNum || [];

        const easyCount = submissionStats.find(s => s.difficulty === 'Easy')?.count || 0;
        const mediumCount = submissionStats.find(s => s.difficulty === 'Medium')?.count || 0;
        const hardCount = submissionStats.find(s => s.difficulty === 'Hard')?.count || 0;

        const totalProblemsSolved = easyCount + mediumCount + hardCount;

        // Global ranking from profile (not contest ranking)
        const globalRank = user.profile?.ranking || 0;

        // Get contest history with problems solved per contest
        const allContests = contestHistory
            .filter(c => c.attended)
            .map(c => ({
                contestName: c.contest?.title || 'Unknown Contest',
                globalRank: c.ranking || 0, // Contest-specific rank
                rating: Math.round(c.rating || 0),
                problemsSolved: c.problemsSolved || 0,
                startTime: c.contest?.startTime
                    ? new Date(c.contest.startTime * 1000)
                    : new Date()
            }))
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime)); // Sort by latest first

        return {
            problemsSolved: totalProblemsSolved, // FIXED: Only Easy + Medium + Hard
            rating: Math.round(contestRanking.rating || 0), // Contest rating
            totalContests: contestRanking.attendedContestsCount || 0,
            rank: globalRank, // FIXED: Global platform ranking (not contest ranking)
            contestRanking: contestRanking.globalRanking || 0, // Separate contest ranking
            easyCount,
            mediumCount,
            hardCount,
            allContests: allContests
        };

    } catch (error) {
        console.error('LeetCode fetch error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch LeetCode data: ${error.message}`);
    }
};


// ============================================
// CODECHEF - Fixed to Count Problem Titles from Spans
// ============================================
const fetchCodeChefStats = async (username) => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(COMMON_HEADERS['User-Agent']);

        console.log(`Opening CodeChef profile: ${username}`);

        await page.goto(`https://www.codechef.com/users/${username}`, {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        await page.waitForSelector('.rating-number', { timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const data = await page.evaluate(() => {
            // 1. EXTRACT FROM DRUPAL SETTINGS (EMBEDDED JSON DATA)
            const historyData = window.Drupal?.settings?.date_versus_rating?.all || [];

            // 2. BASIC STATS FROM DOM
            const rating = parseInt(document.querySelector('.rating-number')?.innerText || '0');
            const stars = document.querySelector('.rating-star span')?.innerText?.trim() ||
                document.querySelector('.rating-star')?.innerText?.trim() || 'Unrated';

            const bodyText = document.body.innerText;
            const problemsSolved = parseInt(bodyText.match(/Total Problems Solved:\s*(\d+)/i)?.[1] || '0');
            const globalRank = parseInt(bodyText.match(/Global Rank:\s*(\d+)/i)?.[1] || '0');

            // 3. EXTRACT PROBLEMS PER CONTEST FROM DOM
            const contestProblemMap = {};

            // Find all div.content sections
            const contentDivs = document.querySelectorAll('div.content');

            console.log(`Found ${contentDivs.length} contest content divs`);

            contentDivs.forEach((div, index) => {
                // Get contest name from h5 > span
                const h5 = div.querySelector('h5');
                if (!h5) return;

                const contestNameSpan = h5.querySelector('span');
                if (!contestNameSpan) return;

                const contestName = contestNameSpan.innerText.trim();

                // Count problem spans: <span style="font-size: 12px">Problem Name</span>
                const problemSpans = div.querySelectorAll('p span[style*="font-size: 12px"]');
                const count = problemSpans.length;

                contestProblemMap[contestName] = count;

                if (index < 5) {
                    console.log(`${index + 1}. "${contestName}": ${count} problems`);
                }
            });

            console.log(`Total contests mapped: ${Object.keys(contestProblemMap).length}`);

            return {
                rating,
                stars,
                globalRank,
                problemsSolved,
                historyData,
                contestProblemMap
            };
        });

        await browser.close();

        console.log(`\nCodeChef extracted:`);
        console.log(`  - Rating: ${data.rating}`);
        console.log(`  - Problems: ${data.problemsSolved}`);
        console.log(`  - Global Rank: ${data.globalRank}`);
        console.log(`  - History entries: ${data.historyData.length}`);
        console.log(`  - Contests mapped: ${Object.keys(data.contestProblemMap).length}`);

        // 4. MERGE HISTORY DATA WITH PROBLEM COUNTS
        const allContests = data.historyData.map(entry => {
            // Match contest name to get problem count
            const solvedCount = data.contestProblemMap[entry.name] || 0;

            return {
                contestName: entry.name,
                code: entry.code,
                globalRank: parseInt(entry.rank) || 0,
                rating: parseInt(entry.rating) || 0,
                problemsSolved: solvedCount,
                startTime: new Date(entry.end_date)
            };
        });

        // Sort by date (oldest first)
        allContests.sort((a, b) => a.startTime - b.startTime);

        console.log(`\n✅ Final: ${allContests.length} contests`);

        const withProblems = allContests.filter(c => c.problemsSolved > 0);
        const withoutProblems = allContests.filter(c => c.problemsSolved === 0);

        console.log(`  - With problem counts: ${withProblems.length}`);
        console.log(`  - Without problem counts: ${withoutProblems.length}`);

        if (withProblems.length > 0) {
            console.log('\nFirst 5 contests:');
            withProblems.slice(0, 5).forEach((c, i) => {
                console.log(`  ${i + 1}. ${c.contestName}: ${c.problemsSolved} problems, rank ${c.globalRank}, rating ${c.rating}`);
            });

            console.log('\nLast 5 contests:');
            withProblems.slice(-5).forEach((c, i) => {
                console.log(`  ${withProblems.length - 4 + i}. ${c.contestName}: ${c.problemsSolved} problems, rank ${c.globalRank}, rating ${c.rating}`);
            });
        }

        return {
            problemsSolved: data.problemsSolved,
            rating: data.rating,
            totalContests: allContests.length,
            rank: data.stars,
            globalRank: data.globalRank,
            allContests: allContests
        };

    } catch (error) {
        await browser.close();
        console.error('CodeChef fetch error:', error.message);
        throw new Error(`Failed to fetch CodeChef data: ${error.message}`);
    }
};






// ============================================
// CODEFORCES - Enhanced with Better Stats
// ============================================
const fetchCodeforcesStats = async (username) => {
    try {
        // Fetch user info
        const userInfoResponse = await axios.get(
            `https://codeforces.com/api/user.info?handles=${username}`,
            {
                headers: COMMON_HEADERS,
                timeout: 10000
            }
        );

        if (userInfoResponse.data.status !== 'OK') {
            throw new Error(`Codeforces user '${username}' not found`);
        }

        const userInfo = userInfoResponse.data.result[0];

        // Fetch contest history
        let contests = [];
        try {
            const ratingResponse = await axios.get(
                `https://codeforces.com/api/user.rating?handle=${username}`,
                {
                    headers: COMMON_HEADERS,
                    timeout: 10000
                }
            );

            if (ratingResponse.data.status === 'OK') {
                contests = ratingResponse.data.result || [];
            }
        } catch (ratingError) {
            console.log('Could not fetch Codeforces rating history:', ratingError.message);
        }

        // Fetch UNIQUE problems solved count
        let problemsSolved = 0;
        try {
            const statusResponse = await axios.get(
                `https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`,
                {
                    headers: COMMON_HEADERS,
                    timeout: 20000
                }
            );

            if (statusResponse.data.status === 'OK') {
                const submissions = statusResponse.data.result || [];
                const solvedProblems = new Set();

                submissions.forEach(sub => {
                    if (sub.verdict === 'OK') {
                        const problemId = `${sub.problem.contestId}-${sub.problem.index}`;
                        solvedProblems.add(problemId);
                    }
                });

                problemsSolved = solvedProblems.size;
            }
        } catch (statusError) {
            console.log('Could not fetch Codeforces submissions:', statusError.message);
            // Don't use rating as fallback for problems solved
            problemsSolved = 0;
        }

        // Get problems solved per contest
        const contestsWithProblems = contests.map(c => {
            // Calculate problems solved based on rank change
            // This is an approximation since API doesn't provide it directly
            let estimatedProblems = 0;
            const rankChange = c.newRating - c.oldRating;

            if (rankChange > 0) {
                // Positive change: likely solved 1-4 problems
                estimatedProblems = Math.min(4, Math.floor(rankChange / 50) + 1);
            }

            return {
                contestName: c.contestName,
                globalRank: c.rank,
                rating: c.newRating,
                problemsSolved: estimatedProblems,
                startTime: new Date(c.ratingUpdateTimeSeconds * 1000)
            };
        });

        return {
            problemsSolved: problemsSolved,
            rating: userInfo.rating || 0,
            maxRating: userInfo.maxRating || 0, // Add max rating
            totalContests: contests.length,
            rank: userInfo.rank || 'unrated',
            maxRank: userInfo.maxRank || 'unrated', // Add max rank
            allContests: contestsWithProblems
        };
    } catch (error) {
        console.error('Codeforces fetch error:', error.message);
        if (error.response?.status === 400) {
            throw new Error(`Codeforces user '${username}' not found`);
        }
        throw new Error(`Failed to fetch Codeforces data: ${error.message}`);
    }
};

// ============================================
// HACKERRANK - Uses REST endpoint to get current_points (no Puppeteer)
// ============================================
const fetchHackerRankStats = async (username) => {
    try {
        const url = `https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`;

        const res = await axios.get(url, {
            headers: {
                ...COMMON_HEADERS,
                Accept: "application/json, text/plain, */*",
                Referer: `https://www.hackerrank.com/${username}`,
                Origin: "https://www.hackerrank.com"
            },
            timeout: 20000,
            // Sometimes HR blocks requests without redirects/cookies; keep defaults
            validateStatus: (s) => s >= 200 && s < 500
        });

        if (res.status !== 200) {
            throw new Error(`HTTP ${res.status}`);
        }

        const payload = res.data;

        // The response shape can vary; handle common possibilities safely
        const badges =
            payload?.badges ||
            payload?.models ||
            payload?.data ||
            payload?.result ||
            [];

        if (!Array.isArray(badges)) {
            throw new Error("Unexpected badges response format");
        }

        // Pick "problem-solving" badge if present, else take max current_points
        const ps =
            badges.find(b => b?.badge_type === "problem-solving" || /problem/i.test(b?.badge_name || "")) ||
            null;

        const currentPoints = ps?.current_points ??
            Math.max(0, ...badges.map(b => Number(b?.current_points || 0)));

        return {
            problemsSolved: ps?.solved || 0,     // optional (you can ignore)
            rating: Math.round(Number(currentPoints) || 0), // <-- THIS is what you want
            totalContests: 0,
            rank: ps?.hacker_rank || "N/A",
            currentPoints: Math.round(Number(currentPoints) || 0),
            allContests: []
        };
    } catch (err) {
        throw new Error(`Failed to fetch HackerRank badges: ${err.message}`);
    }
};


// ============================================
// INTERVIEWBIT - Robust profile scrape (text-regex based)
// ============================================
const fetchInterviewBitStats = async (username) => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
        const page = await browser.newPage();
        await page.setUserAgent(COMMON_HEADERS["User-Agent"]);

        const url = `https://www.interviewbit.com/profile/${username}`;
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

        // Prefer condition-based waits; then a small sleep for dynamic text
        await page.waitForSelector("body", { timeout: 20000 });
        await sleep(3500);

        const data = await page.evaluate(() => {
            const text = document.body?.innerText || "";

            const grabNumber = (re) => {
                const m = text.match(re);
                return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
            };

            const totalScore = grabNumber(/Total\s+Score\s+(\d+(?:,\d+)?)/i);
            const problemsSolved =
                grabNumber(/Total\s+Problems\s+Solved\s+(\d+(?:,\d+)?)/i) ||
                grabNumber(/Problems\s*-\s*(\d+(?:,\d+)?)/i);

            const globalRank = grabNumber(/Global\s+Rank\s*#?\s*(\d+(?:,\d+)?)/i);
            const coins = grabNumber(/Coins\s+(\d+(?:,\d+)?)/i);
            const streak = grabNumber(/Streak\s+(\d+(?:,\d+)?)/i);

            return { totalScore, problemsSolved, globalRank, coins, streak };
        });

        return {
            problemsSolved: data.problemsSolved,
            rating: data.totalScore,
            totalContests: 0,
            rank: data.globalRank,
            coins: data.coins,
            streak: data.streak,
            allContests: []
        };
    } catch (error) {
        throw new Error(`Failed to scrape InterviewBit: ${error.message}`);
    } finally {
        await browser.close();
    }
};


// ============================================
// SPOJ - Robust scrape from https://www.spoj.com/users/{username}/
// ============================================
/* 
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const looksLikeCloudflareBlock = (text = "") => {
    const t = text.toLowerCase();
    return (
        t.includes("cloudflare") ||
        t.includes("attention required") ||
        t.includes("verify you are human") ||
        t.includes("captcha") ||
        t.includes("checking your browser")
    );
};

const fetchSPOJStats = async (username) => {
    const browser = await puppeteer.launch({
        headless: "new",
        userDataDir: require("path").join(process.cwd(), "sessions", "spoj"),
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(COMMON_HEADERS["User-Agent"]);

        const url = `https://www.spoj.com/users/${username}/`;
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await page.waitForSelector("body", { timeout: 20000 });
        await sleep(1500);

        const data = await page.evaluate(() => {
            const text = document.body?.innerText || "";

            // rank best-effort
            const rank = parseInt((text.match(/World\s+Rank:\s*#?(\d+)/i)?.[1] || "0"), 10);

            // solved codes from links
            const solvedCodes = new Set();
            for (const a of document.querySelectorAll('a[href*="/status/"]')) {
                const href = a.getAttribute("href") || "";
                const m = href.match(/\/status\/([^,\/]+),/i);
                if (m?.[1]) solvedCodes.add(m[1].trim());
            }

            return {
                preview: text.slice(0, 500),
                rank,
                problemsSolved: solvedCodes.size,
                solvedProblems: Array.from(solvedCodes).slice(0, 10)
            };
        });

        if (looksLikeCloudflareBlock(data.preview)) {
            // Don’t return wrong zeros; instead return a clear “blocked” signal
            return {
                problemsSolved: 0,
                rating: 0,
                totalContests: 0,
                rank: 0,
                solvedProblems: [],
                allContests: [],
                blocked: true
            };
        }

        return {
            problemsSolved: data.problemsSolved,
            rating: 0,
            totalContests: 0,
            rank: data.rank,
            solvedProblems: data.solvedProblems,
            allContests: []
        };
    } finally {
        await browser.close();
    }
};
*/


// ============================================
// MAIN FETCH FUNCTION
// ============================================
const fetchExternalProfileStats = async (platform, username) => {
    const platformLower = platform.toLowerCase();

    console.log(`Fetching ${platform} stats for ${username}...`);

    try {
        let stats;

        switch (platformLower) {
            case 'leetcode':
                stats = await fetchLeetCodeStats(username);
                break;
            case 'codechef':
                stats = await fetchCodeChefStats(username);
                break;
            case 'codeforces':
                stats = await fetchCodeforcesStats(username);
                break;
            case 'hackerrank':
                stats = await fetchHackerRankStats(username);
                break;
            case 'interviewbit':
                stats = await fetchInterviewBitStats(username);
                break;
            /* case 'spoj':
                stats = await fetchSPOJStats(username);
                break; */
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }


        console.log(`✅ Successfully fetched ${platform} stats for ${username}`);
        console.log(`   Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Contests: ${stats.totalContests}, Rank: ${stats.rank}`);

        return stats;
    } catch (error) {
        console.error(`❌ Error fetching ${platform} stats for ${username}:`, error.message);
        throw error;
    }
};

// [Rest of the sync functions remain the same...]

// Sync single profile
const syncProfile = async (profileId) => {
    try {
        const profile = await ExternalProfile.findById(profileId);
        if (!profile) {
            throw new Error('Profile not found');
        }

        console.log(`Syncing profile: ${profile.platform} - ${profile.username}`);

        const stats = await fetchExternalProfileStats(profile.platform, profile.username);

        await ExternalProfile.updateStats(profileId, stats, stats.allContests || []);

        // Update leaderboard
        await Leaderboard.recalculateScores(profile.studentId);

        return {
            success: true,
            message: 'Profile synced successfully',
            stats,
            platform: profile.platform,
            username: profile.username
        };
    } catch (error) {
        console.error('Error syncing profile:', error.message);
        return {
            success: false,
            message: error.message,
            error: error.message
        };
    }
};

// Sync all profiles for a student
const syncStudentProfiles = async (studentId) => {
    try {
        const profiles = await ExternalProfile.findByStudent(studentId);

        if (profiles.length === 0) {
            return {
                success: true,
                message: 'No profiles to sync',
                results: []
            };
        }

        console.log(`Syncing ${profiles.length} profiles for student ${studentId}`);

        const results = [];

        for (const profile of profiles) {
            try {
                const result = await syncProfile(profile._id.toString());
                results.push({
                    platform: profile.platform,
                    username: profile.username,
                    ...result
                });

                // Add delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                results.push({
                    platform: profile.platform,
                    username: profile.username,
                    success: false,
                    message: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;

        return {
            success: true,
            message: `Synced ${successCount}/${profiles.length} profiles`,
            results
        };
    } catch (error) {
        console.error('Error syncing student profiles:', error.message);
        return {
            success: false,
            message: error.message,
            results: []
        };
    }
};

// Sync all profiles in batch
const syncBatchProfiles = async (batchId) => {
    try {
        const User = require('../models/User');
        const students = await User.getStudentsByBatch(batchId);

        console.log(`Syncing profiles for ${students.length} students in batch ${batchId}`);

        const results = [];
        for (const student of students) {
            const result = await syncStudentProfiles(student._id.toString());
            results.push({
                studentId: student._id,
                email: student.email,
                ...result
            });

            // Add delay between students
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const successCount = results.filter(r => r.success).length;

        return {
            success: true,
            message: `Batch sync completed: ${successCount}/${students.length} students synced`,
            results
        };
    } catch (error) {
        console.error('Error syncing batch profiles:', error.message);
        return {
            success: false,
            message: error.message
        };
    }
};

// Daily auto-sync job
const autoSyncProfiles = async () => {
    try {
        const profiles = await ExternalProfile.findProfilesNeedingSync();
        console.log(`\n🔄 Auto-sync started: ${profiles.length} profiles to sync`);

        const results = [];
        for (const profile of profiles) {
            try {
                const result = await syncProfile(profile._id.toString());
                results.push({
                    profileId: profile._id,
                    platform: profile.platform,
                    username: profile.username,
                    ...result
                });

                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (error) {
                results.push({
                    profileId: profile._id,
                    platform: profile.platform,
                    username: profile.username,
                    success: false,
                    message: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Auto-sync completed: ${successCount}/${results.length} successful\n`);

        return {
            success: true,
            syncedCount: successCount,
            totalCount: results.length,
            results
        };
    } catch (error) {
        console.error('Error in auto-sync:', error.message);
        return {
            success: false,
            message: error.message
        };
    }
};

module.exports = {
    fetchExternalProfileStats,
    syncProfile,
    syncStudentProfiles,
    syncBatchProfiles,
    autoSyncProfiles,
    // Export individual fetchers for testing
    fetchLeetCodeStats,
    fetchInterviewBitStats,
    // fetchSPOJStats,
    fetchCodeChefStats,
    fetchCodeforcesStats,
    fetchHackerRankStats
};
