// frontend/src/pages/Analytics/Analytics.tsx
import React, { useState, useMemo } from 'react';
import BehaviorTimeline from '../../components/analytics/BehaviorTimeline';
import FocusHeatmap from '../../components/analytics/FocusHeatmap';
import BigFiveProfile from '../../components/analytics/BigFiveProfile';
import MoodTracker from '../../components/analytics/MoodTracker';
import StrategicInsight from '../../components/analytics/StrategicInsight';
import GoalProgress from '../../components/analytics/GoalProgress';
import AIIntelligenceScore from '../../components/analytics/AIIntelligenceScore';
import {
  Sun,
  Moon,
  Sparkles,
  TrendingUp,
  LineChart,
  HeartPulse,
  Target,
  Flame,
  Crosshair,
  RefreshCw,
  AlertTriangle,
  Gauge,
  Smile,
  Fingerprint,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import '../../styles/pages/analytics.css';
import '../../styles/components/analytics/customScrollbar.css';
import { LockedFeature } from '../../components/common/LockedFeature';
import { useUser } from '../../hooks/useUser';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { useProductivityScore } from '../../hooks/useProductivityScore';
import { useFocusScore } from '../../hooks/useFocusScore';
import { useBurnoutRisk } from '../../hooks/useBurnoutRisk';
import { useTheme } from '../../hooks/useTheme';

type AnalyticsTab = 'goals' | 'focus' | 'wellbeing' | 'personality';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('goals');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  
  // Drill-down expansion toggles
  const [showGoalDetails, setShowGoalDetails] = useState(false);
  const [showHeatmapDetails, setShowHeatmapDetails] = useState(false);
  const [showBehaviorDetails, setShowBehaviorDetails] = useState(false);

  const { setTheme, resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const analyticsParticles = useMemo(() => {
    const seeded = (seed: number) => {
      const value = Math.sin(seed * 12.9898) * 43758.5453;
      return value - Math.floor(value);
    };

    return Array.from({ length: 15 }, (_, index) => ({
      key: index,
      animationDelay: `${index * 0.15}s`,
      left: `${(seeded(index + 1) * 100).toFixed(2)}%`,
      top: `${(seeded(index + 101) * 100).toFixed(2)}%`,
    }));
  }, []);

  const { isUltra, user } = useUser();
  const bigFiveIntervalDays = Number((user as any)?.limits?.big_five_interval_days ?? (isUltra ? 7 : 14));

  // Real-time productivity scoring
  const {
    score: productivityData,
    weeklyAverage: weeklyProductivityAvg,
    monthlyAverage: monthlyProductivityAvg,
    isLoading: productivityLoading,
    refresh: refreshProductivity,
  } = useProductivityScore(timeRange);

  // Real-time focus scoring
  const {
    score: focusData,
    weeklyAverage: weeklyFocusAvg,
    monthlyAverage: monthlyFocusAvg,
    isLoading: focusLoading,
    refresh: refreshFocus,
  } = useFocusScore(timeRange);

  // AI-powered burnout risk
  const {
    risk: burnoutData,
    weeklyAverage: weeklyBurnoutAvg,
    monthlyData: monthlyBurnoutData,
    isLoading: burnoutLoading,
    refresh: refreshBurnout,
  } = useBurnoutRisk(timeRange, isUltra);

  // Get real productivity score
  const getRealProductivityScore = (): number | null => {
    if (timeRange === 'monthly' && monthlyProductivityAvg !== null) {
      return Math.round(monthlyProductivityAvg);
    }
    if (timeRange === 'weekly' && weeklyProductivityAvg !== null) {
      return Math.round(weeklyProductivityAvg);
    }
    if (productivityData && productivityData.score !== null) {
      return Math.round(productivityData.score);
    }
    return null;
  };

  const currentProductivityScore = getRealProductivityScore();

  const getDisplayScore = (): number | null => {
    if (productivityLoading && currentProductivityScore === null) return null;
    return currentProductivityScore;
  };

  const getProductivityHeadline = (score: number | null): string => {
    if (score === null) return 'Awaiting Activity';
    if (score >= 85) return 'Exceptional Output';
    if (score >= 70) return 'Solid Momentum';
    if (score >= 50) return 'Steady Progress';
    if (score >= 30) return 'Building Rhythm';
    return 'Action Needed';
  };

  const getProductivityColor = (score: number | null) => {
    if (score === null) return { bg: 'transparent', text: 'var(--text-muted)', glow: 'none' };
    if (score <= 30) return { bg: 'rgba(239, 68, 68, 0.08)', text: '#f87171', glow: 'none' };
    if (score <= 50) return { bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', glow: 'none' };
    if (score <= 70) return { bg: 'rgba(59, 130, 246, 0.08)', text: '#60a5fa', glow: 'none' };
    if (score <= 85) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399', glow: 'none' };
    return { bg: 'rgba(124, 58, 237, 0.1)', text: '#a78bfa', glow: '0 0 15px rgba(124, 58, 237, 0.25)' };
  };

  const productivityColors = getProductivityColor(getDisplayScore());

  // Get real focus score & minutes
  const getRealFocusScore = (): number | null => {
    if (timeRange === 'monthly' && monthlyFocusAvg !== null) {
      return Math.round(monthlyFocusAvg.average_score);
    }
    if (timeRange === 'weekly' && weeklyFocusAvg !== null) {
      return Math.round(weeklyFocusAvg.average_score);
    }
    if (focusData?.score !== null && focusData?.score !== undefined) {
      return Math.round(focusData.score);
    }
    return null;
  };

  const getFocusMinutes = (): number | null => {
    if (timeRange === 'monthly' && monthlyFocusAvg !== null) {
      return monthlyFocusAvg.average_minutes;
    }
    if (timeRange === 'weekly' && weeklyFocusAvg !== null) {
      return weeklyFocusAvg.average_minutes;
    }
    if (focusData?.score !== null && focusData?.score !== undefined) {
      return focusData.total_minutes;
    }
    return null;
  };

  const currentFocusScore = getRealFocusScore();
  const focusMinutes = getFocusMinutes();
  const displayProductivityScore = getDisplayScore();

  const getFocusHeadline = (minutes: number | null): string => {
    if (minutes === null || minutes === 0) return 'No Focus Logged';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ''} Deep Focus`;
    return `${mins}m Deep Focus`;
  };

  const getFocusColor = (score: number | null) => {
    if (score === null) return { bg: 'transparent', text: 'var(--text-muted)', glow: 'none' };
    if (score <= 35) return { bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', glow: 'none' };
    if (score <= 60) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399', glow: 'none' };
    if (score <= 80) return { bg: 'rgba(6, 182, 212, 0.08)', text: '#22d3ee', glow: 'none' };
    return { bg: 'rgba(139, 92, 246, 0.1)', text: '#a78bfa', glow: '0 0 10px rgba(139, 92, 246, 0.3)' };
  };

  const focusColors = getFocusColor(currentFocusScore);

  // Burnout Risk
  const getBurnoutRiskValue = (): number | null => {
    if (!isUltra) return null;
    if (timeRange === 'monthly' && monthlyBurnoutData) return monthlyBurnoutData.average_risk;
    if (timeRange === 'weekly' && weeklyBurnoutAvg) return weeklyBurnoutAvg.average_risk;
    if (burnoutData?.risk !== null && burnoutData?.risk !== undefined) return burnoutData.risk;
    return null;
  };

  const burnoutRiskValue = getBurnoutRiskValue();

  const getBurnoutHeadline = (risk: number | null): string => {
    if (!isUltra) return 'Ultra Feature';
    if (risk === null) return 'Calibrating Rhythm';
    if (risk <= 25) return 'Well Balanced (Low Fatigue)';
    if (risk <= 50) return 'Moderate Workload';
    if (risk <= 75) return 'Elevated Workload';
    return 'High Fatigue Warning';
  };

  const getBurnoutColor = (risk: number | null) => {
    if (!isUltra) return { bg: 'rgba(148, 163, 184, 0.08)', text: '#94a3b8', glow: 'none' };
    if (risk === null) return { bg: 'transparent', text: 'var(--text-muted)', glow: 'none' };
    if (risk <= 25) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399', glow: 'none' };
    if (risk <= 50) return { bg: 'rgba(59, 130, 246, 0.08)', text: '#60a5fa', glow: 'none' };
    if (risk <= 75) return { bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', glow: 'none' };
    return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', glow: '0 0 10px rgba(239, 68, 68, 0.3)' };
  };

  const burnoutColors = getBurnoutColor(burnoutRiskValue);

  const latestMetricTimestamp = useMemo(() => {
    const timestamps = [
      productivityData?.date,
      focusData?.date,
      burnoutData?.date,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps.map((value) => value.getTime())));
  }, [burnoutData?.date, focusData?.date, productivityData?.date]);

  const getLastUpdatedText = () => {
    if (!latestMetricTimestamp) return 'No activity yet';
    const now = new Date();
    const diffMs = now.getTime() - latestMetricTimestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  const isAnyMetricLoading = productivityLoading || focusLoading || (isUltra && burnoutLoading);
  const hasAnyMetricData =
    displayProductivityScore !== null ||
    currentFocusScore !== null ||
    (isUltra && burnoutRiskValue !== null);
  const dataIntegrityLabel = isAnyMetricLoading
    ? 'Updating'
    : hasAnyMetricData
      ? 'Live'
      : 'No data yet';
  const dataIntegrityClass = dataIntegrityLabel === 'Live' ? 'success' : 'warning';

  const handleRefresh = async () => {
    setLoading(true);
    setRefreshMessage(null);
    try {
      await Promise.all([
        refreshProductivity(),
        refreshFocus(),
        ...(isUltra ? [refreshBurnout()] : []),
      ]);
      setRefreshMessage({ type: 'info', text: 'Analytics refreshed with the latest data.' });
    } catch (error) {
      console.error('Failed to refresh analytics:', error);
      setRefreshMessage({ type: 'error', text: 'Refresh failed. Please check your connection and try again.' });
    } finally {
      window.setTimeout(() => setLoading(false), 800);
    }
  };

  return (
    <ErrorBoundary componentName="Analytics">
      <div className={`analytics-page theme-${resolvedTheme}`}>
        {/* Animated Background */}
        <div className="analytics-background">
          <div className="background-waves" />
          <div className="data-grid-overlay" />
          <div className="particles-container">
            {analyticsParticles.map((particle) => (
              <div
                key={particle.key}
                className="data-particle"
                style={{
                  animationDelay: particle.animationDelay,
                  left: particle.left,
                  top: particle.top,
                }}
              />
            ))}
          </div>
        </div>

        <div className="analytics-content-wrapper">
          {/* Top Header */}
          <div className="analytics-navbar">
            <div className="nav-left">
              <div className="analytics-brand">
                <div className="brand-icon-container">
                  <LineChart className="brand-icon" />
                  <div className="brand-pulse" />
                </div>
                <div className="brand-text">
                  <h1 className="brand-title">Performance & Insights</h1>
                  <p className="brand-subtitle">Actionable productivity intelligence and decision guidance</p>
                </div>
              </div>
            </div>

            <div className="nav-right">
              <div className="time-range-selector">
                {[
                  { id: 'daily', label: 'Today' },
                  { id: 'weekly', label: 'This Week' },
                  { id: 'monthly', label: 'This Month' },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={`time-range-btn ${timeRange === item.id ? 'active' : ''}`}
                    onClick={() => setTimeRange(item.id as any)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="nav-actions">
                <button
                  className={`nav-action-btn ${loading ? 'loading' : ''}`}
                  onClick={handleRefresh}
                  title="Refresh Analytics"
                  aria-label="Refresh analytics"
                  disabled={loading}
                >
                  <RefreshCw size={17} className={loading ? 'spinning' : ''} />
                </button>
                <button
                  className="nav-action-btn"
                  onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                </button>
              </div>
            </div>
          </div>

          {refreshMessage && (
            <div className={`analytics-inline-notice ${refreshMessage.type === 'error' ? 'is-error' : 'is-info'}`}>
              <span>{refreshMessage.text}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* 1. TOP DECISION CENTER (Executive Summary)                */}
          {/* ========================================================= */}
          <div className="decision-hero-section">
            <div className="decision-kpi-grid">
              {/* Productivity Tile */}
              <div
                className="decision-kpi-card glass-card"
                style={{
                  background: productivityColors.bg,
                  borderColor: displayProductivityScore ? `${productivityColors.text}33` : undefined,
                }}
              >
                <div className="kpi-header">
                  <div className="kpi-title-group">
                    <span className="kpi-badge-icon" style={{ color: productivityColors.text }}>
                      <TrendingUp size={16} />
                    </span>
                    <span className="kpi-title">Productivity Score</span>
                  </div>
                  <div className="tooltip-wrapper" title="Calculated from completed tasks, habit consistency, and deep work sessions relative to your planned targets.">
                    <HelpCircle size={14} className="help-icon" />
                  </div>
                </div>

                <div className="kpi-value-row">
                  <span className="kpi-number" style={{ color: productivityColors.text }}>
                    {productivityLoading && displayProductivityScore === null
                      ? '...'
                      : displayProductivityScore === null
                        ? '--'
                        : displayProductivityScore}
                  </span>
                  <span className="kpi-unit">/100</span>
                  <div className="kpi-headline" style={{ color: productivityColors.text }}>
                    {getProductivityHeadline(displayProductivityScore)}
                  </div>
                </div>

                <div className="kpi-progress-bar">
                  <div
                    className="kpi-progress-fill"
                    style={{
                      width: `${displayProductivityScore ?? 0}%`,
                      backgroundColor: productivityColors.text,
                    }}
                  />
                </div>

                <div className="kpi-explainer">
                  {displayProductivityScore === null
                    ? 'Complete a task or deep work block to calculate score.'
                    : productivityData?.next_update
                      ? `Recalibrates at ${productivityData.next_update}`
                      : 'Updated live from your planner activity.'}
                </div>
              </div>

              {/* Focus Time & Quality Tile */}
              <div
                className="decision-kpi-card glass-card"
                style={{
                  background: focusColors.bg,
                  borderColor: currentFocusScore ? `${focusColors.text}33` : undefined,
                }}
              >
                <div className="kpi-header">
                  <div className="kpi-title-group">
                    <span className="kpi-badge-icon" style={{ color: focusColors.text }}>
                      <Crosshair size={16} />
                    </span>
                    <span className="kpi-title">Focus Time & Quality</span>
                  </div>
                  <div className="tooltip-wrapper" title="Measures uninterrupted deep work duration and quality during scheduled focus sessions.">
                    <HelpCircle size={14} className="help-icon" />
                  </div>
                </div>

                <div className="kpi-value-row">
                  <span className="kpi-number" style={{ color: focusColors.text }}>
                    {focusLoading && currentFocusScore === null
                      ? '...'
                      : currentFocusScore === null
                        ? '--'
                        : currentFocusScore}
                  </span>
                  <span className="kpi-unit">/100</span>
                  <div className="kpi-headline" style={{ color: focusColors.text }}>
                    {getFocusHeadline(focusMinutes)}
                  </div>
                </div>

                <div className="kpi-progress-bar">
                  <div
                    className="kpi-progress-fill"
                    style={{
                      width: `${currentFocusScore ?? 0}%`,
                      backgroundColor: focusColors.text,
                    }}
                  />
                </div>

                <div className="kpi-explainer">
                  {currentFocusScore === null
                    ? 'Start a Deep Work session to record focus minutes.'
                    : focusData?.grade
                      ? `Session quality rated Grade ${focusData.grade}`
                      : 'Logged from active deep work blocks.'}
                </div>
              </div>

              {/* Workload & Burnout Balance Tile */}
              <div
                className="decision-kpi-card glass-card"
                style={{
                  background: burnoutColors.bg,
                  borderColor: burnoutRiskValue !== null ? `${burnoutColors.text}33` : undefined,
                }}
              >
                <div className="kpi-header">
                  <div className="kpi-title-group">
                    <span className="kpi-badge-icon" style={{ color: burnoutColors.text }}>
                      <HeartPulse size={16} />
                    </span>
                    <span className="kpi-title">Workload Balance</span>
                  </div>
                  <div className="tooltip-wrapper" title="Estimates fatigue risk using session duration, late-night activity, and recovery intervals between intense tasks.">
                    <HelpCircle size={14} className="help-icon" />
                  </div>
                </div>

                <div className="kpi-value-row">
                  <span className="kpi-number" style={{ color: burnoutColors.text }}>
                    {!isUltra
                      ? 'Pro'
                      : burnoutLoading && burnoutRiskValue === null
                        ? '...'
                        : burnoutRiskValue === null
                          ? '--'
                          : `${burnoutRiskValue.toFixed(0)}%`}
                  </span>
                  {isUltra && burnoutRiskValue !== null && <span className="kpi-unit">fatigue</span>}
                  <div className="kpi-headline" style={{ color: burnoutColors.text }}>
                    {getBurnoutHeadline(burnoutRiskValue)}
                  </div>
                </div>

                <div className="kpi-progress-bar">
                  <div
                    className="kpi-progress-fill"
                    style={{
                      width: `${isUltra && burnoutRiskValue !== null ? 100 - burnoutRiskValue : 0}%`,
                      backgroundColor: burnoutColors.text,
                    }}
                  />
                </div>

                <div className="kpi-explainer">
                  {!isUltra
                    ? 'Upgrade to Ultra for fatigue protection & recovery pacing.'
                    : burnoutRiskValue === null
                      ? 'Logs after 3+ days of continuous scheduling.'
                      : burnoutData?.ai_insights?.[0] || 'Workload pacing is healthy.'}
                </div>
              </div>
            </div>

            {/* Strategic Action Priority Banner (What to do next) */}
            {isUltra && (
              <div className="strategic-priority-banner glass-card">
                <div className="priority-banner-header">
                  <div className="banner-title">
                    <Sparkles size={16} className="sparkle-accent" />
                    <span>Leno's Recommended Moves</span>
                  </div>
                  <span className="banner-subtitle">High-leverage adjustments based on your rhythm</span>
                </div>
                <div className="priority-banner-content">
                  <StrategicInsight />
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 2. SECTIONAL TABS FOR DEEP-DIVE ANALYTICS                 */}
          {/* ========================================================= */}
          <div className="analytics-tabs-container">
            <div className="analytics-tabs-nav">
              <button
                className={`analytics-tab-btn ${activeTab === 'goals' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('goals')}
              >
                <Target size={16} />
                <span>Goals & Deadlines</span>
              </button>

              <button
                className={`analytics-tab-btn ${activeTab === 'focus' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('focus')}
              >
                <Zap size={16} />
                <span>Focus & Cognitive Flow</span>
              </button>

              <button
                className={`analytics-tab-btn ${activeTab === 'wellbeing' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('wellbeing')}
              >
                <Activity size={16} />
                <span>Habits & Wellbeing</span>
              </button>

              <button
                className={`analytics-tab-btn ${activeTab === 'personality' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('personality')}
              >
                <Fingerprint size={16} />
                <span>Work Personality</span>
              </button>
            </div>

            {/* Tab Contents */}
            <div className="analytics-tab-panel">
              {/* TAB 1: Goals & Deadlines */}
              {activeTab === 'goals' && (
                <div className="tab-pane">
                  {isUltra ? (
                    <div className="panel-card glass-card">
                      <div className="panel-header">
                        <div className="panel-title-group">
                          <Target size={18} className="text-primary" />
                          <div>
                            <h3>Goal Velocity & Milestone Probability</h3>
                            <p className="panel-subtitle">
                              Predictive completion rates based on current daily hours vs deadline requirements.
                            </p>
                          </div>
                        </div>

                        <button
                          className="drilldown-toggle-btn"
                          onClick={() => setShowGoalDetails((prev) => !prev)}
                        >
                          <span>{showGoalDetails ? 'Collapse Math Breakdown' : 'See Detailed Pace Breakdown'}</span>
                          {showGoalDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>

                      <div className="panel-body">
                        <GoalProgress timeRange={timeRange} />
                      </div>
                    </div>
                  ) : (
                    <LockedFeature title="Goal Analytics & Pace Tracking" className="h-96" />
                  )}
                </div>
              )}

              {/* TAB 2: Focus & Cognitive Flow */}
              {activeTab === 'focus' && (
                <div className="tab-pane">
                  <div className="grid-split-2">
                    {/* Performance Pillars */}
                    <div className="panel-card glass-card">
                      <div className="panel-header">
                        <div className="panel-title-group">
                          <Gauge size={18} className="text-primary" />
                          <div>
                            <h3>Cognitive & Execution Pillars</h3>
                            <p className="panel-subtitle">
                              Performance balance across planning, execution, adaptability, and consistency.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="panel-body">
                        {isUltra ? (
                          <AIIntelligenceScore timeRange={timeRange} />
                        ) : (
                          <LockedFeature title="Cognitive Score" className="h-64" />
                        )}
                      </div>
                    </div>

                    {/* Focus Matrix / Heatmap */}
                    <div className="panel-card glass-card">
                      <div className="panel-header">
                        <div className="panel-title-group">
                          <Flame size={18} className="text-accent" />
                          <div>
                            <h3>Focus Consistency Matrix</h3>
                            <p className="panel-subtitle">
                              Day-by-day session intensity across your selected timeframe.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="panel-body">
                        {isUltra ? (
                          <FocusHeatmap timeRange={timeRange} />
                        ) : (
                          <LockedFeature title="Focus Heatmap" className="h-64" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Habits & Wellbeing */}
              {activeTab === 'wellbeing' && (
                <div className="tab-pane">
                  <div className="grid-split-2">
                    {/* Mood & Energy */}
                    <div className="panel-card glass-card">
                      <div className="panel-header">
                        <div className="panel-title-group">
                          <Smile size={18} className="text-secondary" />
                          <div>
                            <h3>Daily Mood & Energy Check-in</h3>
                            <p className="panel-subtitle">
                              Log daily mental state to discover how mood correlates with deep work output.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="panel-body">
                        <MoodTracker />
                      </div>
                    </div>

                    {/* Behavioral Rhythm Timeline */}
                    <div className="panel-card glass-card">
                      <div className="panel-header">
                        <div className="panel-title-group">
                          <Activity size={18} className="text-success" />
                          <div>
                            <h3>Habit Rhythm & Retention Safety</h3>
                            <p className="panel-subtitle">
                              Anti-dropoff telemetry monitoring daily streak health.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="panel-body" style={{ padding: 0 }}>
                        {isUltra ? (
                          <BehaviorTimeline />
                        ) : (
                          <LockedFeature title="Behavioral Retention" className="h-64" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Work Personality */}
              {activeTab === 'personality' && (
                <div className="tab-pane">
                  <div className="panel-card glass-card full-width-card">
                    <div className="panel-header">
                      <div className="panel-title-group">
                        <Fingerprint size={18} className="text-primary" />
                        <div>
                          <h3>Your Work Personality (Big Five)</h3>
                          <p className="panel-subtitle">
                            Scientifically backed behavioral traits that inform how Leno organizes your schedule.
                          </p>
                        </div>
                      </div>
                      <div className="component-meta">
                        <span>Recalibrates every {bigFiveIntervalDays} days</span>
                      </div>
                    </div>
                    <div className="panel-body">
                      <BigFiveProfile />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Disclaimer Banner */}
          <div className="analytics-disclaimer">
            <AlertTriangle size={14} />
            <span>Optileno analytics compute mathematical projections and behavioral trends to support your decisions.</span>
          </div>

          {/* Data Status Footer */}
          <div className="data-status-footer">
            <div className="status-item">
              <div className={`status-dot ${dataIntegrityClass}`} />
              <span>Engine Status: {dataIntegrityLabel}</span>
            </div>
            <div className="status-item">
              <div className="status-dot success" />
              <span>Last analyzed: {getLastUpdatedText()}</span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
