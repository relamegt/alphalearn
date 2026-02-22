import apiClient from './apiClient';

const profileService = {
    // Dashboard & Profile
    getDashboardData: async () => {
        try {
            const response = await apiClient.get('/student/dashboard');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch dashboard data' };
        }
    },

    updateProfile: async (profileData) => {
        try {
            const response = await apiClient.put('/student/profile', profileData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update profile' };
        }
    },

    // External Profiles
    linkExternalProfile: async (platform, username) => {
        try {
            const response = await apiClient.post('/student/external-profiles', {
                platform,
                username,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to link external profile' };
        }
    },

    getExternalProfiles: async () => {
        try {
            const response = await apiClient.get('/student/external-profiles');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch external profiles' };
        }
    },

    deleteExternalProfile: async (profileId) => {
        try {
            const response = await apiClient.delete(`/student/external-profiles/${profileId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete external profile' };
        }
    },

    manualSyncProfiles: async () => {
        try {
            const response = await apiClient.post('/student/external-profiles/sync');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to sync profiles' };
        }
    },

    // Instructor/Admin: Student Management
    getAllStudents: async () => {
        try {
            const response = await apiClient.get('/instructor/students');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch students' };
        }
    },

    resetStudentProfile: async (studentId) => {
        try {
            const response = await apiClient.post(`/instructor/students/${studentId}/reset`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to reset student profile' };
        }
    },

    resetMyProfile: async () => {
        try {
            const response = await apiClient.post('/student/profile/reset');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to reset profile' };
        }
    },
};

export default profileService;
