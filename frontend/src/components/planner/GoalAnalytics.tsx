import React, { useState } from 'react';
import { AlertTriangle, Brain, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { plannerApi } from '../../services/api/planner.service';
import { useUserStore } from '../../stores/useUserStore';
import type { Goal } from '../../types/planner.types';
import '../../styles/components/planner/GoalAnalytics.css';

interface GoalAnalyticsProps {
  goal: Goal;
  onUpdate: (updatedGoal: Goal) => void;
}

const probabilityColors: Record<string, string> = {
  'Extremely High': '#10B981',
  'Very High': '#34D399',
  High: '#6EE7B7',
  Medium: '#FBBF24',
  Low: '#F87171',
  'Very Low': '#EF4444',
};

export const GoalAnalytics: React.FC<GoalAnalyticsProps> = ({ goal, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isUltra = useUserStore((state) => state.isUltra);
  const navigate = useNavigate();

  const probability = goal.probability_status ? String(goal.probability_status) : null;
  const probabilityColor = probability ? probabilityColors[probability] || '#94A3B8' : '#94A3B8';
  const progress = Math.max(0, Math.min(100, Number(goal.current_progress || 0)));
  const suggestions = goal.ai_suggestions && typeof goal.ai_suggestions === 'object'
    ? goal.ai_suggestions as Record<string, unknown>
    : null;

  const handleToggleTracking = async () => {
    if (!isUltra) {
      navigate('/settings', { state: { tab: 'billing' } });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await plannerApi.toggleGoalTracking(goal.id);
      if (!response.success || !response.data || response.data.error) {
        throw new Error(response.error?.message || response.data?.error || 'Failed to update goal tracking.');
      }

      onUpdate({
        ...goal,
        is_tracked: Boolean(response.data.is_tracked),
        probability_status: response.data.is_tracked ? goal.probability_status : undefined,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update goal tracking.');
    } finally {
      setLoading(false);
    }
  };

  const handleBreakdown = () => {
    const prompt = `I added this goal: "${goal.title}". Please ask me 2-3 focused questions, then help me break it into tasks, habits, and deep work for its timeline.`;
    localStorage.setItem('optileno_chat_prefill', prompt);
    localStorage.setItem('optileno_chat_mode', 'PLAN');
    navigate('/chat');
  };

  return (
    <div className="goal-analytics-container">
      <div className="analytics-header">
        <h4>
          <Brain size={18} color="#8B5CF6" />
          Goal Intelligence
        </h4>
        {goal.is_tracked && <span className="status-badge">Tracking</span>}
      </div>

      {error && (
        <div className="error-message">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {!goal.is_tracked ? (
        <div className="tracking-cta">
          <p>
            Track this goal to calculate progress from linked work as activity is recorded.
            <br />
            <small>Up to three tracked goals.</small>
          </p>
          <button
            className="primary-btn"
            onClick={() => void handleToggleTracking()}
            disabled={loading}
          >
            {isUltra ? (loading ? 'Updating...' : 'Track goal') : 'Upgrade to Ultra'}
          </button>
        </div>
      ) : (
        <div className="analytics-dashboard">
          <div className="probability-card">
            <div className="probability-header">
              <span className="probability-label">Recorded Progress</span>
              <TrendingUp size={14} color={probabilityColor} />
            </div>
            <div className="probability-value" style={{ color: probabilityColor }}>
              {progress}%
            </div>
            <div className="probability-bar-track">
              <div
                className="probability-bar-fill"
                style={{ width: `${progress}%`, background: probabilityColor }}
              />
            </div>
            <p className="probability-description">
              {probability
                ? `Latest probability assessment: ${probability}.`
                : 'An assessment will appear after linked work provides enough signal.'}
            </p>
          </div>

          <div className="analytics-actions">
            <button className="action-btn generate" onClick={handleBreakdown}>
              <Brain size={14} />
              Continue in Chat
            </button>
            <button
              className="action-btn stop"
              onClick={() => void handleToggleTracking()}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Stop Tracking'}
            </button>
          </div>

          {suggestions && (
            <div className="ai-suggestions">
              <span className="suggestions-header">Saved plan items</span>
              <div className="suggestions-badges">
                <span className="badge-tasks">{Array.isArray(suggestions.tasks) ? suggestions.tasks.length : 0} Tasks</span>
                <span className="badge-habits">{Array.isArray(suggestions.habits) ? suggestions.habits.length : 0} Habits</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
