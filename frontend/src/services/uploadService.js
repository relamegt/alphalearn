import apiClient from './apiClient';

const uploadService = {
    // Upload profile picture
    uploadProfilePicture: async (file) => {
        const formData = new FormData();
        formData.append('profilePicture', file);

        const response = await apiClient.post('/upload/profile-picture', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });

        return response.data;
    },

    // Delete profile picture
    deleteProfilePicture: async (publicId) => {
        const response = await apiClient.delete('/upload/profile-picture', {
            data: { publicId }
        });

        return response.data;
    }
};

export default uploadService;
