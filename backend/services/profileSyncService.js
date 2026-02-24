const axios = require('axios');
const cheerio = require('cheerio');
const ExternalProfile = require('../models/ExternalProfile');
const Leaderboard = require('../models/Leaderboard');
const puppeteer = require('puppeteer');
const Bottleneck = require('bottleneck');
const genericPool = require('generic-pool');
const { addScoreJob } = require('../config/queue');

// Initialize the limiter globally in this file
const limiter = new Bottleneck({
    minTime: 2000,        // Wait 2 seconds between each request
    maxConcurrent: 1      // Run only 1 request at a time
});

// Puppeteer Browser Pool Factory (MEMORY SAVER)
const browserFactory = {
    create: async () => {
        return await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        });
    },
    destroy: async (browser) => {
        await browser.close();
    }
};

const browserPool = genericPool.createPool(browserFactory, {
    max: 3, // Prevent OOM by limiting concurrent browser instances
    min: 1,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 60000
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
        if (!data?.matchedUser) throw new Error(`LeetCode user '${username}' not found`);

        const user = data.matchedUser;
        const contestRanking = data.userContestRanking || {};
        const contestHistory = data.userContestRankingHistory || [];
        const submissionStats = user.submitStatsGlobal?.acSubmissionNum || [];

        const easyCount = submissionStats.find(s => s.difficulty === 'Easy')?.count || 0;
        const mediumCount = submissionStats.find(s => s.difficulty === 'Medium')?.count || 0;
        const hardCount = submissionStats.find(s => s.difficulty === 'Hard')?.count || 0;
        const totalProblemsSolved = easyCount + mediumCount + hardCount;

        const allContests = contestHistory.filter(c => c.attended).map(c => ({
            contestName: c.contest?.title || 'Unknown Contest',
            globalRank: c.ranking || 0,
            rating: Math.round(c.rating || 0),
            problemsSolved: c.problemsSolved || 0,
            startTime: c.contest?.startTime ? new Date(c.contest.startTime * 1000) : new Date()
        })).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

        return {
            problemsSolved: totalProblemsSolved,
            rating: Math.round(contestRanking.rating || 0),
            totalContests: contestRanking.attendedContestsCount || 0,
            rank: user.profile?.ranking || 0,
            contestRanking: contestRanking.globalRanking || 0,
            easyCount, mediumCount, hardCount,
            allContests
        };
    } catch (error) {
        console.error('LeetCode fetch error:', error.response?.data || error.message);
        throw new Error(`Failed to fetch LeetCode data: ${error.message}`);
    }
};

// ============================================
// CODECHEF - POOLED PUPPETEER
// ============================================
const fetchCodeChefStats = async (username) => {
    let browser;
    try {
        browser = await browserPool.acquire();
        const page = await browser.newPage();
        await page.setUserAgent(COMMON_HEADERS['User-Agent']);

        await page.goto(`https://www.codechef.com/users/${username}`, {
            waitUntil: "networkidle2",
            timeout: 60000
        });

        await page.waitForSelector('.rating-number', { timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const data = await page.evaluate(() => {
            const historyData = window.Drupal?.settings?.date_versus_rating?.all || [];
            const rating = parseInt(document.querySelector('.rating-number')?.innerText || '0');
            const stars = document.querySelector('.rating-star span')?.innerText?.trim() || 'Unrated';
            const bodyText = document.body.innerText;
            const problemsSolved = parseInt(bodyText.match(/Total Problems Solved:\s*(\d+)/i)?.[1] || '0');
            const globalRank = parseInt(bodyText.match(/Global Rank:\s*(\d+)/i)?.[1] || '0');

            const contestProblemMap = {};
            document.querySelectorAll('div.content').forEach(div => {
                const h5 = div.querySelector('h5');
                if (!h5) return;
                const contestName = h5.querySelector('span')?.innerText.trim();
                if (!contestName) return;
                contestProblemMap[contestName] = div.querySelectorAll('p span[style*="font-size: 12px"]').length;
            });

            return { rating, stars, globalRank, problemsSolved, historyData, contestProblemMap };
        });

        await page.close();
        browserPool.release(browser);

        const allContests = data.historyData.map(entry => ({
            contestName: entry.name,
            code: entry.code,
            globalRank: parseInt(entry.rank) || 0,
            rating: parseInt(entry.rating) || 0,
            problemsSolved: data.contestProblemMap[entry.name] || 0,
            startTime: new Date(entry.end_date)
        })).sort((a, b) => a.startTime - b.startTime);

        return {
            problemsSolved: data.problemsSolved,
            rating: data.rating,
            totalContests: allContests.length,
            rank: data.stars,
            globalRank: data.globalRank,
            allContests
        };
    } catch (error) {
        if (browser) {
            try {
                await browserPool.destroy(browser);
            } catch (destroyErr) {
                console.error('[Pool] Failed to destroy corrupted browser:', destroyErr.message);
            }
        }
        throw new Error(`CodeChef Scrape Failed: ${error.message}`);
    }
};

// ============================================
// CODEFORCES
// ============================================
const fetchCodeforcesStats = async (username) => {
    try {
        const userInfoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${username}`, { timeout: 10000 });
        if (userInfoRes.data.status !== 'OK') throw new Error('User not found');
        const userInfo = userInfoRes.data.result[0];

        const ratingRes = await axios.get(`https://codeforces.com/api/user.rating?handle=${username}`, { timeout: 10000 });
        const contests = ratingRes.data.status === 'OK' ? ratingRes.data.result : [];

        const statusRes = await axios.get(`https://codeforces.com/api/user.status?handle=${username}&from=1&count=1000`, { timeout: 15000 });
        let problemsSolved = 0;
        if (statusRes.data.status === 'OK') {
            const solved = new Set();
            statusRes.data.result.forEach(sub => {
                if (sub.verdict === 'OK') solved.add(`${sub.problem.contestId}-${sub.problem.index}`);
            });
            problemsSolved = solved.size;
        }

        const contestsWithStats = contests.map(c => ({
            contestName: c.contestName,
            globalRank: c.rank,
            rating: c.newRating,
            problemsSolved: c.newRating > c.oldRating ? Math.min(4, Math.floor((c.newRating - c.oldRating) / 50) + 1) : 0,
            startTime: new Date(c.ratingUpdateTimeSeconds * 1000)
        }));

        return {
            problemsSolved,
            rating: userInfo.rating || 0,
            maxRating: userInfo.maxRating || 0,
            totalContests: contests.length,
            rank: userInfo.rank || 'unrated',
            allContests: contestsWithStats
        };
    } catch (error) {
        throw new Error(`Codeforces API error: ${error.message}`);
    }
};

// ============================================
// HACKERRANK
// ============================================
const fetchHackerRankStats = async (username) => {
    try {
        const res = await axios.get(`https://www.hackerrank.com/rest/hackers/${encodeURIComponent(username)}/badges`, {
            headers: COMMON_HEADERS,
            timeout: 15000
        });
        const badges = res.data?.badges || res.data?.models || [];
        const ps = badges.find(b => b?.badge_type === "problem-solving" || /problem/i.test(b?.badge_name || ""));
        const points = ps?.current_points ?? Math.max(0, ...badges.map(b => Number(b?.current_points || 0)));

        return {
            problemsSolved: ps?.solved || 0,
            rating: Math.round(Number(points) || 0),
            totalContests: 0,
            rank: ps?.hacker_rank || "N/A",
            allContests: []
        };
    } catch (err) {
        throw new Error(`HackerRank fetch error: ${err.message}`);
    }
};

// ============================================
// INTERVIEWBIT - POOLED PUPPETEER
// ============================================
const fetchInterviewBitStats = async (username) => {
    let browser;
    try {
        browser = await browserPool.acquire();
        const page = await browser.newPage();
        await page.setUserAgent(COMMON_HEADERS["User-Agent"]);
        await page.goto(`https://www.interviewbit.com/profile/${username}`, { waitUntil: "networkidle2", timeout: 45000 });
        await page.waitForSelector("body", { timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const data = await page.evaluate(() => {
            const text = document.body?.innerText || "";
            const grab = (re) => {
                const m = text.match(re);
                return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
            };
            return {
                totalScore: grab(/Total\s+Score\s+(\d+(?:,\d+)?)/i),
                problemsSolved: grab(/Total\s+Problems\s+Solved\s+(\d+(?:,\d+)?)/i) || grab(/Problems\s*-\s*(\d+(?:,\d+)?)/i),
                globalRank: grab(/Global\s+Rank\s*#?\s*(\d+(?:,\d+)?)/i)
            };
        });

        await page.close();
        browserPool.release(browser);

        return {
            problemsSolved: data.problemsSolved,
            rating: data.totalScore,
            totalContests: 0,
            rank: data.globalRank,
            allContests: []
        };
    } catch (error) {
        if (browser) {
            try {
                await browserPool.destroy(browser);
            } catch (destroyErr) {
                console.error('[Pool] Failed to destroy corrupted browser:', destroyErr.message);
            }
        }
        throw new Error(`InterviewBit Scrape Failed: ${error.message}`);
    }
};

// ============================================
// MAIN SERVICES
// ============================================
const fetchExternalProfileStats = async (platform, username) => {
    const p = platform.toLowerCase();
    console.log(`[Sync] Fetching ${platform} for ${username}...`);
    if (p === 'leetcode') return await fetchLeetCodeStats(username);
    if (p === 'codechef') return await fetchCodeChefStats(username);
    if (p === 'codeforces') return await fetchCodeforcesStats(username);
    if (p === 'hackerrank') return await fetchHackerRankStats(username);
    if (p === 'interviewbit') return await fetchInterviewBitStats(username);
    throw new Error(`Unsupported platform: ${platform}`);
};

const syncProfile = async (profileId) => {
    try {
        const profile = await ExternalProfile.findById(profileId);
        if (!profile) throw new Error('Profile not found');

        const stats = await fetchExternalProfileStats(profile.platform, profile.username);
        await ExternalProfile.updateStats(profileId, stats, stats.allContests || []);

        // OFFLOAD Score Recalculation to background worker
        await addScoreJob(profile.studentId);

        return { success: true, stats };
    } catch (error) {
        console.error(`[Sync] Fail: ${error.message}`);
        return { success: false, message: error.message };
    }
};

const syncStudentProfiles = async (studentId) => {
    const profiles = await ExternalProfile.findByStudent(studentId);
    if (profiles.length === 0) return { success: true, message: 'No profiles' };

    const results = [];
    for (const profile of profiles) {
        const res = await syncProfile(profile._id.toString());
        results.push({ platform: profile.platform, ...res });
        await new Promise(r => setTimeout(r, 2000));
    }
    return { success: true, results };
};

const syncBatchProfiles = async (batchId) => {
    const User = require('../models/User');
    const students = await User.getStudentsByBatch(batchId);
    for (const student of students) {
        await syncStudentProfiles(student._id.toString());
        await new Promise(r => setTimeout(r, 3000));
    }
    return { success: true };
};

const autoSyncProfiles = async () => {
    const { getRedis } = require('../config/redis');
    const redis = getRedis();
    const SYNC_LOCK_KEY = 'lock:autoSyncProfiles';
    const SYNC_LOCK_TTL = 4 * 60 * 60; // 4 hours max — prevents overlap with the next midnight run

    // Distributed lock: only one instance/run executes at a time
    const acquired = await redis.set(SYNC_LOCK_KEY, '1', 'NX', 'EX', SYNC_LOCK_TTL);
    if (!acquired) {
        console.log('[AutoSync] Previous sync is still running (lock held). Skipping this run.');
        return { success: true, syncedCount: 0, skipped: true };
    }

    let syncedCount = 0;
    try {
        const profiles = await ExternalProfile.findProfilesNeedingSync();
        console.log(`[AutoSync] Starting sync for ${profiles.length} profiles...`);
        for (const profile of profiles) {
            await syncProfile(profile._id.toString());
            syncedCount++;
            await new Promise(r => setTimeout(r, 3000)); // rate limit delay
        }
        return { success: true, syncedCount };
    } finally {
        // Always release the lock, even on error
        await redis.del(SYNC_LOCK_KEY);
        console.log(`[AutoSync] Sync complete. ${syncedCount} profiles processed. Lock released.`);
    }
};

module.exports = {
    fetchExternalProfileStats,
    syncProfile,
    syncStudentProfiles,
    syncBatchProfiles,
    autoSyncProfiles,
    fetchLeetCodeStats,
    fetchInterviewBitStats,
    fetchCodeChefStats,
    fetchCodeforcesStats,
    fetchHackerRankStats
};
