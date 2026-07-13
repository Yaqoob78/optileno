// frontend/src/components/analytics/BehaviorTimeline.tsx
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api/client';
import { useUserStore } from '../../stores/useUserStore';
import {
  Activity,
  Zap,
  Loader,
  Coffee,
  FileText,
  Star,
  LogIn,
  Target,
  Sunrise,
  TrendingUp,
  Flame,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Heart,
  HelpCircle,
} from 'lucide-react';
import '../../styles/components/analytics/BehaviorTimeline.css';

interface Intervention {
  title: string;
  action: string;
  icon: string;
  priority?: string;
}

interface DayDetail {
  tasks_completed: number;
  tasks_due: number;
  tasks_missed: number;
  focus_score: number;
  focus_minutes: number;
  chat_messages: number;
  stress_level: number;
  high_priority_done: number;
  app_opens?: number;
  meaningful_actions?: number;
  deep_work_minutes?: number;
  habit_completions?: number;
}

interface AntiQuitState {
  current_state: string;
  secondary_state?: string | null;
  quit_probability: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical' | string;
  warning_label: string;
  timeline_visual?: string;
  missed_streak?: number;
  confidence?: number;
  confidence_state?: string;
  evidence?: string[];
  profile?: string;
}

interface DayState {
  date: string;
  engagement: 'active' | 'partial' | 'absent';
  effort: 'high' | 'medium' | 'low' | 'none';
  emotion: 'flow' | 'calm' | 'strained' | 'frustrated' | 'drained';
  resistance: string[];
  recovery: boolean;
  intervention?: Intervention;
  detail?: DayDetail;
  anti_quit?: AntiQuitState;
}

interface TimelineSummary {
  active_days: number;
  absent_days: number;
  engagement_rate: number;
  longest_streak: number;
  current_streak: number;
  flow_days: number;
  interventions_triggered: number;
  dominant_pattern: string;
  anti_quit?: AntiQuitState & {
    profile_confidence?: number;
    dominant_state_7d?: string;
    profile_signals?: Record<string, number>;
  };
}

interface TimelineResponse {
  timeline: DayState[];
  summary?: TimelineSummary;
  meta: {
    start_date: string;
    end_date: string;
    days: number;
  };
  error?: string;
}

const EMOTION_CONFIG: Record<string, { color: string; label: string; bg: string; meaning: string }> = {
  flow: {
    color: '#10b981',
    label: 'Flow',
    bg: 'rgba(16, 185, 129, 0.15)',
    meaning: 'In the zone — focused and productive',
  },
  calm: {
    color: '#6366f1',
    label: 'Calm',
    bg: 'rgba(99, 102, 241, 0.15)',
    meaning: 'Steady, balanced working day',
  },
  strained: {
    color: '#f59e0b',
    label: 'Strained',
    bg: 'rgba(245, 158, 11, 0.15)',
    meaning: 'Working under pressure',
  },
  frustrated: {
    color: '#ef4444',
    label: 'Frustrated',
    bg: 'rgba(239, 68, 68, 0.15)',
    meaning: 'Effort without results — friction day',
  },
  drained: {
    color: '#dc2626',
    label: 'Drained',
    bg: 'rgba(220, 38, 38, 0.15)',
    meaning: 'Running on empty — recovery needed',
  },
};

const EFFORT_CONFIG: Record<string, { opacity: number; label: string }> = {
  high: { opacity: 1, label: 'High' },
  medium: { opacity: 0.6, label: 'Medium' },
  low: { opacity: 0.3, label: 'Low' },
  none: { opacity: 0.08, label: 'None' },
};

const ENGAGEMENT_HEIGHT: Record<string, number> = {
  active: 100,
  partial: 55,
  absent: 12,
};

const ENGAGEMENT_LABEL: Record<DayState['engagement'], string> = {
  active: 'Active day',
  partial: 'Partially active',
  absent: 'No activity',
};

const RESISTANCE_LABELS: Record<string, string> = {
  avoidance: 'Avoidance pattern',
  skipped_all: 'Skipped all due tasks',
};

/**
 * The backend momentum model speaks in internal state names
 * (FRUSTRATION_TRAP, ADRENALINE_DEBT, ...). Users get plain language.
 */
const MOMENTUM_STATE_CONFIG: Record<string, { label: string; meaning: string }> = {
  STABLE: {
    label: 'Steady',
    meaning: 'Your rhythm looks healthy. Keep doing what you’re doing.',
  },
  ADRENALINE_DEBT: {
    label: 'Overdrive',
    meaning: 'High output at high stress. Impressive — but this pace borrows from tomorrow. Schedule recovery.',
  },
  FRUSTRATION_TRAP: {
    label: 'Spinning Wheels',
    meaning: 'Long focus hours but nothing completing. Break the next task into something finishable in 30 minutes.',
  },
  AVOIDANCE_LOOP: {
    label: 'Avoidance',
    meaning: 'You’re opening the app but stepping around due tasks. Pick the smallest one and clear it first.',
  },
  MOMENTUM_DECAY: {
    label: 'Losing Steam',
    meaning: 'Light days are stretching into inactivity. One small completed task today restores the rhythm.',
  },
  DISENGAGING: {
    label: 'Drifting Away',
    meaning: 'Several inactive days in a row. A 10-minute restart today matters more than a perfect plan.',
  },
};

const momentumConfig = (state?: string) =>
  MOMENTUM_STATE_CONFIG[String(state || 'STABLE').toUpperCase()] || MOMENTUM_STATE_CONFIG.STABLE;

export default function BehaviorTimeline() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayState | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTimeline = async () => {
    if (!isAuthenticated) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<TimelineResponse>(`/analytics/behavior-timeline?days=${days}`);
      if (!response.success) {
        if (response.error?.code === 'HTTP_401' || response.error?.code === 'HTTP_403') {
          setData(null);
          setError(null);
          return;
        }
        throw new Error(response.error?.message || 'Failed to fetch timeline');
      }
      setData(response.data as TimelineResponse);
    } catch (err: any) {
      console.error('Error fetching timeline:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTimeline();
  }, [days, isAuthenticated]);

  // Auto-scroll to today (rightmost) on data load
  useEffect(() => {
    if (data?.timeline?.length && scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
      }, 100);
    }
  }, [data]);

  const getDayName = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
  const getDayNum = (dateStr: string) => new Date(dateStr + 'T00:00:00').getDate();
  const getMonthStr = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  const handleDayClick = (day: DayState) => {
    setSelectedDay(selectedDay?.date === day.date ? null : day);
  };

  const normalizeText = (value: string): string => {
    return String(value || '')
      .replace(/[—–]/g, '-')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const toTitleCase = (value: string): string => {
    return normalizeText(value).replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const getQuickRead = (day: DayState): string => {
    if (day.recovery) {
      return 'Comeback day — you returned after time away. That’s the habit that keeps streaks alive.';
    }
    if (day.engagement === 'absent') {
      return 'No activity recorded this day. A small restart is all momentum needs.';
    }
    if (day.emotion === 'flow') {
      return 'Strong day — focused, productive, and sustainable. This is your benchmark.';
    }
    if (day.emotion === 'drained' || day.emotion === 'frustrated') {
      return 'High-strain day. Output under stress like this is worth protecting with recovery time.';
    }
    if (day.engagement === 'partial') {
      return 'Some progress made. One focused session on a day like this changes its whole shape.';
    }
    return 'Steady day with balanced progress.';
  };

  const getInterventionIcon = (iconName?: string) => {
    const size = 18;
    switch (iconName) {
      case 'zap': return <Zap size={size} />;
      case 'coffee': return <Coffee size={size} />;
      case 'file-text': return <FileText size={size} />;
      case 'star': return <Star size={size} />;
      case 'log-in': return <LogIn size={size} />;
      case 'target': return <Target size={size} />;
      case 'sunrise': return <Sunrise size={size} />;
      default: return <Activity size={size} />;
    }
  };

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amt = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: amt, behavior: 'smooth' });
    }
  };

  if (isLoading && !data) {
    return (
      <div className="bt-container bt-loading">
        <Loader className="bt-spinner" size={28} />
        <span>Loading behavioral data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bt-container bt-error">
        <AlertTriangle size={20} />
        <p>Unable to load timeline.</p>
        <button onClick={fetchTimeline} className="bt-retry-btn">Retry</button>
      </div>
    );
  }

  const summary = data?.summary;
  const timeline = data?.timeline || [];
  const antiQuit = summary?.anti_quit;
  const momentum = momentumConfig(antiQuit?.current_state);
  const antiRiskClass =
    antiQuit?.risk_level === 'critical'
      ? 'critical'
      : antiQuit?.risk_level === 'high'
      ? 'high'
      : antiQuit?.risk_level === 'moderate'
      ? 'moderate'
      : 'low';

  const hasAnyActivity = timeline.some((day) => day.engagement !== 'absent');

  return (
    <div className="bt-container">
      {/* Header */}
      <div className="bt-header">
        <div className="bt-header-left">
          <div className="bt-icon-wrap">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="bt-title">Behavior Timeline</h3>
            <p className="bt-subtitle">Your last {days} days, one column per day</p>
          </div>
        </div>
        <div className="bt-controls">
          <button
            className={`bt-info-btn ${showExplainer ? 'is-active' : ''}`}
            onClick={() => setShowExplainer((prev) => !prev)}
            aria-expanded={showExplainer}
            aria-label="What is the behavior timeline?"
            title="What is this?"
          >
            <HelpCircle size={15} />
          </button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bt-select"
            aria-label="Timeline range"
          >
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>Quarter</option>
          </select>
        </div>
      </div>

      {showExplainer && (
        <div className="bt-explainer">
          <p>
            This is a picture of how you actually work, built automatically from your tasks, focus
            sessions, habits, and stress signals — nothing to fill in.
          </p>
          <ul>
            <li><strong>Bar height</strong> — how active the day was (tall = fully active).</li>
            <li><strong>Dot color</strong> — the day's working state: green flow, indigo calm, amber strained, red frustrated or drained.</li>
            <li><strong>Lightning brightness</strong> — how much effort you put in.</li>
            <li><strong>Small marker</strong> — Optileno suggested a course-correction that day.</li>
            <li><strong>↑ badge</strong> — a comeback: you returned after time away.</li>
          </ul>
          <p className="bt-explainer-footer">
            Click any day to see exactly what drove its reading.
          </p>
        </div>
      )}

      {/* Summary Stats Strip */}
      {summary && (
        <div className="bt-summary-strip">
          <div className="bt-stat" title="Consecutive active days, ending today">
            <Flame size={14} />
            <span className="bt-stat-value">{summary.current_streak}</span>
            <span className="bt-stat-label">Day Streak</span>
          </div>
          <div className="bt-stat" title={`You were active ${summary.active_days} of the last ${days} days`}>
            <TrendingUp size={14} />
            <span className="bt-stat-value">{summary.engagement_rate}%</span>
            <span className="bt-stat-label">Days Active</span>
          </div>
          <div className="bt-stat" title="Days you were fully in the zone">
            <Star size={14} />
            <span className="bt-stat-value">{summary.flow_days}</span>
            <span className="bt-stat-label">Flow Days</span>
          </div>
          <div className="bt-stat bt-stat-pattern" title="Your dominant working pattern over the last 7 days">
            <span className="bt-stat-pattern-label">This Week</span>
            <span className="bt-stat-pattern-text">{normalizeText(summary.dominant_pattern)}</span>
          </div>
          {antiQuit && (
            <div
              className={`bt-stat bt-stat-risk bt-risk-${antiRiskClass}`}
              title={momentum.meaning}
            >
              <span className="bt-stat-pattern-label">Momentum</span>
              <span className="bt-stat-value">{momentum.label}</span>
              <span className="bt-stat-label">
                {Math.round(antiQuit.quit_probability || 0)}% drop-off risk
              </span>
            </div>
          )}
        </div>
      )}

      {/* Timeline Track with scroll arrows */}
      {timeline.length === 0 || !hasAnyActivity ? (
        <div className="bt-empty">
          <Calendar size={28} />
          <h4>Your timeline is warming up</h4>
          <p>
            Complete tasks, run focus sessions, and track habits — each active day adds a column
            here. After a few days you'll see your working pattern take shape.
          </p>
        </div>
      ) : (
        <>
          <div className="bt-timeline-wrapper">
            <button
              className="bt-scroll-btn bt-scroll-left"
              onClick={() => scrollTimeline('left')}
              aria-label="Scroll timeline left"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="bt-timeline-scroll" ref={scrollRef}>
              <div className="bt-timeline-track">
                {timeline.map((day, index) => {
                  const emotionCfg = EMOTION_CONFIG[day.emotion] || EMOTION_CONFIG.calm;
                  const effortCfg = EFFORT_CONFIG[day.effort] || EFFORT_CONFIG.none;
                  const engHeight = ENGAGEMENT_HEIGHT[day.engagement] || 12;
                  const today = isToday(day.date);
                  const isSelected = selectedDay?.date === day.date;
                  const showMonthLabel = index === 0 || getDayNum(day.date) === 1;

                  return (
                    <div
                      key={day.date}
                      className={`bt-day ${day.engagement} ${isSelected ? 'bt-day-selected' : ''} ${today ? 'bt-day-today' : ''}`}
                      onClick={() => handleDayClick(day)}
                      title={`${day.date} — ${ENGAGEMENT_LABEL[day.engagement]}, ${emotionCfg.label.toLowerCase()} state. Click for details.`}
                    >
                      {/* Month label */}
                      {showMonthLabel && (
                        <div className="bt-month-label">{getMonthStr(day.date)}</div>
                      )}

                      {/* Date */}
                      <div className="bt-date-stack">
                        <span className="bt-day-name">{getDayName(day.date)}</span>
                        <span className={`bt-day-num ${today ? 'bt-today-num' : ''}`}>
                          {getDayNum(day.date)}
                        </span>
                      </div>

                      {/* Engagement bar */}
                      <div className="bt-bar-slot">
                        <div
                          className="bt-engagement-bar"
                          style={{
                            height: `${engHeight}%`,
                            background: emotionCfg.color,
                            opacity: day.engagement === 'absent' ? 0.15 : 0.8,
                          }}
                        />
                      </div>

                      {/* Mood dot */}
                      <div className="bt-mood-slot">
                        <div
                          className="bt-mood-dot"
                          style={{
                            background: emotionCfg.color,
                            boxShadow: day.emotion === 'flow' ? `0 0 6px ${emotionCfg.color}` : 'none',
                          }}
                        />
                      </div>

                      {/* Energy indicator */}
                      <div className="bt-energy-slot">
                        <Zap
                          size={12}
                          fill="#f59e0b"
                          color="#f59e0b"
                          style={{ opacity: effortCfg.opacity }}
                        />
                      </div>

                      {/* Intervention dot */}
                      {day.intervention && (
                        <div
                          className="bt-intervention-dot"
                          style={{
                            background: day.intervention.priority === 'health' ? '#ef4444' :
                              day.intervention.priority === 'reinforcement' ? '#10b981' : '#f59e0b',
                          }}
                        />
                      )}

                      {/* Recovery indicator */}
                      {day.recovery && <div className="bt-recovery-badge">↑</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              className="bt-scroll-btn bt-scroll-right"
              onClick={() => scrollTimeline('right')}
              aria-label="Scroll timeline right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Legend */}
          <div className="bt-legend">
            <div className="bt-legend-item">
              <div className="bt-legend-bar" />
              <span>Bar = activity</span>
            </div>
            {(['flow', 'calm', 'strained', 'frustrated', 'drained'] as const).map((emotion) => (
              <div className="bt-legend-item" key={emotion} title={EMOTION_CONFIG[emotion].meaning}>
                <div className="bt-legend-dot" style={{ background: EMOTION_CONFIG[emotion].color }} />
                <span>{EMOTION_CONFIG[emotion].label}</span>
              </div>
            ))}
            <div className="bt-legend-item" title="Brighter bolt = more effort that day">
              <Zap size={10} fill="#f59e0b" color="#f59e0b" />
              <span>Effort</span>
            </div>
            <div className="bt-legend-item" title="Optileno suggested a course-correction">
              <div className="bt-legend-marker" />
              <span>Suggestion</span>
            </div>
            <div className="bt-legend-item" title="You came back after time away">
              <span className="bt-legend-recovery">↑</span>
              <span>Comeback</span>
            </div>
          </div>
        </>
      )}

      {/* Selected Day Detail Panel */}
      {selectedDay && (
        <div className="bt-detail-panel">
          <div className="bt-detail-header">
            <div className="bt-detail-date">
              <Calendar size={14} />
              <span>
                {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              {isToday(selectedDay.date) && <span className="bt-today-badge">Today</span>}
            </div>
            <button className="bt-close-btn" onClick={() => setSelectedDay(null)} aria-label="Close day details">
              <X size={14} />
            </button>
          </div>

          {/* State indicators */}
          <div className="bt-detail-states">
            <div
              className="bt-state-chip"
              style={{ background: EMOTION_CONFIG[selectedDay.emotion]?.bg }}
              title={EMOTION_CONFIG[selectedDay.emotion]?.meaning}
            >
              <Heart size={12} style={{ color: EMOTION_CONFIG[selectedDay.emotion]?.color }} />
              <span>{EMOTION_CONFIG[selectedDay.emotion]?.label || toTitleCase(selectedDay.emotion)}</span>
            </div>
            <div className="bt-state-chip">
              <Activity size={12} />
              <span>{ENGAGEMENT_LABEL[selectedDay.engagement]}</span>
            </div>
            <div className="bt-state-chip">
              <Zap size={12} />
              <span>{EFFORT_CONFIG[selectedDay.effort]?.label || toTitleCase(selectedDay.effort)} effort</span>
            </div>
            {selectedDay.recovery && (
              <div className="bt-state-chip bt-recovery-chip">
                <Sunrise size={12} />
                <span>Comeback</span>
              </div>
            )}
          </div>

          <div className="bt-quick-read">
            <strong>Quick read:</strong> {getQuickRead(selectedDay)}
          </div>

          {selectedDay.anti_quit && selectedDay.anti_quit.current_state !== 'STABLE' && (
            <div className={`bt-warning-card bt-warning-${String(selectedDay.anti_quit.risk_level || 'low')}`}>
              <div className="bt-warning-title">
                {momentumConfig(selectedDay.anti_quit.current_state).label}
              </div>
              <div className="bt-warning-text">
                {momentumConfig(selectedDay.anti_quit.current_state).meaning}
              </div>
              <div className="bt-warning-meta">
                Drop-off risk that day: {Math.round(selectedDay.anti_quit.quit_probability || 0)}%
              </div>
            </div>
          )}

          {/* Detail metrics */}
          {selectedDay.detail && (
            <div className="bt-detail-metrics">
              <div className="bt-metric-row">
                <span className="bt-metric-label">Tasks completed</span>
                <span className="bt-metric-value">{selectedDay.detail.tasks_completed}</span>
              </div>
              {selectedDay.detail.tasks_due > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Tasks due</span>
                  <span className="bt-metric-value">
                    {selectedDay.detail.tasks_due - selectedDay.detail.tasks_missed}/{selectedDay.detail.tasks_due} done
                  </span>
                </div>
              )}
              {selectedDay.detail.focus_score > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Focus score</span>
                  <span className="bt-metric-value">{selectedDay.detail.focus_score}%</span>
                </div>
              )}
              {selectedDay.detail.focus_minutes > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Focus minutes</span>
                  <span className="bt-metric-value">{selectedDay.detail.focus_minutes} min</span>
                </div>
              )}
              {selectedDay.detail.deep_work_minutes && selectedDay.detail.deep_work_minutes > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Deep work minutes</span>
                  <span className="bt-metric-value">{selectedDay.detail.deep_work_minutes} min</span>
                </div>
              )}
              {selectedDay.detail.habit_completions && selectedDay.detail.habit_completions > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Habits completed</span>
                  <span className="bt-metric-value">{selectedDay.detail.habit_completions}</span>
                </div>
              )}
              {selectedDay.detail.high_priority_done > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">High priority completed</span>
                  <span className="bt-metric-value">{selectedDay.detail.high_priority_done}</span>
                </div>
              )}
              {selectedDay.detail.chat_messages > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Chat messages</span>
                  <span className="bt-metric-value">{selectedDay.detail.chat_messages}</span>
                </div>
              )}
              {selectedDay.detail.app_opens && selectedDay.detail.app_opens > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">App opens</span>
                  <span className="bt-metric-value">{selectedDay.detail.app_opens}</span>
                </div>
              )}
              {selectedDay.detail.stress_level > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">Stress level</span>
                  <span className="bt-metric-value">{selectedDay.detail.stress_level}/10</span>
                </div>
              )}
            </div>
          )}

          {selectedDay.resistance?.length > 0 && (
            <div className="bt-resistance">
              <span className="bt-resistance-label">Friction signals:</span>
              <div className="bt-resistance-list">
                {selectedDay.resistance.map((signal) => (
                  <span key={signal} className="bt-resistance-chip">
                    {RESISTANCE_LABELS[signal] || toTitleCase(signal)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Intervention */}
          {selectedDay.intervention && (
            <div className={`bt-intervention bt-intervention-${selectedDay.intervention.priority || 'behavioral'}`}>
              <div className="bt-intervention-icon">
                {getInterventionIcon(selectedDay.intervention.icon)}
              </div>
              <div className="bt-intervention-text">
                <strong>{selectedDay.intervention.title}</strong>
                <p>{selectedDay.intervention.action}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
