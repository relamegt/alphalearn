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

const sectionService = {
    // Get all sections
    getAllSections: async () => {
        try {
            const response = await apiClient.get('/sections');
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch sections' };
        }
    },

    // Create section
    createSection: async (title) => {
        try {
            const response = await apiClient.post('/sections', { title });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create section' };
        }
    },

    // Update section
    updateSection: async (sectionId, title) => {
        try {
            const response = await apiClient.put(`/sections/${sectionId}`, { title });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update section' };
        }
    },

    // Delete section
    deleteSection: async (sectionId) => {
        try {
            const response = await apiClient.delete(`/sections/${sectionId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete section' };
        }
    },

    // Add subsection
    addSubsection: async (sectionId, title) => {
        try {
            const response = await apiClient.post(`/sections/${sectionId}/subsections`, { title });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to add subsection' };
        }
    },

    // Update subsection
    updateSubsection: async (sectionId, subsectionId, title) => {
        try {
            const response = await apiClient.put(`/sections/${sectionId}/subsections/${subsectionId}`, { title });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update subsection' };
        }
    },

    // Delete subsection
    deleteSubsection: async (sectionId, subsectionId) => {
        try {
            const response = await apiClient.delete(`/sections/${sectionId}/subsections/${subsectionId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete subsection' };
        }
    },

    // Add problem(s) to subsection
    addProblemToSubsection: async (sectionId, subsectionId, problemIds) => {
        try {
            // problemIds can be single ID or array
            const response = await apiClient.post(`/sections/${sectionId}/subsections/${subsectionId}/problems`, { problemIds });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to add problem(s) to subsection' };
        }
    },

    // Remove problem(s) from subsection
    removeProblemFromSubsection: async (sectionId, subsectionId, problemIds) => {
        try {
            // If single ID, use URL param for backward compatibility (or simplicity)
            if (!Array.isArray(problemIds)) {
                const response = await apiClient.delete(`/sections/${sectionId}/subsections/${subsectionId}/problems/${problemIds}`);
                return response.data;
            } else {
                // If array, send in body
                const response = await apiClient.delete(`/sections/${sectionId}/subsections/${subsectionId}/problems`, {
                    data: { problemIds }
                });
                return response.data;
            }
        } catch (error) {
            throw error.response?.data || { message: 'Failed to remove problem(s) from subsection' };
        }
    },
};

export default sectionService;
