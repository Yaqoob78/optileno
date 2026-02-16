// frontend/src/hooks/useAIIntelligence.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';
import { api } from '../services/api/client';
import { useUserStore } from '../stores/useUserStore';

export interface AIIntelligenceMetrics {
    strategic_planning: number;
    execution_intelligence: number;
    ai_collaboration: number;
    adaptive_capacity: number;
    cognitive_consistency: number;
    self_regulation: number;
    big_five_modifier: number;
}

export interface AIIntelligenceData {
    ready?: boolean;
    status?: 'ready' | 'pending';
    message?: string;
    score?: number | null;
    category?: string;
    score_version?: string;
    strengths?: string[];
    growth_areas?: string[];
    primary_insight?: string;
    metrics?: AIIntelligenceMetrics;
    weights?: Record<string, number>;
    // Legacy fields kept for backward compat
    trend?: 'up' | 'down' | 'stable';
    trend_percent?: number;
    context_label?: string;
    sparkline_7d?: number[];
    confidence?: number;
    error_fallback?: boolean;
    reason?: string;
}

export function useAIIntelligence(timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily') {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const [data, setData] = useState<AIIntelligenceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const normalizeData = useCallback((payload: any): AIIntelligenceData => {
        const metricsRaw = payload.metrics || {};

        // V3 metrics with backward-compatible fallbacks for any in-flight V2 data
        const normalizedMetrics: AIIntelligenceMetrics = {
            strategic_planning: Number(
                metricsRaw.strategic_planning ?? metricsRaw.planning_quality ?? 0
            ),
            execution_intelligence: Number(
                metricsRaw.execution_intelligence ?? metricsRaw.execution_quality ?? 0
            ),
            ai_collaboration: Number(
                metricsRaw.ai_collaboration ?? metricsRaw.adaptation_to_insights ?? 0
            ),
            adaptive_capacity: Number(
                metricsRaw.adaptive_capacity ?? metricsRaw.adaptation_reflection ?? 0
            ),
            cognitive_consistency: Number(
                metricsRaw.cognitive_consistency ?? metricsRaw.consistency ?? metricsRaw.behavioral_stability ?? 0
            ),
            self_regulation: Number(
                metricsRaw.self_regulation ?? metricsRaw.cognitive_profile ?? 0
            ),
            big_five_modifier: Number(metricsRaw.big_five_modifier ?? 0),
        };

        return {
            ...payload,
            score: payload.score ?? null,
            category: payload.category || 'Calibrating',
            strengths: Array.isArray(payload.strengths) ? payload.strengths : [],
            growth_areas: Array.isArray(payload.growth_areas) ? payload.growth_areas : [],
            primary_insight: payload.primary_insight || '',
            metrics: normalizedMetrics,
            weights: payload.weights || {},
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
    }, [fetchScore, isAuthenticated]);

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
