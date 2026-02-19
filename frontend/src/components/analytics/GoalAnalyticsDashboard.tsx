import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { api } from '../../services/api/client';
import '../../styles/components/analytics/goalAnalyticsDashboard.css';

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface GoalActionImpact {
  title: string;
  why: string;
  expected_momentum_lift: [number, number];
  expected_probability_lift: [number, number];
}

interface GoalBreakdownV3 {
  task_score: number;
  habit_score: number;
  deep_work_score: number;
  ai_resonance_score: number;
  raw_score: number;
  adjusted_raw_score: number;
}

interface GoalPaceV3 {
  required_hours_per_day: number;
  actual_hours_per_day: number;
  pace_ratio: number;
  on_track_gap_hours: number;
}

interface GoalQualityV3 {
  focus_score_avg: number;
  burnout_risk: number;
  days_inactive: number;
  active_days: number;
  data_points: number;
  overdue_high_impact_tasks: number;
  relevant_query_count: number;
}

interface GoalProgressV3Item {
  goal_id: number;
  title: string;
  category: string;
  target_date: string;
  archetype: 'grind' | 'routine' | 'builder' | 'blitz';
  archetype_confidence: number;
  completion_probability: number;
  momentum_score: number;
  probability_band: 'very_low' | 'low' | 'mid' | 'high' | 'very_high';
  confidence: number;
  confidence_state: 'calibrating' | 'established';
  reason_codes: string[];
  weekly_trend: 'improving' | 'stable' | 'declining';
  progress: number;
  expected_progress: number;
  pace_delta: number;
  linked_tasks_created: number;
  linked_tasks_completed: number;
  breakdown: GoalBreakdownV3;
  pace: GoalPaceV3;
  quality: GoalQualityV3;
  actions: GoalActionImpact[];
}

interface GoalProgressSummary {
  active_goals: number;
  avg_confidence: number;
  focus_score_avg: number;
  burnout_risk: number;
}

interface GoalProgressV3Response {
  score: number | null;
  momentum_score: number | null;
  overall_band: 'very_low' | 'low' | 'mid' | 'high' | 'very_high' | null;
  confidence_state: 'calibrating' | 'established';
  goals: GoalProgressV3Item[];
  summary: GoalProgressSummary;
  goal_progress_version: string;
}

interface GoalAnalyticsDashboardProps {
  timeRange?: TimeRange;
  refreshKey?: number;
}

const bandStyle: Record<
  'very_low' | 'low' | 'mid' | 'high' | 'very_high',
  { color: string; bg: string; border: string; glow: string; label: string }
> = {
  very_low: {
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.4)',
    glow: '0 0 14px rgba(239,68,68,0.25)',
    label: 'Very Low',
  },
  low: {
    color: '#f97316',
    bg: 'rgba(249,115,22,0.1)',
    border: 'rgba(249,115,22,0.35)',
    glow: '0 0 12px rgba(249,115,22,0.22)',
    label: 'Low',
  },
  mid: {
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.1)',
    border: 'rgba(251,191,36,0.35)',
    glow: '0 0 10px rgba(251,191,36,0.2)',
    label: 'Mid',
  },
  high: {
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.35)',
    glow: '0 0 12px rgba(52,211,153,0.22)',
    label: 'High',
  },
  very_high: {
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.4)',
    glow: '0 0 16px rgba(16,185,129,0.28)',
    label: 'Very High',
  },
};

function formatReason(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatArchetype(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function daysRemaining(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function trendIcon(trend: GoalProgressV3Item['weekly_trend']) {
  if (trend === 'improving') return <TrendingUp size={10} />;
  if (trend === 'declining') return <TrendingDown size={10} />;
  return <Minus size={10} />;
}

export default function GoalAnalyticsDashboard({
  timeRange = 'weekly',
  refreshKey = 0,
}: GoalAnalyticsDashboardProps) {
  const [data, setData] = useState<GoalProgressV3Response | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchGoalProgress = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<GoalProgressV3Response>(
          `/analytics/goals/progress?time_range=${timeRange}`
        );
        if (cancelled) return;
        if (!response.success || !response.data) {
          if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
            setData(null);
            setError(null);
            return;
          }
          setError(response.error?.message || 'Failed to load goal analytics');
          return;
        }
        setData(response.data);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load goal analytics');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchGoalProgress();
    return () => {
      cancelled = true;
    };
  }, [timeRange, refreshKey]);

  const goals = useMemo(() => {
    const list = data?.goals || [];
    return [...list]
      .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
      .slice(0, 3);
  }, [data]);

  const totalGoals = data?.goals?.length || 0;
  const isMaxReached = totalGoals > 3;

  if (isLoading) {
    return (
      <div className="goal-analytics-empty">
        <RefreshCw size={28} className="spin" />
        <h4>Loading Goal Analytics</h4>
        <p>Syncing probability model and engagement metrics.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="goal-analytics-empty">
        <AlertCircle size={28} />
        <h4>Goal Analytics Unavailable</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (!goals.length) {
    return (
      <div className="goal-analytics-empty">
        <Target size={36} />
        <h4>No Active Goals</h4>
        <p>Create a goal in Planner to activate probability tracking.</p>
      </div>
    );
  }

  return (
    <div className="goal-analytics-dashboard">
      {data?.confidence_state === 'calibrating' && (
        <div className="goal-max-banner">
          <AlertCircle size={14} />
          <span>
            Model is calibrating. Momentum updates are immediate, while probability confidence
            increases as more activity data is collected.
          </span>
        </div>
      )}

      {isMaxReached && (
        <div className="goal-max-banner">
          <AlertCircle size={14} />
          <span>
            Showing top <span className="goal-max-count">3</span> goals by deadline. Total active goals:{' '}
            <span className="goal-max-count">{totalGoals}</span>.
          </span>
        </div>
      )}

      {goals.map((goal) => (
        <GoalCard key={goal.goal_id} goal={goal} />
      ))}
    </div>
  );
}

function GoalCard({ goal }: { goal: GoalProgressV3Item }) {
  const [expanded, setExpanded] = useState(false);
  const style = bandStyle[goal.probability_band];
  const remain = daysRemaining(goal.target_date);
  const daysClass = remain <= 3 ? 'days-urgent' : remain <= 7 ? 'days-warning' : 'days-normal';

  return (
    <div className="goal-analysis-card" style={{ borderColor: style.border }}>
      <div className="goal-card-header">
        <div className="goal-card-info">
          <div className="goal-card-category">
            <Target size={10} />
            {goal.category}
          </div>
          <h4 className="goal-card-title" title={goal.title}>
            {goal.title}
          </h4>
          <div className="goal-card-deadline">
            <Clock size={11} />
            <span className={daysClass}>
              {remain <= 0 ? 'Deadline passed' : `${remain} day${remain === 1 ? '' : 's'} left`}
            </span>
          </div>
        </div>

        <div
          className="probability-badge"
          style={{
            background: style.bg,
            borderColor: style.border,
            boxShadow: style.glow,
          }}
        >
          <span className="probability-score" style={{ color: style.color }}>
            {Math.round(goal.completion_probability)}%
          </span>
          <span className="probability-label" style={{ color: style.color }}>
            {style.label}
          </span>
        </div>
      </div>

      <div className="probability-bar-section">
        <div className="probability-bar-container">
          <div
            className="probability-bar-fill"
            style={{
              width: `${goal.completion_probability}%`,
              background: `linear-gradient(90deg, ${style.color}66, ${style.color})`,
              color: style.color,
            }}
          />
        </div>
        <div className="probability-bar-markers">
          <span className="probability-marker">0%</span>
          <span className="probability-marker">50%</span>
          <span className="probability-marker">100%</span>
        </div>
      </div>

      <div className="goal-stats-row">
        <div className="goal-stat-item">
          <span className="goal-stat-value">{Math.round(goal.momentum_score)}%</span>
          <span className="goal-stat-label">Momentum</span>
        </div>
        <div className="goal-stat-item">
          <span className="goal-stat-value">
            <span className={`trend-badge ${goal.weekly_trend}`}>
              {trendIcon(goal.weekly_trend)}
              {goal.weekly_trend === 'improving'
                ? 'Up'
                : goal.weekly_trend === 'declining'
                ? 'Down'
                : 'Stable'}
            </span>
          </span>
          <span className="goal-stat-label">7D Trend</span>
        </div>
        <div className="goal-stat-item">
          <span className="goal-stat-value">{Math.round(goal.confidence * 100)}%</span>
          <span className="goal-stat-label">Confidence</span>
        </div>
      </div>

      <div className="goal-risks">
        <span className="risk-tag">
          <Zap size={10} />
          Archetype: {formatArchetype(goal.archetype)} ({Math.round(goal.archetype_confidence * 100)}%)
        </span>
        {goal.confidence_state === 'calibrating' && (
          <span className="risk-tag">
            <AlertCircle size={10} />
            Calibrating
          </span>
        )}
        {goal.reason_codes.map((code) => (
          <span key={code} className="risk-tag">
            <AlertCircle size={10} />
            {formatReason(code)}
          </span>
        ))}
      </div>

      <div className="goal-breakdown">
        <button
          className={`breakdown-toggle ${expanded ? 'expanded' : ''}`}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronRight size={12} />
          <span>Model Breakdown</span>
          <span style={{ marginLeft: 'auto', opacity: 0.6, fontWeight: 400, textTransform: 'none' }}>
            Pace {goal.pace.actual_hours_per_day}h/day vs {goal.pace.required_hours_per_day}h/day
          </span>
        </button>

        <div className={`breakdown-content ${expanded ? 'visible' : ''}`}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
            Components: Tasks {Math.round(goal.breakdown.task_score)} | Habits{' '}
            {Math.round(goal.breakdown.habit_score)} | Deep Work {Math.round(goal.breakdown.deep_work_score)} |
            AI Resonance {Math.round(goal.breakdown.ai_resonance_score)}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.45rem' }}>
            Quality: Focus {Math.round(goal.quality.focus_score_avg)} | Burnout{' '}
            {Math.round(goal.quality.burnout_risk)} | Inactive {goal.quality.days_inactive}d
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
            Progress {Math.round(goal.progress)}% (Expected {Math.round(goal.expected_progress)}%, Delta{' '}
            {Math.round(goal.pace_delta)}).
          </div>

          {goal.actions.length > 0 && (
            <div>
              <div className="breakdown-category-title">
                <Zap size={12} />
                Next Best Actions
              </div>
              <div className="breakdown-task-list">
                {goal.actions.map((action, idx) => (
                  <div key={`${goal.goal_id}-action-${idx}`} className="breakdown-task-item">
                    <div className="task-status-dot pending" />
                    <span className="task-item-title">{action.title}</span>
                    <span className="task-priority-tag medium">
                      +{action.expected_probability_lift[0]} to +{action.expected_probability_lift[1]}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
