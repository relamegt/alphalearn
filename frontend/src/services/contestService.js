import apiClient from './apiClient';

const PENDING_CALLS = {};

const contestService = {
    // ============================================
    // PUBLIC ROUTES (Unauthenticated)
    // ============================================

    getPublicContestInfo: async (contestId) => {
        try {
            const response = await apiClient.get(`/contest/public/${contestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch public contest info' };
        }
    },

    registerSpotUser: async (data) => {
        try {
            const response = await apiClient.post(`/contest/register-spot`, data);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to register spot user' };
        }
    },

    // ============================================
    // PUBLIC ROUTES (All authenticated users)
    // ============================================

    // Get Contests by Batch → GET /contest/batch/:batchId
    getContestsByBatch: async (batchId, status = null) => {
        const cacheKey = `batch_${batchId}_${status || 'all'}`;
        if (PENDING_CALLS[cacheKey]) {
            return await PENDING_CALLS[cacheKey];
        }

        const promise = (async () => {
            try {
                const params = status ? { status } : {};
                const response = await apiClient.get(`/contest/batch/${batchId}`, { params });
                return response.data;
            } catch (error) {
                throw error.response?.data || { message: 'Failed to fetch contests' };
            } finally {
                delete PENDING_CALLS[cacheKey];
            }
        })();

        PENDING_CALLS[cacheKey] = promise;
        return promise;
    },

    // Get Contest by ID → GET /contest/:contestId
    getContestById: async (contestId) => {
        try {
            const response = await apiClient.get(`/contest/${contestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch contest' };
        }
    },

    // Get Contest Leaderboard → GET /contest/:contestId/leaderboard
    getContestLeaderboard: async (contestId) => {
        try {
            const response = await apiClient.get(`/contest/${contestId}/leaderboard`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch leaderboard' };
        }
    },

    // ============================================
    // STUDENT ROUTES
    // ============================================

    // Run Contest Code → POST /contest/:contestId/run
    runContestCode: async (contestId, codeData) => {
        try {
            const response = await apiClient.post(`/contest/${contestId}/run`, codeData);
            return response.data;
        } catch (error) {
            // Preserve the raw error for network failures (no error.response on network errors)
            if (!error.response) throw error;
            throw error.response?.data || { message: 'Code execution failed' };
        }
    },

    // Submit Contest Code → POST /contest/:contestId/submit
    // Handles 429 (Redis lock) by automatically retrying after a delay
    submitContestCode: async (contestId, submissionData, _retryCount = 0) => {
        try {
            const response = await apiClient.post(`/contest/${contestId}/submit`, submissionData);
            return response.data;
        } catch (error) {
            // Preserve the raw error for network failures
            if (!error.response) throw error;
            // Auto-retry on 429 (previous submission still processing in worker)
            if (error.response?.status === 429 && _retryCount < 3) {
                await new Promise(r => setTimeout(r, 3000)); // wait 3s
                return contestService.submitContestCode(contestId, submissionData, _retryCount + 1);
            }
            throw error.response?.data || { message: 'Contest submission failed' };
        }
    },

    // Get Student Contest Submissions → GET /contest/:contestId/submissions
    getStudentContestSubmissions: async (contestId) => {
        try {
            const response = await apiClient.get(`/contest/${contestId}/submissions`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch submissions' };
        }
    },

    // Get Proctoring Violations → GET /contest/:contestId/violations/:studentId
    getProctoringViolations: async (contestId, studentId) => {
        try {
            const response = await apiClient.get(`/contest/${contestId}/violations/${studentId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch violations' };
        }
    },

    // Log Violation → POST /contest/:contestId/violation
    logViolation: async (contestId, violationData) => {
        try {
            await apiClient.post(`/contest/${contestId}/violation`, violationData);
        } catch (error) {
            console.error('Failed to log violation:', error);
            // Silent error - don't disrupt user
        }
    },

    // ============================================
    // ADMIN/INSTRUCTOR ROUTES
    // ============================================

    // Create Contest → POST /contest
    createContest: async (contestData) => {
        try {
            const response = await apiClient.post('/contest', contestData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to create contest' };
        }
    },

    // Update Contest → PUT /contest/:contestId
    updateContest: async (contestId, updateData) => {
        try {
            const response = await apiClient.put(`/contest/${contestId}`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to update contest' };
        }
    },

    // Delete Contest → DELETE /contest/:contestId
    deleteContest: async (contestId) => {
        try {
            const response = await apiClient.delete(`/contest/${contestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to delete contest' };
        }
    },

    // Get Contest Statistics → GET /contest/:contestId/statistics
    getContestStatistics: async (contestId) => {
        try {
            const response = await apiClient.get(`/contest/${contestId}/statistics`);
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch statistics' };
        }
    },
    // Finish Contest → POST /contest/:contestId/finish
    // finalViolations: { tabSwitchCount, tabSwitchDuration, fullscreenExits, pasteAttempts }
    finishContest: async (contestId, finalViolations = null) => {
        try {
            const response = await apiClient.post(`/contest/${contestId}/finish`, {
                finalViolations: finalViolations || undefined
            });
            return response.data;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to finish contest';
            throw { message, ...error.response?.data };
        }
    },

    // Unlock Contest For User → POST /contest/:contestId/unlock-user
    // Only admin or contest-creator instructor can call this
    unlockContestForUser: async (contestId, studentId) => {
        try {
            const response = await apiClient.post(`/contest/${contestId}/unlock-user`, { studentId });
            return response.data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to unlock contest for user' };
        }
    },

};

export default contestService;
