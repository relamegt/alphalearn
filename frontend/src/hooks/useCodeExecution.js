import { useState } from 'react';
import submissionService from '../services/submissionService';
import toast from 'react-hot-toast';

const useCodeExecution = () => {
    // Separate states for Run (Sample) vs Submit (Full)
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [runResult, setRunResult] = useState(null);
    const [submitResult, setSubmitResult] = useState(null);
    const [error, setError] = useState(null);

    // Run Code (Sample Test Cases)
    const runCode = async (problemId, code, language, customInput) => {
        setRunning(true);
        setRunResult(null);
        setError(null);
        // Clear submit result when running samples to focus on current action
        setSubmitResult(null);

        console.log('🚀 [Frontend] Running code...');
        console.log({ problemId, language, customInput });

        try {
            const response = await submissionService.runCode(problemId, code, language, customInput);
            console.log('✅ [Frontend] Final Run Response:');
            console.log('Veridct:', response.verdict);
            if (response.results) {
                console.table(response.results.map(r => ({
                    passed: r.passed,
                    verdict: r.verdict,
                    input: r.input?.substring(0, 20),
                    expected: r.expectedOutput?.substring(0, 20),
                    actual: r.actualOutput?.substring(0, 20),
                    error: r.error
                })));
            }

            if (response.success) {
                setRunResult({
                    verdict: response.verdict,
                    output: response.output,
                    testCasesPassed: response.testCasesPassed,
                    totalTestCases: response.totalTestCases,
                    results: response.results,
                    message: response.message,
                    error: response.error
                });

                if (response.verdict === 'Accepted') {
                    toast.success('Run successful: Accepted');
                } else if (response.verdict === 'Compilation Error') {
                    toast.error('Compilation Error');
                } else {
                    toast(response.verdict, { icon: '⚠️' });
                }
            } else {
                console.error('❌ [Frontend] Run Failed:', response);
                setError(response.message || 'Execution failed');
                toast.error(response.message || 'Execution failed');
            }
        } catch (err) {
            console.error('❌ [Frontend] Run Error (Catch):', err);
            setError(err.message || 'Failed to execute code');
            toast.error(err.message || 'Failed to execute code');
        } finally {
            setRunning(false);
        }
    };

    // Submit Code (All Test Cases)
    const submitCode = async (problemId, code, language) => {
        setSubmitting(true);
        setSubmitResult(null);
        setError(null);
        // Clear run result to focus on submission result
        setRunResult(null);

        try {
            const response = await submissionService.submitCode(problemId, code, language);

            if (response.success) {
                setSubmitResult({
                    // normalize structure to match what component expects
                    submission: {
                        verdict: response.verdict,
                        testCasesPassed: response.testCasesPassed,
                        totalTestCases: response.totalTestCases,
                        output: response.output
                    },
                    results: response.results,
                    message: response.message,
                    error: response.error
                });

                if (response.verdict === 'Accepted') {
                    toast.success('🎉 Solution Accepted!');
                } else {
                    toast.error(`Solution ${response.verdict}`);
                }
            } else {
                setError(response.message || 'Submission failed');
                toast.error(response.message || 'Submission failed');
            }
        } catch (err) {
            console.error('Submit code error:', err);
            setError(err.message || 'Failed to submit code');
            toast.error(err.message || 'Failed to submit code');
        } finally {
            setSubmitting(false);
        }
    };

    return {
        runCode,
        submitCode,
        running,
        submitting,
        runResult,
        submitResult,
        error
    };
};

export default useCodeExecution;
