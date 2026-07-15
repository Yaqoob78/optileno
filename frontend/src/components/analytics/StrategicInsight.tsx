// frontend/src/components/analytics/StrategicInsight.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Sparkles, CheckCircle, Zap, Loader2, ArrowRight,
    AlertTriangle, Target, Brain, Clock, Flame, Heart, MessageCircle, Dumbbell,
} from 'lucide-react';
import { realtimeClient } from '../../services/realtime/socket-client';
import { api } from '../../services/api/client';
import '../../styles/components/analytics/StrategicInsight.css';

interface InsightData {
    id: number;
    title: string;
    description: string;
    confidence: number;
    applied_at: string | null;
    type: string;
    severity: string;
    category: string;
    generated_at?: string | null;
    evidence?: string[];
    data_points?: number;
}

interface InsightsResponse {
    insights: InsightData[];
    count: number;
}

/** Severity → colors & accent */
const severityConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    positive: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', icon: <Sparkles size={14} /> },
    info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', icon: <Brain size={14} /> },
    medium: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', icon: <AlertTriangle size={14} /> },
    high: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', icon: <Flame size={14} /> },
};

/** Category → icon */
const categoryIcons: Record<string, React.ReactNode> = {
    planning: <Target size={13} />,
    consistency: <Clock size={13} />,
    wellbeing: <Heart size={13} />,
    focus: <Zap size={13} />,
    goals: <Target size={13} />,
    ai_collaboration: <MessageCircle size={13} />,
    habits: <Dumbbell size={13} />,
};

const StrategicInsight: React.FC = () => {
    const [insights, setInsights] = useState<InsightData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [applyingId, setApplyingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [applyFeedback, setApplyFeedback] = useState<string | null>(null);
    const hasLoadedRef = useRef(false);

    const fetchInsights = useCallback(async (options?: { background?: boolean }) => {
        const isBackground = options?.background ?? false;
        const showLoading = !isBackground && !hasLoadedRef.current;

        try {
            if (showLoading) setIsLoading(true);
            setError(null);

            const response = await api.get<InsightsResponse>('/analytics/strategic-insight');
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || 'Failed to fetch insights');
            }

            const data = response.data;
            // Handle both old single-insight and new multi-insight responses
            if (Array.isArray(data.insights)) {
                setInsights(data.insights);
            } else if ((data as any).title) {
                // Legacy single-insight response
                setInsights([data as any]);
            }
            hasLoadedRef.current = true;
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    }, []);

    const applyInsight = useCallback(async (insightId: number) => {
        if (insightId === 0) return; // awaiting data

        try {
            setApplyingId(insightId);
            setError(null);
            const response = await api.post<{ applied_at?: string; message?: string }>('/analytics/strategic-insight/apply', { insight_id: insightId });
            if (!response.success) {
                throw new Error(response.error?.message || 'Failed to apply insight');
            }
            // Update the insight locally and surface what actually happened
            // (the backend may have created a planner task from this insight)
            setInsights(prev => prev.map(ins =>
                ins.id === insightId
                    ? { ...ins, applied_at: response.data?.applied_at || new Date().toISOString() }
                    : ins
            ));
            if (response.data?.message) {
                setApplyFeedback(response.data.message);
                window.setTimeout(() => setApplyFeedback(null), 5000);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setApplyingId(null);
        }
    }, []);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => fetchInsights({ background: true }), 3000);
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
    }, [fetchInsights]);

    useEffect(() => {
        const interval = setInterval(() => fetchInsights({ background: true }), 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchInsights]);

    if (isLoading) {
        return (
            <div className="loading-placeholder">
                <Loader2 className="spinning" size={24} />
                <span>Analyzing your work patterns...</span>
            </div>
        );
    }

    if (insights.length === 0 || (insights.length === 1 && insights[0].type === 'awaiting_data')) {
        const awaiting = insights[0];
        return (
            <div className="strategic-insight-container">
                <div className="insight-main">
                    <h4 className="insight-title-text">Nothing to suggest yet</h4>
                    <p className="insight-description">
                        {awaiting?.description || "Once you've logged a few tasks and sessions, Leno will suggest what to focus on next."}
                    </p>
                    {error && (
                        <p className="insight-description" style={{ marginTop: '0.5rem', opacity: 0.85 }}>
                            Connection issue: {error}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="strategic-insight-container">
            <div className="strategic-insight-header-bar">
                <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7 }}>
                    Strategic Insights ({insights.length})
                </span>
            </div>

            <div className="strategic-insights-list">
                {insights.map((insight) => {
                    const severity = severityConfig[insight.severity] || severityConfig.info;
                    const catIcon = categoryIcons[insight.category] || <Zap size={13} />;
                    const isApplying = applyingId === insight.id;

                    return (
                        <div
                            key={insight.id}
                            className="strategic-insight-card"
                            style={{ borderLeftColor: severity.color }}
                        >
                            <div className="strategic-insight-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '22px', height: '22px', borderRadius: '6px',
                                        background: severity.bg, color: severity.color,
                                    }}>
                                        {severity.icon}
                                    </span>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                                        color: severity.color, letterSpacing: '0.3px',
                                    }}>
                                        {insight.category?.replace('_', ' ') || 'insight'}
                                    </span>
                                </div>
                                <span className="confidence-badge" style={{
                                    background: severity.bg, color: severity.color,
                                    border: `1px solid ${severity.color}40`,
                                }}>
                                    {insight.confidence}% MATCH
                                </span>
                            </div>

                            <h4 className="insight-title-text" style={{ fontSize: '1rem', marginTop: '6px' }}>
                                {insight.title}
                            </h4>
                            <p className="insight-description" style={{ fontSize: '0.85rem' }}>
                                {insight.description}
                            </p>

                            {insight.evidence && insight.evidence.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '11px', opacity: 0.75 }}>
                                    {insight.evidence.slice(0, 2).map((item, idx) => (
                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                            {catIcon}
                                            <span>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: '10px' }}>
                                {insight.applied_at ? (
                                    <div className="applied-state" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                                        <CheckCircle size={14} />
                                        Implemented
                                        <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '4px' }}>
                                            {new Date(insight.applied_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        className="apply-button"
                                        onClick={() => applyInsight(insight.id)}
                                        disabled={isApplying || insight.id === 0}
                                        style={{ padding: '0.6rem', fontSize: '0.8rem' }}
                                    >
                                        {isApplying ? (
                                            <Loader2 className="spinning" size={14} />
                                        ) : (
                                            <>
                                                <Zap size={14} />
                                                Apply
                                                <ArrowRight size={12} />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {applyFeedback && (
                <div style={{ fontSize: '11px', color: 'var(--success, #10b981)', marginTop: '8px', padding: '0 4px' }} role="status">
                    {applyFeedback}
                </div>
            )}

            {error && (
                <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '8px', padding: '0 4px' }}>
                    {error}
                </div>
            )}
        </div>
    );
};

export default StrategicInsight;
