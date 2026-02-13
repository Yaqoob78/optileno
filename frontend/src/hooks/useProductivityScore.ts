// frontend/src/hooks/useProductivityScore.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';

interface ProductivityBreakdown {
    base_usage: number;
    task_completion: number;
    focus_quality: number;
    habit_consistency: number;
    planning_accuracy: number;
    engagement_depth: number;
}

interface ProductivityScore {
    score: number;
    date: string;
    breakdown: ProductivityBreakdown;
    grade: string;
    next_update?: string;
}

interface UseProductivityScoreReturn {
    score: ProductivityScore | null;
    weeklyAverage: number | null;
    monthlyAverage: number | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useProductivityScore(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): UseProductivityScoreReturn {
    const [score, setScore] = useState<ProductivityScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<number | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<number | null>(null);
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
            const todayResponse = await fetch('/api/v1/analytics/productivity/score/today', {
                headers: getAuthHeaders(),
            });

            if (!todayResponse.ok) {
                throw new Error('Failed to fetch productivity score');
            }

            const todayData = await todayResponse.json();
            setScore(todayData);

            // Fetch weekly average if needed
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await fetch('/api/v1/analytics/productivity/score/weekly', {
                    headers: getAuthHeaders(),
                });

                if (weeklyResponse.ok) {
                    const weeklyData = await weeklyResponse.json();
                    setWeeklyAverage(weeklyData.average);
                }
            }

            // Fetch monthly average if needed
            if (timeRange === 'monthly') {
                const monthlyResponse = await fetch('/api/v1/analytics/productivity/score/monthly', {
                    headers: getAuthHeaders(),
                });

                if (monthlyResponse.ok) {
                    const monthlyData = await monthlyResponse.json();
                    setMonthlyAverage(monthlyData.average);
                }
            }
        } catch (err: any) {
            console.error('Error fetching productivity score:', err);
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

    // Real-time refresh on productivity-impacting events
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                refresh();
            }, 250);
        };

        realtimeClient.on('analytics:update', queueRefresh);
        realtimeClient.on('planner:task:created', queueRefresh);
        realtimeClient.on('planner:task:updated', queueRefresh);
        realtimeClient.on('planner:habit:completed', queueRefresh);
        realtimeClient.on('planner:deepwork:completed', queueRefresh);

        return () => {
            realtimeClient.off('analytics:update', queueRefresh);
            realtimeClient.off('planner:task:created', queueRefresh);
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
