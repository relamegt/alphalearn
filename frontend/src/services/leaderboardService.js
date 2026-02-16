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

apiClient.interceptors.request.use((config) => {
    const accessToken = Cookies.get('accessToken');
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

// Cache keys
const CACHE_KEYS = {
    PRACTICE_LEADERBOARD: 'alphalearn_practice_leaderboard_',
    EXTERNAL_DATA: 'alphalearn_external_data_',
    CACHE_TIMESTAMP: 'alphalearn_cache_timestamp_',
};

// Cache duration: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const leaderboardService = {
    // Check if cache is valid
    isCacheValid: (key) => {
        try {
            const timestamp = localStorage.getItem(`${CACHE_KEYS.CACHE_TIMESTAMP}${key}`);
            if (!timestamp) return false;

            const now = Date.now();
            const cacheTime = parseInt(timestamp);
            return (now - cacheTime) < CACHE_DURATION;
        } catch (error) {
            console.error('Cache validation error:', error);
            return false;
        }
    },

    // Get from cache
    getFromCache: (key) => {
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;
            return JSON.parse(data);
        } catch (error) {
            console.error('Cache retrieval error:', error);
            return null;
        }
    },

    // Save to cache
    saveToCache: (key, data) => {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            localStorage.setItem(`${CACHE_KEYS.CACHE_TIMESTAMP}${key}`, Date.now().toString());
        } catch (error) {
            console.error('Cache save error:', error);
        }
    },

    // Clear all leaderboard caches
    clearAllCaches: () => {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('alphalearn_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    },

    // Get FULL Batch Leaderboard with caching
    getBatchLeaderboard: async (batchId, forceRefresh = false) => {
        const cacheKey = `${CACHE_KEYS.PRACTICE_LEADERBOARD}${batchId}`;

        // Check cache first
        if (!forceRefresh && leaderboardService.isCacheValid(cacheKey)) {
            const cachedData = leaderboardService.getFromCache(cacheKey);
            if (cachedData) {
                console.log('📦 Practice leaderboard loaded from cache');
                return cachedData;
            }
        }

        try {
            console.log('🌐 Fetching practice leaderboard from API...');
            const response = await apiClient.get(`/reports/leaderboard/batch/${batchId}`);

            // Save to cache
            leaderboardService.saveToCache(cacheKey, response.data);

            return response.data;
        } catch (error) {
            // If API fails, try to return cached data even if expired
            const cachedData = leaderboardService.getFromCache(cacheKey);
            if (cachedData) {
                console.warn('⚠️ API failed, using cached data');
                return cachedData;
            }
            throw error.response?.data || { message: 'Failed to fetch leaderboard' };
        }
    },

    // Get ALL External Data with caching
    getAllExternalData: async (batchId, forceRefresh = false) => {
        const cacheKey = `${CACHE_KEYS.EXTERNAL_DATA}${batchId}`;

        // Check cache first
        if (!forceRefresh && leaderboardService.isCacheValid(cacheKey)) {
            const cachedData = leaderboardService.getFromCache(cacheKey);
            if (cachedData) {
                console.log('📦 External data loaded from cache');
                return cachedData;
            }
        }

        try {
            console.log('🌐 Fetching external data from API...');
            const response = await apiClient.get(`/reports/leaderboard/batch/${batchId}/external-all`);

            // Save to cache
            leaderboardService.saveToCache(cacheKey, response.data);

            return response.data;
        } catch (error) {
            // If API fails, try to return cached data even if expired
            const cachedData = leaderboardService.getFromCache(cacheKey);
            if (cachedData) {
                console.warn('⚠️ API failed, using cached data');
                return cachedData;
            }
            throw error.response?.data || { message: 'Failed to fetch external data' };
        }
    },

    // Get FULL Internal Contest Leaderboard (NO CACHE - real-time)
    getInternalContestLeaderboard: async (contestId) => {
        try {
            const response = await apiClient.get(`/reports/leaderboard/contest/${contestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch contest leaderboard' };
        }
    },

    // Get Student Rank
    getStudentRank: async (studentId = null) => {
        try {
            const endpoint = studentId
                ? `/reports/leaderboard/student/${studentId}/rank`
                : '/reports/leaderboard/student/rank';
            const response = await apiClient.get(endpoint);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch student rank' };
        }
    },

    // Get Top Performers
    getTopPerformers: async (limit = 10) => {
        try {
            const response = await apiClient.get('/reports/leaderboard/top', {
                params: { limit },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch top performers' };
        }
    },
};

export default leaderboardService;
