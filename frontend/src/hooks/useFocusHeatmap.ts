// frontend/src/hooks/useFocusHeatmap.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

interface FocusBreakdown {
    task_points: number;
    habit_points: number;
    deep_work_points: number;
    goal_alignment_points: number;
    planning_engagement_points: number;
}

interface FocusColor {
    color: string;
    label: string;
}

interface DailyScore {
    date: string;
    day?: number;
    score: number | null;
    raw_score?: number;
    breakdown?: FocusBreakdown;
    activities?: string[];
    color: FocusColor | null;
}

interface WeeklyData {
    daily_scores: DailyScore[];
    weekly_average: number;
    peak_day: DailyScore | null;
    lowest_day: DailyScore | null;
}

interface HeatmapData {
    year: number;
    month: number;
    weeks: Array<Array<DailyScore | null>>;
    monthly_average: number;
    previous_month_average: number;
    rise_percentage: number;
    consistency_score: number;
    peak_day: DailyScore | null;
    lowest_day: DailyScore | null;
}

interface FocusStats {
    current_focus: {
        score: number;
        breakdown: FocusBreakdown;
        color: FocusColor;
    };
    weekly: {
        average: number;
        change: number;
        trend: 'up' | 'down' | 'stable';
        peak_day: string | null;
        peak_score: number;
        lowest_day: string | null;
        lowest_score: number;
    };
    monthly: {
        average: number;
        rise: number;
        trend: 'up' | 'down' | 'stable';
        consistency: number;
    };
    activities_today: string[];
}

interface UseFocusHeatmapReturn {
    // Data
    todayScore: DailyScore | null;
    weeklyData: WeeklyData | null;
    heatmapData: HeatmapData | null;
    stats: FocusStats | null;

    // State
    isLoading: boolean;
    error: string | null;

    // Actions
    refresh: () => Promise<void>;
    fetchToday: () => Promise<void>;
    fetchWeekly: () => Promise<void>;
    fetchHeatmap: (year?: number, month?: number) => Promise<void>;
    fetchStats: () => Promise<void>;
}

/**
 * Hook for accessing focus heatmap data with real-time updates.
 * Automatically refreshes when productivity events occur via WebSocket.
 */
export function useFocusHeatmap(): UseFocusHeatmapReturn {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [todayScore, setTodayScore] = useState<DailyScore | null>(null);
    const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
    const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
    const [stats, setStats] = useState<FocusStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch today's score
    const fetchToday = useCallback(async () => {
        if (!isAuthenticated) {
            setTodayScore(null);
            return;
        }

        try {
            const response = await api.get<DailyScore>('/analytics/focus/today');
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setTodayScore(null);
                    return;
                }
                throw new Error(response.error?.message || "Failed to fetch today's focus score");
            }
            setTodayScore(response.data);
        } catch (err: any) {
            console.error('Error fetching today\'s focus:', err);
            setError(err.message);
        }
    }, [isAuthenticated]);

    // Fetch weekly data
    const fetchWeekly = useCallback(async () => {
        if (!isAuthenticated) {
            setWeeklyData(null);
            return;
        }

        try {
            const response = await api.get<WeeklyData>('/analytics/focus/weekly');
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setWeeklyData(null);
                    return;
                }
                throw new Error(response.error?.message || 'Failed to fetch weekly focus data');
            }
            setWeeklyData(response.data);
        } catch (err: any) {
            console.error('Error fetching weekly focus:', err);
            setError(err.message);
        }
    }, [isAuthenticated]);

    // Fetch monthly heatmap
    const fetchHeatmap = useCallback(async (year?: number, month?: number) => {
        if (!isAuthenticated) {
            setHeatmapData(null);
            return;
        }

        try {
            let url = '/analytics/focus/heatmap';
            if (year && month) {
                url += `?year=${year}&month=${month}`;
            }

            const response = await api.get<HeatmapData>(url);
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setHeatmapData(null);
                    return;
                }
                throw new Error(response.error?.message || 'Failed to fetch focus heatmap');
            }
            setHeatmapData(response.data);
        } catch (err: any) {
            console.error('Error fetching heatmap:', err);
            setError(err.message);
        }
    }, [isAuthenticated]);

    // Fetch comprehensive stats
    const fetchStats = useCallback(async () => {
        if (!isAuthenticated) {
            setStats(null);
            return;
        }

        try {
            const response = await api.get<FocusStats>('/analytics/focus/stats');
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setStats(null);
                    return;
                }
                throw new Error(response.error?.message || 'Failed to fetch focus stats');
            }
            setStats(response.data);
        } catch (err: any) {
            console.error('Error fetching focus stats:', err);
            setError(err.message);
        }
    }, [isAuthenticated]);

    // Refresh all data
    const refresh = useCallback(async () => {
        if (!isAuthenticated) {
            setTodayScore(null);
            setWeeklyData(null);
            setHeatmapData(null);
            setStats(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await Promise.all([
                fetchToday(),
                fetchWeekly(),
                fetchHeatmap(),
                fetchStats(),
            ]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [fetchToday, fetchWeekly, fetchHeatmap, fetchStats, isAuthenticated]);

    // Initial load
    useEffect(() => {
        if (!isAuthenticated) return;
        refresh();
    }, [refresh, isAuthenticated]);

    // Listen for real-time focus score updates via WebSocket
    useEffect(() => {
        if (!isAuthenticated) return;
        if (!realtimeClient.isConnected()) return;

        const handleFocusUpdate = (data: any) => {
            console.log('📊 Focus score updated via WebSocket:', data);

            // Update today's score immediately
            if (data.score !== undefined) {
                setTodayScore({
                    date: new Date().toISOString().split('T')[0],
                    score: data.score,
                    breakdown: data.breakdown,
                    color: data.color,
                    activities: [],
                });

                // Also update stats current_focus
                setStats(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        current_focus: {
                            score: data.score,
                            breakdown: data.breakdown || prev.current_focus.breakdown,
                            color: data.color || prev.current_focus.color,
                        },
                    };
                });
            }

            // Dispatch custom event for components that listen directly
            window.dispatchEvent(new CustomEvent('focus_update', { detail: data }));
        };

        const handleRefreshToday = () => fetchToday();

        // Listen for various productivity events that affect focus score
        realtimeClient.on('analytics:focus:updated', handleFocusUpdate);
        realtimeClient.on('planner:task:updated', handleRefreshToday);
        realtimeClient.on('planner:habit:completed', handleRefreshToday);
        realtimeClient.on('planner:deepwork:completed', handleRefreshToday);

        return () => {
            realtimeClient.off('analytics:focus:updated', handleFocusUpdate);
            realtimeClient.off('planner:task:updated', handleRefreshToday);
            realtimeClient.off('planner:habit:completed', handleRefreshToday);
            realtimeClient.off('planner:deepwork:completed', handleRefreshToday);
        };
    }, [fetchToday, isAuthenticated]);

    return {
        todayScore,
        weeklyData,
        heatmapData,
        stats,
        isLoading,
        error,
        refresh,
        fetchToday,
        fetchWeekly,
        fetchHeatmap,
        fetchStats,
    };
}

export type { DailyScore, WeeklyData, HeatmapData, FocusStats, FocusBreakdown };
