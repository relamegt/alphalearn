// backend/services/judge0Service.js
const axios = require('axios');
const Bottleneck = require('bottleneck');

// Environment Variable for Judge0 API URL
// Example: http://YOUR_JUDGE0_HOST:2358
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'http://localhost:2358';

// CRIT-1 FIX: Concurrency limiter for Judge0 requests.
// With 1000 students submitting simultaneously, unlimited parallel requests would
// flood the Judge0 server and cause 503 errors / mass false "Runtime Error" verdicts.
// Bottleneck caps concurrent outbound calls to 15; extras wait in queue automatically.
const judge0Limiter = new Bottleneck({
    maxConcurrent: 15,   // Max 15 simultaneous Judge0 HTTP requests
    minTime: 0           // No forced delay between requests (just caps concurrency)
});

// Language ID Mapping (Standard Judge0 IDs)
const LANGUAGE_IDS = {
    c: 50,          // GCC 9.2.0
    cpp: 54,        // GCC 9.2.0
    java: 62,       // OpenJDK 13.0.1
    python: 71,     // Python 3.8.1
    javascript: 63, // Node.js 12.14.0
    csharp: 51,     // C# (Mono 6.6.0.161)
};

// Language Versions (for API compatibility)
const languageVersions = {
    c: 'GCC 9.2.0',
    cpp: 'GCC 9.2.0',
    java: 'OpenJDK 13.0.1',
    python: '3.8.1',
    javascript: 'Node.js 12.14.0',
    csharp: 'Mono 6.6.0.161'
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
        javascript: [/require\s*\(/i, /eval\s*\(/i, /Function\s*\(/i, /child_process/i],
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

// Execute single code run (Legacy/Single use)
const executeCode = async (language, code, stdin = '', timeLimit = 3000) => {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    try {
        const payload = {
            source_code: Buffer.from(code).toString('base64'),
            language_id: languageId,
            stdin: Buffer.from(stdin).toString('base64'),
        };

        const response = await judge0Limiter.schedule(() =>
            axios.post(
                `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`,
                payload,
                { timeout: 30000 }
            )
        );

        return parseJudge0Response(response.data);

    } catch (error) {
        console.error('Judge0 execution error:', error.message);
        return { success: false, verdict: 'Runtime Error', output: '', error: error.message };
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// OPTIMIZED: Single-submission multi-test-case execution (CodeChef/Codeforces style)
//
// Instead of sending N separate Judge0 submissions (N API credits), we wrap the
// user code with a harness that feeds all test cases sequentially in ONE submission.
// The harness injects all inputs separated by a unique sentinel, captures each
// output block, then we split and map back to individual test case results.
//
// COST: 1 Judge0 credit regardless of how many test cases there are.
// ──────────────────────────────────────────────────────────────────────────────

const CASE_SENTINEL = '---CASE_END---';

/**
 * Build a language-specific harness that:
 *  1. Reads T (number of test cases)
 *  2. For each test case, reads its input block (terminated by a blank line or EOF)
 *  3. Runs user code logic for that input
 *  4. Prints the sentinel after each output
 *
 * Strategy: We redirect stdin so the user's code reads from a per-case buffer.
 * The simplest approach: concatenate all inputs with sentinels in stdin and
 * wrap user code so each "run" consumes exactly one input block.
 *
 * For languages with easy stdin redirection (C, C++, Python, JS) we use
 * an I/O redirection harness. For Java/C# we use a similar technique.
 */
const buildHarness = (language, userCode, testInputs) => {
    // We join all test case inputs separated by sentinel lines in a single stdin.
    // The harness reads until it encounters the sentinel, runs user code for that
    // block, prints the output, then prints the case separator.
    //
    // Packed stdin format:
    //   <input for case 1>
    //   \n__NEXT__\n
    //   <input for case 2>
    //   ...

    const INPUT_SEP = '__NEXT__';
    const packedStdin = testInputs.map(inp =>
        String(inp || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n')
    ).join(`\n${INPUT_SEP}\n`);

    const T = testInputs.length;

    switch (language) {
        case 'python': {
            const harness = `
import sys

_ALL_INPUT = sys.stdin.read()
_CASES = _ALL_INPUT.split('\\n${INPUT_SEP}\\n')

import io as _io

_SENTINEL = '${CASE_SENTINEL}'

for _case_idx in range(${T}):
    _case_input = _CASES[_case_idx].strip('\\n') if _case_idx < len(_CASES) else ''
    _stdin_backup = sys.stdin
    _stdout_backup = sys.stdout
    sys.stdin = _io.StringIO(_case_input + '\\n')
    sys.stdout = _io.StringIO()
    try:
        # ===== USER CODE START =====
${userCode.split('\n').map(l => '        ' + l).join('\n')}
        # ===== USER CODE END =====
    except Exception as _e:
        pass
    _out = sys.stdout.getvalue()
    sys.stdin = _stdin_backup
    sys.stdout = _stdout_backup
    print(_out, end='')
    if not _out.endswith('\\n'):
        print()
    print(_SENTINEL)
`;
            return { harness, packedStdin };
        }

        case 'javascript': {
            // Node.js: Buffer all stdin, split by separator, run user code per case
            // We emulate readline for each case via a line queue
            const harness = `
const _readline = require('readline');
const _fs = require('fs');

const _ALL_INPUT = _fs.readFileSync('/dev/stdin', 'utf8');
const _CASES = _ALL_INPUT.split('\\n${INPUT_SEP}\\n');
const _SENTINEL = '${CASE_SENTINEL}';

(async () => {
    for (let _ci = 0; _ci < ${T}; _ci++) {
        const _caseInput = (_CASES[_ci] || '').replace(/\\n$/, '');
        const _lines = _caseInput.split('\\n');
        let _lineIdx = 0;

        // Override readline/input for this case
        const _origLog = console.log;
        const _outputs = [];
        console.log = (...args) => _outputs.push(args.map(String).join(' '));

        // Provide a synchronous line reader
        const _readLine = () => _lines[_lineIdx++] || '';
        const _inputFn = _readLine;

        try {
            // ===== USER CODE START (wrapped in IIFE) =====
            await (async () => {
                const readline = { question: (_, cb) => cb(_readLine()) };
                const input = _inputFn;
${userCode.split('\n').map(l => '                ' + l).join('\n')}
            })();
        } catch (_e) {}

        console.log = _origLog;
        const _caseOut = _outputs.join('\\n');
        process.stdout.write(_caseOut);
        if (_caseOut && !_caseOut.endsWith('\\n')) process.stdout.write('\\n');
        process.stdout.write(_SENTINEL + '\\n');
    }
})();
`;
            return { harness, packedStdin };
        }

        case 'cpp': {
            // C++: Rename user's int main(...) to int _user_main() so that
            // 'return 0;' statements inside user code remain valid.
            // Handles: int main(), int main(void), int main(int argc, char* argv[]), etc.
            const patchedUserCode = userCode.replace(
                /\bint\s+main\s*\([^)]*\)\s*\{/,
                'int _user_main() {'
            );
            const cppHarness = `
#include <iostream>
#include <sstream>
#include <string>
#include <streambuf>
#include <vector>
using namespace std;

static const string INPUT_SEP = "${INPUT_SEP}";
static const string SENTINEL = "${CASE_SENTINEL}";

// ===== USER CODE START =====
${patchedUserCode}
// ===== USER CODE END =====

int main() {
    string all_input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    
    vector<string> cases;
    size_t pos = 0;
    string sep = "\\n" + INPUT_SEP + "\\n";
    while (true) {
        size_t found = all_input.find(sep, pos);
        if (found == string::npos) {
            cases.push_back(all_input.substr(pos));
            break;
        }
        cases.push_back(all_input.substr(pos, found - pos));
        pos = found + sep.size();
    }
    
    for (int ci = 0; ci < ${T}; ci++) {
        string caseInput = (ci < (int)cases.size()) ? cases[ci] : "";
        while (!caseInput.empty() && (caseInput.back() == '\\n' || caseInput.back() == '\\r'))
            caseInput.pop_back();
        caseInput += "\\n";
        
        istringstream iss(caseInput);
        streambuf* orig_cin = cin.rdbuf(iss.rdbuf());
        ostringstream oss;
        streambuf* orig_cout = cout.rdbuf(oss.rdbuf());
        cin.clear();
        
        _user_main();
        
        cout.rdbuf(orig_cout);
        cin.rdbuf(orig_cin);
        
        string out = oss.str();
        cout << out;
        if (out.empty() || out.back() != '\\n') cout << '\\n';
        cout << SENTINEL << "\\n";
        cout.flush();
    }
    return 0;
}
`;
            return { harness: cppHarness, packedStdin };
        }

        case 'c': {
            // C: Rename user's int main(...) to int _user_main() so return values stay valid
            const patchedUserCode = userCode.replace(
                /\bint\s+main\s*\([^)]*\)\s*\{/,
                'int _user_main() {'
            );
            const cHarness = `
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define INPUT_SEP "${INPUT_SEP}"
#define SENTINEL "${CASE_SENTINEL}"
#define MAX_INPUT (1<<20)
#define MAX_CASES 200

// ===== USER CODE START =====
${patchedUserCode}
// ===== USER CODE END =====

// Minimal FILE* redirection for C using fmemopen
int main() {
    // Read all stdin
    char* all_input = (char*)malloc(MAX_INPUT);
    int total = fread(all_input, 1, MAX_INPUT - 1, stdin);
    all_input[total] = '\\0';
    
    // Split by separator
    char* cases[MAX_CASES];
    int num_cases = 0;
    char sep[64];
    snprintf(sep, sizeof(sep), "\\n%s\\n", INPUT_SEP);
    int sep_len = strlen(sep);
    
    char* ptr = all_input;
    while (num_cases < MAX_CASES) {
        char* found = strstr(ptr, sep);
        if (!found) {
            cases[num_cases++] = ptr;
            break;
        }
        *found = '\\0';
        cases[num_cases++] = ptr;
        ptr = found + sep_len;
    }
    
    for (int ci = 0; ci < ${T} && ci < num_cases; ci++) {
        char* caseInput = cases[ci];
        int clen = strlen(caseInput);
        // Trim trailing newlines
        while (clen > 0 && (caseInput[clen-1] == '\\n' || caseInput[clen-1] == '\\r'))
            caseInput[--clen] = '\\0';
        
        // Append final newline
        char* buf = (char*)malloc(clen + 2);
        memcpy(buf, caseInput, clen);
        buf[clen] = '\\n';
        buf[clen+1] = '\\0';
        
        // Redirect stdin
        FILE* fake_stdin = fmemopen(buf, clen + 1, "r");
        
        // Capture stdout
        char out_buf[1<<18];
        memset(out_buf, 0, sizeof(out_buf));
        FILE* fake_stdout = fmemopen(out_buf, sizeof(out_buf) - 1, "w");
        
        FILE* orig_stdin = stdin;
        FILE* orig_stdout = stdout;
        stdin = fake_stdin;
        stdout = fake_stdout;
        
        _user_main();
        
        fflush(fake_stdout);
        stdin = orig_stdin;
        stdout = orig_stdout;
        fclose(fake_stdin);
        fclose(fake_stdout);
        
        int olen = strlen(out_buf);
        fprintf(orig_stdout, "%s", out_buf);
        if (olen == 0 || out_buf[olen-1] != '\\n') fprintf(orig_stdout, "\\n");
        fprintf(orig_stdout, "%s\\n", SENTINEL);
        fflush(orig_stdout);
        free(buf);
    }
    free(all_input);
    return 0;
}
`;
            return { harness: cHarness, packedStdin };
        }

        case 'java': {
            // Java: Wrap user code in a class, redirect System.in and System.out per case
            // Extract class body from user code (assume public class Main)
            const javaHarness = `
import java.io.*;
import java.util.*;

public class Main {
    // ===== USER CODE / METHODS START =====
    // (User's static methods will be inlined below via the _UserMain class approach)
    // ===== USER CODE END =====

    static final String SEP = "${INPUT_SEP}";
    static final String SENTINEL = "${CASE_SENTINEL}";

    public static void main(String[] args) throws Exception {
        // Read all stdin
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) {
            sb.append(line).append("\\n");
        }
        String allInput = sb.toString();
        
        // Split by separator
        String[] cases = allInput.split("\\n" + SEP + "\\n", -1);
        
        PrintStream origOut = System.out;
        InputStream origIn = System.in;
        
        for (int ci = 0; ci < ${T}; ci++) {
            String caseInput = (ci < cases.length) ? cases[ci].stripTrailing() + "\\n" : "\\n";
            
            ByteArrayInputStream fakeIn = new ByteArrayInputStream(caseInput.getBytes());
            ByteArrayOutputStream fakeOut = new ByteArrayOutputStream();
            PrintStream fakePrint = new PrintStream(fakeOut);
            
            System.setIn(fakeIn);
            System.setOut(fakePrint);
            
            try {
                _runUserCode();
            } catch (Exception e) {
                // swallow per-case exceptions
            }
            
            System.out.flush();
            System.setOut(origOut);
            System.setIn(origIn);
            
            String out = fakeOut.toString();
            origOut.print(out);
            if (out.isEmpty() || out.charAt(out.length()-1) != '\\n') origOut.println();
            origOut.println(SENTINEL);
            origOut.flush();
        }
    }

    static void _runUserCode() throws Exception {
        // User's main logic goes here — extracted from their Main class
        Scanner scanner = new Scanner(System.in);
        // ============ USER CODE BODY START ============
${extractJavaBody(userCode)}
        // ============ USER CODE BODY END ============
    }
}
`;
            return { harness: javaHarness, packedStdin };
        }

        case 'csharp': {
            const csharpHarness = `
using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;

class Main {
    static readonly string SEP = "${INPUT_SEP}";
    static readonly string SENTINEL = "${CASE_SENTINEL}";

    static void Main(string[] args) {
        string allInput = Console.In.ReadToEnd();
        string[] cases = allInput.Split(new string[]{"\\n" + SEP + "\\n"}, StringSplitOptions.None);
        
        TextWriter origOut = Console.Out;
        TextReader origIn = Console.In;
        
        for (int ci = 0; ci < ${T}; ci++) {
            string caseInput = (ci < cases.Length) ? cases[ci].TrimEnd() + "\\n" : "\\n";
            
            Console.SetIn(new StringReader(caseInput));
            var sw = new StringWriter();
            Console.SetOut(sw);
            
            try { _RunUserCode(); } catch {}
            
            Console.Out.Flush();
            Console.SetOut(origOut);
            Console.SetIn(origIn);
            
            string outStr = sw.ToString();
            origOut.Write(outStr);
            if (outStr.Length == 0 || outStr[outStr.Length-1] != '\\n') origOut.WriteLine();
            origOut.WriteLine(SENTINEL);
            origOut.Flush();
        }
    }

    static void _RunUserCode() {
        // ============ USER CODE BODY START ============
${extractCSharpBody(userCode)}
        // ============ USER CODE BODY END ============
    }
}
`;
            return { harness: csharpHarness, packedStdin };
        }

        default:
            return null; // Fallback to batch mode for unsupported languages
    }
};

// Helper: extract the body of Java's main method from user code
function extractJavaBody(userCode) {
    // Try to extract content inside main(String[] args) { ... }
    const mainMatch = userCode.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}/);
    if (mainMatch) {
        return mainMatch[1];
    }
    // Fallback: just include everything (may fail to compile but best effort)
    return `// Could not extract main body\n// ${userCode.replace(/\n/g, '\n// ')}`;
}

// Helper: extract the body of C#'s Main method from user code
function extractCSharpBody(userCode) {
    const mainMatch = userCode.match(/static\s+void\s+Main\s*\([^)]*\)\s*\{([\s\S]*)\}/);
    if (mainMatch) {
        return mainMatch[1];
    }
    return `// Could not extract Main body\n// ${userCode.replace(/\n/g, '\n// ')}`;
}

/**
 * Submit ONE Judge0 submission (single credit) and poll for result.
 */
async function submitSingle(languageId, sourceCode, stdin) {
    const payload = {
        source_code: Buffer.from(sourceCode).toString('base64'),
        language_id: languageId,
        stdin: Buffer.from(stdin).toString('base64'),
    };

    let response = await judge0Limiter.schedule(() =>
        axios.post(
            `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`,
            payload,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000   // single submission can take longer (all test cases)
            }
        )
    );

    let result = response.data;

    // If we got a token (async mode), poll until done
    const isTokenResponse = result && !result.status && result.token;
    if (response.status === 201 || isTokenResponse) {
        const token = result.token;
        if (!token) throw new Error('Judge0 returned 201 but no token found');

        const maxRetries = 30;
        const delay = 1000;
        let attempts = 0;
        let finished = false;

        while (!finished && attempts < maxRetries) {
            await new Promise(r => setTimeout(r, delay));
            attempts++;
            try {
                const poll = await axios.get(
                    `${JUDGE0_API_URL}/submissions/${token}`,
                    {
                        params: {
                            base64_encoded: 'true',
                            fields: 'token,stdout,stderr,status,message,compile_output'
                        }
                    }
                );
                if (poll.data?.status?.id >= 3) {
                    result = poll.data;
                    finished = true;
                }
            } catch (e) {
                console.error('[Judge0] Poll error:', e.message);
            }
        }
        if (!finished) throw new Error('Time Limit Exceeded (Polling timed out)');
    }

    return result;
}

/**
 * Parse the combined stdout back into per-case outputs.
 * The harness prints CASE_SENTINEL after each case output.
 */
function splitCombinedOutput(rawOutput, T) {
    const lines = rawOutput.split('\n');
    const caseOutputs = [];
    let currentCase = [];

    for (const line of lines) {
        if (line.trim() === CASE_SENTINEL) {
            caseOutputs.push(currentCase.join('\n'));
            currentCase = [];
        } else {
            currentCase.push(line);
        }
    }

    // Pad with empty strings if fewer outputs than expected
    while (caseOutputs.length < T) {
        caseOutputs.push('');
    }

    return caseOutputs;
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: executeWithTestCases
//
// Now uses single-submission harness (1 Judge0 credit for all N test cases).
// Falls back to the old batch approach only if harness generation fails.
// ──────────────────────────────────────────────────────────────────────────────
const executeWithTestCases = async (language, code, testCases, timeLimit = 3000) => {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    if (!testCases || testCases.length === 0) {
        return { verdict: 'Accepted', testCasesPassed: 0, totalTestCases: 0, results: [] };
    }

    const T = testCases.length;
    console.log(`\n🚀 [Judge0] Single-Submit Harness (${T} cases, 1 credit)`);
    console.log(`   Language: ${language} (ID: ${languageId})`);

    // Clean test case inputs
    const cleanInputs = testCases.map(tc =>
        String(tc.input || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n')
    );

    // Build language harness
    const harnessResult = buildHarness(language, code, cleanInputs);

    if (!harnessResult) {
        // Fallback to legacy batch for unsupported languages
        console.warn(`   ⚠️  No harness for language '${language}', falling back to batch mode`);
        return executeWithTestCasesBatch(language, code, testCases, timeLimit);
    }

    const { harness, packedStdin } = harnessResult;

    try {
        // Single Judge0 submission
        const raw = await submitSingle(languageId, harness, packedStdin);
        const parsed = parseJudge0Response(raw);

        console.log(`   [Judge0] Status: ${raw.status?.description || 'Unknown'} (id=${raw.status?.id})`);

        // Handle compile error / runtime error at harness level
        if (raw.status?.id === 6) {
            // Compilation Error — applies to all test cases
            const compileErr = parsed.error || 'Compilation Error';
            console.log(`   ❌ Compilation Error: ${compileErr}`);
            const results = testCases.map(tc => ({
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: '',
                passed: false,
                verdict: 'Compilation Error',
                error: compileErr,
                isHidden: tc.isHidden || false
            }));
            return {
                verdict: 'Compilation Error',
                testCasesPassed: 0,
                totalTestCases: T,
                results,
                error: compileErr
            };
        }

        if (raw.status?.id === 5) {
            // TLE at harness level (global)
            const results = testCases.map(tc => ({
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: '',
                passed: false,
                verdict: 'TLE',
                error: 'Time Limit Exceeded',
                isHidden: tc.isHidden || false
            }));
            return { verdict: 'TLE', testCasesPassed: 0, totalTestCases: T, results, error: 'Time Limit Exceeded' };
        }

        if (!parsed.success && raw.status?.id !== 3) {
            // Runtime error in harness itself
            const errMsg = parsed.error || 'Runtime Error';
            console.log(`   ❌ Runtime Error in harness: ${errMsg}`);
            // We may have partial output — try to recover what we can
            const stdout = raw.stdout ? Buffer.from(raw.stdout, 'base64').toString('utf-8') : '';
            if (stdout.includes(CASE_SENTINEL)) {
                // Partial results available
                const caseOutputs = splitCombinedOutput(stdout, T);
                const results = buildResults(testCases, caseOutputs, 'Runtime Error', errMsg);
                const passedCount = results.filter(r => r.passed).length;
                const verdict = determineVerdict(results);
                return { verdict, testCasesPassed: passedCount, totalTestCases: T, results, error: errMsg };
            }
            // No partial output — mark all as Runtime Error
            const results = testCases.map(tc => ({
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: '',
                passed: false,
                verdict: 'Runtime Error',
                error: errMsg,
                isHidden: tc.isHidden || false
            }));
            return { verdict: 'Runtime Error', testCasesPassed: 0, totalTestCases: T, results, error: errMsg };
        }

        // Successful execution — split combined output into per-case outputs
        const combinedOutput = parsed.output || '';
        console.log(`   ✅ Combined output length: ${combinedOutput.length} chars`);

        const caseOutputs = splitCombinedOutput(combinedOutput, T);
        console.log(`   Split into ${caseOutputs.length} case outputs (expected ${T})`);

        const results = buildResults(testCases, caseOutputs, 'Accepted', null);
        const passedCount = results.filter(r => r.passed).length;
        const verdict = determineVerdict(results);

        console.log(`   [Judge0] Result: ${verdict} (${passedCount}/${T} passed)\n`);

        return {
            verdict,
            testCasesPassed: passedCount,
            totalTestCases: T,
            results,
            error: results.find(r => r.error)?.error || null
        };

    } catch (error) {
        console.error('❌ [Judge0] Single-Submit Error:', error.message);
        return {
            verdict: 'Runtime Error',
            testCasesPassed: 0,
            totalTestCases: T,
            results: [],
            error: `System Error: ${error.message}`
        };
    }
};

/**
 * Build per-test-case result objects from split outputs.
 */
function buildResults(testCases, caseOutputs, defaultVerdict, defaultError) {
    return testCases.map((tc, i) => {
        const actualOutput = normalizeOutput(caseOutputs[i] || '');
        const expectedOutput = tc.output !== undefined && tc.output !== null
            ? normalizeOutput(String(tc.output))
            : null;

        // If no expected output defined (custom test case), just show output
        const passed = expectedOutput === null
            ? true
            : actualOutput === expectedOutput;

        let verdict = passed ? 'Accepted' : 'Wrong Answer';

        // If the harness indicated a global error and no output produced for this case
        if (!passed && defaultVerdict !== 'Accepted' && !caseOutputs[i]) {
            verdict = defaultVerdict;
        }

        if (!passed && i === 0) {
            console.log(`   ❌ [Case ${i + 1}] Expected: ${expectedOutput?.substring(0, 80)} | Got: ${actualOutput?.substring(0, 80)}`);
        }

        return {
            input: tc.input,
            expectedOutput: tc.output ?? null,
            actualOutput: caseOutputs[i]?.trim() || '',
            passed,
            verdict,
            error: passed ? null : (defaultError || null),
            isHidden: tc.isHidden || false
        };
    });
}

/**
 * Determine overall verdict from individual results (priority: CE > RE > TLE > WA > AC)
 */
function determineVerdict(results) {
    if (results.every(r => r.passed)) return 'Accepted';
    if (results.some(r => r.verdict === 'Compilation Error')) return 'Compilation Error';
    if (results.some(r => r.verdict === 'Runtime Error')) return 'Runtime Error';
    if (results.some(r => r.verdict === 'TLE')) return 'TLE';
    return 'Wrong Answer';
}

// ──────────────────────────────────────────────────────────────────────────────
// LEGACY BATCH MODE: Used as fallback for unsupported languages
// ──────────────────────────────────────────────────────────────────────────────
const executeWithTestCasesBatch = async (language, code, testCases, timeLimit = 3000) => {
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) throw new Error(`Unsupported language: ${language}`);

    const T = testCases.length;

    try {
        console.log(`\n🚀 [Judge0] Batch Mode (${T} cases)`);

        const submissions = testCases.map((tc) => {
            const input = String(tc.input || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n');
            return {
                source_code: Buffer.from(code).toString('base64'),
                language_id: languageId,
                stdin: Buffer.from(input).toString('base64'),
            };
        });

        let response = await judge0Limiter.schedule(() =>
            axios.post(
                `${JUDGE0_API_URL}/submissions/batch?base64_encoded=true&wait=true`,
                { submissions },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                }
            )
        );

        let rawResults = response.data;
        const isTokenResponse = (Array.isArray(rawResults) && rawResults.length > 0 && !rawResults[0].status);

        if (response.status === 201 || isTokenResponse) {
            const tokens = rawResults.map(r => r.token).filter(t => t);
            if (tokens.length === 0) throw new Error('Judge0 returned 201 but no tokens found');

            const maxRetries = 20;
            const delay = 1000;
            let attempts = 0;
            let finished = false;

            while (!finished && attempts < maxRetries) {
                await new Promise(r => setTimeout(r, delay));
                attempts++;
                try {
                    const pollResponse = await axios.get(
                        `${JUDGE0_API_URL}/submissions/batch`,
                        {
                            params: {
                                tokens: tokens.join(','),
                                base64_encoded: 'true',
                                fields: 'token,stdout,stderr,status,message,compile_output'
                            }
                        }
                    );
                    const pollData = pollResponse.data.submissions;
                    if (Array.isArray(pollData) && pollData.every(s => s.status && s.status.id >= 3)) {
                        rawResults = pollData;
                        finished = true;
                    }
                } catch (e) {
                    console.error('[Judge0] Batch poll error:', e.message);
                }
            }
            if (!finished) throw new Error('Time Limit Exceeded (Polling timed out)');
        }

        if (!Array.isArray(rawResults)) throw new Error('Invalid response format from Judge0');

        const results = rawResults.map((res, i) => {
            const tc = testCases[i] || {};
            if (!res.status) {
                return { input: tc.input, expectedOutput: tc.output, actualOutput: '', passed: false, verdict: 'System Error', error: 'Missing status', isHidden: tc.isHidden || false };
            }
            const parsed = parseJudge0Response(res);
            const actualNormalized = normalizeOutput(parsed.output);
            const expectedNormalized = normalizeOutput(String(tc.output || ''));
            const passed = parsed.success && (tc.output === undefined || tc.output === null || actualNormalized === expectedNormalized);
            return {
                input: tc.input,
                expectedOutput: tc.output,
                actualOutput: parsed.output,
                passed,
                verdict: parsed.success && !passed && tc.output !== undefined ? 'Wrong Answer' : parsed.verdict,
                error: parsed.error,
                isHidden: tc.isHidden || false
            };
        });

        const passedCount = results.filter(r => r.passed).length;
        const verdict = determineVerdict(results);

        return { verdict, testCasesPassed: passedCount, totalTestCases: T, results, error: results.find(r => r.error)?.error || null };

    } catch (error) {
        console.error('❌ [Judge0] Batch Error:', error.message);
        return { verdict: 'Runtime Error', testCasesPassed: 0, totalTestCases: T, results: [], error: `System Error: ${error.message}` };
    }
};

// Helper: Parse Judge0 Response Object
const parseJudge0Response = (data) => {
    const statusId = data.status?.id;
    const stdout = data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf-8') : '';
    const stderr = data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf-8') : '';
    const compileOutput = data.compile_output ? Buffer.from(data.compile_output, 'base64').toString('utf-8') : '';
    const message = data.message ? Buffer.from(data.message, 'base64').toString('utf-8') : '';

    if (statusId === 3) {
        return { success: true, verdict: 'Accepted', output: stdout, error: null };
    }
    if (statusId === 6) {
        return { success: false, verdict: 'Compilation Error', output: stdout, error: compileOutput || stderr };
    }
    if (statusId === 5) {
        return { success: false, verdict: 'TLE', output: stdout, error: 'Time Limit Exceeded' };
    }

    let error = stderr || message || data.status?.description || 'Runtime Error';
    error = cleanErrorMessage(error);

    return { success: false, verdict: 'Runtime Error', output: stdout, error };
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
