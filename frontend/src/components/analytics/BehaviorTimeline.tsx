// frontend/src/components/analytics/BehaviorTimeline.tsx
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api/client';
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
  Heart
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

const EMOTION_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  flow: { color: '#10b981', label: 'Flow', bg: 'rgba(16, 185, 129, 0.15)' },
  calm: { color: '#6366f1', label: 'Calm', bg: 'rgba(99, 102, 241, 0.15)' },
  strained: { color: '#f59e0b', label: 'Strained', bg: 'rgba(245, 158, 11, 0.15)' },
  frustrated: { color: '#ef4444', label: 'Frustrated', bg: 'rgba(239, 68, 68, 0.15)' },
  drained: { color: '#dc2626', label: 'Drained', bg: 'rgba(220, 38, 38, 0.15)' },
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

export default function BehaviorTimeline() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayState | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTimeline = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get<TimelineResponse>(`/analytics/behavior-timeline?days=${days}`);
      if (!response.success) {
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
    fetchTimeline();
  }, [days]);

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

  return (
    <div className="bt-container">
      {/* Header */}
      <div className="bt-header">
        <div className="bt-header-left">
          <div className="bt-icon-wrap">
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="bt-title">Behavioral Flow</h3>
            <p className="bt-subtitle">Energy, mood & momentum over time</p>
          </div>
        </div>
        <div className="bt-controls">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bt-select"
          >
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>Quarter</option>
          </select>
        </div>
      </div>

      {/* Summary Stats Strip */}
      {summary && (
        <div className="bt-summary-strip">
          <div className="bt-stat">
            <Flame size={14} />
            <span className="bt-stat-value">{summary.current_streak}</span>
            <span className="bt-stat-label">Streak</span>
          </div>
          <div className="bt-stat">
            <TrendingUp size={14} />
            <span className="bt-stat-value">{summary.engagement_rate}%</span>
            <span className="bt-stat-label">Engaged</span>
          </div>
          <div className="bt-stat">
            <Star size={14} />
            <span className="bt-stat-value">{summary.flow_days}</span>
            <span className="bt-stat-label">Flow Days</span>
          </div>
          <div className="bt-stat bt-stat-pattern">
            <span className="bt-stat-pattern-text">{summary.dominant_pattern}</span>
          </div>
        </div>
      )}

      {/* Timeline Track with scroll arrows */}
      <div className="bt-timeline-wrapper">
        <button className="bt-scroll-btn bt-scroll-left" onClick={() => scrollTimeline('left')}>
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
                  title={`${day.date}: ${day.engagement} engagement, ${day.emotion} mood`}
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

        <button className="bt-scroll-btn bt-scroll-right" onClick={() => scrollTimeline('right')}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Legend */}
      <div className="bt-legend">
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: '#10b981' }} />
          <span>Flow</span>
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: '#6366f1' }} />
          <span>Calm</span>
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: '#f59e0b' }} />
          <span>Strained</span>
        </div>
        <div className="bt-legend-item">
          <div className="bt-legend-dot" style={{ background: '#ef4444' }} />
          <span>Frustrated</span>
        </div>
        <div className="bt-legend-item">
          <Zap size={10} fill="#f59e0b" color="#f59e0b" />
          <span>Effort</span>
        </div>
      </div>

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
            <button className="bt-close-btn" onClick={() => setSelectedDay(null)}>
              <X size={14} />
            </button>
          </div>

          {/* State indicators */}
          <div className="bt-detail-states">
            <div className="bt-state-chip" style={{ background: EMOTION_CONFIG[selectedDay.emotion]?.bg }}>
              <Heart size={12} style={{ color: EMOTION_CONFIG[selectedDay.emotion]?.color }} />
              <span>{EMOTION_CONFIG[selectedDay.emotion]?.label || selectedDay.emotion}</span>
            </div>
            <div className="bt-state-chip">
              <Activity size={12} />
              <span>{selectedDay.engagement}</span>
            </div>
            <div className="bt-state-chip">
              <Zap size={12} />
              <span>{EFFORT_CONFIG[selectedDay.effort]?.label || selectedDay.effort} effort</span>
            </div>
            {selectedDay.recovery && (
              <div className="bt-state-chip bt-recovery-chip">
                <Sunrise size={12} />
                <span>Comeback</span>
              </div>
            )}
          </div>

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
                  <span className="bt-metric-value">{selectedDay.detail.focus_score}</span>
                </div>
              )}
              {selectedDay.detail.high_priority_done > 0 && (
                <div className="bt-metric-row">
                  <span className="bt-metric-label">High priority done</span>
                  <span className="bt-metric-value">{selectedDay.detail.high_priority_done}</span>
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
