import apiClient from './apiClient';

const PENDING_CALLS = {};

const submissionService = {
    // Run Code (Sample Test Cases) → POST /student/code/run
    runCode: async (problemId, code, language, customInput, customInputs) => {
        try {
            const payload = { problemId, code, language };
            if (customInputs !== undefined && customInputs !== null) {
                // Array of { input, expectedOutput } objects — multi-case run
                payload.customInputs = customInputs;
            } else if (customInput !== undefined && customInput !== null) {
                // Single custom input string (legacy)
                payload.customInput = customInput;
            }
            const response = await apiClient.post('/student/code/run', payload);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Code execution failed' };
        }
    },

    // Submit Code (All Test Cases) → POST /student/code/submit
    submitCode: async (problemId, code, language) => {
        try {
            const response = await apiClient.post('/student/code/submit', {
                problemId,
                code,
                language,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Code submission failed' };
        }
    },

    // Get Submission by ID → GET /student/submissions/:submissionId
    getSubmissionById: async (submissionId) => {
        try {
            const response = await apiClient.get(`/student/submissions/${submissionId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch submission' };
        }
    },

    // Get Student Submissions → GET /student/submissions
    getStudentSubmissions: async (studentId = null, limit = 100) => {
        try {
            const url = studentId ? `/student/submissions/${studentId}` : '/student/submissions';
            const response = await apiClient.get(url, { params: { limit } });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch submissions' };
        }
    },

    // Get submissions for a specific problem
    getProblemSubmissions: async (problemId, studentId = null) => {
        const cacheKey = `prob_subs_${problemId}_${studentId || 'me'}`;
        if (PENDING_CALLS[cacheKey]) {
            return await PENDING_CALLS[cacheKey];
        }

        const promise = (async () => {
            try {
                const url = studentId ? `/student/submissions/${studentId}` : '/student/submissions';
                const response = await apiClient.get(url, { params: { problemId } });
                return response.data;
            } catch (error) {
                throw error.response?.data || { message: 'Failed to fetch problem submissions' };
            } finally {
                delete PENDING_CALLS[cacheKey];
            }
        })();

        PENDING_CALLS[cacheKey] = promise;
        return promise;
    },

    // Get Recent Submissions → GET /student/submissions/recent
    getRecentSubmissions: async (limit = 10) => {
        try {
            const response = await apiClient.get('/student/submissions/recent', {
                params: { limit },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch recent submissions' };
        }
    },

    // Get Submission Statistics → GET /student/statistics
    getSubmissionStatistics: async () => {
        try {
            const response = await apiClient.get('/student/statistics');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch statistics' };
        }
    },
};

export default submissionService;
