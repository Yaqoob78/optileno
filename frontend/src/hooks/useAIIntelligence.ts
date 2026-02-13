// frontend/src/hooks/useAIIntelligence.ts
import { useState, useEffect, useCallback } from 'react';
import { realtimeClient } from '../services/realtime/socket-client';

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
    const [data, setData] = useState<AIIntelligenceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchScore = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            // yearly not really supported by backend AI score yet, default to monthly or handle in UI
            const queryRange = timeRange === 'yearly' ? 'monthly' : timeRange;

            const response = await fetch(`/api/v1/analytics/ai-intelligence?time_range=${queryRange}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch AI Intelligence Score');
            const jsonData = await response.json();
            setData(jsonData);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchScore();
    }, [fetchScore]); // Refetch when timeRange changes

    useEffect(() => {
        const interval = setInterval(fetchScore, 3 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchScore]);

    useEffect(() => {
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
    }, [fetchScore]);

    return { data, isLoading, error, refresh: fetchScore };
}
