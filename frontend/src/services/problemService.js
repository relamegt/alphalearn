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

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

const problemService = {
    // ============================================
    // PUBLIC ROUTES (All authenticated users)
    // ============================================

    // Get All Problems → GET /api/problem
    getAllProblems: async (filters = {}) => {
        try {
            const params = {};
            if (filters.difficulty) params.difficulty = filters.difficulty;

            const response = await apiClient.get('/problem', { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch problems' };
        }
    },

    // Get Problem by ID → GET /api/problem/:problemId
    getProblemById: async (problemId) => {
        try {
            const response = await apiClient.get(`/problem/${problemId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch problem' };
        }
    },

    // Get Difficulty-wise Count → GET /api/problem/difficulty/count
    getDifficultyWiseCount: async () => {
        try {
            const response = await apiClient.get('/problem/difficulty/count');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch difficulty counts' };
        }
    },

    // ============================================
    // ADMIN-ONLY ROUTES
    // ============================================

    // Create Single Problem → POST /api/problem
    createProblem: async (problemData) => {
        try {
            const response = await apiClient.post('/problem', problemData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create problem' };
        }
    },

    // Bulk Create Problems (JSON) → POST /api/problem/bulk
    bulkCreateProblems: async (jsonFile) => {
        try {
            const formData = new FormData();
            formData.append('file', jsonFile);

            const response = await apiClient.post('/problem/bulk', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to bulk create problems' };
        }
    },

    // Update Problem → PUT /api/problem/:problemId
    updateProblem: async (problemId, updateData) => {
        try {
            const response = await apiClient.put(`/problem/${problemId}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update problem' };
        }
    },

    // Delete Problem → DELETE /api/problem/:problemId
    deleteProblem: async (problemId) => {
        try {
            const response = await apiClient.delete(`/problem/${problemId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete problem' };
        }
    },

    // Set Reference Solution Code (Admin) → PUT /api/problem/:problemId/solution-code
    setSolutionCode: async (problemId, language, code) => {
        try {
            const response = await apiClient.put(`/problem/${problemId}/solution-code`, { language, code });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to save solution code' };
        }
    },
};

export default problemService;
