// frontend/src/hooks/useBurnoutRisk.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';

interface BurnoutBreakdown {
    time_based: number;
    workload: number;
    chat_sentiment: number;
    deep_work_intensity: number;
    recovery_bonus: number;
}

interface BurnoutRisk {
    risk: number;
    date: string;
    level: string;
    breakdown: BurnoutBreakdown;
    ai_insights: string[];
    recommendation: string;
}

interface BurnoutAverageData {
    average_risk: number;
    level: string;
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

export function useBurnoutRisk(timeRange: 'daily' | 'weekly' | 'monthly' = 'daily'): UseBurnoutRiskReturn {
    const [risk, setRisk] = useState<BurnoutRisk | null>(null);
    const [weeklyAverage, setWeeklyAverage] = useState<BurnoutAverageData | null>(null);
    const [monthlyData, setMonthlyData] = useState<BurnoutAverageData | null>(null);
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

            // Fetch today's risk
            const todayResponse = await fetch('/api/v1/analytics/burnout/risk/today', {
                headers: getAuthHeaders(),
            });

            if (!todayResponse.ok) {
                throw new Error('Failed to fetch burnout risk');
            }

            const todayData = await todayResponse.json();
            setRisk(todayData);

            // Fetch weekly average if needed
            if (timeRange === 'weekly' || timeRange === 'monthly') {
                const weeklyResponse = await fetch('/api/v1/analytics/burnout/risk/weekly', {
                    headers: getAuthHeaders(),
                });

                if (weeklyResponse.ok) {
                    const weeklyData = await weeklyResponse.json();
                    setWeeklyAverage(weeklyData);
                }
            }

            // Fetch monthly data (always 0)
            if (timeRange === 'monthly') {
                const monthlyResponse = await fetch('/api/v1/analytics/burnout/risk/monthly', {
                    headers: getAuthHeaders(),
                });

                if (monthlyResponse.ok) {
                    const monthlyDataResponse = await monthlyResponse.json();
                    setMonthlyData(monthlyDataResponse);
                }
            }
        } catch (err: any) {
            console.error('Error fetching burnout risk:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [getAuthHeaders, timeRange]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Refresh every 3 minutes (more frequent for burnout monitoring)
    useEffect(() => {
        const interval = setInterval(refresh, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh]);

    // Refresh risk quickly when work patterns change
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                refresh();
            }, 350);
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
        risk,
        weeklyAverage,
        monthlyData,
        isLoading,
        error,
        refresh,
    };
}
