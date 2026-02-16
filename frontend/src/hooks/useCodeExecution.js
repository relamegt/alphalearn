import { useState } from 'react';
import submissionService from '../services/submissionService';
import toast from 'react-hot-toast';

const useCodeExecution = () => {
    const [running, setRunning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const [submitResult, setSubmitResult] = useState(null);

    // Run code against sample test cases
    const runCode = async (problemId, code, language) => {
        setRunning(true);
        setRunResult(null);
        try {
            const result = await submissionService.runCode(problemId, code, language);
            setRunResult(result);

            if (result.verdict === 'Accepted') {
                toast.success('All sample test cases passed! ✅');
            } else {
                toast.error(`Test failed: ${result.verdict}`);
            }

            return result;
        } catch (error) {
            toast.error(error.message || 'Code execution failed');
            throw error;
        } finally {
            setRunning(false);
        }
    };

    // Submit code against all test cases
    const submitCode = async (problemId, code, language) => {
        setSubmitting(true);
        setSubmitResult(null);
        try {
            const result = await submissionService.submitCode(problemId, code, language);
            setSubmitResult(result);

            if (result.submission.verdict === 'Accepted') {
                toast.success('🎉 Problem Solved! All test cases passed!', { duration: 5000 });
            } else {
                toast.error(`Submission failed: ${result.submission.verdict}`);
            }

            return result;
        } catch (error) {
            toast.error(error.message || 'Code submission failed');
            throw error;
        } finally {
            setSubmitting(false);
        }
    };

    const resetResults = () => {
        setRunResult(null);
        setSubmitResult(null);
    };

    return {
        running,
        submitting,
        runResult,
        submitResult,
        runCode,
        submitCode,
        resetResults,
    };
};

export default useCodeExecution;
