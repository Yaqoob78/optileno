// frontend/src/hooks/useMoodTracker.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';

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

interface UseMoodTrackerReturn {
    moodData: MoodData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    checkIn: (mood: string, context?: string) => Promise<void>;
}

export function useMoodTracker(): UseMoodTrackerReturn {
    const [moodData, setMoodData] = useState<MoodData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch current mood
    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.get<MoodData>('/analytics/mood/current');
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || 'Failed to fetch mood data');
            }
            setMoodData(response.data);
        } catch (err: any) {
            console.error('Error fetching mood:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check-in (manual mood log)
    const checkIn = useCallback(async (mood: string, context?: string) => {
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
    }, [refresh]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Real-time updates
    useEffect(() => {
        if (!realtimeClient.isConnected()) return;

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
    }, [refresh]);

    // Periodic refresh (every 15 min) to capture temporal changes
    useEffect(() => {
        const interval = setInterval(refresh, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh]);

    return {
        moodData,
        isLoading,
        error,
        refresh,
        checkIn,
    };
}
