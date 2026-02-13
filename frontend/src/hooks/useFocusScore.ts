// frontend/src/hooks/useFocusScore.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';

interface FocusBreakdown {
    session_duration: number;
    session_quality: number;
    consistency: number;
    peak_performance: number;
    distraction_resistance: number;
}

interface FocusScore {
    score: number;
    date: string;
    total_minutes: number;
    heatmap_average: number;
    breakdown: FocusBreakdown;
    grade: string;
    status: string;
}

interface FocusAverageData {
    average_score: number;
    average_minutes: number;
    period: string;
    days: number;
}

interface UseFocusScoreReturn {
    score: FocusScore | null;
    weeklyAverage: FocusAverageData | null;
    monthlyAverage: FocusAverageData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useFocusScore(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): UseFocusScoreReturn {
    const [score, setScore] = useState<FocusScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<FocusAverageData | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<FocusAverageData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }, []);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch today's score
            const todayResponse = await fetch('/api/v1/analytics/focus/score/today', {
                headers: getAuthHeaders(),
            });

            if (!todayResponse.ok) {
                throw new Error('Failed to fetch focus score');
            }

            const todayData = await todayResponse.json();
            setScore(todayData);

            // Fetch weekly average if needed
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await fetch('/api/v1/analytics/focus/score/weekly', {
                    headers: getAuthHeaders(),
                });

                if (weeklyResponse.ok) {
                    const weeklyData = await weeklyResponse.json();
                    setWeeklyAverage(weeklyData);
                }
            }

            // Fetch monthly average if needed
            if (timeRange === 'monthly') {
                const monthlyResponse = await fetch('/api/v1/analytics/focus/score/monthly', {
                    headers: getAuthHeaders(),
                });

                if (monthlyResponse.ok) {
                    const monthlyData = await monthlyResponse.json();
                    setMonthlyAverage(monthlyData);
                }
            }
        } catch (err: any) {
            console.error('Error fetching focus score:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [getAuthHeaders, timeRange]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Refresh every 5 minutes to keep score current
    useEffect(() => {
        const interval = setInterval(refresh, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh]);

    // Real-time refresh on focus-impacting events
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                refresh();
            }, 250);
        };

        realtimeClient.on('analytics:focus:updated', queueRefresh);
        realtimeClient.on('analytics:update', queueRefresh);
        realtimeClient.on('planner:task:updated', queueRefresh);
        realtimeClient.on('planner:habit:completed', queueRefresh);
        realtimeClient.on('planner:deepwork:completed', queueRefresh);

        return () => {
            realtimeClient.off('analytics:focus:updated', queueRefresh);
            realtimeClient.off('analytics:update', queueRefresh);
            realtimeClient.off('planner:task:updated', queueRefresh);
            realtimeClient.off('planner:habit:completed', queueRefresh);
            realtimeClient.off('planner:deepwork:completed', queueRefresh);
            if (timeout) clearTimeout(timeout);
        };
    }, [refresh]);

    return {
        score,
        weeklyAverage,
        monthlyAverage,
        isLoading,
        error,
        refresh,
    };
}
