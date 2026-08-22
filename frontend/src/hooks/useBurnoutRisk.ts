// frontend/src/hooks/useBurnoutRisk.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsAutoRefresh } from './useAnalyticsAutoRefresh';

interface BurnoutBreakdown {
    workload_strain: number;
    strain_velocity: number;
    offline_gap_risk: number;
    rest_day_violation: number;
    recovery_deficit: number;
    focus_volatility: number;
    goal_progress_pressure: number;
    deadline_compression: number;
    engagement_extremes: number;
    mood_modulation: number;
}

interface BurnoutRisk {
    risk: number | null;
    date: string;
    level: string | null;
    breakdown: BurnoutBreakdown;
    ai_insights: string[];
    recommendation: string;
}

interface BurnoutAverageData {
    average_risk: number | null;
    level: string | null;
    period: string;
    days: number;
    note?: string;
}

interface UseBurnoutRiskReturn {
    risk: BurnoutRisk | null;
    weeklyAverage: BurnoutAverageData | null;
    monthlyData: BurnoutAverageData | null;
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

export function useBurnoutRisk(
    timeRange: 'daily' | 'weekly' | 'monthly' = 'daily',
    enabled: boolean = true
): UseBurnoutRiskReturn {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const isEnabled = enabled && isAuthenticated;
    const [risk, setRisk] = useState<BurnoutRisk | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<BurnoutAverageData | null>(null);
    const [monthlyData, setMonthlyData] = useState<BurnoutAverageData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Today's risk is time-range independent — fetched once per session,
    // then only on polling/realtime updates (not on tab switches).
    const fetchToday = useCallback(async () => {
        if (!isEnabled) {
            setRisk(null);
            setWeeklyAverage(null);
            setMonthlyData(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const todayResponse = await api.get<BurnoutRisk>('/analytics/burnout/risk/today');
            if (!todayResponse.success || !todayResponse.data) {
                if (todayResponse.error?.code === 'HTTP_401' || todayResponse.error?.code === 'HTTP_403') {
                    setRisk(null);
                    setWeeklyAverage(null);
                    setMonthlyData(null);
                    setError(null);
                    return;
                }
                throw new Error(todayResponse.error?.message || 'Failed to fetch burnout risk');
            }
            const todayPayload = todayResponse.data as any;
            const parsedRisk =
                todayPayload.risk === null || todayPayload.risk === undefined || Number.isNaN(Number(todayPayload.risk))
                    ? null
                    : Number(todayPayload.risk);

            if (todayPayload.error_fallback || todayPayload.status === 'unavailable' || parsedRisk === null) {
                setRisk(null);
                setWeeklyAverage(null);
                setMonthlyData(null);
                setError(
                    typeof todayPayload.message === 'string'
                        ? todayPayload.message
                        : 'Burnout risk is temporarily unavailable.'
                );
                return;
            }

            // V3 breakdown with backward-compatible fallbacks
            setRisk({
                risk: parsedRisk,
                date: todayPayload.period_end || todayPayload.date || new Date().toISOString(),
                level: todayPayload.level ? String(todayPayload.level) : null,
                breakdown: {
                    workload_strain: Number(todayPayload.breakdown?.workload_strain ?? 0),
                    strain_velocity: Number(todayPayload.breakdown?.strain_velocity ?? 0),
                    offline_gap_risk: Number(todayPayload.breakdown?.offline_gap_risk ?? 0),
                    rest_day_violation: Number(todayPayload.breakdown?.rest_day_violation ?? 0),
                    recovery_deficit: Number(todayPayload.breakdown?.recovery_deficit ?? 0),
                    focus_volatility: Number(todayPayload.breakdown?.focus_volatility ?? 0),
                    goal_progress_pressure: Number(todayPayload.breakdown?.goal_progress_pressure ?? 0),
                    deadline_compression: Number(todayPayload.breakdown?.deadline_compression ?? 0),
                    engagement_extremes: Number(todayPayload.breakdown?.engagement_extremes ?? 0),
                    mood_modulation: Number(todayPayload.breakdown?.mood_modulation ?? 0),
                },
                ai_insights: Array.isArray(todayPayload.ai_insights)
                    ? todayPayload.ai_insights
                    : [`Current burnout risk is ${String(todayPayload.level || 'moderate')}.`],
                recommendation: String(todayPayload.recommendation || 'Keep workload and recovery balanced this week.'),
            });
        } catch (err: any) {
            console.error('Error fetching burnout risk:', err);
            // Keep the last good reading on transient refresh failures
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [isEnabled]);

    // Averages depend on the selected time range.
    const fetchAverages = useCallback(async () => {
        if (!isEnabled) {
            setWeeklyAverage(null);
            setMonthlyData(null);
            return;
        }

        try {
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await api.get<BurnoutAverageData>('/analytics/burnout/risk/weekly');
                if (weeklyResponse.success && weeklyResponse.data) {
                    const weeklyPayload = weeklyResponse.data as any;
                    const weeklyRisk =
                        weeklyPayload.average_risk === null || weeklyPayload.average_risk === undefined || Number.isNaN(Number(weeklyPayload.average_risk))
                            ? null
                            : Number(weeklyPayload.average_risk);
                    if (weeklyRisk === null) {
                        setWeeklyAverage(null);
                    } else {
                        setWeeklyAverage({
                            average_risk: weeklyRisk,
                            level: weeklyPayload.level ? String(weeklyPayload.level) : null,
                            period: String(weeklyPayload.period || 'weekly'),
                            days: Number(weeklyPayload.days ?? 7),
                            note: typeof weeklyPayload.note === 'string' ? weeklyPayload.note : undefined,
                        });
                    }
                } else if (weeklyResponse.error?.code === 'HTTP_401' || weeklyResponse.error?.code === 'HTTP_403') {
                    setWeeklyAverage(null);
                }
            }

            if (timeRange === 'monthly') {
                const monthlyResponse = await api.get<BurnoutAverageData>('/analytics/burnout/risk/monthly');
                if (monthlyResponse.success && monthlyResponse.data) {
                    const monthlyPayload = monthlyResponse.data as any;
                    const monthlyRisk =
                        monthlyPayload.average_risk === null || monthlyPayload.average_risk === undefined || Number.isNaN(Number(monthlyPayload.average_risk))
                            ? null
                            : Number(monthlyPayload.average_risk);
                    if (monthlyRisk === null) {
                        setMonthlyData(null);
                    } else {
                        setMonthlyData({
                            average_risk: monthlyRisk,
                            level: monthlyPayload.level ? String(monthlyPayload.level) : null,
                            period: String(monthlyPayload.period || 'monthly'),
                            days: Number(monthlyPayload.days ?? 30),
                            note: typeof monthlyPayload.note === 'string' ? monthlyPayload.note : undefined,
                        });
                    }
                } else if (monthlyResponse.error?.code === 'HTTP_401' || monthlyResponse.error?.code === 'HTTP_403') {
                    setMonthlyData(null);
                }
            }
        } catch (err: any) {
            console.error('Error fetching burnout averages:', err);
            setError(err.message);
        }
    }, [timeRange, isEnabled]);

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
    // Burnout keeps a shorter cadence and slightly longer debounce than the
    // other score hooks so heavy work sessions surface quickly without churn.
    useAnalyticsAutoRefresh(refresh, isEnabled, {
        events: REALTIME_EVENTS,
        intervalMs: 3 * 60 * 1000,
        debounceMs: 350,
        initialLoad: false,
    });

    return {
        risk,
        weeklyAverage,
        monthlyData,
        isLoading,
        error,
        refresh,
    };
}
