// frontend/src/hooks/useProductivityScore.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

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
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [score, setScore] = useState<ProductivityScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<number | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!isAuthenticated) {
            setScore(null);
            setWeeklyAverage(null);
            setMonthlyAverage(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Fetch today's score
            const todayResponse = await api.get<ProductivityScore>('/analytics/productivity/score/today');
            if (!todayResponse.success || !todayResponse.data) {
                if (todayResponse.error?.code === 'HTTP_401') {
                    setScore(null);
                    setWeeklyAverage(null);
                    setMonthlyAverage(null);
                    setError(null);
                    return;
                }
                throw new Error(todayResponse.error?.message || 'Failed to fetch productivity score');
            }
            const todayPayload = todayResponse.data as any;
            const normalizedBreakdown: ProductivityBreakdown = {
                base_usage: Number(todayPayload.breakdown?.base_usage ?? todayPayload.breakdown?.execution_block ?? 0),
                task_completion: Number(todayPayload.breakdown?.task_completion ?? todayPayload.breakdown?.task_component ?? 0),
                focus_quality: Number(todayPayload.breakdown?.focus_quality ?? todayPayload.breakdown?.deep_work_component ?? 0),
                habit_consistency: Number(todayPayload.breakdown?.habit_consistency ?? todayPayload.breakdown?.habit_component ?? 0),
                planning_accuracy: Number(todayPayload.breakdown?.planning_accuracy ?? todayPayload.breakdown?.goal_progress_block ?? 0),
                engagement_depth: Number(todayPayload.breakdown?.engagement_depth ?? todayPayload.breakdown?.engagement_block ?? 0),
            };
            setScore({
                score: Number(todayPayload.score ?? 0),
                date: todayPayload.period_end || todayPayload.date || new Date().toISOString(),
                breakdown: normalizedBreakdown,
                grade: String(todayPayload.grade || todayPayload.goal_band || todayPayload.level || 'Live'),
                next_update: todayPayload.generated_at || todayPayload.next_update,
            });

            // Fetch weekly average if needed
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await api.get<{ average?: number; score?: number | null }>('/analytics/productivity/score/weekly');
                if (weeklyResponse.success && weeklyResponse.data) {
                    const weeklyData = weeklyResponse.data;
                    setWeeklyAverage(weeklyData.average ?? weeklyData.score ?? null);
                } else if (weeklyResponse.error?.code === 'HTTP_401') {
                    setWeeklyAverage(null);
                }
            }

            // Fetch monthly average if needed
            if (timeRange === 'monthly') {
                const monthlyResponse = await api.get<{ average?: number; score?: number | null }>('/analytics/productivity/score/monthly');
                if (monthlyResponse.success && monthlyResponse.data) {
                    const monthlyData = monthlyResponse.data;
                    setMonthlyAverage(monthlyData.average ?? monthlyData.score ?? null);
                } else if (monthlyResponse.error?.code === 'HTTP_401') {
                    setMonthlyAverage(null);
                }
            }
        } catch (err: any) {
            console.error('Error fetching productivity score:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [timeRange, isAuthenticated]);

    // Initial load
    useEffect(() => {
        if (!isAuthenticated) return;
        refresh();
    }, [refresh, isAuthenticated]);

    // Refresh every 5 minutes to keep score current
    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(refresh, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh, isAuthenticated]);

    // Real-time refresh on productivity-impacting events
    useEffect(() => {
        if (!isAuthenticated) return;
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
    }, [refresh, isAuthenticated]);

    return {
        score,
        weeklyAverage,
        monthlyAverage,
        isLoading,
        error,
        refresh,
    };
}
