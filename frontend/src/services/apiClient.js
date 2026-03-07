import axios from 'axios';
import Cookies from 'js-cookie';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
    // Abort requests after 30 seconds — gives BullMQ worker queue enough time to accept jobs
    timeout: 30000,
});

// Request Interceptor: Attach Token to every request automatically
apiClient.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor: re-throw network/timeout errors with the raw error
// so callers can inspect error.code (ERR_NETWORK, ECONNABORTED, etc.)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const isNetworkError = !error.response && (
            error.code === 'ERR_NETWORK' ||
            error.code === 'ECONNABORTED' ||
            error.message === 'Network Error' ||
            error.message?.includes('timeout')
        );
        if (isNetworkError) {
            // Preserve the original error so callers can detect offline
            return Promise.reject(error);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
