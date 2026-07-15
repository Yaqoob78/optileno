import React from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, Zap, Target, Lightbulb } from 'lucide-react';
import { useAIIntelligence } from '../../hooks/useAIIntelligence';

interface MetricBarProps {
    label: string;
    value: number;
    color: string;
    weight?: number;
}

const MetricBar: React.FC<MetricBarProps> = ({ label, value, color, weight }) => (
    <div className="metric-row" style={{ marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px', opacity: 0.8 }}>
            <span>{label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {weight && <span style={{ opacity: 0.4, fontSize: '9px' }}>{Math.round(weight * 100)}%</span>}
                <span>{Math.round(value)}</span>
            </span>
        </div>
        <div style={{ height: '3px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div
                style={{
                    height: '100%',
                    width: `${Math.min(value, 100)}%`,
                    background: color,
                    boxShadow: `0 0 5px ${color}`,
                    transition: 'width 0.8s ease'
                }}
            />
        </div>
    </div>
);

/** Mini sparkline SVG — plots 7 data points as a smooth polyline */
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number }> = ({
    data,
    width = 120,
    height = 32
}) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const points = data.map((v, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    const lastX = padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2);
    const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
            <polyline
                points={points}
                fill="none"
                stroke="url(#sparkGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx={lastX} cy={lastY} r="2.5" fill="var(--primary)" />
            <defs>
                <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="1" />
                </linearGradient>
            </defs>
        </svg>
    );
};

/** Calm waiting state — three soft rings, no circuitry theatre */
const ScorePlaceholder = () => (
    <div className="score-placeholder" aria-hidden="true">
        <span className="score-placeholder-ring" />
        <span className="score-placeholder-ring" />
        <span className="score-placeholder-ring" />
    </div>
);

/** Human-readable label for dimension keys */
const dimensionLabels: Record<string, string> = {
    strategic_planning: 'Planning',
    execution_intelligence: 'Execution',
    ai_collaboration: 'Working with Leno',
    adaptive_capacity: 'Adaptability',
    cognitive_consistency: 'Consistency',
    self_regulation: 'Follow-through',
};

const dimensionColors: Record<string, string> = {
    strategic_planning: '#7c3aed',
    execution_intelligence: '#06b6d4',
    ai_collaboration: '#3b82f6',
    adaptive_capacity: '#10b981',
    cognitive_consistency: '#f59e0b',
    self_regulation: '#ec4899',
};

const AIIntelligenceScore: React.FC<{ timeRange: string }> = ({ timeRange }) => {
    const { data, isLoading, error } = useAIIntelligence(timeRange as any);

    if (isLoading) {
        return (
            <div className="intelligence-analyzing">
                <ScorePlaceholder />
                <div className="analyzing-text">Reading your recent work…</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="intelligence-analyzing">
                <div className="analyzing-text">We couldn't load your score. Try refreshing.</div>
            </div>
        );
    }

    if (!data) return null;

    if (data.ready === false || data.status === 'pending' || data.score == null || data.error_fallback) {
        const pendingMessage = data.message || 'Your score appears once you have a few tasks and sessions logged.';
        const pendingParts = pendingMessage.split('. ').filter(Boolean);

        return (
            <div className="intelligence-analyzing">
                <ScorePlaceholder />
                <div className="analyzing-text">{pendingParts[0]}</div>
                {pendingParts[1] && (
                    <div className="analyzing-text">{pendingParts.slice(1).join('. ')}</div>
                )}
            </div>
        );
    }

    const metrics = data.metrics;
    const weights = data.weights || {};
    const trendPercent = typeof data.trend_percent === 'number' ? data.trend_percent : null;
    const trendText = trendPercent !== null
        ? `${trendPercent >= 0 ? '+' : ''}${trendPercent}%`
        : 'Live';
    const TrendIcon = trendPercent === null ? Minus : trendPercent >= 0 ? TrendingUp : TrendingDown;
    const trendClass = trendPercent === null ? 'neutral' : trendPercent >= 0 ? 'up' : 'down';
    const scoreValue = typeof data.score === 'number' ? Math.round(data.score) : 0;
    const categoryLabel = data.category || 'Building up';
    const sparkline = data.sparkline_7d;

    const strengths = data.strengths || [];
    const growthAreas = data.growth_areas || [];
    const primaryInsight = data.primary_insight || '';

    return (
        <div className="intelligence-card">
            <div className="intelligence-main">
                <div className="score-ring">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                        <circle
                            cx="70" cy="70" r="62"
                            fill="none"
                            stroke="var(--border-color)"
                            strokeWidth="6"
                            opacity="0.3"
                        />
                        <circle
                            cx="70" cy="70" r="62"
                            fill="none"
                            stroke="url(#aiGradient)"
                            strokeWidth="6"
                            strokeDasharray="390"
                            strokeDashoffset={390 - (390 * scoreValue) / 100}
                            strokeLinecap="round"
                            className="score-progress"
                        />
                        <defs>
                            <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#7c3aed" />
                                <stop offset="100%" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="score-content">
                        <div className="score-label">Score</div>
                        <div className="score-value">{scoreValue}</div>
                        <div className={`score-trend ${trendClass}`}>
                            <TrendIcon size={10} />
                            <span>{trendText}</span>
                        </div>
                    </div>
                </div>

                <div className="intelligence-category">
                    <div className="category-label">{categoryLabel}</div>
                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
                        {data.context_label || "Cognitive Performance"}
                    </div>
                    {sparkline && sparkline.length >= 2 && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkline data={sparkline} width={100} height={28} />
                            <span style={{ fontSize: '10px', opacity: 0.5 }}>7d</span>
                        </div>
                    )}
                </div>
            </div>

            {/* V3 Six-Dimension Metric Bars */}
            {metrics ? (
                <div className="intelligence-metrics" style={{ marginTop: '1.5rem', padding: '0 10px' }}>
                    <MetricBar
                        label="Strategy"
                        value={metrics.strategic_planning}
                        color={dimensionColors.strategic_planning}
                        weight={weights.strategic_planning}
                    />
                    <MetricBar
                        label="Execution"
                        value={metrics.execution_intelligence}
                        color={dimensionColors.execution_intelligence}
                        weight={weights.execution_intelligence}
                    />
                    <MetricBar
                        label="AI Synergy"
                        value={metrics.ai_collaboration}
                        color={dimensionColors.ai_collaboration}
                        weight={weights.ai_collaboration}
                    />
                    <MetricBar
                        label="Adaptability"
                        value={metrics.adaptive_capacity}
                        color={dimensionColors.adaptive_capacity}
                        weight={weights.adaptive_capacity}
                    />
                    <MetricBar
                        label="Consistency"
                        value={metrics.cognitive_consistency}
                        color={dimensionColors.cognitive_consistency}
                        weight={weights.cognitive_consistency}
                    />
                    <MetricBar
                        label="Self-Regulation"
                        value={metrics.self_regulation}
                        color={dimensionColors.self_regulation}
                        weight={weights.self_regulation}
                    />
                </div>
            ) : (
                <div className="intelligence-metrics" style={{ marginTop: '1.5rem', padding: '0 10px', opacity: 0.75, fontSize: '12px' }}>
                    Detailed component metrics are not available yet for this range.
                </div>
            )}

            {/* Strengths & Growth Areas */}
            {(strengths.length > 0 || growthAreas.length > 0) && (
                <div style={{ marginTop: '12px', padding: '0 10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {strengths.map((s) => (
                        <span
                            key={s}
                            style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                            }}
                        >
                            <Zap size={9} />
                            {dimensionLabels[s] || s}
                        </span>
                    ))}
                    {growthAreas.map((g) => (
                        <span
                            key={g}
                            style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                            }}
                        >
                            <Target size={9} />
                            {dimensionLabels[g] || g}
                        </span>
                    ))}
                </div>
            )}

            {/* Primary Insight */}
            {primaryInsight && (
                <div style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    opacity: 0.75,
                    borderLeft: '2px solid var(--primary)',
                    marginLeft: '10px',
                    marginRight: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                }}>
                    <Lightbulb size={12} style={{ marginTop: '1px', flexShrink: 0, color: 'var(--primary)' }} />
                    <span>{primaryInsight}</span>
                </div>
            )}

            <div className="intelligence-footer">
                <div className="footer-note">
                    <Brain size={12} />
                    <span>6 dimensions: Strategy · Execution · AI Synergy · Adaptability · Consistency · Self-Regulation</span>
                </div>
            </div>
        </div>
    );
};

export default AIIntelligenceScore;
