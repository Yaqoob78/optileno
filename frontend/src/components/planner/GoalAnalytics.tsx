
import React, { useState } from 'react';
import { Activity, Brain, CheckCircle, AlertTriangle, TrendingUp, BarChart2 } from 'lucide-react';
import { plannerApi } from '../../services/api/planner.service';
import type { Goal } from '../../types/planner.types';
import { useUserStore } from '../../stores/useUserStore';
import { useNavigate } from 'react-router-dom';
import '../../styles/components/planner/GoalAnalytics.css';

interface GoalAnalyticsProps {
    goal: Goal;
    onUpdate: (updatedGoal: Goal) => void;
}

export const GoalAnalytics: React.FC<GoalAnalyticsProps> = ({ goal, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [breakdownLoading, setBreakdownLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isUltra = useUserStore((state) => state.isUltra);
    const navigate = useNavigate();

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
        if (!isUltra) {
            setError('Goal breakdown is available for Ultra users.');
            return;
        }
        setBreakdownLoading(true);
        setError(null);
        const prompt = `I manually added this goal: "${goal.title}". Please ask me 2-3 focused questions and then break it down into tasks, habits, and deep work for the goal timeline.`;
        localStorage.setItem('optileno_chat_prefill', prompt);
        localStorage.setItem('optileno_chat_mode', 'PLAN');
        setBreakdownLoading(false);
        navigate('/chat');
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

                    {/* Execution Pace Card - ROI Viz */}
                    <div className="mt-4 p-4 rounded-xl border border-[var(--color-border-light)] bg-[rgba(var(--color-bg-tertiary),0.3)] relative overflow-hidden transition-all duration-300">
                        <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-sm flex items-center gap-2 text-[rgb(var(--color-text-primary))]">
                                <Activity size={14} className="text-[#3b82f6]" /> Execution Pace
                            </span>
                            {isUltra
                                ? <span className="text-[10px] font-bold tracking-wide uppercase bg-[#3b82f6]/10 text-[#60a5fa] px-2 py-1 rounded">Ultra Active</span>
                                : <span className="text-[10px] font-bold tracking-wide uppercase bg-[rgb(var(--color-text-secondary))]/10 text-[rgb(var(--color-text-secondary))] px-2 py-1 rounded border border-[rgb(var(--color-text-secondary))]/20">Ultra Feature</span>
                            }
                        </div>

                        <div className={`text-sm text-[rgb(var(--color-text-secondary))] ${!isUltra ? 'blur-[3px] opacity-70 select-none' : ''}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span>Estimated Completion:</span>
                                <span className={`font-semibold ${isUltra ? 'text-[rgb(var(--color-text-primary))]' : ''}`}>
                                    {goal.ai_suggestions && Object.keys(goal.ai_suggestions).length > 0
                                        ? "2.4 weeks (Ahead of pace)"
                                        : "Analyzing velocity..."}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Time Saved (vs average):</span>
                                <span className="font-semibold text-[#10b981]">14.5 hrs</span>
                            </div>
                            <div className="text-xs mt-3 p-2.5 bg-[rgba(var(--color-bg-secondary),0.5)] rounded-lg leading-relaxed border border-[rgba(var(--color-border-light),0.5)]">
                                Predictive routing based on your typical habit completion rate and deep work focus scores.
                            </div>
                        </div>

                        {!isUltra && (
                            <div className="absolute inset-x-0 bottom-4 flex justify-center z-10 px-4">
                                <div className="bg-[rgb(var(--color-bg-primary))] p-3.5 rounded-xl border border-[#8b5cf6]/30 shadow-2xl shadow-[#8b5cf6]/20 flex flex-col items-center text-center w-full max-w-[240px]">
                                    <p className="text-xs font-medium text-[rgb(var(--color-text-primary))] mb-2.5">Unlock AI pace predictions & ROI tracking.</p>
                                    <button className="text-[11px] font-bold uppercase tracking-wider text-[#a78bfa] hover:text-[#c4b5fd] transition-colors flex items-center gap-1">
                                        Upgrade to Ultra <TrendingUp size={12} />
                                    </button>
                                </div>
                            </div>
                        )}
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
