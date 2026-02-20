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

const authService = {
    // Login
    login: async (email, password) => {
        try {
            const response = await apiClient.post('/auth/login', { email, password });

            if (response.data.success) {
                // Store tokens
                Cookies.set('accessToken', response.data.tokens.accessToken, { expires: 1 }); // 24 hours
                Cookies.set('refreshToken', response.data.tokens.refreshToken, { expires: 7 }); // 7 days
                localStorage.setItem('user', JSON.stringify(response.data.user));

                // Show notification if session was replaced
                if (response.data.sessionReplaced) {
                    console.warn('⚠️ Previous session was automatically logged out');
                }
            }

            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Login failed' };
        }
    },

    // Spot Login (For Global Contests)
    spotLogin: (user, token) => {
        Cookies.set('accessToken', token, { expires: 1 }); // 24 hours
        // No refresh token for spot users
        localStorage.setItem('user', JSON.stringify(user));
        return { success: true, user };
    },

    // Complete first login profile
    completeFirstLoginProfile: async (profileData) => {
        try {
            const accessToken = Cookies.get('accessToken');
            const response = await apiClient.post('/auth/complete-profile', profileData, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Profile completion failed' };
        }
    },

    // Refresh token
    refreshToken: async () => {
        try {
            const refreshToken = Cookies.get('refreshToken');
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await apiClient.post('/auth/refresh-token', { refreshToken });

            if (response.data.success) {
                Cookies.set('accessToken', response.data.tokens.accessToken, { expires: 1 });
                Cookies.set('refreshToken', response.data.tokens.refreshToken, { expires: 7 });
            }

            return response.data;
        } catch (error) {
            // Session replaced or expired - force logout
            if (error.response?.data?.code === 'SESSION_REPLACED' ||
                error.response?.data?.code === 'SESSION_EXPIRED') {
                authService.logout();
                window.location.href = '/login?reason=session_expired';
            }
            throw error.response?.data || { message: 'Token refresh failed' };
        }
    },

    // Logout
    logout: async () => {
        try {
            const accessToken = Cookies.get('accessToken');
            if (accessToken) {
                await apiClient.post(
                    '/auth/logout',
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and cookies
            Cookies.remove('accessToken');
            Cookies.remove('refreshToken');
            localStorage.removeItem('user');
        }
    },

    // Get current user
    getCurrentUser: async () => {
        try {
            let accessToken = Cookies.get('accessToken');

            // Proactive refresh if access token missing but refresh token exists
            if (!accessToken && Cookies.get('refreshToken')) {
                try {
                    await authService.refreshToken();
                    accessToken = Cookies.get('accessToken');
                } catch (refreshError) {
                    // If refresh fails, continue and let the API call fail naturally (or interceptor handle it)
                    console.warn('Proactive refresh failed:', refreshError);
                }
            }

            const response = await apiClient.get('/auth/me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data.user;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch user' };
        }
    },

    // Get batch details
    getBatchDetails: async (batchId) => {
        try {
            const accessToken = Cookies.get('accessToken');
            const response = await apiClient.get(`/batches/${batchId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch batch details' };
        }
    },

    // Change password
    changePassword: async (currentPassword, newPassword) => {
        try {
            const accessToken = Cookies.get('accessToken');
            const response = await apiClient.post(
                '/auth/change-password',
                { currentPassword, newPassword },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            // Auto logout after password change
            if (response.data.success) {
                await authService.logout();
            }

            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Password change failed' };
        }
    },

    // Forgot password
    forgotPassword: async (email) => {
        try {
            const response = await apiClient.post('/auth/forgot-password', { email });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to send OTP' };
        }
    },

    // Reset password
    resetPassword: async (email, otp, newPassword) => {
        try {
            const response = await apiClient.post('/auth/reset-password', {
                email,
                otp,
                newPassword,
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Password reset failed' };
        }
    },

    // Verify session
    verifySession: async () => {
        try {
            const accessToken = Cookies.get('accessToken');
            const response = await apiClient.get('/auth/verify-session', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Session verification failed' };
        }
    },

    // Check if user is authenticated
    isAuthenticated: () => {
        return !!Cookies.get('accessToken') || !!Cookies.get('refreshToken');
    },

    // Get stored user
    getStoredUser: () => {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
};

// Axios interceptor for automatic token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                await authService.refreshToken();
                const newAccessToken = Cookies.get('accessToken');
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default authService;
