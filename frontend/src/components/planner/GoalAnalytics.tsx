
import React, { useState } from 'react';
import { Activity, Brain, CheckCircle, AlertTriangle, TrendingUp, BarChart2 } from 'lucide-react';
import { plannerApi } from '../../services/api/planner.service';
import type { Goal } from '../../types/planner.types';
import '../../styles/components/planner/GoalAnalytics.css';

interface GoalAnalyticsProps {
    goal: Goal;
    onUpdate: (updatedGoal: Goal) => void;
}

export const GoalAnalytics: React.FC<GoalAnalyticsProps> = ({ goal, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const probabilityColors: Record<string, string> = {
        'Extremely High': '#10B981', // Green
        'Very High': '#34D399',
        'High': '#6EE7B7',
        'Medium': '#FBBF24', // Yellow
        'Low': '#F87171', // Red
        'Very Low': '#EF4444'
    };

    const currentProbability = goal.probability_status || 'Medium';
    const color = probabilityColors[currentProbability] || '#FBBF24';

    const handleToggleTracking = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await plannerApi.toggleGoalTracking(goal.id);
            if (response.data && !response.data.error) {
                onUpdate({ ...goal, is_tracked: response.data.is_tracked });
            } else {
                setError(response.data.error || 'Failed to toggle tracking');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleBreakdown = async () => {
        setBreakdownLoading(true);
        setError(null);
        try {
            const response = await plannerApi.breakdownGoal(goal.id);
            if (response.data && !response.data.error) {
                // Update goal suggestions locally
                onUpdate({ ...goal, ai_suggestions: response.data });
                alert("Goal broken down successfully! Check your tasks and habits.");
            } else {
                setError(response.data.error || 'Failed to breakdown goal');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'An error occurred');
        } finally {
            setBreakdownLoading(false);
        }
    };

    return (
        <div className="goal-analytics-container">
            <div className="analytics-header">
                <h4>
                    <Brain size={18} color="#8B5CF6" />
                    Goal Intelligence
                </h4>
                {goal.is_tracked && (
                    <span className="status-badge">
                        Active
                    </span>
                )}
            </div>

            {error && (
                <div className="error-message">
                    <AlertTriangle size={12} />
                    {error}
                </div>
            )}

            {/* Tracking Toggle */}
            {!goal.is_tracked ? (
                <div className="tracking-cta">
                    <p>
                        Enable AI analysis to calculate success probability and verify consistency across tasks & habits.
                        <br />
                        <small>(Max 3 goals allowed)</small>
                    </p>
                    <button
                        className="primary-btn"
                        onClick={handleToggleTracking}
                        disabled={loading}
                    >
                        {loading ? 'Activating...' : 'Analyze with AI'}
                    </button>
                </div>
            ) : (
                <div className="analytics-dashboard">
                    {/* Probability Score */}
                    <div className="probability-card">
                        <div className="probability-header">
                            <span className="probability-label">Success Probability</span>
                            <TrendingUp size={14} color={color} />
                        </div>
                        <div className="probability-value" style={{ color: color }}>
                            {currentProbability}
                        </div>
                        <div className="probability-bar-track">
                            <div
                                className="probability-bar-fill"
                                style={{
                                    width: currentProbability === 'Extremely High' ? '100%' :
                                        currentProbability === 'Very High' ? '85%' :
                                            currentProbability === 'High' ? '70%' :
                                                currentProbability === 'Medium' ? '50%' :
                                                    currentProbability === 'Low' ? '30%' : '10%',
                                    background: color
                                }}
                            />
                        </div>
                        <p className="probability-description">
                            Based on consistency of linked Tasks, Habits & Deep Work.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="analytics-actions">
                        <button
                            className="action-btn generate"
                            onClick={handleBreakdown}
                            disabled={breakdownLoading}
                        >
                            <Activity size={14} />
                            {breakdownLoading ? 'Planning...' : 'Generate Plan'}
                        </button>

                        <button
                            className="action-btn stop"
                            onClick={handleToggleTracking}
                            disabled={loading}
                        >
                            Stop Tracking
                        </button>
                    </div>

                    {/* Suggestions Preview */}
                    {goal.ai_suggestions && Object.keys(goal.ai_suggestions).length > 0 && (
                        <div className="ai-suggestions">
                            <span className="suggestions-header">Recent AI Plan:</span>
                            <div className="suggestions-badges">
                                <span className="badge-tasks">
                                    {(goal.ai_suggestions as any).tasks?.length || 0} Tasks
                                </span>
                                <span className="badge-habits">
                                    {(goal.ai_suggestions as any).habits?.length || 0} Habits
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
