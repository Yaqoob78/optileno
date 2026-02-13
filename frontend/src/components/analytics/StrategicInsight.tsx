// frontend/src/components/analytics/StrategicInsight.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, CheckCircle, Zap, Loader2, ArrowRight } from 'lucide-react';
import { realtimeClient } from '../../services/realtime/socket-client';
import '../../styles/components/analytics/StrategicInsight.css';

interface InsightData {
    id: number;
    title: string;
    description: string;
    confidence: number;
    applied_at: string | null;
    type: string;
    generated_at?: string | null;
    evidence?: string[];
    data_points?: number;
    impact?: string;
}

const StrategicInsight: React.FC = () => {
    const [insight, setInsight] = useState<InsightData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasLoadedInsightRef = useRef(false);

    const fetchInsight = useCallback(async (options?: { background?: boolean }) => {
        const isBackgroundRefresh = options?.background ?? false;
        const showLoading = !isBackgroundRefresh && !hasLoadedInsightRef.current;

        try {
            if (showLoading) {
                setIsLoading(true);
            }
            setError(null);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/v1/analytics/strategic-insight', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch insight');
            const data = await response.json();
            setInsight(data);
            hasLoadedInsightRef.current = true;
        } catch (err: any) {
            setError(err.message);
        } finally {
            if (showLoading) {
                setIsLoading(false);
            }
        }
    }, []);

    const applyInsight = useCallback(async () => {
        if (!insight || insight.applied_at) return;

        try {
            setIsApplying(true);
            setError(null);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/v1/analytics/strategic-insight/apply', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ insight_id: insight.id })
            });

            if (!response.ok) throw new Error('Failed to apply insight');

            const result = await response.json();
            setInsight({ ...insight, applied_at: result.applied_at });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsApplying(false);
        }
    }, [insight]);

    useEffect(() => {
        fetchInsight();
    }, [fetchInsight]);

    // Keep strategic insight fresh as user activity changes.
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        const queueRefresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                fetchInsight({ background: true });
            }, 3000); // 3s debounce to prevent request spam from rapid events
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
    }, [fetchInsight]);

    useEffect(() => {
        const interval = setInterval(() => fetchInsight({ background: true }), 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchInsight]);

    if (isLoading) {
        return (
            <div className="loading-placeholder">
                <Loader2 className="spinning" size={24} />
                <span>Synthesizing Strategy...</span>
            </div>
        );
    }

    if (!insight || insight.type === 'awaiting_data') {
        return (
            <div className="strategic-insight-container">
                <div className="insight-main">
                    <h4 className="insight-title-text">Awaiting Data</h4>
                    <p className="insight-description">
                        {insight?.description || "Leno is observing your patterns. High-impact strategies will appear shortly."}
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
            <div className="insight-header">
                <div className="confidence-badge">
                    {insight.confidence}% MATCH
                </div>
                <Sparkles size={16} className="text-accent" />
            </div>

            <div className="insight-main">
                <h3 className="insight-title-text">{insight.title}</h3>
                <p className="insight-description">{insight.description}</p>
                {insight.evidence && insight.evidence.length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '12px', opacity: 0.85 }}>
                        {insight.evidence.slice(0, 2).map((item, idx) => (
                            <div key={idx}>- {item}</div>
                        ))}
                    </div>
                )}
                {insight.data_points !== undefined && (
                    <div style={{ marginTop: '0.5rem', fontSize: '11px', opacity: 0.7 }}>
                        Based on {insight.data_points} completed tasks in the last 30 days.
                    </div>
                )}
                {error && (
                    <div style={{ marginTop: '0.5rem', fontSize: '11px', opacity: 0.7 }}>
                        Last action error: {error}
                    </div>
                )}
            </div>

            <div className="insight-actions">
                {insight.applied_at ? (
                    <>
                        <div className="applied-state">
                            <CheckCircle size={18} />
                            Implemented
                        </div>
                        <div className="last-applied-meta">
                            Applied on {new Date(insight.applied_at).toLocaleDateString()}
                        </div>
                    </>
                ) : (
                    <button
                        className="apply-button"
                        onClick={applyInsight}
                        disabled={isApplying}
                    >
                        {isApplying ? (
                            <Loader2 className="spinning" size={18} />
                        ) : (
                            <>
                                <Zap size={18} />
                                Apply Strategic Optimization
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default StrategicInsight;
