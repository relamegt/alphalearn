import { QueryClient } from '@tanstack/react-query';

/**
 * Stale times (ms) — how long before a query is considered stale and
 * will be refetched in the background on the next mount/focus.
 *
 * Data that changes often  → short stale time (near-realtime)
 * Data that rarely changes → long stale time (avoid redundant fetches)
 */
const STALE = {
    REALTIME: 0,           // always refetch on mount (leaderboard during live contest)
    SHORT: 10_000,      // 10s  – contest leaderboard, active contest state
    MEDIUM: 60_000,      // 1min – batch leaderboard (backend caches for 60s anyway)
    LONG: 5 * 60_000,  // 5min – contests list, problems, batch info
    VERY_LONG: 30 * 60_000, // 30min– external profiles, analytics, reports
    PERMANENT: Infinity,    // never re-fetch until explicit invalidation (static config)
};

/**
 * GC times (ms) — how long UNUSED data stays in the QueryCache before
 * being garbage collected. Should always be ≥ staleTime.
 */
const GC = {
    SHORT: 60_000,       // 1min
    MEDIUM: 5 * 60_000,   // 5min
    LONG: 30 * 60_000,  // 30min
    VERY_LONG: 60 * 60_000,  // 1hr
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Default: stale after 30s, keep in GC for 5min
            staleTime: STALE.LONG,
            gcTime: GC.MEDIUM,
            // Retry failed requests twice with exponential backoff
            retry: (failureCount, error) => {
                // Don't retry on 401/403/404 — they'll always fail
                const status = error?.response?.status ?? error?.status;
                if (status === 401 || status === 403 || status === 404) return false;
                return failureCount < 2;
            },
            retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10_000),
            // Refetch on window focus for stale data only
            refetchOnWindowFocus: 'always',
            // Don't refetch when network reconnects unless stale
            refetchOnReconnect: true,
        },
        mutations: {
            retry: false,
        },
    },
});

export { queryClient, STALE, GC };
export default queryClient;
