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

    // Run Code (Sample Test Cases)
    const runCode = useCallback(async (problemId, code, language, customInput, customInputs) => {
        setRunning(true);
        setRunResult(null);
        setError(null);
        setSubmitResult(null); // clear previous submit result

        try {
            const response = await submissionService.runCode(problemId, code, language, customInput, customInputs);

            if (response.success) {
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
                console.log('[RunResult] Total results:', normalizedRunResult.results.length,
                    '| Custom:', normalizedRunResult.results.filter(r => r.isCustom).length,
                    '| Standard:', normalizedRunResult.results.filter(r => !r.isCustom).length
                );
                console.log('[RunResult] Full results:', JSON.stringify(normalizedRunResult.results, null, 2));
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

                // Still set a run result so we can show the error in the results panel
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
            const errMsg = err?.message || err?.error || 'Failed to execute code';
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

                // Build partial result if possible so error is visible in results panel
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
            const errMsg = err?.message || err?.error || 'Failed to submit code';
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
