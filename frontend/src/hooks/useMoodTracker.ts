// frontend/src/hooks/useMoodTracker.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

interface MoodBreakdown {
    chat_sentiment: number;
    planner_engagement: number;
    productivity_flow: number;
    temporal_adjustment: number;
}

interface MoodData {
    score: number;
    category: string;
    label: string;
    emoji: string;
    hint: string;
    breakdown: MoodBreakdown;
}

interface MoodApiPayload {
    score?: number | null;
    category?: string | null;
    label?: string | null;
    emoji?: string | null;
    hint?: string | null;
    breakdown?: Partial<MoodBreakdown> | null;
    status?: string;
    error_fallback?: boolean;
    message?: string;
    reason_code?: string;
}

interface UseMoodTrackerReturn {
    moodData: MoodData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    checkIn: (mood: string, context?: string) => Promise<void>;
}

export function useMoodTracker(): UseMoodTrackerReturn {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [moodData, setMoodData] = useState<MoodData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const normalizeMoodData = useCallback((payload: MoodApiPayload): MoodData | null => {
        if (!payload || payload.error_fallback || payload.status === 'unavailable') {
            return null;
        }

        const parsedScore =
            payload.score === null || payload.score === undefined || Number.isNaN(Number(payload.score))
                ? null
                : Number(payload.score);
        if (parsedScore === null) {
            return null;
        }

        const breakdown = payload.breakdown || {};
        return {
            score: parsedScore,
            category: String(payload.category || 'NEUTRAL'),
            label: String(payload.label || 'Neutral'),
            emoji: String(payload.emoji || '🙂'),
            hint: String(payload.hint || 'Mood insights are syncing.'),
            breakdown: {
                chat_sentiment: Number(breakdown.chat_sentiment ?? 0),
                planner_engagement: Number(breakdown.planner_engagement ?? 0),
                productivity_flow: Number(breakdown.productivity_flow ?? 0),
                temporal_adjustment: Number(breakdown.temporal_adjustment ?? 0),
            },
        };
    }, []);

    // Fetch current mood
    const refresh = useCallback(async () => {
        if (!isAuthenticated) {
            setMoodData(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const response = await api.get<MoodApiPayload>('/analytics/mood/current');
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setMoodData(null);
                    setError(null);
                    return;
                }
                throw new Error(response.error?.message || 'Failed to fetch mood data');
            }
            const payload = response.data;
            const normalized = normalizeMoodData(payload);

            if (!normalized) {
                setMoodData(null);
                setError(
                    typeof payload.message === 'string'
                        ? payload.message
                        : 'Mood insights are temporarily unavailable.'
                );
                return;
            }

            setMoodData(normalized);
        } catch (err: any) {
            console.error('Error fetching mood:', err);
            setMoodData(null);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, normalizeMoodData]);

    // Check-in (manual mood log)
    const checkIn = useCallback(async (mood: string, context?: string) => {
        if (!isAuthenticated) {
            return;
        }

        try {
            const response = await api.post('/analytics/mood/check-in', { mood, context });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to log mood');
            }

            // Refresh after check-in
            await refresh();
        } catch (err: any) {
            console.error('Error logging mood:', err);
            setError(err.message);
        }
    }, [refresh, isAuthenticated]);

    // Initial load
    useEffect(() => {
        if (!isAuthenticated) return;
        refresh();
    }, [refresh, isAuthenticated]);

    // Real-time updates. Listeners are registered on the client's own emitter,
    // so this works even before the socket finishes connecting.
    useEffect(() => {
        if (!isAuthenticated) return;

        const handleUpdate = () => refresh();

        // Listen for events that affect mood
        realtimeClient.on('planner:task:updated', handleUpdate);
        realtimeClient.on('planner:habit:completed', handleUpdate);
        realtimeClient.on('planner:deepwork:completed', handleUpdate);
        realtimeClient.on('chat:message:received', handleUpdate);

        return () => {
            realtimeClient.off('planner:task:updated', handleUpdate);
            realtimeClient.off('planner:habit:completed', handleUpdate);
            realtimeClient.off('planner:deepwork:completed', handleUpdate);
            realtimeClient.off('chat:message:received', handleUpdate);
        };
    }, [refresh, isAuthenticated]);

    // Periodic refresh (every 15 min) to capture temporal changes
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(refresh, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh, isAuthenticated]);

    return {
        moodData,
        isLoading,
        error,
        refresh,
        checkIn,
    };
}
