const {
    fetchLeetCodeStats,
    fetchCodeChefStats,
    fetchCodeforcesStats,
    fetchHackerRankStats,
    fetchInterviewBitStats,
    fetchSPOJStats
} = require('./services/profileSyncService');

async function testProfiles() {
    console.log('==============================');
    console.log('🧪 TESTING ALL 6 PLATFORMS');
    console.log('==============================\n');

    // Test usernames - UPDATE THESE WITH REAL USERNAMES
    const testData = {
        leetcode: 'akash__9963',
        codechef: 'akash_9963',
        codeforces: 'edhokati123',
        hackerrank: 'dangudubiyyapua1',
        interviewbit: 'akash-dangudubiyyapu', // UPDATE THIS
        spoj: 'akash__9963'       // UPDATE THIS
    };

    const results = [];

    // ================================
    // 1️⃣ LEETCODE
    // ================================
    console.log('🔥 1️⃣ Testing LeetCode...');
    try {
        const stats = await fetchLeetCodeStats(testData.leetcode);
        console.log(`✅ LeetCode [${testData.leetcode}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
        results.push({ platform: 'leetcode', success: true, problems: stats.problemsSolved, rating: stats.rating });
    } catch (error) {
        console.error('❌ LeetCode Error:', error.message);
        results.push({ platform: 'leetcode', success: false, error: error.message });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // ================================
    // 2️⃣ CODECHEF
    // ================================
    console.log('🍳 2️⃣ Testing CodeChef...');
    try {
        const stats = await fetchCodeChefStats(testData.codechef);
        console.log(`✅ CodeChef [${testData.codechef}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
        results.push({ platform: 'codechef', success: true, problems: stats.problemsSolved, rating: stats.rating });
    } catch (error) {
        console.error('❌ CodeChef Error:', error.message);
        results.push({ platform: 'codechef', success: false, error: error.message });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // ================================
    // 3️⃣ CODEFORCES
    // ================================
    console.log('⚡ 3️⃣ Testing Codeforces...');
    try {
        const stats = await fetchCodeforcesStats(testData.codeforces);
        console.log(`✅ Codeforces [${testData.codeforces}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
        results.push({ platform: 'codeforces', success: true, problems: stats.problemsSolved, rating: stats.rating });
    } catch (error) {
        console.error('❌ Codeforces Error:', error.message);
        results.push({ platform: 'codeforces', success: false, error: error.message });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // ================================
    // 4️⃣ HACKERRANK (FIXED)
    // ================================
    console.log('🐱 4️⃣ Testing HackerRank...');
    try {
        const stats = await fetchHackerRankStats(testData.hackerrank);
        console.log(`✅ HackerRank [${testData.hackerrank}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
        results.push({ platform: 'hackerrank', success: true, problems: stats.problemsSolved, rating: stats.rating });
    } catch (error) {
        console.error('❌ HackerRank Error:', error.message);
        results.push({ platform: 'hackerrank', success: false, error: error.message });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // ================================
    // 5️⃣ INTERVIEWBIT (NEW)
    // ================================
    console.log('💼 5️⃣ Testing InterviewBit...');
    try {
        const stats = await fetchInterviewBitStats(testData.interviewbit);
        console.log(`✅ InterviewBit [${testData.interviewbit}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
        results.push({ platform: 'interviewbit', success: true, problems: stats.problemsSolved, rating: stats.rating });
    } catch (error) {
        console.error('❌ InterviewBit Error:', error.message);
        results.push({ platform: 'interviewbit', success: false, error: error.message });
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // ================================
    // 6️⃣ SPOJ (NEW)
    // ================================
    // console.log('🏆 6️⃣ Testing SPOJ...');
    // try {
    //     const stats = await fetchSPOJStats(testData.spoj);
    //     console.log(`✅ SPOJ [${testData.spoj}] - Problems: ${stats.problemsSolved}, Rating: ${stats.rating}, Rank: ${stats.rank}`);
    //     results.push({ platform: 'spoj', success: true, problems: stats.problemsSolved, rating: stats.rating });
    // } catch (error) {
    //     console.error('❌ SPOJ Error:', error.message);
    //     results.push({ platform: 'spoj', success: false, error: error.message });
    // }

    // ================================
    // 📊 SUMMARY
    // ================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(60));

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ SUCCESS: ${successCount}/6 platforms`);
    console.log(`❌ FAILED: ${6 - successCount}/6 platforms\n`);

    console.table(results);

    console.log('\nDetailed Results:');
    results.forEach((result, index) => {
        if (result.success) {
            console.log(`  ✅ ${result.platform.toUpperCase()}: ${result.problems || 0} problems, rating ${result.rating || 0}`);
        } else {
            console.log(`  ❌ ${result.platform.toUpperCase()}: ${result.error}`);
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Testing Complete!');
    console.log('='.repeat(60));
}

testProfiles();
