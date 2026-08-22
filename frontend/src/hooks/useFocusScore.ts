// frontend/src/hooks/useFocusScore.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsAutoRefresh } from './useAnalyticsAutoRefresh';

interface FocusBreakdown {
    session_duration: number;
    session_quality: number;
    consistency: number;
    peak_performance: number;
    distraction_resistance: number;
}

interface FocusScore {
    score: number | null;
    date: string;
    total_minutes: number;
    heatmap_average: number;
    breakdown: FocusBreakdown;
    grade: string | null;
    status: string | null;
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

const REALTIME_EVENTS = [
    'analytics:focus:updated',
    'analytics:update',
    'planner:task:updated',
    'planner:habit:completed',
    'planner:deepwork:completed',
];

export function useFocusScore(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): UseFocusScoreReturn {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [score, setScore] = useState<FocusScore | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<FocusAverageData | null>(null);
    const [monthlyAverage, setMonthlyAverage] = useState<FocusAverageData | null>(null);
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

            const todayResponse = await api.get<FocusScore>('/analytics/focus/score/today');
            if (!todayResponse.success || !todayResponse.data) {
                if (todayResponse.error?.code === 'HTTP_401') {
                    setScore(null);
                    setError(null);
                    return;
                }
                throw new Error(todayResponse.error?.message || 'Failed to fetch focus score');
            }
            const todayPayload = todayResponse.data as any;
            const parsedScore =
                todayPayload.score === null || todayPayload.score === undefined || Number.isNaN(Number(todayPayload.score))
                    ? null
                    : Number(todayPayload.score);
            const normalizedBreakdown: FocusBreakdown = {
                session_duration: Number(todayPayload.breakdown?.session_duration ?? todayPayload.breakdown?.deep_work_component ?? 0),
                session_quality: Number(todayPayload.breakdown?.session_quality ?? todayPayload.breakdown?.task_component ?? 0),
                consistency: Number(todayPayload.breakdown?.consistency ?? todayPayload.breakdown?.goal_alignment_component ?? 0),
                peak_performance: Number(todayPayload.breakdown?.peak_performance ?? parsedScore ?? 0),
                distraction_resistance: Number(todayPayload.breakdown?.distraction_resistance ?? 0),
            };
            setScore({
                score: parsedScore,
                date: todayPayload.period_end || todayPayload.date || new Date().toISOString(),
                total_minutes: Number(todayPayload.total_minutes ?? todayPayload.inputs?.deep_work_minutes ?? 0),
                heatmap_average: Number(todayPayload.heatmap_average ?? parsedScore ?? 0),
                breakdown: normalizedBreakdown,
                grade: todayPayload.grade || null,
                status: todayPayload.status || todayPayload.level || null,
            });
        } catch (err: any) {
            console.error('Error fetching focus score:', err);
            // Keep the last good score on transient refresh failures
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
                const weeklyResponse = await api.get<FocusAverageData>('/analytics/focus/score/weekly');
                if (weeklyResponse.success && weeklyResponse.data) {
                    const weeklyPayload = weeklyResponse.data as any;
                    const weeklyRaw = weeklyPayload.average_score ?? weeklyPayload.score ?? null;
                    if (weeklyRaw === null || weeklyRaw === undefined || Number.isNaN(Number(weeklyRaw))) {
                        setWeeklyAverage(null);
                    } else {
                        setWeeklyAverage({
                            average_score: Number(weeklyRaw),
                            average_minutes: Number(weeklyPayload.average_minutes ?? 0),
                            period: weeklyPayload.period || 'weekly',
                            days: Number(weeklyPayload.days ?? 7),
                        });
                    }
                } else if (weeklyResponse.error?.code === 'HTTP_401') {
                    setWeeklyAverage(null);
                }
            }

            if (timeRange === 'monthly') {
                const monthlyResponse = await api.get<FocusAverageData>('/analytics/focus/score/monthly');
                if (monthlyResponse.success && monthlyResponse.data) {
                    const monthlyPayload = monthlyResponse.data as any;
                    const monthlyRaw = monthlyPayload.average_score ?? monthlyPayload.score ?? null;
                    if (monthlyRaw === null || monthlyRaw === undefined || Number.isNaN(Number(monthlyRaw))) {
                        setMonthlyAverage(null);
                    } else {
                        setMonthlyAverage({
                            average_score: Number(monthlyRaw),
                            average_minutes: Number(monthlyPayload.average_minutes ?? 0),
                            period: monthlyPayload.period || 'monthly',
                            days: Number(monthlyPayload.days ?? 30),
                        });
                    }
                } else if (monthlyResponse.error?.code === 'HTTP_401') {
                    setMonthlyAverage(null);
                }
            }
        } catch (err: any) {
            console.error('Error fetching focus averages:', err);
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
