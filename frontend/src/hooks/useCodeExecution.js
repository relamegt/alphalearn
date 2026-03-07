import { useState, useCallback } from 'react';
import submissionService from '../services/submissionService';
import toast from 'react-hot-toast';

const useCodeExecution = () => {
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Normalized result shape for both run & submit:
    // {
    //   verdict: string,
    //   testCasesPassed: number,
    //   totalTestCases: number,
    //   results: Array<{ input, expectedOutput, actualOutput, passed, verdict, error, isHidden }>,
    //   error: string | null,
    //   coinsEarned: number,       // only on submit
    //   totalCoins: number,        // only on submit
    //   isFirstSolve: boolean,     // only on submit
    //   isSubmitMode: boolean,
    //   isCustomInput: boolean
    // }
    const [runResult, setRunResult] = useState(null);
    const [submitResult, setSubmitResult] = useState(null);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(false);

    // Run Code (Sample Test Cases)
    const runCode = useCallback(async (problemId, code, language, customInput, customInputs) => {
        setRunning(true);
        setRunResult(null);
        setError(null);
        setIsOffline(false);
        setSubmitResult(null); // clear previous submit result

        try {
            const response = await submissionService.runCode(problemId, code, language, customInput, customInputs);

            if (response.success) {
                // ... (existing success logic)
                const normalizedRunResult = {
                    problemId,
                    verdict: response.verdict,
                    testCasesPassed: response.testCasesPassed ?? 0,
                    totalTestCases: response.totalTestCases ?? 0,
                    results: response.results || [],
                    error: response.error || null,
                    coinsEarned: 0,
                    totalCoins: 0,
                    isFirstSolve: false,
                    isSubmitMode: false,
                    isCustomInput: (customInput !== undefined && customInput !== null) || (customInputs !== undefined && customInputs !== null)
                };
                setRunResult(normalizedRunResult);

                if (response.verdict === 'Accepted') {
                    toast.success('✓ All test cases passed!');
                } else if (response.verdict === 'Compilation Error') {
                    toast.error('Compilation Error');
                } else if (response.verdict === 'Runtime Error') {
                    toast.error('Runtime Error');
                } else {
                    toast(response.verdict, { icon: '⚠️' });
                }
            } else {
                const errMsg = response.message || 'Execution failed';
                setError(errMsg);
                if (response.verdict || response.results) {
                    setRunResult({
                        problemId,
                        verdict: response.verdict || 'Error',
                        testCasesPassed: response.testCasesPassed ?? 0,
                        totalTestCases: response.totalTestCases ?? 0,
                        results: response.results || [],
                        error: response.error || errMsg,
                        coinsEarned: 0,
                        totalCoins: 0,
                        isFirstSolve: false,
                        isSubmitMode: false,
                        isCustomInput: false
                    });
                }
                toast.error(errMsg);
            }
        } catch (err) {
            const offline = !navigator.onLine;
            const netErr = err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
            const timeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');

            setIsOffline(offline);
            let errMsg = offline
                ? 'No internet connection. Please check your network and try again.'
                : (netErr || timeout)
                    ? 'Server is taking too long to respond. Please try again in a moment.'
                    : err?.message || err?.error || 'Failed to execute code';

            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setRunning(false);
        }
    }, []);

    // Submit Code (All Test Cases)
    const submitCode = useCallback(async (problemId, code, language) => {
        setSubmitting(true);
        setSubmitResult(null);
        setError(null);
        setIsOffline(false);
        setRunResult(null); // clear run result

        try {
            const response = await submissionService.submitCode(problemId, code, language);

            if (response.success) {
                const normalized = {
                    problemId,
                    verdict: response.verdict,
                    testCasesPassed: response.submission?.testCasesPassed ?? response.testCasesPassed ?? 0,
                    totalTestCases: response.submission?.totalTestCases ?? response.totalTestCases ?? 0,
                    results: response.results || [],
                    error: response.error || null,
                    coinsEarned: response.coinsEarned || 0,
                    totalCoins: response.totalCoins || 0,
                    isFirstSolve: response.isFirstSolve || false,
                    isSubmitMode: true,
                    isCustomInput: false,
                    submission: response.submission || null
                };

                setSubmitResult(normalized);

                if (response.verdict === 'Accepted') {
                    if (response.coinsEarned > 0) {
                        toast.success(`🎉 Accepted! +${response.coinsEarned} Alpha Coins earned!`, { duration: 4000 });
                    } else {
                        toast.success('🎉 Solution Accepted!');
                    }
                } else if (response.verdict === 'Compilation Error') {
                    toast.error('Compilation Error');
                } else {
                    toast.error(`${response.verdict}`);
                }
            } else {
                const errMsg = response.message || 'Submission failed';
                if (response.verdict || response.results) {
                    setSubmitResult({
                        problemId,
                        verdict: response.verdict || 'Error',
                        testCasesPassed: response.testCasesPassed ?? 0,
                        totalTestCases: response.totalTestCases ?? 0,
                        results: response.results || [],
                        error: response.error || errMsg,
                        coinsEarned: 0,
                        totalCoins: 0,
                        isFirstSolve: false,
                        isSubmitMode: true,
                        isCustomInput: false,
                        submission: null
                    });
                } else {
                    setError(errMsg);
                }
                toast.error(errMsg);
            }
        } catch (err) {
            const offline = !navigator.onLine;
            const netErr = err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';
            const timeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout');

            setIsOffline(offline);
            let errMsg = offline
                ? 'No internet connection. Please check your network and try again.'
                : (netErr || timeout)
                    ? 'Submission timed out. The server may be under load — please try again.'
                    : err?.message || err?.error || 'Failed to submit code';

            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setSubmitting(false);
        }
    }, []);

    const resetResults = useCallback(() => {
        setRunResult(null);
        setSubmitResult(null);
        setError(null);
    }, []);

    return {
        runCode,
        submitCode,
        resetResults,
        running,
        submitting,
        runResult,
        submitResult,
        error
    };
};

export default useCodeExecution;
