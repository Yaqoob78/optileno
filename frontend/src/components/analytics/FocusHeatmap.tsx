import React, { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Calendar,
  BarChart3,
  Zap,
  Activity,
  Flame,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { realtimeClient } from '../../services/realtime/socket-client';
import '../../styles/components/analytics/FocusheatMap.css';

// Types
interface DailyScore {
  date: string;
  day?: number;
  score: number | null;
  color: { color: string; label: string } | null;
  activities?: string[];
  breakdown?: {
    deep_work?: number;
    task_focus?: number;
    habit_discipline?: number;
    ai_engagement?: number;
    goal_momentum?: number;
    disruption_penalty?: number;
  };
}

interface FocusStats {
  current_focus: {
    score: number;
    breakdown: DailyScore['breakdown'];
    color: { color: string; label: string };
  };
  weekly: {
    average: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
    peak_day: string | null;
    peak_score: number;
    lowest_day: string | null;
    lowest_score: number;
  };
  monthly: {
    average: number;
    rise: number;
    trend: 'up' | 'down' | 'stable';
    consistency: number;
  };
  activities_today: string[];
}

interface FocusHeatmapProps {
  timeRange?: 'daily' | 'weekly' | 'monthly';
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function FocusHeatmap({ timeRange = 'monthly' }: FocusHeatmapProps) {
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [stats, setStats] = useState<FocusStats | null>(null);
  const [selectedCell, setSelectedCell] = useState<DailyScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const getLabelForScore = useCallback((score: number | null | undefined) => {
    if (score == null) return 'Inactive';
    if (score <= 10) return 'Critical';
    if (score <= 20) return 'Very Low';
    if (score <= 35) return 'Low';
    if (score <= 60) return 'Moderate';
    if (score <= 80) return 'Strong';
    return 'Peak';
  }, []);

  const normalizeColor = useCallback((input: any, score: number | null | undefined) => {
    if (input && typeof input === 'object' && typeof input.color === 'string') {
      return {
        color: input.color,
        label: typeof input.label === 'string' ? input.label : getLabelForScore(score),
      };
    }

    if (typeof input === 'string') {
      return { color: input, label: getLabelForScore(score) };
    }

    if (score == null) return null;
    return { color: '#2a2a2a', label: getLabelForScore(score) };
  }, [getLabelForScore]);

  const normalizeHeatmap = useCallback((raw: any) => {
    if (!raw || !Array.isArray(raw.weeks)) return null;

    return {
      ...raw,
      weeks: raw.weeks.map((week: any[]) => (
        Array.isArray(week)
          ? week.map((cell: any) => {
            if (!cell) return null;
            return {
              ...cell,
              color: normalizeColor(cell.color, cell.score),
            };
          })
          : []
      )),
    };
  }, [normalizeColor]);

  const normalizeStats = useCallback((raw: any): FocusStats | null => {
    if (!raw) return null;
    return {
      current_focus: {
        score: raw.current_focus?.score ?? 0,
        breakdown: raw.current_focus?.breakdown ?? {},
        color: normalizeColor(raw.current_focus?.color, raw.current_focus?.score) || {
          color: '#2a2a2a',
          label: 'Inactive',
        },
      },
      weekly: {
        average: raw.weekly?.average ?? 0,
        change: raw.weekly?.change ?? 0,
        trend: raw.weekly?.trend ?? 'stable',
        peak_day: raw.weekly?.peak_day ?? null,
        peak_score: raw.weekly?.peak_score ?? 0,
        lowest_day: raw.weekly?.lowest_day ?? null,
        lowest_score: raw.weekly?.lowest_score ?? 0,
      },
      monthly: {
        average: raw.monthly?.average ?? 0,
        rise: raw.monthly?.rise ?? 0,
        trend: raw.monthly?.trend ?? 'stable',
        consistency: raw.monthly?.consistency ?? 0,
      },
      activities_today: Array.isArray(raw.activities_today) ? raw.activities_today : [],
    };
  }, [normalizeColor]);

  // Fetch real data from backend API
  const fetchFocusData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const now = new Date();
      const heatmapParams = new URLSearchParams({
        year: now.getFullYear().toString(),
        month: (now.getMonth() + 1).toString(),
        time_range: timeRange,
      });

      // Fetch heatmap and stats in parallel
      const [heatmapRes, statsRes] = await Promise.all([
        fetch(`/api/v1/analytics/focus/heatmap?${heatmapParams.toString()}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`/api/v1/analytics/focus/stats?time_range=${timeRange}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      // Check if responses are actually JSON (not HTML error pages)
      const heatmapContentType = heatmapRes.headers.get('content-type');
      const statsContentType = statsRes.headers.get('content-type');

      if (!heatmapContentType?.includes('application/json') ||
        !statsContentType?.includes('application/json')) {
        throw new Error('API unavailable - server returned non-JSON response');
      }

      if (!heatmapRes.ok || !statsRes.ok) {
        throw new Error(`Failed to fetch focus data: ${heatmapRes.status} ${statsRes.status}`);
      }

      const heatmapData = await heatmapRes.json();
      const statsData = await statsRes.json();

      const normalizedHeatmap = normalizeHeatmap(heatmapData);
      const normalizedStats = normalizeStats(statsData);

      if (!normalizedHeatmap || !normalizedStats) {
        throw new Error('Analytics API returned invalid shape');
      }

      setHeatmapData(normalizedHeatmap);
      setStats(normalizedStats);
    } catch (err: any) {
      console.error('Error fetching focus data:', err);
      setError(err?.message || 'Failed to load focus analytics');
    } finally {
      setIsLoading(false);
    }
  }, [normalizeHeatmap, normalizeStats, timeRange]);

  // Load data on mount
  useEffect(() => {
    fetchFocusData();
  }, [fetchFocusData]);

  // Keep heatmap aligned with real user activity.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const queueRefresh = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        fetchFocusData();
      }, 300);
    };

    realtimeClient.on('analytics:focus:updated', queueRefresh);
    realtimeClient.on('analytics:update', queueRefresh);
    realtimeClient.on('planner:task:updated', queueRefresh);
    realtimeClient.on('planner:habit:completed', queueRefresh);
    realtimeClient.on('planner:deepwork:completed', queueRefresh);

    return () => {
      realtimeClient.off('analytics:focus:updated', queueRefresh);
      realtimeClient.off('analytics:update', queueRefresh);
      realtimeClient.off('planner:task:updated', queueRefresh);
      realtimeClient.off('planner:habit:completed', queueRefresh);
      realtimeClient.off('planner:deepwork:completed', queueRefresh);
      if (timeout) clearTimeout(timeout);
    };
  }, [fetchFocusData]);

  useEffect(() => {
    const interval = setInterval(fetchFocusData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchFocusData]);

  // Format date for display
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Get day of week name
  const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr);
    return DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1];
  };

  const subtitle = (() => {
    if (!heatmapData) return 'Daily productivity patterns';
    if (timeRange === 'daily') return `Today within ${MONTH_NAMES[heatmapData.month - 1]} ${heatmapData.year}`;
    if (timeRange === 'weekly') return `Weekly view in ${MONTH_NAMES[heatmapData.month - 1]} ${heatmapData.year}`;
    return `${MONTH_NAMES[heatmapData.month - 1]} ${heatmapData.year}`;
  })();

  if (isLoading) {
    return (
      <div className="focus-heatmap loading">
        <div className="loading-spinner">
          <RefreshCw size={24} className="spin" />
          <span>Loading focus heatmap...</span>
        </div>
      </div>
    );
  }

  if (error && !heatmapData) {
    return (
      <div className="focus-heatmap loading">
        <div className="loading-spinner" style={{ flexDirection: 'column', gap: '10px' }}>
          <span>Unable to load focus heatmap: {error}</span>
          <button className="refresh-btn" onClick={fetchFocusData} type="button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="focus-heatmap">
      {/* Header */}
      <div className="heatmap-header">
        <div className="header-left">
          <div className="header-icon">
            <BrainCircuit size={24} />
            <div className="icon-pulse" />
          </div>
          <div className="header-text">
            <h3>Focus Heatmap</h3>
            <p className="subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchFocusData} title="Refresh data">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="heatmap-content">
        {/* Main Heatmap Grid */}
        <div className="heatmap-main">
          {/* Day labels */}
          <div className="day-axis">
            <div className="axis-spacer" />
            {DAY_NAMES.map(day => (
              <div key={day} className="day-label">{day}</div>
            ))}
          </div>

          {/* Weeks */}
          <div className="weeks-container">
            {heatmapData?.weeks.map((week: DailyScore[], weekIndex: number) => (
              <div key={weekIndex} className="week-row">
                <div className="week-label">W{weekIndex + 1}</div>
                {week.map((cell: DailyScore | null, dayIndex: number) => (
                  <div
                    key={dayIndex}
                    className={`heatmap-cell ${!cell || cell.score === null ? 'empty' : ''} ${selectedCell?.date === cell?.date ? 'selected' : ''}`}
                    style={{
                      backgroundColor: !cell || cell.score === null ? '#2a2a2a' : (cell?.color?.color || '#e5e7eb'),
                      backgroundImage: !cell || cell.score === null ? 'radial-gradient(circle, #3a3a3a 1px, transparent 1px)' : 'none',
                      backgroundSize: '4px 4px',
                      opacity: !cell || cell.score === null ? 0.6 : 1
                    }}
                    onClick={() => cell && cell.score !== null && setSelectedCell(cell)}
                    onMouseEnter={(e) => {
                      if (cell && cell.score !== null) {
                        const tooltip = e.currentTarget.querySelector('.cell-tooltip') as HTMLElement;
                        if (tooltip) tooltip.style.display = 'block';
                      }
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('.cell-tooltip') as HTMLElement;
                      if (tooltip) tooltip.style.display = 'none';
                    }}
                  >
                    {cell?.day != null && <span className="cell-day">{cell.day}</span>}
                    {cell?.score != null && <span className="cell-score">{cell.score}%</span>}
                    {(!cell || cell.score === null) && <span className="cell-score" style={{ color: '#666', fontSize: '10px' }}>—</span>}

                    {/* Tooltip */}
                    {cell && cell.score !== null && (
                      <div className="cell-tooltip">
                        <div className="tooltip-header">
                          <span className="tooltip-date">{formatDate(cell.date)}</span>
                          <span className="tooltip-score">{cell.score}%</span>
                        </div>
                        <div className="tooltip-label">{cell.color?.label}</div>
                        {cell.activities && cell.activities.length > 0 && (
                          <div className="tooltip-activities">
                            {cell.activities.map((a, i) => (
                              <div key={i} className="tooltip-activity">
                                <CheckCircle size={10} />
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="heatmap-legend">
            <span className="legend-label">Less</span>
            <div className="legend-scale">
              <div className="legend-item" style={{ backgroundColor: '#2a2a2a', backgroundImage: 'radial-gradient(circle, #3a3a3a 1px, transparent 1px)', backgroundSize: '4px 4px' }} title="No Data" />
              {[
                { color: '#ef4444', label: '0-10%' },
                { color: '#fecaca', label: '11-20%' },
                { color: '#fde68a', label: '21-39%' },
                { color: '#3b82f6', label: '40-70%' },
                { color: '#16a34a', label: '71-90%' },
                { color: '#15803d', label: '91-100%' },
              ].map((item, i) => (
                <div
                  key={i}
                  className="legend-item"
                  style={{ backgroundColor: item.color }}
                  title={item.label}
                />
              ))}
            </div>
            <span className="legend-label">More</span>
          </div>
        </div>

        {/* Stats Section - Moved below the heatmap */}
        <div className="stats-section">
          <div className="stats-grid">
            {/* Current Focus */}
            <div className="stat-card current-focus">
              <div className="stat-header">
                <Target size={14} />
                <span>Current Focus</span>
              </div>
              <div className="focus-score-display">
                <div
                  className="score-circle"
                  style={{
                    background: stats?.current_focus.score != null
                      ? `conic-gradient(${stats?.current_focus.color?.color || '#3b82f6'} ${(stats?.current_focus.score || 0) * 3.6}deg, #e5e7eb 0deg)`
                      : '#2a2a2a',
                    border: stats?.current_focus.score == null ? '1px dashed #444' : 'none'
                  }}
                >
                  <div className="score-inner">
                    <span className="score-value">{stats?.current_focus.score !== null ? `${stats?.current_focus.score}%` : '--'}</span>
                    <span className="score-label">{stats?.current_focus.color?.label || 'Inactive'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Average */}
            <div className="stat-card">
              <div className="stat-header">
                <Calendar size={14} />
                <span>Weekly Avg</span>
              </div>
              <div className="stat-value-row">
                <span className="stat-value">{stats?.weekly.average || 0}%</span>
                <div className="stat-change">
                  {stats?.weekly.trend === 'up' ? <TrendingUp size={12} className="trend-icon trend-up" /> :
                    stats?.weekly.trend === 'down' ? <TrendingDown size={12} className="trend-icon trend-down" /> :
                      <Minus size={12} className="trend-icon trend-stable" />}
                  <span className={`change-value ${(stats?.weekly.change || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(stats?.weekly.change || 0) >= 0 ? '+' : ''}{stats?.weekly.change || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Average */}
            <div className="stat-card">
              <div className="stat-header">
                <BarChart3 size={14} />
                <span>Monthly Avg</span>
              </div>
              <div className="stat-value-row">
                <span className="stat-value">{stats?.monthly.average || 0}%</span>
                <div className="stat-change">
                  {stats?.monthly.trend === 'up' ? <TrendingUp size={12} className="trend-icon trend-up" /> :
                    stats?.monthly.trend === 'down' ? <TrendingDown size={12} className="trend-icon trend-down" /> :
                      <Minus size={12} className="trend-icon trend-stable" />}
                  <span className={`change-value ${(stats?.monthly.rise || 0) >= 0 ? 'positive' : 'negative'}`}>
                    {(stats?.monthly.rise || 0) >= 0 ? '+' : ''}{stats?.monthly.rise || 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Peak Day */}
            <div className="stat-card highlight">
              <div className="stat-header">
                <Zap size={14} />
                <span>Peak Day</span>
              </div>
              <div className="stat-content">
                <span className="stat-day">{stats?.weekly.peak_day || '--'}</span>
                <span className="stat-score success">{stats?.weekly.peak_score || 0}%</span>
              </div>
            </div>

            {/* Lowest Day */}
            <div className="stat-card">
              <div className="stat-header">
                <Activity size={14} />
                <span>Lowest Day</span>
              </div>
              <div className="stat-content">
                <span className="stat-day">{stats?.weekly.lowest_day || '--'}</span>
                <span className="stat-score muted">{stats?.weekly.lowest_score || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Cell Details */}
      {selectedCell && (
        <div className="selected-day-panel">
          <div className="panel-header">
            <h4>{formatDate(selectedCell.date)} Details</h4>
            <button className="close-btn" onClick={() => setSelectedCell(null)}>×</button>
          </div>
          <div className="panel-content">
            <div className="detail-score">
              <span className="label">Focus Score</span>
              <span className="value" style={{ color: selectedCell.color?.color }}>{selectedCell.score !== null ? `${selectedCell.score}%` : 'N/A'}</span>
            </div>
            {selectedCell.breakdown && (
              <div className="breakdown-grid">
                <div className="breakdown-item">
                  <span className="breakdown-label">Deep Work</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{ width: `${selectedCell.breakdown.deep_work || 0}%`, backgroundColor: '#10b981' }} />
                  </div>
                  <span className="breakdown-value">{Math.round(selectedCell.breakdown.deep_work || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Task Focus</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{ width: `${selectedCell.breakdown.task_focus || 0}%`, backgroundColor: '#3b82f6' }} />
                  </div>
                  <span className="breakdown-value">{Math.round(selectedCell.breakdown.task_focus || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Habit Discipline</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{ width: `${selectedCell.breakdown.habit_discipline || 0}%`, backgroundColor: '#f1f5f9', opacity: 0.8 }} />
                  </div>
                  <span className="breakdown-value">{Math.round(selectedCell.breakdown.habit_discipline || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">AI Engagement</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{ width: `${selectedCell.breakdown.ai_engagement || 0}%`, backgroundColor: '#eab308' }} />
                  </div>
                  <span className="breakdown-value">{Math.round(selectedCell.breakdown.ai_engagement || 0)}</span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">Goal Momentum</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{ width: `${selectedCell.breakdown.goal_momentum || 0}%`, backgroundColor: '#8b5cf6' }} />
                  </div>
                  <span className="breakdown-value">{Math.round(selectedCell.breakdown.goal_momentum || 0)}</span>
                </div>
                <div className="breakdown-item penalty">
                  <span className="breakdown-label">Disruption Factor</span>
                  <div className="breakdown-bar">
                    <div className="bar-fill" style={{
                      width: `${100 - (selectedCell.breakdown.disruption_penalty || 0)}%`,
                      backgroundColor: '#ef4444'
                    }} />
                  </div>
                  <span className="breakdown-value">-{Math.round(selectedCell.breakdown.disruption_penalty || 0)}%</span>
                </div>
              </div>
            )}
            {selectedCell.activities && selectedCell.activities.length > 0 && (
              <div className="detail-activities">
                <span className="label">Activities</span>
                <ul>
                  {selectedCell.activities.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
