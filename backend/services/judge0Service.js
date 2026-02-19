// backend/services/judge0Service.js
const axios = require('axios');

// Environment Variable for Judge0 API URL
// Example: http://YOUR_JUDGE0_HOST:2358
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';

// Language ID Mapping (Standard Judge0 IDs)
const LANGUAGE_IDS = {
    c: 50,          // GCC 9.2.0
    cpp: 54,        // GCC 9.2.0
    java: 62,       // OpenJDK 13.0.1
    python: 71,     // Python 3.8.1
    javascript: 63, // Node.js 12.14.0
};

// Language Versions (for API compatibility)
const languageVersions = {
    c: 'GCC 9.2.0',
    cpp: 'GCC 9.2.0',
    java: 'OpenJDK 13.0.1',
    python: '3.8.1',
    javascript: 'Node.js 12.14.0'
};

// Get runtimes (Dummy implementation for compatibility)
const getRuntimes = async () => {
    return Object.keys(LANGUAGE_IDS).map(lang => ({
        language: lang,
        version: languageVersions[lang],
        aliases: []
    }));
};

// Validate code
const validateCode = (code, language) => {
    const errors = [];

    if (!code || code.trim().length === 0) {
        errors.push('Code cannot be empty');
    }

    if (code.length > 20000) {
        errors.push('Code exceeds maximum length of 20000 characters');
    }

    const dangerousPatterns = {
        c: [/system\s*\(/i, /exec\s*\(/i, /fork\s*\(/i],
        cpp: [/system\s*\(/i, /exec\s*\(/i, /fork\s*\(/i],
        java: [/Runtime\.getRuntime\(\)/i, /ProcessBuilder/i],
        python: [/os\.system/i, /subprocess/i, /eval\s*\(/i, /exec\s*\(/i, /__import__/i],
        javascript: [/require\s*\(/i, /eval\s*\(/i, /Function\s*\(/i, /child_process/i]
    };

    const patterns = dangerousPatterns[language] || [];
    for (const pattern of patterns) {
        if (pattern.test(code)) {
            errors.push(`Potentially dangerous code pattern detected`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

// Execute single code run (Legacy/Single use)
const executeCode = async (language, code, stdin = '', timeLimit = 3000) => {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    try {
        const payload = {
            source_code: Buffer.from(code).toString('base64'),
            language_id: languageId,
            stdin: Buffer.from(stdin).toString('base64'),
            // cpu_time_limit: Math.min(timeLimit / 1000, 10) // Relaxed
        };

        const response = await axios.post(
            `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`,
            payload
        );

        return parseJudge0Response(response.data);

    } catch (error) {
        console.error('Judge0 execution error:', error.message);
        return { success: false, verdict: 'Runtime Error', output: '', error: error.message };
    }
};

// OPTIMIZED: Batch Execution for Multiple Test Cases
const executeWithTestCases = async (language, code, testCases, timeLimit = 3000) => {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    if (!testCases || testCases.length === 0) {
        return { verdict: 'Accepted', testCasesPassed: 0, totalTestCases: 0, results: [] };
    }

    try {
        console.log(`\n🚀 [Judge0] Prepare Batch (${testCases.length} cases)`);
        console.log(`   Language: ${language} (ID: ${languageId})`);

        // 1. Prepare Batch Payload
        const submissions = testCases.map((tc, index) => {
            const input = String(tc.input || "");
            return {
                source_code: Buffer.from(code).toString('base64'),
                language_id: languageId,
                stdin: Buffer.from(input).toString('base64'),
                // Relaxed limits -> let Judge0 defaults apply to rule out config issues
            };
        });

        // 2. Send Batch Request
        // Note: Even with wait=true, some servers return 201 + tokens immediately
        console.log(`   Sending request to: ${JUDGE0_API_URL}/submissions/batch`);

        let response = await axios.post(
            `${JUDGE0_API_URL}/submissions/batch?base64_encoded=true&wait=true`,
            { submissions },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        console.log(`   [Judge0] Response Status: ${response.status}`);

        let rawResults = response.data;

        // 3. Handle Polling if Tokens Returned (Status 201 or missing status object in results)
        // If the server returns tokens instead of results, we must poll.
        // Usually `wait=true` returns array of objects with results.
        // If it failed to wait, it might return array of objects with JUST tokens.

        // Check if we got tokens. A token response usually looks like [{token: "..."}] or just tokens.
        // The most reliable check is: if result is array, check first item for 'status'. If missing, it's a token response.

        const isTokenResponse = (Array.isArray(rawResults) && rawResults.length > 0 && !rawResults[0].status);

        if (response.status === 201 || isTokenResponse) {
            console.log('   [Judge0] Received tokens (async mode). Switching to polling...');

            // Extract tokens. Response might be [{token: "..."}]
            const tokens = rawResults.map(r => r.token).filter(t => t);

            if (tokens.length === 0) {
                console.error('   [Judge0] No tokens found in 201 response:', JSON.stringify(rawResults));
                throw new Error('Judge0 returned 201 but no tokens found');
            }

            console.log(`   [Judge0] Polling for ${tokens.length} submissions...`);

            // Polling Loop
            const maxRetries = 20; // 20 attempts
            const delay = 1000; // 1 second
            let attempts = 0;
            let finished = false;

            while (!finished && attempts < maxRetries) {
                await new Promise(r => setTimeout(r, delay));
                attempts++;

                // Construct comma-separated tokens
                const tokenStr = tokens.join(',');

                try {
                    const pollResponse = await axios.get(
                        `${JUDGE0_API_URL}/submissions/batch`,
                        {
                            params: {
                                tokens: tokenStr,
                                base64_encoded: 'true',
                                fields: 'token,stdout,stderr,status,message,compile_output'
                            }
                        }
                    );

                    const pollData = pollResponse.data.submissions;

                    if (!pollData || !Array.isArray(pollData)) {
                        console.log('   [Judge0] Invalid poll data format');
                        continue;
                    }

                    // Check if all are processed (status.id >= 3)
                    // 1=In Queue, 2=Processing
                    const allDone = pollData.every(s => s.status && s.status.id >= 3);

                    if (allDone) {
                        console.log(`   [Judge0] Polling complete after ${attempts} attempts`);
                        rawResults = pollData;
                        finished = true;
                    } else {
                        if (attempts % 5 === 0) console.log(`   [Judge0] Still processing... (${attempts}/${maxRetries})`);
                    }
                } catch (pollErr) {
                    console.error('   [Judge0] Polling error:', pollErr.message);
                }
            }

            if (!finished) {
                throw new Error('Time Limit Exceeded (Polling timed out)');
            }
        }

        if (!Array.isArray(rawResults)) {
            console.error('   [Judge0] Invalid Results Format:', JSON.stringify(rawResults));
            throw new Error('Invalid response format from Judge0');
        }

        // 4. Parse and Map Results
        const results = rawResults.map((res, i) => {
            const testCase = testCases[i] || {}; // Safety fallback

            // Safety check for status
            if (!res.status) {
                return {
                    input: testCase.input,
                    expectedOutput: testCase.output,
                    actualOutput: '',
                    passed: false,
                    verdict: 'System Error',
                    error: 'Missing status in response',
                    isHidden: testCase.isHidden
                };
            }

            // --- DEBUG LOGGING ---
            if (res.status.id !== 3) {
                console.log(`\n   ❌ [Case ${i + 1}] Failed (Status ID: ${res.status.id} - ${res.status.description})`);
                const rawStderr = res.stderr ? Buffer.from(res.stderr, 'base64').toString('utf-8') : '';
                const rawMsg = res.message ? Buffer.from(res.message, 'base64').toString('utf-8') : '';
                const rawCompile = res.compile_output ? Buffer.from(res.compile_output, 'base64').toString('utf-8') : '';

                if (rawStderr) console.log(`      STDERR: ${rawStderr}`);
                if (rawMsg) console.log(`      MESSAGE: ${rawMsg}`);
                if (rawCompile) console.log(`      COMPILE: ${rawCompile}`);
            }

            const parsed = parseJudge0Response(res);

            // Normalize outputs
            const actualNormalized = normalizeOutput(parsed.output);
            const expectedNormalized = normalizeOutput(String(testCase.output || ''));

            // Check correctness
            const passed = parsed.success &&
                (testCase.output === undefined || testCase.output === null || actualNormalized === expectedNormalized);

            let finalVerdict = parsed.verdict;
            if (parsed.success && !passed && testCase.output !== undefined) {
                finalVerdict = 'Wrong Answer';
            }

            return {
                input: testCase.input,
                expectedOutput: testCase.output,
                actualOutput: parsed.output,
                passed: passed,
                verdict: finalVerdict,
                error: parsed.error,
                isHidden: testCase.isHidden || false
            };
        });

        // 5. Calculate Final Stats
        let passedCount = 0;
        let batchVerdict = 'Accepted';
        let batchError = null;

        for (const res of results) {
            if (res.passed) passedCount++;
            else {
                if (res.verdict === 'Compilation Error') {
                    batchVerdict = 'Compilation Error';
                    if (!batchError) batchError = res.error;
                }
                else if (res.verdict === 'Runtime Error' && batchVerdict !== 'Compilation Error') {
                    batchVerdict = 'Runtime Error';
                    if (!batchError) batchError = res.error;
                }
                else if (res.verdict === 'TLE' && batchVerdict !== 'Compilation Error' && batchVerdict !== 'Runtime Error') {
                    batchVerdict = 'TLE';
                }
                else if (res.verdict === 'Wrong Answer' && batchVerdict === 'Accepted') {
                    batchVerdict = 'Wrong Answer';
                }
            }
        }

        console.log(`   [Judge0] Batch Result: ${batchVerdict} (${passedCount}/${testCases.length} passed)\n`);

        return {
            verdict: batchVerdict,
            testCasesPassed: passedCount,
            totalTestCases: testCases.length,
            results: results,
            error: batchError
        };

    } catch (error) {
        console.error('❌ [Judge0] Batch System Error:', error.message);
        if (error.response) console.error('   Response Data:', JSON.stringify(error.response.data));

        return {
            verdict: 'Runtime Error',
            testCasesPassed: 0,
            totalTestCases: testCases.length,
            results: [],
            error: `System Error: ${error.message}`
        };
    }
};

// Helper: Parse Judge0 Response Object
const parseJudge0Response = (data) => {
    // Decode fields
    const statusId = data.status?.id;
    const stdout = data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf-8') : '';
    const stderr = data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf-8') : '';
    const compileOutput = data.compile_output ? Buffer.from(data.compile_output, 'base64').toString('utf-8') : '';
    const message = data.message ? Buffer.from(data.message, 'base64').toString('utf-8') : '';

    if (statusId === 3) {
        return { success: true, verdict: 'Accepted', output: stdout, error: null };
    }

    // Compilation Error
    if (statusId === 6) {
        return { success: false, verdict: 'Compilation Error', output: stdout, error: compileOutput || stderr };
    }

    // TLE
    if (statusId === 5) {
        return { success: false, verdict: 'TLE', output: stdout, error: 'Time Limit Exceeded' };
    }

    // Runtime Error & Others
    // We strictly prefer stderr, then message, then status description
    let error = stderr || message || data.status?.description || 'Runtime Error';
    error = cleanErrorMessage(error);

    return {
        success: false,
        verdict: 'Runtime Error',
        output: stdout,
        error: error
    };
};

const cleanErrorMessage = (errorMsg) => {
    if (!errorMsg) return '';
    let clean = errorMsg.replace(/\/judge0\/[a-zA-Z0-9_\-\/]+\./g, '');
    clean = clean.replace(/File "script\.py",/g, 'Line');
    clean = clean.replace(/script\.[a-z]+:?/g, '');
    return clean.trim();
};

// Helper: Normalize Output
const normalizeOutput = (str) => {
    if (!str) return '';
    return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
};

module.exports = {
    executeCode,
    executeWithTestCases,
    validateCode,
    getRuntimes,
    languageVersions
};
