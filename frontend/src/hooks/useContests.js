/**
 * useContests.js
 * TanStack Query hooks for contest data.
 *
 * CACHING STRATEGY:
 * ─────────────────────────────────────────────────────────────────
 * Contest list (by batch):
 *   • staleTime = 5min — contest metadata rarely changes mid-contest.
 *   • Invalidated on createContest / updateContest / deleteContest mutations.
 *
 * Contest detail:
 *   • staleTime = 5min — same reasoning.
 *
 * Contest submissions (student's own):
 *   • staleTime = 30s — updated after each submission via mutation.
 *
 * Mutations automatically invalidate relevant keys so the UI stays fresh.
 * ─────────────────────────────────────────────────────────────────
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { STALE, GC } from '../services/queryClient';
import apiClient from '../services/apiClient';

// ── Raw fetchers ──────────────────────────────────────────────────

const fetchContestsByBatch = async (batchId, status) => {
    const params = status ? { status } : {};
    const { data } = await apiClient.get(`/contest/batch/${batchId}`, { params });
    return data;
};

const fetchContestById = async (contestId) => {
    const { data } = await apiClient.get(`/contest/${contestId}`);
    return data;
};

const fetchContestLeaderboard = async (contestId) => {
    const { data } = await apiClient.get(`/contest/${contestId}/leaderboard`);
    return data;
};

const fetchContestStatistics = async (contestId) => {
    const { data } = await apiClient.get(`/contest/${contestId}/statistics`);
    return data;
};

const fetchStudentSubmissions = async (contestId) => {
    const { data } = await apiClient.get(`/contest/${contestId}/submissions`);
    return data;
};

// ── Read Hooks ────────────────────────────────────────────────────

export function useContestsByBatch(batchId, status = null, options = {}) {
    return useQuery({
        queryKey: queryKeys.contests.byBatch(batchId),
        queryFn: () => fetchContestsByBatch(batchId, status),
        enabled: !!batchId,
        staleTime: STALE.LONG,        // 5min
        gcTime: GC.LONG,
        placeholderData: (prev) => prev,
        ...options,
    });
}

export function useContest(contestId, options = {}) {
    return useQuery({
        queryKey: queryKeys.contests.detail(contestId),
        queryFn: () => fetchContestById(contestId),
        enabled: !!contestId,
        staleTime: STALE.LONG,
        gcTime: GC.LONG,
        ...options,
    });
}

export function useContestPublicLeaderboard(contestId, options = {}) {
    return useQuery({
        queryKey: queryKeys.contests.leaderboard(contestId),
        queryFn: () => fetchContestLeaderboard(contestId),
        enabled: !!contestId,
        staleTime: STALE.SHORT,       // 10s — updates frequently
        gcTime: GC.SHORT,
        placeholderData: (prev) => prev,
        ...options,
    });
}

export function useContestStatistics(contestId, options = {}) {
    return useQuery({
        queryKey: queryKeys.contests.statistics(contestId),
        queryFn: () => fetchContestStatistics(contestId),
        enabled: !!contestId,
        staleTime: STALE.MEDIUM,
        gcTime: GC.MEDIUM,
        ...options,
    });
}

export function useStudentSubmissions(contestId, options = {}) {
    return useQuery({
        queryKey: queryKeys.contests.submissions(contestId),
        queryFn: () => fetchStudentSubmissions(contestId),
        enabled: !!contestId,
        staleTime: STALE.SHORT,       // 10s
        gcTime: GC.SHORT,
        placeholderData: (prev) => prev,
        ...options,
    });
}

// ── Write Mutations ───────────────────────────────────────────────

export function useSubmitContestCode() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ contestId, submissionData }) =>
            apiClient.post(`/contest/${contestId}/submit`, submissionData).then(r => r.data),
        onSuccess: (_, { contestId }) => {
            // Invalidate student's submission list so it shows the new verdict
            qc.invalidateQueries({ queryKey: queryKeys.contests.submissions(contestId) });
            // Leaderboard might change — mark it stale so background refetch happens
            qc.invalidateQueries({ queryKey: queryKeys.leaderboard.contest(contestId), exact: false });
        },
    });
}

export function useFinishContest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ contestId, finalViolations }) =>
            apiClient.post(`/contest/${contestId}/finish`, { finalViolations }).then(r => r.data),
        onSuccess: (_, { contestId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.contests.submissions(contestId) });
            qc.invalidateQueries({ queryKey: queryKeys.leaderboard.contest(contestId), exact: false });
            // Student rank changes when contest finishes
            qc.invalidateQueries({ queryKey: queryKeys.leaderboard.rank(), exact: false });
        },
    });
}

export function useCreateContest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (contestData) =>
            apiClient.post('/contest', contestData).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.contests.all() });
        },
    });
}

export function useUpdateContest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ contestId, updateData }) =>
            apiClient.put(`/contest/${contestId}`, updateData).then(r => r.data),
        onSuccess: (_, { contestId }) => {
            qc.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });
            qc.invalidateQueries({ queryKey: queryKeys.contests.all() });
        },
    });
}

export function useDeleteContest() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (contestId) =>
            apiClient.delete(`/contest/${contestId}`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.contests.all() });
        },
    });
}
