/**
 * Centralised query key factory.
 * Every useQuery / useMutation in the app MUST use these keys for
 * consistent, granular cache invalidation.
 *
 *  queryKeys.leaderboard.batch(batchId)       → ['leaderboard', 'batch', batchId]
 *  queryKeys.leaderboard.contest(id, page)    → ['leaderboard', 'contest', id, page, limit]
 */
export const queryKeys = {
    // ── Auth ──────────────────────────────────────────────────────
    auth: {
        me: () => ['auth', 'me'],
    },

    // ── Leaderboard ───────────────────────────────────────────────
    leaderboard: {
        all: () => ['leaderboard'],
        batch: (batchId) => ['leaderboard', 'batch', batchId],
        contest: (contestId, page, limit) => ['leaderboard', 'contest', contestId, page, limit],
        rank: (studentId) => ['leaderboard', 'rank', studentId ?? 'me'],
        top: (limit) => ['leaderboard', 'top', limit],
        externalAll: (batchId) => ['leaderboard', 'external', batchId],
    },

    // ── Contests ──────────────────────────────────────────────────
    contests: {
        all: () => ['contests'],
        byBatch: (batchId) => ['contests', 'batch', batchId],
        detail: (contestId) => ['contests', 'detail', contestId],
        leaderboard: (contestId) => ['contests', 'leaderboard', contestId],
        statistics: (contestId) => ['contests', 'statistics', contestId],
        submissions: (contestId) => ['contests', 'submissions', contestId],
        violations: (contestId, studentId) => ['contests', 'violations', contestId, studentId],
    },

    // ── Profile / Dashboard ───────────────────────────────────────
    profile: {
        dashboard: () => ['profile', 'dashboard'],
        externalProfiles: () => ['profile', 'external'],
    },

    // ── Problems ─────────────────────────────────────────────────
    problems: {
        all: () => ['problems'],
        detail: (id) => ['problems', id],
        byContest: (contestId) => ['problems', 'contest', contestId],
    },

    // ── Admin ─────────────────────────────────────────────────────
    admin: {
        batches: () => ['admin', 'batches'],
        batch: (id) => ['admin', 'batch', id],
        students: (batchId) => ['admin', 'students', batchId],
        analytics: () => ['admin', 'analytics'],
        reports: (contestId) => ['admin', 'reports', contestId],
    },
};
