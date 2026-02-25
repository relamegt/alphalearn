/**
 * useProfile.js
 * TanStack Query hooks for student dashboard and profile data.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryKeys';
import { STALE, GC } from '../services/queryClient';
import apiClient from '../services/apiClient';

const fetchDashboard = () =>
    apiClient.get('/student/dashboard').then(r => r.data);

const fetchExternalProfiles = () =>
    apiClient.get('/student/external-profiles').then(r => r.data);

// ── Read Hooks ────────────────────────────────────────────────────

export function useDashboard(options = {}) {
    return useQuery({
        queryKey: queryKeys.profile.dashboard(),
        queryFn: fetchDashboard,
        staleTime: STALE.MEDIUM,      // 1min — score updates via background worker
        gcTime: GC.MEDIUM,
        ...options,
    });
}

export function useExternalProfiles(options = {}) {
    return useQuery({
        queryKey: queryKeys.profile.externalProfiles(),
        queryFn: fetchExternalProfiles,
        staleTime: STALE.VERY_LONG,   // 30min — synced daily
        gcTime: GC.VERY_LONG,
        ...options,
    });
}

// ── Write Mutations ───────────────────────────────────────────────

export function useUpdateProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (profileData) =>
            apiClient.put('/student/profile', profileData).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.profile.dashboard() });
            qc.invalidateQueries({ queryKey: queryKeys.auth.me() });
        },
    });
}

export function useLinkExternalProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ platform, username }) =>
            apiClient.post('/student/external-profiles', { platform, username }).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.profile.externalProfiles() });
            qc.invalidateQueries({ queryKey: queryKeys.profile.dashboard() });
        },
    });
}

export function useDeleteExternalProfile() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (profileId) =>
            apiClient.delete(`/student/external-profiles/${profileId}`).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.profile.externalProfiles() });
        },
    });
}

export function useSyncProfiles() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () =>
            apiClient.post('/student/external-profiles/sync').then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.profile.externalProfiles() });
            qc.invalidateQueries({ queryKey: queryKeys.profile.dashboard() });
            // External scores affect leaderboard
            qc.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
        },
    });
}
