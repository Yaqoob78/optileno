// frontend/src/hooks/useFocusScore.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

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
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [score, setScore] = useState<FocusScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<FocusAverageData | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<FocusAverageData | null>(null);
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
            const todayResponse = await api.get<FocusScore>('/analytics/focus/score/today');
            if (!todayResponse.success || !todayResponse.data) {
                if (todayResponse.error?.code === 'HTTP_401') {
                    setScore(null);
                    setWeeklyAverage(null);
                    setMonthlyAverage(null);
                    setError(null);
                    return;
                }
                throw new Error(todayResponse.error?.message || 'Failed to fetch focus score');
            }
            const todayPayload = todayResponse.data as any;
            const normalizedBreakdown: FocusBreakdown = {
                session_duration: Number(todayPayload.breakdown?.session_duration ?? todayPayload.breakdown?.deep_work_component ?? 0),
                session_quality: Number(todayPayload.breakdown?.session_quality ?? todayPayload.breakdown?.task_component ?? 0),
                consistency: Number(todayPayload.breakdown?.consistency ?? todayPayload.breakdown?.goal_alignment_component ?? 0),
                peak_performance: Number(todayPayload.breakdown?.peak_performance ?? todayPayload.score ?? 0),
                distraction_resistance: Number(todayPayload.breakdown?.distraction_resistance ?? 0),
            };
            setScore({
                score: Number(todayPayload.score ?? 0),
                date: todayPayload.period_end || todayPayload.date || new Date().toISOString(),
                total_minutes: Number(todayPayload.total_minutes ?? todayPayload.inputs?.deep_work_minutes ?? 0),
                heatmap_average: Number(todayPayload.heatmap_average ?? todayPayload.score ?? 0),
                breakdown: normalizedBreakdown,
                grade: String(todayPayload.grade || todayPayload.source || 'Live'),
                status: String(todayPayload.status || todayPayload.level || 'Active'),
            });

            // Fetch weekly average if needed
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await api.get<FocusAverageData>('/analytics/focus/score/weekly');
                if (weeklyResponse.success && weeklyResponse.data) {
                    const weeklyPayload = weeklyResponse.data as any;
                    setWeeklyAverage({
                        average_score: Number(weeklyPayload.average_score ?? weeklyPayload.score ?? 0),
                        average_minutes: Number(weeklyPayload.average_minutes ?? 0),
                        period: weeklyPayload.period || 'weekly',
                        days: Number(weeklyPayload.days ?? 7),
                    });
                } else if (weeklyResponse.error?.code === 'HTTP_401') {
                    setWeeklyAverage(null);
                }
            }

            // Fetch monthly average if needed
            if (timeRange === 'monthly') {
                const monthlyResponse = await api.get<FocusAverageData>('/analytics/focus/score/monthly');
                if (monthlyResponse.success && monthlyResponse.data) {
                    const monthlyPayload = monthlyResponse.data as any;
                    setMonthlyAverage({
                        average_score: Number(monthlyPayload.average_score ?? monthlyPayload.score ?? 0),
                        average_minutes: Number(monthlyPayload.average_minutes ?? 0),
                        period: monthlyPayload.period || 'monthly',
                        days: Number(monthlyPayload.days ?? 30),
                    });
                } else if (monthlyResponse.error?.code === 'HTTP_401') {
                    setMonthlyAverage(null);
                }
            }
        } catch (err: any) {
            console.error('Error fetching focus score:', err);
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

    // Real-time refresh on focus-impacting events
    useEffect(() => {
        if (!isAuthenticated) return;
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
