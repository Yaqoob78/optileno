// frontend/src/hooks/useAIIntelligence.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

export interface AIIntelligenceData {
    ready?: boolean;
    status?: 'ready' | 'pending';
    message?: string;
    score?: number;
    category?: string;
    trend?: 'up' | 'down' | 'stable';
    trend_percent?: number;
    metrics?: {
        planning_quality: number;
        execution_intelligence: number;
        adaptation_reflection: number;
        behavioral_stability: number;
        learning_growth?: number;
    };
    context_label?: string;
    volatility?: number;
    best_day_score?: number;
    worst_day_score?: number;
    last_updated?: string;
    baseline?: {
        label?: string;
        score?: number;
        delta?: number;
        samples?: number;
    } | null;
    coverage?: {
        level?: 'low' | 'medium' | 'high';
        confidence?: number;
        tasks_created?: number;
        tasks_completed?: number;
        plans_created?: number;
        deep_work_sessions?: number;
        chat_messages?: number;
        insights_read?: number;
        events?: number;
        active_days?: number;
    };
    drivers?: Array<{
        direction?: 'up' | 'down' | 'neutral';
        label: string;
        detail?: string;
    }>;
    next_actions?: Array<{
        label: string;
        detail?: string;
        target?: string;
    }>;
    confidence?: number;
    sparkline_7d?: number[];
    error_fallback?: boolean;
    requirements?: {
        tasks_completed_min?: number;
        habits_min?: number;
        interactions_min?: number;
    };
    counts?: {
        tasks_completed?: number;
        habits_created?: number;
        habits_completed?: number;
        interactions?: number;
        chat_messages?: number;
        insights_read?: number;
        deep_work_sessions?: number;
    };
}

export function useAIIntelligence(timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [data, setData] = useState<AIIntelligenceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const normalizeData = useCallback((payload: AIIntelligenceData): AIIntelligenceData => {
        const metricsRaw = (payload.metrics || {}) as any;
        const normalizedMetrics = payload.metrics
            ? {
                planning_quality: Number(metricsRaw.planning_quality ?? 0),
                execution_intelligence: Number(
                    metricsRaw.execution_intelligence ??
                    metricsRaw.execution_quality ??
                    0
                ),
                adaptation_reflection: Number(
                    metricsRaw.adaptation_reflection ??
                    metricsRaw.adaptation_to_insights ??
                    0
                ),
                behavioral_stability: Number(
                    metricsRaw.behavioral_stability ??
                    metricsRaw.consistency ??
                    0
                ),
                learning_growth: Number(
                    metricsRaw.learning_growth ??
                    metricsRaw.cognitive_profile ??
                    0
                ),
            }
            : undefined;

        return {
            ...payload,
            metrics: normalizedMetrics,
        };
    }, []);

    const fetchScore = useCallback(async () => {
        if (!isAuthenticated) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            // yearly not really supported by backend AI score yet, default to monthly or handle in UI
            const queryRange = timeRange === 'yearly' ? 'monthly' : timeRange;

            const response = await api.get<AIIntelligenceData>(`/analytics/ai-intelligence?time_range=${queryRange}`);
            if (!response.success || !response.data) {
                if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
                    setData(null);
                    setError(null);
                    return;
                }
                throw new Error(response.error?.message || 'Failed to fetch AI Intelligence Score');
            }
            setData(normalizeData(response.data));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [timeRange, isAuthenticated, normalizeData]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchScore();
    }, [fetchScore, isAuthenticated]); // Refetch when timeRange changes

    useEffect(() => {
        if (!isAuthenticated) return;
        const interval = setInterval(fetchScore, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchScore, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                fetchScore();
            }, 250);
        };

        realtimeClient.on('analytics:update', queueRefresh);
        realtimeClient.on('analytics:insight', queueRefresh);
        realtimeClient.on('planner:task:updated', queueRefresh);
        realtimeClient.on('planner:habit:completed', queueRefresh);
        realtimeClient.on('planner:deepwork:completed', queueRefresh);

        return () => {
            realtimeClient.off('analytics:update', queueRefresh);
            realtimeClient.off('analytics:insight', queueRefresh);
            realtimeClient.off('planner:task:updated', queueRefresh);
            realtimeClient.off('planner:habit:completed', queueRefresh);
            realtimeClient.off('planner:deepwork:completed', queueRefresh);
            if (timeout) clearTimeout(timeout);
        };
    }, [fetchScore, isAuthenticated]);

    return { data, isLoading, error, refresh: fetchScore };
}
