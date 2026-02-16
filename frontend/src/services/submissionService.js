import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Add auth token
apiClient.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

const submissionService = {
    // Run Code (Sample Test Cases) → POST /student/code/run
    runCode: async (problemId, code, language) => {
        try {
            const response = await apiClient.post('/student/code/run', {
                problemId,
                code,
                language,
            });
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
            const response = await apiClient.get('/student/submissions', { params: { limit } });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch submissions' };
        }
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
    getSubmissionStatistics: async (studentId = null) => {
        try {
            const response = await apiClient.get('/student/statistics');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch statistics' };
        }
    },
};

export default submissionService;
