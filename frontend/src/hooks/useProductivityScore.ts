// frontend/src/hooks/useProductivityScore.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsAutoRefresh } from './useAnalyticsAutoRefresh';

interface ProductivityBreakdown {
    task_points: number;
    habit_points: number;
    deep_work_points: number;
    goal_progress_block: number;
    engagement_block: number;
    burnout_cap: number;
    weights: Record<string, number>;
}

interface ProductivityScore {
    score: number | null;
    date: string;
    breakdown: ProductivityBreakdown;
    grade: string;
    daily_intent: string;
    baseline_state: string;
    reason_codes: string[];
    reason?: string | null;
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

const REALTIME_EVENTS = [
    'analytics:update',
    'planner:task:created',
    'planner:task:updated',
    'planner:habit:completed',
    'planner:deepwork:completed',
];

export function useProductivityScore(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): UseProductivityScoreReturn {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [score, setScore] = useState<ProductivityScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<number | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Today's score is time-range independent — fetched once per session,
    // then only on polling/realtime updates (not on tab switches).
    const fetchToday = useCallback(async () => {
        if (!isAuthenticated) {
            setScore(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const todayResponse = await api.get<ProductivityScore>('/analytics/productivity/score/today');
            if (!todayResponse.success || !todayResponse.data) {
                if (todayResponse.error?.code === 'HTTP_401') {
                    setScore(null);
                    setError(null);
                    return;
                }
                throw new Error(todayResponse.error?.message || 'Failed to fetch productivity score');
            }
            const todayPayload = todayResponse.data as any;
            const parsedScore =
                todayPayload.score === null || todayPayload.score === undefined || Number.isNaN(Number(todayPayload.score))
                    ? null
                    : Number(todayPayload.score);

            // V3 breakdown with backward-compatible fallbacks
            const normalizedBreakdown: ProductivityBreakdown = {
                task_points: Number(todayPayload.breakdown?.task_points ?? todayPayload.breakdown?.task_component ?? 0),
                habit_points: Number(todayPayload.breakdown?.habit_points ?? todayPayload.breakdown?.habit_component ?? 0),
                deep_work_points: Number(todayPayload.breakdown?.deep_work_points ?? todayPayload.breakdown?.deep_work_component ?? 0),
                goal_progress_block: Number(todayPayload.breakdown?.goal_progress_block ?? 0),
                engagement_block: Number(todayPayload.breakdown?.engagement_block ?? 0),
                burnout_cap: Number(todayPayload.breakdown?.burnout_cap ?? 100),
                weights: todayPayload.breakdown?.weights ?? {},
            };

            setScore({
                score: parsedScore,
                date: todayPayload.period_end || todayPayload.date || new Date().toISOString(),
                breakdown: normalizedBreakdown,
                grade:
                    parsedScore === null
                        ? 'No Data'
                        : String(todayPayload.grade || todayPayload.goal_band || 'Live'),
                daily_intent: String(todayPayload.daily_intent || 'athlete'),
                baseline_state: String(todayPayload.baseline_state || 'cold_start'),
                reason_codes: Array.isArray(todayPayload.reason_codes) ? todayPayload.reason_codes : [],
                reason: typeof todayPayload.reason === 'string' ? todayPayload.reason : null,
                next_update: todayPayload.generated_at || todayPayload.next_update,
            });
        } catch (err: any) {
            console.warn('Productivity score sync:', err?.message || err);
            // Keep the last good score on transient refresh failures —
            // wiping it would blank the dashboard on every network blip
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated]);

    // Averages depend on the selected time range.
    const fetchAverages = useCallback(async () => {
        if (!isAuthenticated) {
            setWeeklyAverage(null);
            setMonthlyAverage(null);
            return;
        }

        try {
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await api.get<{ average?: number; score?: number | null }>('/analytics/productivity/score/weekly');
                if (weeklyResponse.success && weeklyResponse.data) {
                    const weeklyData = weeklyResponse.data;
                    const weeklyRaw = weeklyData.average ?? weeklyData.score ?? null;
                    setWeeklyAverage(
                        weeklyRaw === null || weeklyRaw === undefined || Number.isNaN(Number(weeklyRaw))
                            ? null
                            : Number(weeklyRaw)
                    );
                } else if (weeklyResponse.error?.code === 'HTTP_401') {
                    setWeeklyAverage(null);
                }
            }

            if (timeRange === 'monthly') {
                const monthlyResponse = await api.get<{ average?: number; score?: number | null }>('/analytics/productivity/score/monthly');
                if (monthlyResponse.success && monthlyResponse.data) {
                    const monthlyData = monthlyResponse.data;
                    const monthlyRaw = monthlyData.average ?? monthlyData.score ?? null;
                    setMonthlyAverage(
                        monthlyRaw === null || monthlyRaw === undefined || Number.isNaN(Number(monthlyRaw))
                            ? null
                            : Number(monthlyRaw)
                    );
                } else if (monthlyResponse.error?.code === 'HTTP_401') {
                    setMonthlyAverage(null);
                }
            }
        } catch (err: any) {
            console.warn('Productivity averages sync:', err?.message || err);
            setError(err.message);
        }
    }, [timeRange, isAuthenticated]);

    const refresh = useCallback(async () => {
        await Promise.all([fetchToday(), fetchAverages()]);
    }, [fetchToday, fetchAverages]);

    // Initial loads: today once per session, averages on time-range change.
    useEffect(() => {
        fetchToday();
    }, [fetchToday]);

    useEffect(() => {
        fetchAverages();
    }, [fetchAverages]);

    // Polling + realtime events refresh everything.
    useAnalyticsAutoRefresh(refresh, isAuthenticated, {
        events: REALTIME_EVENTS,
        intervalMs: 5 * 60 * 1000,
        initialLoad: false,
    });

    return {
        score,
        weeklyAverage,
        monthlyAverage,
        isLoading,
        error,
        refresh,
    };
}
