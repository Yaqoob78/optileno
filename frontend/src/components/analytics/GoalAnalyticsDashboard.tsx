import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Lock,
} from 'lucide-react';
import { api } from '../../services/api/client';
import '../../styles/components/analytics/goalAnalyticsDashboard.css';

type TimeRange = 'daily' | 'weekly' | 'monthly';
type Band = 'very_low' | 'low' | 'mid' | 'high' | 'very_high';

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

/** V3 item; V2 responses omit most of these fields, so everything model-side is optional. */
interface GoalProgressItem {
  goal_id: number;
  title: string;
  category: string;
  target_date: string | null;
  archetype?: 'grind' | 'routine' | 'builder' | 'blitz';
  archetype_confidence?: number;
  completion_probability: number;
  momentum_score?: number;
  probability_band: Band;
  confidence?: number;
  confidence_state?: 'calibrating' | 'established';
  reason_codes?: string[];
  weekly_trend?: 'improving' | 'stable' | 'declining';
  progress?: number;
  expected_progress?: number;
  pace_delta?: number;
  linked_tasks_created?: number;
  linked_tasks_completed?: number;
  breakdown?: GoalBreakdownV3;
  pace?: GoalPaceV3;
  quality?: GoalQualityV3;
  actions?: GoalActionImpact[];
}

interface GoalProgressSummary {
  active_goals?: number;
  avg_confidence?: number;
  focus_score_avg?: number;
  burnout_risk?: number;
}

interface GoalProgressResponse {
  score: number | null;
  momentum_score?: number | null;
  overall_band: Band | null;
  confidence_state?: 'calibrating' | 'established';
  goals: GoalProgressItem[];
  summary?: GoalProgressSummary;
  goal_progress_version?: string;
  // Backend degradation contract (see _fallback_payload in analytics.py)
  error_fallback?: boolean;
  message?: string;
}

interface GoalAnalyticsDashboardProps {
  timeRange?: TimeRange;
  refreshKey?: number;
}

const bandStyle: Record<Band, { color: string; bg: string; border: string; glow: string; label: string }> = {
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

const clampPercent = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const formatHours = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

function formatReason(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatArchetype(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Days until target; null when the goal has no (valid) deadline. */
function daysRemaining(targetDate: string | null | undefined): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function trendIcon(trend: GoalProgressItem['weekly_trend']) {
  if (trend === 'improving') return <TrendingUp size={10} />;
  if (trend === 'declining') return <TrendingDown size={10} />;
  return <Minus size={10} />;
}

export default function GoalAnalyticsDashboard({
  timeRange = 'weekly',
  refreshKey = 0,
}: GoalAnalyticsDashboardProps) {
  const [data, setData] = useState<GoalProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const fetchGoalProgress = async () => {
      // Stale-while-revalidate: realtime ticks refresh quietly behind the
      // current data instead of flashing the whole card into a spinner
      if (hasDataRef.current) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const response = await api.get<GoalProgressResponse>(
          `/analytics/goals/progress?time_range=${timeRange}`
        );
        if (cancelled) return;
        if (!response.success || !response.data) {
          if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
            setIsLocked(true);
            return;
          }
          setError(response.error?.message || 'Failed to load goal analytics');
          return;
        }
        setIsLocked(false);
        setData(response.data);
        hasDataRef.current = true;
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load goal analytics');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchGoalProgress();
    return () => {
      cancelled = true;
    };
  }, [timeRange, refreshKey]);

  // Nearest deadline first; goals without a deadline at the end
  const goals = useMemo(() => {
    const list = data?.goals || [];
    const dateRank = (goal: GoalProgressItem) => {
      if (!goal.target_date) return Number.MAX_SAFE_INTEGER;
      const t = new Date(goal.target_date).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    return [...list].sort((a, b) => dateRank(a) - dateRank(b)).slice(0, 3);
  }, [data]);

  const totalGoals = data?.goals?.length || 0;
  const isMaxReached = totalGoals > 3;
  const overallBand = data?.overall_band ? bandStyle[data.overall_band] : null;

  if (isLoading && !data) {
    return (
      <div className="goal-analytics-empty">
        <RefreshCw size={28} className="spin" />
        <h4>Loading Goal Analytics</h4>
        <p>Syncing probability model and engagement metrics.</p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="goal-analytics-empty">
        <Lock size={28} />
        <h4>Ultra Feature</h4>
        <p>Goal probability analytics is part of the Ultra plan.</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="goal-analytics-empty">
        <AlertCircle size={28} />
        <h4>Goal Analytics Unavailable</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (data?.error_fallback) {
    return (
      <div className="goal-analytics-empty">
        <AlertCircle size={28} />
        <h4>Temporarily Unavailable</h4>
        <p>{data.message || 'Goal analytics will be back shortly. Your data is safe.'}</p>
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
      {/* Portfolio summary — data the API already returns */}
      {(data?.score !== null || data?.summary) && (
        <div className="goal-portfolio-summary">
          {data?.score !== null && data?.score !== undefined && (
            <div className="goal-portfolio-stat">
              <span
                className="goal-portfolio-value"
                style={overallBand ? { color: overallBand.color } : undefined}
              >
                {Math.round(clampPercent(data.score))}%
              </span>
              <span className="goal-portfolio-label">
                Overall{overallBand ? ` · ${overallBand.label}` : ''}
              </span>
            </div>
          )}
          {typeof data?.summary?.active_goals === 'number' && (
            <div className="goal-portfolio-stat">
              <span className="goal-portfolio-value">{data.summary.active_goals}</span>
              <span className="goal-portfolio-label">Active Goals</span>
            </div>
          )}
          {typeof data?.summary?.avg_confidence === 'number' && (
            <div className="goal-portfolio-stat">
              <span className="goal-portfolio-value">
                {Math.round(clampPercent(data.summary.avg_confidence * 100))}%
              </span>
              <span className="goal-portfolio-label">Avg Confidence</span>
            </div>
          )}
          {isRefreshing && (
            <RefreshCw size={12} className="spin goal-refresh-indicator" aria-label="Refreshing" />
          )}
        </div>
      )}

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

function GoalCard({ goal }: { goal: GoalProgressItem }) {
  const [expanded, setExpanded] = useState(false);
  const style = bandStyle[goal.probability_band] || bandStyle.mid;
  const remain = daysRemaining(goal.target_date);
  const probability = clampPercent(goal.completion_probability);
  const daysClass =
    remain === null ? 'days-normal' : remain <= 3 ? 'days-urgent' : remain <= 7 ? 'days-warning' : 'days-normal';

  const hasModelDetails = Boolean(goal.breakdown || goal.pace || goal.quality || goal.actions?.length);

  return (
    <div className="goal-analysis-card" style={{ borderColor: style.border }}>
      <div className="goal-card-header">
        <div className="goal-card-info">
          <div className="goal-card-category">
            <Target size={10} />
            {goal.category || 'General'}
          </div>
          <h4 className="goal-card-title" title={goal.title}>
            {goal.title}
          </h4>
          <div className="goal-card-deadline">
            <Clock size={11} />
            <span className={daysClass}>
              {remain === null
                ? 'No deadline set'
                : remain <= 0
                ? 'Deadline passed'
                : `${remain} day${remain === 1 ? '' : 's'} left`}
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
            {Math.round(probability)}%
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
              width: `${probability}%`,
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
        {typeof goal.momentum_score === 'number' && (
          <div className="goal-stat-item">
            <span className="goal-stat-value">{Math.round(clampPercent(goal.momentum_score))}%</span>
            <span className="goal-stat-label">Momentum</span>
          </div>
        )}
        {goal.weekly_trend && (
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
        )}
        {typeof goal.confidence === 'number' && (
          <div className="goal-stat-item">
            <span className="goal-stat-value">{Math.round(clampPercent(goal.confidence * 100))}%</span>
            <span className="goal-stat-label">Confidence</span>
          </div>
        )}
      </div>

      <div className="goal-risks">
        {goal.archetype && (
          <span className="risk-tag">
            <Zap size={10} />
            Archetype: {formatArchetype(goal.archetype)}
            {typeof goal.archetype_confidence === 'number'
              ? ` (${Math.round(clampPercent(goal.archetype_confidence * 100))}%)`
              : ''}
          </span>
        )}
        {goal.confidence_state === 'calibrating' && (
          <span className="risk-tag">
            <AlertCircle size={10} />
            Calibrating
          </span>
        )}
        {(goal.reason_codes || []).map((code) => (
          <span key={code} className="risk-tag">
            <AlertCircle size={10} />
            {formatReason(code)}
          </span>
        ))}
      </div>

      {hasModelDetails && (
        <div className="goal-breakdown">
          <button
            className={`breakdown-toggle ${expanded ? 'expanded' : ''}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <ChevronRight size={12} />
            <span>Model Breakdown</span>
            {goal.pace && (
              <span className="breakdown-pace-summary">
                Pace {formatHours(goal.pace.actual_hours_per_day)}h/day vs{' '}
                {formatHours(goal.pace.required_hours_per_day)}h/day
              </span>
            )}
          </button>

          <div className={`breakdown-content ${expanded ? 'visible' : ''}`}>
            {goal.breakdown && (
              <div className="breakdown-metric-line">
                Components: Tasks {Math.round(goal.breakdown.task_score)} | Habits{' '}
                {Math.round(goal.breakdown.habit_score)} | Deep Work{' '}
                {Math.round(goal.breakdown.deep_work_score)} | AI Resonance{' '}
                {Math.round(goal.breakdown.ai_resonance_score)}
              </div>
            )}
            {goal.quality && (
              <div className="breakdown-metric-line">
                Quality: Focus {Math.round(goal.quality.focus_score_avg)} | Burnout{' '}
                {Math.round(goal.quality.burnout_risk)} | Inactive {goal.quality.days_inactive}d
              </div>
            )}
            {typeof goal.progress === 'number' && typeof goal.expected_progress === 'number' && (
              <div className="breakdown-metric-line is-last">
                Progress {Math.round(goal.progress)}% (Expected {Math.round(goal.expected_progress)}%,
                Delta {Math.round(goal.pace_delta ?? goal.progress - goal.expected_progress)}).
              </div>
            )}

            {(goal.actions?.length ?? 0) > 0 && (
              <div>
                <div className="breakdown-category-title">
                  <Zap size={12} />
                  Next Best Actions
                </div>
                <div className="breakdown-task-list">
                  {goal.actions!.map((action, idx) => (
                    <div key={`${goal.goal_id}-action-${idx}`} className="breakdown-task-item">
                      <div className="task-status-dot pending" />
                      <span className="task-item-title" title={action.why || action.title}>
                        {action.title}
                      </span>
                      <span className="task-priority-tag medium">
                        +{action.expected_probability_lift?.[0] ?? 0} to +
                        {action.expected_probability_lift?.[1] ?? 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
