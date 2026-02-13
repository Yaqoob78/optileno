// frontend/src/components/analytics/PredictiveTrajectory.tsx
import React, { useState, useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Loader,
    Brain
} from 'lucide-react';
import '../../styles/components/analytics/PredictiveTrajectory.css';

interface TrajectoryData {
    current_score: number;
    projected_score: number;
    change: number;
    trend_direction: 'rising' | 'stable' | 'declining';
    trend_slope: number;
    confidence: 'high' | 'medium' | 'low';
    primary_driver: {
        code: string;
        name: string;
        direction: string;
        change: number;
    } | null;
    color: string;
    status: string;
    projection_days: number;
}

export default function PredictiveTrajectory() {
    const [data, setData] = useState<TrajectoryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTrajectory = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const token = localStorage.getItem('token');
            const response = await fetch('/api/v1/analytics/predictive-trajectory', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch trajectory');
            }

            const result: TrajectoryData = await response.json();
            setData(result);
        } catch (err: any) {
            console.error('Error fetching trajectory:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTrajectory();
    }, []);

    // Get trend icon
    const getTrendIcon = () => {
        if (!data) return <Minus size={16} />;

        switch (data.trend_direction) {
            case 'rising':
                return <TrendingUp size={16} />;
            case 'declining':
                return <TrendingDown size={16} />;
            default:
                return <Minus size={16} />;
        }
    };

    // Get confidence bars
    const getConfidenceBars = () => {
        if (!data) return '░░░░';

        switch (data.confidence) {
            case 'high':
                return '▓▓▓▓';
            case 'medium':
                return '▓▓░░';
            default:
                return '▓░░░';
        }
    };

    // Loading state
    if (isLoading && !data) {
        return (
            <div className="predictive-trajectory-loading">
                <Loader className="trajectory-loader" size={24} />
                <p>Calculating trajectory...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="predictive-trajectory-empty">
                <Brain size={32} style={{ opacity: 0.3 }} />
                <p>Building baseline for predictions</p>
            </div>
        );
    }

    if (!data) return null;

    // Calculate line path (simple linear projection)
    const startY = 150; // Middle of chart area
    const currentY = 150 - ((data.current_score - 50) * 1.4); // Scale to fit
    const projectedY = 150 - ((data.projected_score - 50) * 1.4);

    const linePath = `M 40 ${currentY} L 260 ${projectedY}`;

    return (
        <div className="predictive-trajectory-container">
            {/* Header */}
            <div className="trajectory-header">
                <h3>Predictive Trajectory</h3>
            </div>

            {/* Main visualization */}
            <div className="trajectory-viz">
                <div className="current-score">
                    <span className="score-label">CURRENT</span>
                    <span className="score-value">{Math.round(data.current_score)}</span>
                </div>

                {/* SVG Line Chart */}
                <svg className="trajectory-chart" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    <line x1="40" y1="30" x2="260" y2="30" stroke="var(--border-color)" strokeDasharray="2,2" />
                    <line x1="40" y1="90" x2="260" y2="90" stroke="var(--border-color)" strokeDasharray="2,2" />
                    <line x1="40" y1="150" x2="260" y2="150" stroke="var(--border-color)" strokeDasharray="2,2" />

                    {/* Trajectory line */}
                    <path
                        d={linePath}
                        stroke={data.color}
                        strokeWidth="3"
                        fill="none"
                        className="trajectory-line"
                    />

                    {/* Start point */}
                    <circle cx="40" cy={currentY} r="5" fill={data.color} className="trajectory-point" />

                    {/* End point */}
                    <circle cx="260" cy={projectedY} r="6" fill={data.color} className="trajectory-point-end" />

                    {/* Labels */}
                    <text x="40" y="175" textAnchor="middle" className="axis-label">TODAY</text>
                    <text x="260" y="175" textAnchor="middle" className="axis-label">+{data.projection_days}D</text>
                </svg>

                <div className="projected-score">
                    <span className="score-label">PROJECTION</span>
                    <span className="score-value" style={{ color: data.color }}>
                        {Math.round(data.projected_score)}
                    </span>
                    <span className="score-change" style={{ color: data.change >= 0 ? '#10b981' : '#ef4444' }}>
                        ({data.change >= 0 ? '+' : ''}{Math.round(data.change)})
                    </span>
                </div>
            </div>

            {/* Status message */}
            <div className="trajectory-status" style={{ borderLeftColor: data.color }}>
                {data.status}
            </div>

            {/* Legend boxes */}
            <div className="trajectory-legend">
                <div className="legend-box">
                    <span className="legend-icon">{getTrendIcon()}</span>
                    <span className="legend-text">
                        {data.trend_direction === 'rising' ? 'Rising' :
                            data.trend_direction === 'declining' ? 'Declining' : 'Stable'} momentum
                    </span>
                </div>

                <div className="legend-box">
                    <span className="legend-bars">{getConfidenceBars()}</span>
                    <span className="legend-text">
                        {data.confidence.charAt(0).toUpperCase() + data.confidence.slice(1)} confidence
                    </span>
                </div>

                {data.primary_driver && (
                    <div className="legend-box">
                        <span className="legend-code">{data.primary_driver.code}:</span>
                        <span className="legend-text">
                            {data.primary_driver.name} {data.primary_driver.direction}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
