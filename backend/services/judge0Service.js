const axios = require('axios');
const Bottleneck = require('bottleneck');
const util = require('util');
const execFileAsync = util.promisify(require('child_process').execFile);
const crypto = require('crypto');
const vm = require('vm');
const zlib = require('zlib');
const zlibGzip = util.promisify(zlib.gzip);
const zlibGunzip = util.promisify(zlib.gunzip);

// ─────────────────────────────────────────────────────────────────────────────
// GENERATOR SCRIPT CACHE
// Two-level cache: (1) in-process LRU so same worker never spawns Python twice,
// (2) Redis so any of the 5 BullMQ worker concurrency slots share one warm cache
// across Render restarts and across all 1000 concurrent users.
//
// Render Free only has 0.1 vCPU — every avoided Python spawn saves ~150-400ms.
// Upstash Free gives 10 000 commands/day which is ample for caching stable
// deterministic generator outputs (they never change for the same script).
// ─────────────────────────────────────────────────────────────────────────────

// --- BUG-2 FIX: Byte-capped LRU prevents OOM on Render Free (512 MB RAM) ---
// LRU_MAX=200 with 7MB entries = 1.4GB potential → guaranteed OOM kill.
// Now we track cumulative bytes and evict oldest when exceeding cap.
const LRU_BYTE_CAP = 80 * 1024 * 1024; // 80 MB hard cap
const REDIS_RAW_MAX = 900 * 1024;       // 900 KB → safe to push raw to Upstash (1 MB limit)
const REDIS_GZ_MAX = 900 * 1024;       // 900 KB compressed

const _lruCache = new Map();
const _lruOrder = [];
let _lruBytes = 0;

const lruGet = (key) => {
    if (!_lruCache.has(key)) return null;
    const idx = _lruOrder.indexOf(key);
    if (idx !== -1) { _lruOrder.splice(idx, 1); _lruOrder.push(key); }
    return _lruCache.get(key);
};

const lruSet = (key, value) => {
    const newBytes = Buffer.byteLength(value, 'utf8');
    // Evict oldest entries until room is available
    while (_lruBytes + newBytes > LRU_BYTE_CAP && _lruOrder.length > 0) {
        const evict = _lruOrder.shift();
        const old = _lruCache.get(evict) || '';
        _lruBytes -= Buffer.byteLength(old, 'utf8');
        _lruCache.delete(evict);
    }
    if (_lruCache.has(key)) {
        const old = _lruCache.get(key) || '';
        _lruBytes -= Buffer.byteLength(old, 'utf8');
        const oi = _lruOrder.indexOf(key);
        if (oi !== -1) _lruOrder.splice(oi, 1);
    }
    _lruCache.set(key, value);
    _lruOrder.push(key);
    _lruBytes += newBytes;
};

// --- Stampede protection: pending promises per cache key ---
const _inFlight = new Map(); // key → Promise<string>

// Stable hash for a script so the cache key stays short
const scriptHash = (script) =>
    crypto.createHash('sha1').update(script).digest('hex').slice(0, 16);

// --- BUG-3 FIX: Size-aware Redis write (Upstash Free has 1 MB per-item limit) ---
// A 7 MB array string silently exceeds Upstash limits. We gzip-compress first;
// if still > 900 KB we skip Redis entirely and rely on LRU only.
const redisSetSafe = async (client, key, value) => {
    try {
        const rawLen = Buffer.byteLength(value, 'utf8');
        if (rawLen <= REDIS_RAW_MAX) {
            await client.set(key, value, 'EX', 7 * 24 * 60 * 60);
        } else {
            const compressed = await zlibGzip(value);
            if (compressed.length <= REDIS_GZ_MAX) {
                await client.set(`${key}:gz`, compressed.toString('base64'), 'EX', 7 * 24 * 60 * 60);
                console.log(`   🗄️  [Redis] gzip stored: ${(rawLen / 1024 | 0)} KB → ${(compressed.length / 1024 | 0)} KB`);
            } else {
                console.log(`   ⚠️  [Redis] ${(rawLen / 1024 | 0)} KB too large — LRU only`);
            }
        }
    } catch (e) { console.warn(`   ⚠️  [Redis write] ${e.message}`); }
};

const redisGetSafe = async (client, key) => {
    try {
        const raw = await client.get(key);
        if (raw) return raw;
        const gz = await client.get(`${key}:gz`);
        if (gz) {
            const buf = await zlibGunzip(Buffer.from(gz, 'base64'));
            return buf.toString('utf8');
        }
    } catch (e) { console.warn(`   ⚠️  [Redis read] ${e.message}`); }
    return null;
};

// --- BUG-1 FIX: vm.runInNewContext is SYNCHRONOUS — use setImmediate to yield ---
// vm.runInNewContext blocks the event loop for ~200ms for 10^6-element arrays.
// setImmediate defers execution to after pending I/O callbacks (WebSocket pings,
// HTTP keepalives, BullMQ state updates) are processed first.
// Due to stampede protection this blocking only ever happens ONCE per unique script.
const runJsInSandbox = (script) => new Promise((resolve, reject) => {
    setImmediate(() => {
        try {
            let output = '';
            const sandbox = {
                console: {
                    log: (...a) => { output += a.join(' ') + '\n'; },
                    error: (...a) => { output += a.join(' ') + '\n'; },
                    warn: (...a) => { output += a.join(' ') + '\n'; },
                },
                Math, JSON, Number, String, Boolean, Array, Object,
                parseInt, parseFloat, isNaN, isFinite,
            };
            vm.runInNewContext(script, sandbox, { timeout: 8000 });
            resolve(output);
        } catch (e) { reject(e); }
    });
});

/**
 * runGeneratorCached({ jsScript, pyScript, label })
 *
 * Priority:
 *   1. LRU cache hit      — ~0 ms  (byte-capped in-process Map, BUG-2 fixed)
 *   2. Redis cache hit    — ~5 ms  (gzip-aware read, BUG-3 fixed)
 *   3. jsScript via vm   — ~1–200 ms async via setImmediate (BUG-1 fixed)
 *   4. pyScript Python   — ~150–400 ms async subprocess
 *
 * Stampede protection: all 1000 concurrent users sharing ONE execution Promise
 * per unique script — only one vm/Python run ever happens at a time.
 */
const runGeneratorCached = async ({ jsScript = null, pyScript = null, label = 'script' }) => {
    const canonicalScript = jsScript || pyScript;
    if (!canonicalScript) return '';

    const cacheKey = `tcgen:${scriptHash(canonicalScript)}`;

    // 1. LRU hit — instant, no I/O
    const lruHit = lruGet(cacheKey);
    if (lruHit !== null) {
        console.log(`   ⚡ [L1-LRU] ${label} (~0ms, ${(Buffer.byteLength(lruHit) / 1024 | 0)} KB)`);
        return lruHit;
    }

    // 2. Stampede protection — join in-flight Promise
    if (_inFlight.has(cacheKey)) {
        console.log(`   ⏳ [Stampede] ${label} awaiting in-flight generator...`);
        return _inFlight.get(cacheKey);
    }

    // 3. Build single execution Promise
    const promise = (async () => {
        try {
            // 3a. Redis hit (size-aware, gzip-capable)
            let redisClient = null;
            try {
                const { getRedis } = require('./config/redis');
                redisClient = getRedis();
                const redisVal = await redisGetSafe(redisClient, cacheKey);
                if (redisVal) {
                    console.log(`   🗄️  [L2-Redis] ${label} hit`);
                    lruSet(cacheKey, redisVal); // Warm LRU from Redis
                    return redisVal;
                }
            } catch (redisErr) {
                console.warn(`   ⚠️  [Redis] unavailable: ${redisErr.message}`);
            }

            // 3b. Execute generator
            const start = Date.now();
            let result = '';

            if (jsScript) {
                // BUG-1 FIXED: setImmediate wrapper makes this non-blocking
                console.log(`   ⚡ [JS-vm] ${label}...`);
                result = await runJsInSandbox(jsScript);
                console.log(`   ✅ [JS-vm] ${label} done in ${Date.now() - start}ms (${(Buffer.byteLength(result) / 1024 | 0)} KB)`);
            } else {
                console.log(`   🐍 [Python] ${label}...`);
                const { stdout } = await execFileAsync('python', ['-c', pyScript], {
                    encoding: 'utf-8',
                    timeout: 10000,
                    maxBuffer: 50 * 1024 * 1024
                });
                result = stdout;
                console.log(`   ✅ [Python] ${label} done in ${Date.now() - start}ms (${(Buffer.byteLength(result) / 1024 | 0)} KB)`);
            }

            // BUG-2 FIXED: byte-capped LRU set
            lruSet(cacheKey, result);
            // BUG-3 FIXED: size-checked Redis write
            if (redisClient) await redisSetSafe(redisClient, cacheKey, result);

            return result;
        } finally {
            _inFlight.delete(cacheKey);
        }
    })();

    _inFlight.set(cacheKey, promise);
    return promise;
};



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
/**
 * buildHarness — builds language-specific harness source + packed stdin.
 *
 * TWO modes:
 *  COMPARE mode  — when `expectedOutputs` array is provided (submit path).
 *    Expected outputs travel in stdin AFTER a __SPLIT__ sentinel.
 *    Harness captures student output, compares, emits only:
 *      "PASS\n---CASE_END---\n"  or  "FAIL\n<first 512 chars of actual>\n---CASE_END---\n"
 *    → stdout stays tiny (~50 bytes/case) regardless of output size.
 *    → Solves Judge0 file-size-limit (SIGXFSZ / NZEC id=11) for large outputs.
 *
 *  PASSTHROUGH mode — when `expectedOutputs` is null/undefined (run path).
 *    Original behaviour: harness echos full output, backend compares.
 */
const buildHarness = (language, userCode, testInputs, expectedOutputs = null) => {
    const INPUT_SEP = '__NEXT__';
    const SPLIT_SENTINEL = '__SPLIT__';
    const compareMode = Array.isArray(expectedOutputs) && expectedOutputs.length === testInputs.length;

    // Normalize helper
    const norm = s => String(s || '').replace(/\r/g, '').trimEnd();

    const packedInputs = testInputs.map(inp =>
        String(inp || '').replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n')
    ).join(`\n${INPUT_SEP}\n`);

    let packedStdin;
    if (compareMode) {
        const packedExpected = expectedOutputs.map(o => norm(o)).join(`\n${INPUT_SEP}\n`);
        packedStdin = `${packedInputs}\n${SPLIT_SENTINEL}\n${packedExpected}`;
    } else {
        packedStdin = packedInputs;
    }

    const T = testInputs.length;

    switch (language) {
        case 'python': {
            const harness = `
import sys
import io as _io

_ALL_INPUT = sys.stdin.read()
_SPLIT_MARKER = '\\n${SPLIT_SENTINEL}\\n'
_COMPARE_MODE = _SPLIT_MARKER in _ALL_INPUT

if _COMPARE_MODE:
    _parts = _ALL_INPUT.split(_SPLIT_MARKER, 1)
    _CASES = _parts[0].split('\\n${INPUT_SEP}\\n')
    _EXPECTED = _parts[1].split('\\n${INPUT_SEP}\\n') if len(_parts) > 1 else []
else:
    _CASES = _ALL_INPUT.split('\\n${INPUT_SEP}\\n')
    _EXPECTED = []

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
    if _COMPARE_MODE:
        _exp = _EXPECTED[_case_idx].rstrip('\\n') if _case_idx < len(_EXPECTED) else ''
        _act = _out.rstrip('\\n')
        if _act == _exp:
            print('PASS')
        else:
            print('FAIL')
            _excerpt = _out[:512]
            print(_excerpt, end='')
            if _excerpt and not _excerpt.endswith('\\n'):
                print()
    else:
        print(_out, end='')
        if not _out.endswith('\\n'):
            print()
    print(_SENTINEL)
`;
            return { harness, packedStdin };
        }

        case 'javascript': {
            const harness = `
const _fs = require('fs');
const _realReadFileSync = _fs.readFileSync;
const _ALL_INPUT = _realReadFileSync('/dev/stdin', 'utf8');
const _SPLIT_MARKER = '\\n${SPLIT_SENTINEL}\\n';
const _COMPARE_MODE = _ALL_INPUT.includes(_SPLIT_MARKER);
const _SENTINEL = '${CASE_SENTINEL}';

let _CASES, _EXPECTED;
if (_COMPARE_MODE) {
    const _parts = _ALL_INPUT.split(_SPLIT_MARKER);
    _CASES = _parts[0].split('\\n${INPUT_SEP}\\n');
    _EXPECTED = (_parts[1] || '').split('\\n${INPUT_SEP}\\n');
} else {
    _CASES = _ALL_INPUT.split('\\n${INPUT_SEP}\\n');
    _EXPECTED = [];
}

let _CURRENT_CASE_INPUT = '';

// Intercept fs.readFileSync so user code reading from stdin via fs gets only the current case
_fs.readFileSync = function(path, encoding) {
    if (path === 0 || path === '/dev/stdin') {
        const res = _CURRENT_CASE_INPUT;
        if (encoding === 'utf8' || encoding === 'utf-8') return res;
        return Buffer.from(res);
    }
    return _realReadFileSync(path, encoding);
};

(async () => {
    for (let _ci = 0; _ci < ${T}; _ci++) {
        const _caseInput = (_CASES[_ci] || '').replace(/\\n$/, '');
        _CURRENT_CASE_INPUT = _caseInput + '\\n'; // Set isolated input for fs.readFileSync intercept
        const _lines = _caseInput.split('\\n');
        let _lineIdx = 0;
        const _origLog = console.log;
        const _origError = console.error;
        const _outputs = [];
        console.log = (...args) => _outputs.push(args.map(String).join(' '));
        console.error = () => {};
        const _readLine = () => _lines[_lineIdx++] || '';
        const _inputFn = _readLine;
        try {
            await (async () => {
                const readline = { question: (_, cb) => cb(_readLine()) };
                const input = _inputFn;
${userCode.split('\n').map(l => '                ' + l).join('\n')}
            })();
        } catch (_e) {}
        console.log = _origLog;
        console.error = _origError;
        const _caseOut = _outputs.join('\\n');
        if (_COMPARE_MODE) {
            const _exp = (_EXPECTED[_ci] || '').replace(/\\r/g, '').trimEnd();
            const _act = _caseOut.replace(/\\r/g, '').trimEnd();
            if (_act === _exp) {
                process.stdout.write('PASS\\n');
            } else {
                process.stdout.write('FAIL\\n');
                const _excerpt = _caseOut.slice(0, 512);
                process.stdout.write(_excerpt);
                if (_excerpt && !_excerpt.endsWith('\\n')) process.stdout.write('\\n');
            }
        } else {
            process.stdout.write(_caseOut);
            if (_caseOut && !_caseOut.endsWith('\\n')) process.stdout.write('\\n');
        }
        process.stdout.write(_SENTINEL + '\\n');
    }
})();
`;
            return { harness, packedStdin };
        }

        case 'cpp': {
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
static const string SPLIT_SENTINEL = "${SPLIT_SENTINEL}";
static const string SENTINEL = "${CASE_SENTINEL}";

// ===== USER CODE START =====
${patchedUserCode}
// ===== USER CODE END =====

// Trim trailing whitespace/newlines
static string trimEnd(string s) {
    while (!s.empty() && (s.back() == '\\n' || s.back() == '\\r' || s.back() == ' ')) s.pop_back();
    return s;
}

int main() {
    string all_input((istreambuf_iterator<char>(cin)), istreambuf_iterator<char>());
    
    string splitMark = "\\n" + SPLIT_SENTINEL + "\\n";
    bool compareMode = all_input.find(splitMark) != string::npos;
    
    string inputSection, expectedSection;
    if (compareMode) {
        size_t sp = all_input.find(splitMark);
        inputSection  = all_input.substr(0, sp);
        expectedSection = all_input.substr(sp + splitMark.size());
    } else {
        inputSection = all_input;
    }
    
    // Split inputs
    vector<string> cases;
    string sep = "\\n" + INPUT_SEP + "\\n";
    size_t pos = 0;
    while (true) {
        size_t found = inputSection.find(sep, pos);
        if (found == string::npos) { cases.push_back(inputSection.substr(pos)); break; }
        cases.push_back(inputSection.substr(pos, found - pos));
        pos = found + sep.size();
    }
    
    // Split expected outputs
    vector<string> expected;
    if (compareMode) {
        pos = 0;
        while (true) {
            size_t found = expectedSection.find(sep, pos);
            if (found == string::npos) { expected.push_back(expectedSection.substr(pos)); break; }
            expected.push_back(expectedSection.substr(pos, found - pos));
            pos = found + sep.size();
        }
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
        
        if (compareMode) {
            string exp = (ci < (int)expected.size()) ? trimEnd(expected[ci]) : "";
            string act = trimEnd(out);
            if (act == exp) {
                cout << "PASS\\n";
            } else {
                cout << "FAIL\\n";
                string excerpt = out.substr(0, 512);
                cout << excerpt;
                if (excerpt.empty() || excerpt.back() != '\\n') cout << '\\n';
            }
        } else {
            cout << out;
            if (out.empty() || out.back() != '\\n') cout << '\\n';
        }
        cout << SENTINEL << "\\n";
        cout.flush();
    }
    return 0;
}
`;
            return { harness: cppHarness, packedStdin };
        }

        case 'c': {
            const patchedUserCode = userCode.replace(
                /\bint\s+main\s*\([^)]*\)\s*\{/,
                'int _user_main() {'
            );
            const cHarness = `
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define INPUT_SEP "${INPUT_SEP}"
#define SPLIT_SENTINEL "${SPLIT_SENTINEL}"
#define SENTINEL "${CASE_SENTINEL}"
#define MAX_STDIN (8<<20)  /* 8 MB stdin buffer */
#define MAX_CASES 200
#define OUT_BUF_SIZE (2<<20) /* 2 MB per-case output buffer */

// ===== USER CODE START =====
${patchedUserCode}
// ===== USER CODE END =====

static char** split_by(char* src, const char* sep, int* num) {
    char** arr = (char**)malloc(MAX_CASES * sizeof(char*));
    int sep_len = (int)strlen(sep);
    *num = 0;
    char* ptr = src;
    while (*num < MAX_CASES) {
        char* found = strstr(ptr, sep);
        if (!found) { arr[(*num)++] = ptr; break; }
        *found = '\\0';
        arr[(*num)++] = ptr;
        ptr = found + sep_len;
    }
    return arr;
}

int main() {
    char* all_input = (char*)malloc(MAX_STDIN);
    int total = (int)fread(all_input, 1, MAX_STDIN - 1, stdin);
    all_input[total] = '\\0';
    
    char split_mark[128];
    snprintf(split_mark, sizeof(split_mark), "\\n%s\\n", SPLIT_SENTINEL);
    char* split_pos = strstr(all_input, split_mark);
    int compare_mode = (split_pos != NULL);
    
    char* input_section;
    char* expected_section = "";
    if (compare_mode) {
        *split_pos = '\\0';
        input_section  = all_input;
        expected_section = split_pos + strlen(split_mark);
    } else {
        input_section = all_input;
    }
    
    char sep[64];
    snprintf(sep, sizeof(sep), "\\n%s\\n", INPUT_SEP);
    
    int num_cases = 0, num_expected = 0;
    char** cases    = split_by(input_section, sep, &num_cases);
    char** expected = compare_mode ? split_by(expected_section, sep, &num_expected) : NULL;
    
    for (int ci = 0; ci < ${T} && ci < num_cases; ci++) {
        char* caseInput = cases[ci];
        int clen = (int)strlen(caseInput);
        while (clen > 0 && (caseInput[clen-1] == '\\n' || caseInput[clen-1] == '\\r'))
            caseInput[--clen] = '\\0';
        
        char* buf = (char*)malloc(clen + 2);
        memcpy(buf, caseInput, clen);
        buf[clen] = '\\n'; buf[clen+1] = '\\0';
        
        FILE* fake_stdin = fmemopen(buf, clen + 1, "r");
        char* out_buf = (char*)calloc(OUT_BUF_SIZE, 1);
        FILE* fake_stdout = fmemopen(out_buf, OUT_BUF_SIZE - 1, "w");
        
        FILE* orig_stdin = stdin; FILE* orig_stdout = stdout;
        stdin = fake_stdin; stdout = fake_stdout;
        _user_main();
        fflush(fake_stdout);
        stdin = orig_stdin; stdout = orig_stdout;
        fclose(fake_stdin); fclose(fake_stdout);
        
        if (compare_mode) {
            /* Trim trailing whitespace from actual and expected */
            int olen = (int)strlen(out_buf);
            while (olen > 0 && (out_buf[olen-1] == '\\n' || out_buf[olen-1] == '\\r' || out_buf[olen-1] == ' '))
                out_buf[--olen] = '\\0';
            char* exp = (ci < num_expected) ? expected[ci] : "";
            int elen = (int)strlen(exp);
            while (elen > 0 && (exp[elen-1] == '\\n' || exp[elen-1] == '\\r' || exp[elen-1] == ' '))
                exp[--elen] = '\\0';
            if (strcmp(out_buf, exp) == 0) {
                fprintf(orig_stdout, "PASS\\n");
            } else {
                fprintf(orig_stdout, "FAIL\\n");
                /* Write first 512 chars as excerpt */
                int ex_len = olen < 512 ? olen : 512;
                fwrite(out_buf, 1, ex_len, orig_stdout);
                if (ex_len == 0 || out_buf[ex_len-1] != '\\n') fprintf(orig_stdout, "\\n");
            }
        } else {
            int olen = (int)strlen(out_buf);
            fprintf(orig_stdout, "%s", out_buf);
            if (olen == 0 || out_buf[olen-1] != '\\n') fprintf(orig_stdout, "\\n");
        }
        fprintf(orig_stdout, "%s\\n", SENTINEL);
        fflush(orig_stdout);
        free(buf); free(out_buf);
    }
    free(cases); if (expected) free(expected);
    free(all_input);
    return 0;
}
`;
            return { harness: cHarness, packedStdin };
        }

        case 'java': {
            const javaHarness = `
import java.io.*;
import java.util.*;

public class Main {
    static final String SEP = "${INPUT_SEP}";
    static final String SPLIT_SENTINEL = "${SPLIT_SENTINEL}";
    static final String SENTINEL = "${CASE_SENTINEL}";

    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line).append("\\n");
        String allInput = sb.toString();
        
        String splitMark = "\\n" + SPLIT_SENTINEL + "\\n";
        boolean compareMode = allInput.contains(splitMark);
        
        String[] inputCases, expectedCases;
        if (compareMode) {
            String[] parts = allInput.split(splitMark, 2);
            inputCases    = parts[0].split("\\n" + SEP + "\\n", -1);
            expectedCases = (parts.length > 1 ? parts[1] : "").split("\\n" + SEP + "\\n", -1);
        } else {
            inputCases    = allInput.split("\\n" + SEP + "\\n", -1);
            expectedCases = new String[0];
        }
        
        PrintStream origOut = System.out;
        InputStream  origIn  = System.in;
        
        for (int ci = 0; ci < ${T}; ci++) {
            String caseInput = (ci < inputCases.length) ? inputCases[ci].stripTrailing() + "\\n" : "\\n";
            ByteArrayInputStream fakeIn  = new ByteArrayInputStream(caseInput.getBytes());
            ByteArrayOutputStream fakeOut = new ByteArrayOutputStream();
            System.setIn(fakeIn);
            System.setOut(new PrintStream(fakeOut));
            try { _runUserCode(); } catch (Exception e) {}
            System.out.flush();
            System.setOut(origOut);
            System.setIn(origIn);
            String out = fakeOut.toString();
            
            if (compareMode) {
                String exp = (ci < expectedCases.length) ? expectedCases[ci].stripTrailing() : "";
                String act = out.stripTrailing();
                if (act.equals(exp)) {
                    origOut.println("PASS");
                } else {
                    origOut.println("FAIL");
                    String excerpt = out.length() > 512 ? out.substring(0, 512) : out;
                    origOut.print(excerpt);
                    if (excerpt.isEmpty() || excerpt.charAt(excerpt.length()-1) != '\\n') origOut.println();
                }
            } else {
                origOut.print(out);
                if (out.isEmpty() || out.charAt(out.length()-1) != '\\n') origOut.println();
            }
            origOut.println(SENTINEL);
            origOut.flush();
        }
    }

    static void _runUserCode() throws Exception {
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

class Program {
    static readonly string SEP = "${INPUT_SEP}";
    static readonly string SPLIT_SENTINEL = "${SPLIT_SENTINEL}";
    static readonly string SENTINEL = "${CASE_SENTINEL}";

    static void Main(string[] args) {
        string allInput = Console.In.ReadToEnd();
        string splitMark = "\\n" + SPLIT_SENTINEL + "\\n";
        bool compareMode = allInput.Contains(splitMark);
        
        string[] inputCases, expectedCases;
        if (compareMode) {
            var parts = allInput.Split(new string[]{splitMark}, 2, StringSplitOptions.None);
            inputCases    = parts[0].Split(new string[]{"\\n" + SEP + "\\n"}, StringSplitOptions.None);
            expectedCases = (parts.Length > 1 ? parts[1] : "").Split(new string[]{"\\n" + SEP + "\\n"}, StringSplitOptions.None);
        } else {
            inputCases    = allInput.Split(new string[]{"\\n" + SEP + "\\n"}, StringSplitOptions.None);
            expectedCases = new string[0];
        }
        
        TextWriter origOut = Console.Out;
        TextReader origIn = Console.In;
        
        for (int ci = 0; ci < ${T}; ci++) {
            string caseInput = (ci < inputCases.Length) ? inputCases[ci].TrimEnd() + "\\n" : "\\n";
            Console.SetIn(new StringReader(caseInput));
            var sw = new StringWriter();
            Console.SetOut(sw);
            try { _RunUserCode(); } catch {}
            Console.Out.Flush();
            Console.SetOut(origOut);
            Console.SetIn(origIn);
            string outStr = sw.ToString();
            
            if (compareMode) {
                string exp = (ci < expectedCases.Length) ? expectedCases[ci].TrimEnd() : "";
                string act = outStr.TrimEnd();
                if (act == exp) {
                    origOut.WriteLine("PASS");
                } else {
                    origOut.WriteLine("FAIL");
                    string excerpt = outStr.Length > 512 ? outStr.Substring(0, 512) : outStr;
                    origOut.Write(excerpt);
                    if (excerpt.Length == 0 || excerpt[excerpt.Length-1] != '\\n') origOut.WriteLine();
                }
            } else {
                origOut.Write(outStr);
                if (outStr.Length == 0 || outStr[outStr.Length-1] != '\\n') origOut.WriteLine();
            }
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
            return null;
    }
};


// Helper: extract the body of Java's main method from user code
function extractJavaBody(userCode) {
    const startMatch = userCode.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/);
    if (!startMatch) {
        return `// Could not find main method\n// ${userCode.replace(/\n/g, '\n// ')}`;
    }
    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;
    while (braceCount > 0 && endIndex < userCode.length) {
        if (userCode[endIndex] === '{') braceCount++;
        else if (userCode[endIndex] === '}') braceCount--;
        endIndex++;
    }
    return userCode.substring(startIndex, endIndex - 1);
}

// Helper: extract the body of C#'s Main method from user code
function extractCSharpBody(userCode) {
    const startMatch = userCode.match(/static\s+void\s+Main\s*\([^)]*\)\s*\{/);
    if (!startMatch) {
        return `// Could not find Main method\n// ${userCode.replace(/\n/g, '\n// ')}`;
    }
    const startIndex = startMatch.index + startMatch[0].length;
    let braceCount = 1;
    let endIndex = startIndex;
    while (braceCount > 0 && endIndex < userCode.length) {
        if (userCode[endIndex] === '{') braceCount++;
        else if (userCode[endIndex] === '}') braceCount--;
        endIndex++;
    }
    return userCode.substring(startIndex, endIndex - 1);
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

    // Clean test case inputs & run generator scripts asynchronously
    const cleanInputs = await Promise.all(testCases.map(async (tc, index) => {
        let inputStr = tc.input || '';

        // Run input generator — prefer jsGeneratorScript (vm, ~1ms) over generatorScript (Python, ~150ms)
        if (tc.jsGeneratorScript || tc.generatorScript) {
            try {
                const raw = await runGeneratorCached({
                    jsScript: tc.jsGeneratorScript || null,
                    pyScript: tc.generatorScript || null,
                    label: `TC${index + 1}-input`
                });
                inputStr = raw;
            } catch (err) {
                console.error(`❌ [TC ${index + 1}] Input generator error:`, err.message);
                throw new Error(`Failed to generate test case input for test case ${index + 1}`);
            }
        }

        // Run output generator — prefer jsOutputGenerator (vm) over tcOutputGenerator (Python)
        if ((tc.jsOutputGenerator || tc.tcOutputGenerator) && tc.output === undefined) {
            try {
                const raw = await runGeneratorCached({
                    jsScript: tc.jsOutputGenerator || null,
                    pyScript: tc.tcOutputGenerator || null,
                    label: `TC${index + 1}-output`
                });
                tc.output = raw.trim();
            } catch (err) {
                console.error(`❌ [TC ${index + 1}] Output generator error:`, err.message);
                throw new Error(`Failed to generate test case output for test case ${index + 1}`);
            }
        }

        // Return the final cleaned input string
        return String(inputStr).replace(/\r/g, '').split('\n').map(l => l.trimEnd()).join('\n');
    }));

    // ── Output-size guard: estimate total stdout size and split into batches if needed ──
    // Judge0 enforces a file-size limit on stdout ("ulimit -f"). For pattern problems
    // with N=1000 the output alone can be ~500 KB. Multiple such test cases packed
    // together easily exceed the 2-4 MB limit, causing status=11 (NZEC / File size
    // limit exceeded). We split into batches whose *estimated* total output is ≤ 1.5 MB.
    const OUTPUT_BATCH_LIMIT = 1.5 * 1024 * 1024; // 1.5 MB
    const estimatedOutputSizes = testCases.map((tc, i) => {
        // Use known expected output size as proxy for student output size
        const exp = tc.output != null ? String(tc.output).length : 512;
        return exp;
    });

    // Build batches
    const batches = [];
    let batchStart = 0;
    let batchBytes = 0;
    for (let i = 0; i < T; i++) {
        const sz = estimatedOutputSizes[i];
        if (batches.length > 0 && batchBytes + sz > OUTPUT_BATCH_LIMIT) {
            batches.push({ start: batchStart, end: i });
            batchStart = i;
            batchBytes = 0;
        }
        batchBytes += sz;
    }
    batches.push({ start: batchStart, end: T });

    if (batches.length > 1) {
        console.log(`   📦 Output too large — splitting into ${batches.length} sub-batches`);
    }

    // ── Run each batch and merge results ──
    const allResults = [];
    for (const { start, end } of batches) {
        const batchTCs = testCases.slice(start, end);
        const batchInputs = cleanInputs.slice(start, end);
        const batchResult = await runSingleHarnessBatch(language, code, batchTCs, batchInputs, languageId, timeLimit);

        allResults.push(...batchResult.results);

        // If the batch itself failed globally (CE/TLE/RE with no partial), stop early
        if (['Compilation Error'].includes(batchResult.verdict) && batchResult.results.every(r => !r.passed)) {
            // Pad remaining test cases with the same verdict
            const remaining = testCases.slice(end);
            for (const tc of remaining) {
                allResults.push({
                    input: tc.input,
                    expectedOutput: tc.output ?? null,
                    actualOutput: '',
                    passed: false,
                    verdict: batchResult.verdict,
                    error: batchResult.error,
                    isHidden: tc.isHidden || false
                });
            }
            break;
        }
    }

    const passedCount = allResults.filter(r => r.passed).length;
    const verdict = determineVerdict(allResults.length ? allResults : [{ passed: false, verdict: 'Runtime Error' }]);
    console.log(`   [Judge0] Final: ${verdict} (${passedCount}/${T} passed)\n`);
    return {
        verdict,
        testCasesPassed: passedCount,
        totalTestCases: T,
        results: allResults,
        error: allResults.find(r => r.error)?.error || null
    };
};

/**
 * Run a single harness batch for a slice of test cases.
 * Uses COMPARE mode when all test cases have known expected output:
 *   → harness compares internally, stdout is only ~50 bytes/case (PASS/FAIL)
 *   → no more "File size limit exceeded" for large outputs
 * Falls back to PASSTHROUGH mode (old behaviour) when expected output unknown.
 */
async function runSingleHarnessBatch(language, code, testCases, cleanInputs, languageId, timeLimit) {
    const T = testCases.length;

    // Decide mode: compare mode when ALL cases have a known expected output
    const allHaveExpected = testCases.every(tc => tc.output != null);
    const expectedOutputs = allHaveExpected ? testCases.map(tc => String(tc.output)) : null;

    const harnessResult = buildHarness(language, code, cleanInputs, expectedOutputs);
    if (!harnessResult) {
        return executeWithTestCasesBatch(language, code, testCases, timeLimit);
    }
    const { harness, packedStdin } = harnessResult;
    const compareMode = allHaveExpected;

    try {
        const raw = await submitSingle(languageId, harness, packedStdin);
        const parsed = parseJudge0Response(raw);
        console.log(`   [Judge0] Batch(${compareMode ? 'CMP' : 'PASS'}) Status: ${raw.status?.description} (id=${raw.status?.id})`);

        // ── Compilation Error ──
        if (raw.status?.id === 6) {
            const compileErr = parsed.error || 'Compilation Error';
            return {
                verdict: 'Compilation Error', testCasesPassed: 0, totalTestCases: T, error: compileErr,
                results: testCases.map(tc => ({
                    input: tc.input, expectedOutput: tc.output ?? null,
                    actualOutput: '', passed: false, verdict: 'Compilation Error', error: compileErr,
                    isHidden: tc.isHidden || false
                }))
            };
        }

        // ── TLE ──
        if (raw.status?.id === 5) {
            const partialStdout = raw.stdout ? Buffer.from(raw.stdout, 'base64').toString('utf-8') : '';
            const partialOutputs = splitCombinedOutput(partialStdout, T);
            const results = testCases.map((tc, i) => {
                const raw_out = partialOutputs[i] || '';
                if (compareMode) {
                    // In compare mode, partial output is "PASS" or "FAIL\n<excerpt>"
                    const firstLine = raw_out.trim().split('\n')[0];
                    const hasSentinel = raw_out.trim() !== '';
                    if (!hasSentinel) return {
                        input: tc.input, expectedOutput: tc.output ?? null,
                        actualOutput: '', passed: false, verdict: 'TLE',
                        error: 'Time Limit Exceeded', isHidden: tc.isHidden || false
                    };
                    const passed = firstLine === 'PASS';
                    return {
                        input: tc.input, expectedOutput: tc.output ?? null,
                        actualOutput: passed ? String(tc.output).slice(0, 200) : raw_out.split('\n').slice(1).join('\n').slice(0, 200),
                        passed, verdict: passed ? 'Accepted' : 'Wrong Answer', error: null,
                        isHidden: tc.isHidden || false
                    };
                } else {
                    const hasOutput = raw_out && raw_out.trim() !== '';
                    const actualOutput = hasOutput ? normalizeOutput(raw_out) : '';
                    const expectedOutput = tc.output != null ? normalizeOutput(String(tc.output)) : null;
                    const passed = hasOutput && expectedOutput !== null && actualOutput === expectedOutput;
                    const caseVerdict = hasOutput ? (passed ? 'Accepted' : 'Wrong Answer') : 'TLE';
                    return {
                        input: tc.input, expectedOutput: tc.output ?? null,
                        actualOutput: raw_out.trim() || '', passed, verdict: caseVerdict,
                        error: caseVerdict === 'TLE' ? 'Time Limit Exceeded' : null,
                        isHidden: tc.isHidden || false
                    };
                }
            });
            const passedCount = results.filter(r => r.passed).length;
            return { verdict: 'TLE', testCasesPassed: passedCount, totalTestCases: T, results, error: 'Time Limit Exceeded' };
        }

        // ── Runtime Error / other non-success ──
        if (!parsed.success && raw.status?.id !== 3) {
            const errMsg = parsed.error || 'Runtime Error';
            const stdout = raw.stdout ? Buffer.from(raw.stdout, 'base64').toString('utf-8') : '';
            if (stdout.includes(CASE_SENTINEL)) {
                const caseOutputs = splitCombinedOutput(stdout, T);
                if (compareMode) {
                    const results = parseCmpResults(testCases, caseOutputs, errMsg);
                    return { verdict: determineVerdict(results), testCasesPassed: results.filter(r => r.passed).length, totalTestCases: T, results, error: errMsg };
                }
                const results = buildResults(testCases, caseOutputs, 'Runtime Error', errMsg);
                return { verdict: determineVerdict(results), testCasesPassed: results.filter(r => r.passed).length, totalTestCases: T, results, error: errMsg };
            }
            return {
                verdict: 'Runtime Error', testCasesPassed: 0, totalTestCases: T, error: errMsg,
                results: testCases.map(tc => ({
                    input: tc.input, expectedOutput: tc.output ?? null,
                    actualOutput: '', passed: false, verdict: 'Runtime Error', error: errMsg,
                    isHidden: tc.isHidden || false
                }))
            };
        }

        // ── Success ──
        const combinedOutput = parsed.output || '';
        const caseOutputs = splitCombinedOutput(combinedOutput, T);

        let results, passedCount, verdict;
        if (compareMode) {
            results = parseCmpResults(testCases, caseOutputs, null);
        } else {
            results = buildResults(testCases, caseOutputs, 'Accepted', null);
        }
        passedCount = results.filter(r => r.passed).length;
        verdict = determineVerdict(results);
        console.log(`   [Judge0] Batch result: ${verdict} (${passedCount}/${T})`);
        return { verdict, testCasesPassed: passedCount, totalTestCases: T, results, error: results.find(r => r.error)?.error || null };

    } catch (error) {
        return {
            verdict: 'Runtime Error', testCasesPassed: 0, totalTestCases: T, error: `System Error: ${error.message}`,
            results: testCases.map(tc => ({
                input: tc.input, expectedOutput: tc.output ?? null,
                actualOutput: '', passed: false,
                verdict: 'Runtime Error', error: `System Error: ${error.message}`,
                isHidden: tc.isHidden || false
            }))
        };
    }
}

/**
 * Parse compare-mode harness output (PASS/FAIL lines) into result objects.
 * Each caseOutput is either:
 *   "PASS"                    → passed
 *   "FAIL\n<excerpt 512 chars>" → failed
 */
function parseCmpResults(testCases, caseOutputs, defaultError) {
    return testCases.map((tc, i) => {
        const raw = (caseOutputs[i] || '').trim();
        if (raw === '') {
            // No output at all — harness crashed on this case
            return {
                input: tc.input, expectedOutput: tc.output ?? null,
                actualOutput: '', passed: false, verdict: defaultError || 'Runtime Error',
                error: defaultError || 'Runtime Error', isHidden: tc.isHidden || false
            };
        }
        const lines = raw.split('\n');
        const firstLine = lines[0].trim();
        const passed = firstLine === 'PASS';
        const excerpt = lines.slice(1).join('\n');
        return {
            input: tc.input,
            expectedOutput: tc.output ?? null,
            // Show first 200 chars of expected when correct (for display in run mode)
            actualOutput: passed
                ? (tc.output != null ? String(tc.output).slice(0, 200) + (String(tc.output).length > 200 ? '…' : '') : '')
                : excerpt.slice(0, 512),
            passed,
            verdict: passed ? 'Accepted' : 'Wrong Answer',
            error: null,
            isHidden: tc.isHidden || false
        };
    });
}


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
