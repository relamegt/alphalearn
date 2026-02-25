/**
 * useLeaderboard.js
 * TanStack Query hooks for all leaderboard data.
 *
 * CACHING STRATEGY:
 * ─────────────────────────────────────────────────────────────────
 * Batch leaderboard:
 *   • staleTime = 60s (backend Redis cache TTL is also 60s)
 *   • If the WS fires a `leaderboardRefetch` event, we call
 *     queryClient.invalidateQueries([...batchKey]) to force refetch.
 *
 * Contest leaderboard (live):
 *   • staleTime = 10s — always kept fresh during an active contest.
 *   • WS events trigger invalidation for immediate background refetch.
 *
 * External leaderboard:
 *   • staleTime = 30min — scraped third-party data doesn't change often.
 *
 * Student rank:
 *   • staleTime = 5min — infrequently changes.
 * ─────────────────────────────────────────────────────────────────
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { STALE, GC } from '../services/queryClient';
import apiClient from '../services/apiClient';

// ── Raw fetchers ──────────────────────────────────────────────────

const fetchBatchLeaderboard = async (batchId) => {
    const { data } = await apiClient.get(`/reports/leaderboard/batch/${batchId}`);
    return data;
};

const fetchContestLeaderboard = async (contestId, page, limit) => {
    const { data } = await apiClient.get(`/reports/leaderboard/contest/${contestId}`, {
        params: { page, limit }
    });
    return data;
};

const fetchExternalAll = async (batchId) => {
    const { data } = await apiClient.get(`/reports/leaderboard/batch/${batchId}/external-all`);
    return data;
};

const fetchStudentRank = async (studentId) => {
    const endpoint = studentId
        ? `/reports/leaderboard/student/${studentId}/rank`
        : '/reports/leaderboard/student/rank';
    const { data } = await apiClient.get(endpoint);
    return data;
};

const fetchTopPerformers = async (limit) => {
    const { data } = await apiClient.get('/reports/leaderboard/top', { params: { limit } });
    return data;
};

// ── Hooks ─────────────────────────────────────────────────────────

/**
 * Hook for the batch practice leaderboard.
 * Reads from TanStack cache first (stale for 60s), fetches in background.
 * Also used by Leaderboard.jsx to replace the old localStorage cache.
 */
export function useBatchLeaderboard(batchId, options = {}) {
    return useQuery({
        queryKey: queryKeys.leaderboard.batch(batchId),
        queryFn: () => fetchBatchLeaderboard(batchId),
        enabled: !!batchId,
        staleTime: STALE.MEDIUM,      // 60s — matches Redis TTL on backend
        gcTime: GC.LONG,              // keep in memory for 30min
        placeholderData: (prev) => prev, // keep showing old data while refetching
        ...options,
    });
}

/**
 * Hook for the internal contest leaderboard (live during contest).
 * Short stale time for near-realtime updates. WebSocket events trigger
 * invalidation for immediate background refetch.
 */
export function useContestLeaderboard(contestId, page = 1, limit = 50, options = {}) {
    return useQuery({
        queryKey: queryKeys.leaderboard.contest(contestId, page, limit),
        queryFn: () => fetchContestLeaderboard(contestId, page, limit),
        enabled: !!contestId,
        staleTime: STALE.SHORT,       // 10s — stay fresh during live contest
        gcTime: GC.SHORT,             // evict quickly when not mounted
        placeholderData: (prev) => prev,
        ...options,
    });
}

/**
 * Hook for all external platform data (LeetCode, CodeChef, etc.)
 * Long stale time since third-party data is scraped daily.
 */
export function useExternalLeaderboard(batchId, options = {}) {
    return useQuery({
        queryKey: queryKeys.leaderboard.externalAll(batchId),
        queryFn: () => fetchExternalAll(batchId),
        enabled: !!batchId,
        staleTime: STALE.VERY_LONG,   // 30min
        gcTime: GC.VERY_LONG,
        ...options,
    });
}

/**
 * Hook for a student's rank (batch + global).
 */
export function useStudentRank(studentId = null, options = {}) {
    return useQuery({
        queryKey: queryKeys.leaderboard.rank(studentId),
        queryFn: () => fetchStudentRank(studentId),
        staleTime: STALE.LONG,
        gcTime: GC.MEDIUM,
        ...options,
    });
}

/**
 * Hook for top performers.
 */
export function useTopPerformers(limit = 10, options = {}) {
    return useQuery({
        queryKey: queryKeys.leaderboard.top(limit),
        queryFn: () => fetchTopPerformers(limit),
        staleTime: STALE.MEDIUM,
        gcTime: GC.LONG,
        ...options,
    });
}

/**
 * Utility: invalidate the contest leaderboard (called from WebSocket handler).
 * Pass `queryClient` from `useQueryClient()` in your component.
 */
export function invalidateContestLeaderboard(queryClient, contestId) {
    queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard.contest(contestId),
        exact: false,
    });
}

export function invalidateBatchLeaderboard(queryClient, batchId) {
    queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard.batch(batchId),
    });
}
