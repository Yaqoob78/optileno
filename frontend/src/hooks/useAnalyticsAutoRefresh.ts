// frontend/src/hooks/useAnalyticsAutoRefresh.ts
// Shared scheduling for the analytics score hooks (productivity / focus / burnout):
// initial load, periodic polling, and debounced realtime-event refresh.
// Each score hook keeps its own fetch logic and delegates the wiring here.
import { useEffect } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';

interface AutoRefreshOptions {
    /** Realtime events that should trigger a refresh. */
    events: string[];
    /** Polling interval in milliseconds. */
    intervalMs: number;
    /** Debounce for bursts of realtime events. */
    debounceMs?: number;
    /**
     * Run refresh on mount / identity change. Callers that manage their own
     * initial fetches (e.g. split today/averages loading) pass false.
     */
    initialLoad?: boolean;
}

export function useAnalyticsAutoRefresh(
    refresh: () => Promise<void> | void,
    enabled: boolean,
    { events, intervalMs, debounceMs = 250, initialLoad = true }: AutoRefreshOptions
): void {
    // Initial load (also re-runs when the refresh identity changes, e.g. timeRange)
    useEffect(() => {
        if (!enabled || !initialLoad) return;
        refresh();
    }, [refresh, enabled, initialLoad]);

    // Periodic polling
    useEffect(() => {
        if (!enabled) return;
        const interval = setInterval(refresh, intervalMs);
        return () => clearInterval(interval);
    }, [refresh, enabled, intervalMs]);

    // Debounced realtime refresh
    useEffect(() => {
        if (!enabled) return;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                refresh();
            }, debounceMs);
        };

        events.forEach((event) => realtimeClient.on(event, queueRefresh));

        return () => {
            events.forEach((event) => realtimeClient.off(event, queueRefresh));
            if (timeout) clearTimeout(timeout);
        };
        // events is a static array literal at each call site; joining keeps the
        // dependency stable without requiring callers to memoize it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, enabled, debounceMs, events.join('|')]);
}
