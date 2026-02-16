import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Axios instance with auth
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

const adminService = {
    // ============================================
    // BATCH MANAGEMENT
    // ============================================

    // Create Batch → POST /admin/batches
    createBatch: async (batchData) => {
        try {
            const response = await apiClient.post('/admin/batches', batchData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create batch' };
        }
    },

    // Get All Batches → GET /admin/batches
    getAllBatches: async () => {
        try {
            const response = await apiClient.get('/admin/batches');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch batches' };
        }
    },

    // Update Batch → PUT /admin/batches/:batchId
    updateBatch: async (batchId, updateData) => {
        try {
            const response = await apiClient.put(`/admin/batches/${batchId}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update batch' };
        }
    },

    // Extend Batch Expiry → POST /admin/batches/:batchId/extend
    extendBatchExpiry: async (batchId, newEndDate) => {
        try {
            const response = await apiClient.post(`/admin/batches/${batchId}/extend`, {
                newEndDate,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to extend batch' };
        }
    },

    // Get Batch Statistics → GET /admin/batches/:batchId/statistics
    getBatchStatistics: async (batchId) => {
        try {
            const response = await apiClient.get(`/admin/batches/${batchId}/statistics`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch statistics' };
        }
    },

    // Delete Batch → DELETE /admin/batches/:batchId
    deleteBatch: async (batchId) => {
        try {
            const response = await apiClient.delete(`/admin/batches/${batchId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete batch' };
        }
    },

    // ============================================
    // USER MANAGEMENT (WITHIN BATCH)
    // ============================================

    // Add Single User to Batch → POST /admin/batches/:batchId/users
    addUserToBatch: async (batchId, userData) => {
        try {
            const response = await apiClient.post(`/admin/batches/${batchId}/users`, userData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to add user' };
        }
    },

    // Bulk Add Users (CSV) → POST /admin/batches/:batchId/users/bulk
    bulkAddUsersToBatch: async (batchId, file, role) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('role', role);

            const response = await apiClient.post(
                `/admin/batches/${batchId}/users/bulk`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to bulk add users' };
        }
    },

    // Get Batch Users → GET /admin/batches/:batchId/users
    getBatchUsers: async (batchId, role = null) => {
        try {
            const params = role ? { role } : {};
            const response = await apiClient.get(`/admin/batches/${batchId}/users`, { params });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch batch users' };
        }
    },

    // Remove User from Batch → DELETE /admin/batches/:batchId/users/:userId
    removeUserFromBatch: async (batchId, userId) => {
        try {
            const response = await apiClient.delete(`/admin/batches/${batchId}/users/${userId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to remove user' };
        }
    },

    // ============================================
    // ADMIN USER MANAGEMENT
    // ============================================

    // Create Admin User → POST /admin/admins
    createAdminUser: async (email) => {
        try {
            const response = await apiClient.post('/admin/admins', { email });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create admin' };
        }
    },

    // Get All Users → GET /admin/users
    getAllUsers: async (filters = {}) => {
        try {
            const response = await apiClient.get('/admin/users', { params: filters });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch users' };
        }
    },

    // Get System Analytics → GET /admin/analytics
    getSystemAnalytics: async () => {
        try {
            const response = await apiClient.get('/admin/analytics');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch analytics' };
        }
    },
};

export default adminService;
