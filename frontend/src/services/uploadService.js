import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const uploadApi = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

uploadApi.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

const uploadService = {
    // Upload profile picture
    uploadProfilePicture: async (file) => {
        const formData = new FormData();
        formData.append('profilePicture', file);

        const response = await uploadApi.post('/upload/profile-picture', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });

        return response.data;
    },

    // Delete profile picture
    deleteProfilePicture: async (publicId) => {
        const response = await uploadApi.delete('/upload/profile-picture', {
            data: { publicId }
        });

        return response.data;
    }
};

export default uploadService;
