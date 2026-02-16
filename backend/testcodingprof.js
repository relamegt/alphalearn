const {
    fetchLeetCodeStats,
    fetchCodeChefStats,
    fetchCodeforcesStats
} = require('./services/profileSyncService');

async function testProfiles() {
    console.log('Testing External Profile Fetching\n');

    // Test LeetCode
    try {
        console.log('1. Testing LeetCode...');
        const leetcodeStats = await fetchLeetCodeStats('akash__9963');
        console.log('✅ LeetCode Stats:', JSON.stringify(leetcodeStats, null, 2));
    } catch (error) {
        console.error('❌ LeetCode Error:', error.message);
    }

    console.log('\n---\n');

    // Test CodeChef
    // try {
    //     console.log('2. Testing CodeChef...');
    //     const codechefStats = await fetchCodeChefStats('akash_9963');
    //     console.log('✅ CodeChef Stats:', JSON.stringify(codechefStats, null, 2));
    // } catch (error) {
    //     console.error('❌ CodeChef Error:', error.message);
    // }

    console.log('\n---\n');

    // Test Codeforces
    // try {
    //     console.log('3. Testing Codeforces...');
    //     const codeforcesStats = await fetchCodeforcesStats('edhokati123');
    //     console.log('✅ Codeforces Stats:', JSON.stringify(codeforcesStats, null, 2));
    // } catch (error) {
    //     console.error('❌ Codeforces Error:', error.message);
    // }
}

testProfiles();
