/**
 * leaderboardService.js
 *
 * MIGRATION NOTE:
 * ───────────────────────────────────────────────────────────────
 * The old localStorage cache (24h TTL) has been REPLACED by
 * TanStack Query (see src/hooks/useLeaderboard.js).
 *
 * This file still exports the raw fetcher functions so:
 *  1. Leaderboard.jsx can call them directly when not yet converted
 *     to hooks (backward-compatible bridge).
 *  2. The old in-memory deduplication is kept via PENDING_CALLS.
 *
 * The old saveToCache / isCacheValid / getFromCache are removed —
 * TanStack Query manages staleness and persistence automatically.
 * ───────────────────────────────────────────────────────────────
 */
import apiClient from './apiClient';
import queryClient from './queryClient';
import { queryKeys } from './queryKeys';

const PENDING_CALLS = {};

const leaderboardService = {

    /**
     * Get the batch practice leaderboard.
     * Reads from TanStack Query cache first (stale for 60s).
     * forceRefresh=true bypasses the cache and invalidates TQ cache too.
     */
    getBatchLeaderboard: async (batchId, forceRefresh = false) => {
        const qKey = queryKeys.leaderboard.batch(batchId);

        if (!forceRefresh) {
            // Try TanStack Query in-memory cache first
            const cached = queryClient.getQueryData(qKey);
            if (cached) {
                const state = queryClient.getQueryState(qKey);
                const age = Date.now() - (state?.dataUpdatedAt ?? 0);
                // Return cached if fresher than 60s
                if (age < 60_000) {
                    console.log('📦 Leaderboard served from TanStack cache');
                    return cached;
                }
            }
        } else {
            // Force-invalidate so next useQuery refetches from network
            queryClient.invalidateQueries({ queryKey: qKey });
        }

        // Deduplicate simultaneous calls
        const pendingKey = `batch_${batchId}`;
        if (PENDING_CALLS[pendingKey]) return PENDING_CALLS[pendingKey];

        const promise = (async () => {
            try {
                console.log('🌐 Fetching leaderboard from API...');
                const { data } = await apiClient.get(`/reports/leaderboard/batch/${batchId}`);
                // Seed TanStack Query cache with fresh data
                queryClient.setQueryData(qKey, data);
                return data;
            } catch (error) {
                // Fallback: return stale TQ cache if available
                const stale = queryClient.getQueryData(qKey);
                if (stale) {
                    console.warn('⚠️ API failed, using stale cache');
                    return stale;
                }
                throw error.response?.data || { message: 'Failed to fetch leaderboard' };
            } finally {
                delete PENDING_CALLS[pendingKey];
            }
        })();

        PENDING_CALLS[pendingKey] = promise;
        return promise;
    },

    /**
     * Get all external platform data.
     * staleTime = 30min (third-party data is scraped daily).
     */
    getAllExternalData: async (batchId, forceRefresh = false) => {
        const qKey = queryKeys.leaderboard.externalAll(batchId);

        if (!forceRefresh) {
            const cached = queryClient.getQueryData(qKey);
            if (cached) {
                const state = queryClient.getQueryState(qKey);
                const age = Date.now() - (state?.dataUpdatedAt ?? 0);
                if (age < 30 * 60_000) {
                    console.log('📦 External data served from TanStack cache');
                    return cached;
                }
            }
        } else {
            queryClient.invalidateQueries({ queryKey: qKey });
        }

        const pendingKey = `ext_${batchId}`;
        if (PENDING_CALLS[pendingKey]) return PENDING_CALLS[pendingKey];

        const promise = (async () => {
            try {
                console.log('🌐 Fetching external data from API...');
                const { data } = await apiClient.get(`/reports/leaderboard/batch/${batchId}/external-all`);
                queryClient.setQueryData(qKey, data);
                return data;
            } catch (error) {
                const stale = queryClient.getQueryData(qKey);
                if (stale) {
                    console.warn('⚠️ API failed, using stale external cache');
                    return stale;
                }
                throw error.response?.data || { message: 'Failed to fetch external data' };
            } finally {
                delete PENDING_CALLS[pendingKey];
            }
        })();

        PENDING_CALLS[pendingKey] = promise;
        return promise;
    },

    /**
     * Get internal contest leaderboard (no aggressive caching — near-realtime).
     * TanStack Query's staleTime=10s handles background refresh.
     */
    getInternalContestLeaderboard: async (contestId, page = 1, limit = 50) => {
        try {
            const { data } = await apiClient.get(`/reports/leaderboard/contest/${contestId}`, {
                params: { page, limit }
            });
            // Seed TQ cache so the useContestLeaderboard hook sees it immediately
            queryClient.setQueryData(
                queryKeys.leaderboard.contest(contestId, page, limit),
                data
            );
            return data;
        } catch (error) {
            throw error.response?.data || { message: 'Failed to fetch contest leaderboard' };
        }
    },

    // Student rank — pass through, TQ hooks handle caching
    getStudentRank: async (studentId = null) => {
        const endpoint = studentId
            ? `/reports/leaderboard/student/${studentId}/rank`
            : '/reports/leaderboard/student/rank';
        const { data } = await apiClient.get(endpoint).catch(e => {
            throw e.response?.data || { message: 'Failed to fetch student rank' };
        });
        return data;
    },

    // Top performers — pass through
    getTopPerformers: async (limit = 10) => {
        const { data } = await apiClient.get('/reports/leaderboard/top', {
            params: { limit },
        }).catch(e => {
            throw e.response?.data || { message: 'Failed to fetch top performers' };
        });
        return data;
    },

    // ── Cache management utilities (thin wrappers over TQ) ────────

    /** Force-invalidate the batch leaderboard so it refetches on next access. */
    invalidateBatchLeaderboard: (batchId) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.batch(batchId) });
    },

    /** Force-invalidate the contest leaderboard (e.g. on WS event). */
    invalidateContestLeaderboard: (contestId) => {
        queryClient.invalidateQueries({
            queryKey: queryKeys.leaderboard.contest(contestId),
            exact: false,
        });
    },

    /** Clear all leaderboard caches (e.g. on logout). */
    clearAllCaches: () => {
        queryClient.removeQueries({ queryKey: ['leaderboard'] });
    },
};

export default leaderboardService;
