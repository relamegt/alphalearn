// backend/services/pistonService.js (FIXED - Following Official Piston Docs)
const axios = require('axios');

// ✅ Use CORRECT endpoints from official docs
const PISTON_API_URL = process.env.PISTON_API_URL || 'https://piston-api.run';

// Updated language mappings
const languageVersions = {
    c: '10.2.0',
    cpp: '10.2.0',
    java: '15.0.2',
    python: '3.10.0',
    javascript: '18.15.0',
    csharp: '5.0.201'
};

// Map our language names to Piston's expected names
const languageMap = {
    cpp: 'c++',
    javascript: 'javascript',
    python: 'python',
    java: 'java',
    c: 'c',
    csharp: 'csharp'
};

// Get runtime information
const getRuntimes = async () => {
    try {
        const response = await axios.get(`${PISTON_API_URL}/runtimes`);
        return response.data;
    } catch (error) {
        console.error('❌ Error fetching Piston runtimes:', error.message);
        throw new Error('Failed to fetch available runtimes');
    }
};

// ✅ FIXED: Execute code following official Piston API format
const executeCode = async (language, code, stdin = '', timeLimit = 3000) => {
    try {
        // Map language name
        const pistonLanguage = languageMap[language] || language;
        const stdinString = typeof stdin === 'string' ? stdin : String(stdin || '');

        // ✅ Follow EXACT format from Piston docs
        const payload = {
            language: pistonLanguage,
            version: languageVersions[language] || '*', // Use * for latest if version unknown
            files: [
                {
                    name: `main.${getFileExtension(language)}`,
                    content: code
                }
            ],
            stdin: stdinString,
            args: [],
            compile_timeout: 10000,  // 10 seconds
            run_timeout: Math.min(timeLimit, 3000),  // Max 3 seconds as per Piston defaults
            compile_cpu_time: 10000,
            run_cpu_time: Math.min(timeLimit, 3000),
            compile_memory_limit: -1,
            run_memory_limit: -1
        };

        console.log('🚀 Piston request:', {
            url: `${PISTON_API_URL}/execute`,
            language: payload.language,
            version: payload.version
        });

        // ✅ Add delay to respect rate limit (5 req/sec = 200ms between requests)
        await new Promise(resolve => setTimeout(resolve, 250)); // 250ms = safe margin

        const response = await axios.post(
            `${PISTON_API_URL}/execute`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: timeLimit + 10000, // Add buffer
                validateStatus: (status) => status < 600 // Accept all status codes to handle them
            }
        );

        console.log('📡 Piston response status:', response.status);

        // Handle non-200 responses
        if (response.status !== 200) {
            console.error('❌ Piston API error:', {
                status: response.status,
                data: response.data
            });

            if (response.status === 401) {
                return {
                    success: false,
                    verdict: 'Runtime Error',
                    output: '',
                    error: 'Piston API authentication error. Please try again or contact administrator.'
                };
            }

            if (response.status === 429) {
                return {
                    success: false,
                    verdict: 'Runtime Error',
                    output: '',
                    error: 'Rate limit exceeded. Please wait a moment and try again.'
                };
            }

            return {
                success: false,
                verdict: 'Runtime Error',
                output: '',
                error: `Code execution service error (HTTP ${response.status})`
            };
        }

        // ✅ Parse successful response
        return parseExecutionResult(response.data);

    } catch (error) {
        console.error('❌ Piston execution error:', {
            message: error.message,
            code: error.code,
            response: error.response?.data
        });

        if (error.code === 'ECONNABORTED') {
            return {
                success: false,
                verdict: 'TLE',
                output: '',
                error: 'Time Limit Exceeded'
            };
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                success: false,
                verdict: 'Runtime Error',
                output: '',
                error: 'Code execution service is unavailable'
            };
        }

        return {
            success: false,
            verdict: 'Runtime Error',
            output: '',
            error: error.response?.data?.message || error.message || 'Code execution failed'
        };
    }
};

// Helper to normalize output
const normalizeOutput = (str) => {
    if (!str) return '';
    return str
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .trim();
};

// ✅ FIXED: Execute with test cases with proper rate limiting
const executeWithTestCases = async (language, code, testCases, timeLimit = 3000) => {
    const results = [];

    console.log(`🧪 Running ${testCases.length} test cases for ${language}`);

    // ✅ IMPORTANT: Run sequentially with 250ms delay to respect rate limit
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];

        try {
            console.log(`🧪 Test case ${i + 1}/${testCases.length}`);

            const safeInput = testCase.input !== undefined && testCase.input !== null
                ? String(testCase.input)
                : '';

            // ✅ Execute with built-in delay
            const result = await executeCode(language, code, safeInput, timeLimit);

            console.log(`✅ Test case ${i + 1} result:`, {
                verdict: result.verdict,
                success: result.success
            });

            // Normalize outputs
            const actualRaw = result.output || '';
            const actualNormalized = normalizeOutput(actualRaw);
            const expectedNormalized = normalizeOutput(testCase.output || '');

            // Check if passed
            const passed = result.success && actualNormalized === expectedNormalized;

            let verdict = 'Accepted';
            if (!result.success) {
                verdict = result.verdict || 'Runtime Error';
            } else if (!passed) {
                verdict = 'Wrong Answer';
            }

            results.push({
                input: safeInput,
                expectedOutput: testCase.output,
                actualOutput: actualRaw,
                passed: passed,
                verdict: verdict,
                error: result.error,
                isHidden: testCase.isHidden || false
            });

        } catch (err) {
            console.error(`❌ Test case ${i + 1} error:`, err);

            results.push({
                input: testCase.input,
                expectedOutput: testCase.output,
                actualOutput: '',
                passed: false,
                verdict: 'Runtime Error',
                error: err.message,
                isHidden: testCase.isHidden || false
            });
        }
    }

    // Calculate final verdict
    let passedCount = 0;
    let finalVerdict = 'Accepted';

    for (const res of results) {
        if (res.passed) {
            passedCount++;
        } else {
            if (res.verdict === 'Compilation Error') {
                finalVerdict = 'Compilation Error';
            } else if (res.verdict === 'Runtime Error' && finalVerdict !== 'Compilation Error') {
                finalVerdict = 'Runtime Error';
            } else if (res.verdict === 'TLE' && finalVerdict !== 'Compilation Error' && finalVerdict !== 'Runtime Error') {
                finalVerdict = 'TLE';
            } else if (res.verdict === 'Wrong Answer' && finalVerdict === 'Accepted') {
                finalVerdict = 'Wrong Answer';
            }
        }
    }

    console.log(`✅ Final result: ${passedCount}/${testCases.length} passed, verdict: ${finalVerdict}`);

    return {
        verdict: finalVerdict,
        testCasesPassed: passedCount,
        totalTestCases: testCases.length,
        results: results
    };
};

// ✅ Parse Piston response (follows their format)
const parseExecutionResult = (data) => {
    // Check for compilation error
    if (data.compile && data.compile.code !== 0) {
        return {
            success: false,
            verdict: 'Compilation Error',
            output: data.compile.stdout || '',
            error: data.compile.stderr || data.compile.output || 'Compilation failed'
        };
    }

    // Check for runtime error or signal
    if (data.run) {
        // Check for timeout signals
        if (data.run.signal === 'SIGTERM' || data.run.signal === 'SIGKILL') {
            return {
                success: false,
                verdict: 'TLE',
                output: data.run.stdout || '',
                error: 'Time Limit Exceeded'
            };
        }

        // Check for non-zero exit code
        if (data.run.code !== 0 && data.run.code !== null) {
            return {
                success: false,
                verdict: 'Runtime Error',
                output: data.run.stdout || '',
                error: data.run.stderr || data.run.output || `Exit code: ${data.run.code}`
            };
        }

        // Successful execution
        return {
            success: true,
            verdict: 'Accepted',
            output: data.run.stdout || data.run.output || '',
            error: data.run.stderr || null
        };
    }

    // Fallback
    return {
        success: false,
        verdict: 'Runtime Error',
        output: '',
        error: 'Invalid response from code execution service'
    };
};

// Get file extension
const getFileExtension = (language) => {
    const extensions = {
        c: 'c',
        cpp: 'cpp',
        java: 'java',
        python: 'py',
        javascript: 'js',
        csharp: 'cs'
    };
    return extensions[language] || 'txt';
};

// Validate code
const validateCode = (code, language) => {
    const errors = [];

    if (!code || code.trim().length === 0) {
        errors.push('Code cannot be empty');
    }

    if (code.length > 10000) {
        errors.push('Code exceeds maximum length of 10000 characters');
    }

    const dangerousPatterns = {
        c: [/system\s*\(/i, /exec\s*\(/i, /fork\s*\(/i],
        cpp: [/system\s*\(/i, /exec\s*\(/i, /fork\s*\(/i],
        java: [/Runtime\.getRuntime\(\)/i, /ProcessBuilder/i],
        python: [/os\.system/i, /subprocess/i, /eval\s*\(/i, /exec\s*\(/i, /__import__/i],
        javascript: [/require\s*\(['"](child_process|os|vm)['"]\)/i, /eval\s*\(/i, /Function\s*\(/i, /child_process/i],
        csharp: [/System\.Diagnostics\.Process/i]
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

module.exports = {
    getRuntimes,
    executeCode,
    executeWithTestCases,
    validateCode,
    languageVersions
};
