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
  Fingerprint
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


export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const { theme, setTheme } = useTheme();
  const resolvedTheme: 'dark' | 'light' =
    theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
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

  // Get real productivity score (not hardcoded)
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

  // Get display score based on time range
  const getDisplayScore = (): number | null => {
    if (productivityLoading && currentProductivityScore === null) return null;
    return currentProductivityScore;
  };

  const getScoreLabel = () => {
    if (timeRange === 'monthly') return 'Monthly Average';
    if (timeRange === 'weekly') return 'Weekly Average';
    return 'Today\'s Score';
  };

  // Dynamic color based on score
  const getProductivityColor = (score: number | null) => {
    if (score === null) return { bg: 'transparent', text: 'var(--text-muted)', glow: 'none' };
    if (score === 0) return { bg: '#1a0000', text: '#ff0000', glow: '0 0 20px rgba(255, 0, 0, 0.6)' }; // Extreme red with glow
    if (score <= 5) return { bg: '#2a0000', text: '#ff1a1a', glow: '0 0 15px rgba(255, 26, 26, 0.5)' }; // Very strong red
    if (score <= 15) return { bg: '#3a0a0a', text: '#ff3333', glow: '0 0 10px rgba(255, 51, 51, 0.4)' }; // Strong red
    if (score <= 30) return { bg: '#4a1a1a', text: '#ff6666', glow: 'none' }; // Medium red
    if (score <= 50) return { bg: 'transparent', text: 'var(--text-primary)', glow: 'none' }; // White/normal
    if (score <= 70) return { bg: 'rgba(16, 185, 129, 0.05)', text: '#10b981', glow: 'none' }; // Light green
    if (score <= 85) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#059669', glow: '0 0 5px rgba(16, 185, 129, 0.2)' }; // Green
    if (score <= 95) return { bg: 'rgba(124, 58, 237, 0.1)', text: '#7c3aed', glow: '0 0 10px rgba(124, 58, 237, 0.3)' }; // Purple
    return { bg: 'rgba(251, 191, 36, 0.15)', text: '#f59e0b', glow: '0 0 15px rgba(245, 158, 11, 0.5)' }; // Gold with glow
  };

  const productivityColors = getProductivityColor(getDisplayScore());

  // Get real focus score (not hardcoded)
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

  // Dynamic color for focus score
  const getFocusColor = (score: number) => {
    if (score === 0) return { bg: '#1a0000', text: '#ff0000', glow: '0 0 20px rgba(255, 0, 0, 0.6)' };
    if (score <= 10) return { bg: '#ef4444', text: '#ffffff', glow: 'none' };
    if (score <= 20) return { bg: '#f97316', text: '#ffffff', glow: 'none' };
    if (score <= 35) return { bg: '#eab308', text: '#000000', glow: 'none' };
    if (score <= 60) return { bg: '#10b981', text: '#ffffff', glow: 'none' };
    if (score <= 80) return { bg: '#06b6d4', text: '#ffffff', glow: '0 0 5px rgba(6, 182, 212, 0.2)' };
    return { bg: '#8b5cf6', text: '#ffffff', glow: '0 0 10px rgba(139, 92, 246, 0.4)' };
  };

  const focusColors = getFocusColor(currentFocusScore ?? 0);

  const getBurnoutRiskValue = (): number | null => {
    if (!isUltra) return null;
    if (timeRange === 'monthly' && monthlyBurnoutData) return monthlyBurnoutData.average_risk;
    if (timeRange === 'weekly' && weeklyBurnoutAvg) return weeklyBurnoutAvg.average_risk;
    if (burnoutData?.risk !== null && burnoutData?.risk !== undefined) return burnoutData.risk;
    return null;
  };

  const getBurnoutLevel = (): string | null => {
    if (!isUltra) return null;
    if (timeRange === 'monthly' && monthlyBurnoutData?.level) return monthlyBurnoutData.level;
    if (timeRange === 'weekly' && weeklyBurnoutAvg?.level) return weeklyBurnoutAvg.level;
    if (burnoutData?.level) return burnoutData.level;
    return null;
  };

  const burnoutRiskValue = getBurnoutRiskValue();
  const burnoutLevel = getBurnoutLevel();

  const stats = [
    {
      label: 'Productivity Score',
      value:
        productivityLoading && displayProductivityScore === null
          ? '...'
          : displayProductivityScore === null
            ? '--'
            : displayProductivityScore.toString(),
      change: displayProductivityScore === null ? 'No Data Yet' : (productivityData?.grade || getScoreLabel()),
      trend:
        displayProductivityScore === null
          ? 'neutral'
          : displayProductivityScore > 60
            ? 'up'
            : displayProductivityScore > 40
              ? 'neutral'
              : 'down',
      icon: TrendingUp,
      progress: displayProductivityScore ?? 0,
      subtitle:
        displayProductivityScore === null
          ? 'Complete a task, habit, chat, or deep work to generate a score.'
          : productivityData?.next_update
            ? `Updates at ${productivityData.next_update}`
            : undefined,
      customColors: productivityColors
    },
    {
      label: 'Focus Score',
      value:
        focusLoading && currentFocusScore === null
          ? '...'
          : currentFocusScore === null
            ? '--'
            : currentFocusScore.toString(),
      change: focusData?.status || (focusMinutes !== null ? `${focusMinutes}m total` : 'No Data Yet'),
      trend:
        currentFocusScore === null
          ? 'neutral'
          : currentFocusScore > 60
            ? 'up'
            : currentFocusScore > 40
              ? 'neutral'
              : 'down',
      icon: Crosshair,
      progress: currentFocusScore ?? 0,
      subtitle:
        currentFocusScore === null
          ? 'Complete a task, habit, or deep work session to generate a focus score.'
          : focusData?.grade
            ? `Grade: ${focusData.grade}`
            : undefined,
      customColors: focusColors
    },
    {
      label: 'Burnout Risk',
      value: !isUltra
        ? 'Locked'
        : burnoutLoading && burnoutRiskValue === null
          ? '...'
          : burnoutRiskValue === null
            ? '--'
            : `${burnoutRiskValue.toFixed(0)}%`,
      change: (() => {
        if (!isUltra) return 'Ultra only';
        return burnoutLevel || 'No Data Yet';
      })(),
      trend: (() => {
        if (!isUltra || burnoutRiskValue === null) return 'neutral';
        return burnoutRiskValue < 40 ? 'down' : burnoutRiskValue < 60 ? 'neutral' : 'up';
      })(),
      icon: HeartPulse,
      progress: (() => {
        if (!isUltra || burnoutRiskValue === null) return 0;
        return 100 - burnoutRiskValue; // Invert for progress bar (lower risk = higher progress)
      })(),
      subtitle:
        burnoutRiskValue === null
          ? 'Complete tasks, habits, or deep work and this will start tracking.'
          : burnoutData?.ai_insights?.[0] || monthlyBurnoutData?.note,
      customColors: (() => {
        if (!isUltra) {
          return { bg: 'rgba(148, 163, 184, 0.08)', text: '#94a3b8', glow: 'none' };
        }
        if (burnoutRiskValue === null) {
          return { bg: 'transparent', text: 'var(--text-muted)', glow: 'none' };
        }

        // Inverted colors (low risk = green, high risk = red)
        if (burnoutRiskValue === 0) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', glow: '0 0 10px rgba(16, 185, 129, 0.3)' };
        if (burnoutRiskValue <= 20) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669', glow: 'none' };
        if (burnoutRiskValue <= 40) return { bg: 'transparent', text: 'var(--text-primary)', glow: 'none' };
        if (burnoutRiskValue <= 60) return { bg: 'rgba(251, 191, 36, 0.08)', text: '#f59e0b', glow: 'none' };
        if (burnoutRiskValue <= 80) return { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444', glow: '0 0 8px rgba(239, 68, 68, 0.3)' };
        return { bg: '#2a0000', text: '#ff1a1a', glow: '0 0 15px rgba(255, 26, 26, 0.5)' }; // Critical
      })()
    },
  ];

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

  // Calculate last updated time
  const getLastUpdatedText = () => {
    if (!latestMetricTimestamp) return 'No activity yet';
    const now = new Date();
    const diffMs = now.getTime() - latestMetricTimestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
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

  // Handle refresh
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

  // Handle time range change
  const handleTimeRangeChange = (range: 'daily' | 'weekly' | 'monthly') => {
    setTimeRange(range);
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
                  top: particle.top
                }}
              />
            ))}
          </div>
        </div>

        <div className="analytics-content-wrapper">
          {/* Top Navigation / Header */}
          <div className="analytics-navbar">
            <div className="nav-left">
              <div className="analytics-brand">
                <div className="brand-icon-container">
                  <LineChart className="brand-icon" />
                  <div className="brand-pulse" />
                </div>
                <div className="brand-text">
                  <h1 className="brand-title">Performance Analytics</h1>
                  <p className="brand-subtitle">Live scores, behavior patterns, and AI insights</p>
                </div>
              </div>
            </div>

            <div className="nav-right">
              <div className="time-range-selector">
                {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                  <button
                    key={range}
                    className={`time-range-btn ${timeRange === range ? 'active' : ''}`}
                    onClick={() => handleTimeRangeChange(range)}
                  >
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </button>
                ))}
              </div>

              <div className="nav-actions">
                <button className={`nav-action-btn ${loading ? 'loading' : ''}`} onClick={handleRefresh} title="Refresh Analytics" aria-label="Refresh analytics" disabled={loading}>
                  <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                </button>
                <button
                  className="nav-action-btn"
                  onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
                  title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>
          </div>

          {refreshMessage && (
            <div className={`analytics-inline-notice ${refreshMessage.type === 'error' ? 'is-error' : 'is-info'}`}>
              <span>{refreshMessage.text}</span>
            </div>
          )}

          {/* Stats Dashboard - 4 Cards at Top */}
          <div className="stats-overview-grid">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="stat-card glass-card"
                style={(stat as any).customColors ? {
                  background: (stat as any).customColors.bg,
                  boxShadow: (stat as any).customColors.glow
                } : {}}
              >
                <div className="stat-header">
                  <div className="stat-icon-wrapper">
                    <stat.icon className="stat-icon" size={20} />
                  </div>
                  <div className={`trend-indicator ${stat.trend}`}>
                    <span>{stat.change}</span>
                  </div>
                </div>
                <div
                  className="stat-value"
                  style={(stat as any).customColors ? {
                    color: (stat as any).customColors.text,
                    textShadow: (stat as any).customColors.glow
                  } : {}}
                >
                  {stat.value}
                </div>
                <div className="stat-label" title={stat.label}>{stat.label}</div>
                {(stat as any).subtitle && (
                  <div className="stat-subtitle">
                    {(stat as any).subtitle}
                  </div>
                )}
                <div className="stat-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${stat.progress}%`,
                        background: (stat as any).customColors
                          ? (stat as any).customColors.text
                          : stat.trend === 'up' || stat.trend === 'neutral'
                            ? 'linear-gradient(90deg, var(--primary), var(--secondary))'
                            : 'linear-gradient(90deg, var(--warning), var(--accent))'
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Analytics Grid - 6 Components */}
          <div className="analytics-main-grid">
            {/* Left Column - 3 Components */}
            <div className="grid-column left-column">
              {/* Performance Score */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Gauge size={18} />
                        <h3>Performance Score</h3>
                      </div>
                    </div>
                    <div className="component-content">
                      <AIIntelligenceScore timeRange={timeRange} />
                    </div>
                  </>
                ) : <LockedFeature title="Performance Score" className="h-full" />}
              </div>

              {/* Mood Tracker */}
              <div className="component-card glass-card">
                <>
                  <div className="component-header">
                    <div className="component-title">
                      <Smile size={18} />
                      <h3>Mood Tracker</h3>
                    </div>
                  </div>
                  <div className="component-content">
                    <MoodTracker />
                  </div>
                </>
              </div>

              {/* Goal Progress */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Target size={18} />
                        <h3>Goal Analytics</h3>
                      </div>
                    </div>
                    <div className="component-content">
                      <GoalProgress timeRange={timeRange} />
                    </div>
                  </>
                ) : <LockedFeature title="Goal Analytics" className="h-full" />}
              </div>
            </div>

            {/* Right Column - 3 Components */}
            <div className="grid-column right-column">
              {/* Focus Heatmap */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Flame size={18} />
                        <h3>Focus Heatmap</h3>
                      </div>
                    </div>
                    <div className="component-content">
                      <FocusHeatmap timeRange={timeRange} />
                    </div>
                  </>
                ) : <LockedFeature title="Focus Heatmap" className="h-full" />}
              </div>

              {/* AI Strategic Insight */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Sparkles size={18} />
                        <h3>What to focus on</h3>
                      </div>
                    </div>
                    <div className="component-content">
                      <StrategicInsight />
                    </div>
                  </>
                ) : <LockedFeature title="What to focus on" className="h-full" />}
              </div>

              {/* Behavior Timeline */}
              <div className="component-card glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                {isUltra ? (
                  <BehaviorTimeline />
                ) : <LockedFeature title="Behavior Timeline" className="h-full" />}
              </div>
            </div>
          </div>

          {/* Bottom Section - Big Five Behavioral Profile (Full Width) */}
          <div className="analytics-bottom-section">
            <div className="component-card glass-card full-width-card" style={{ height: 'auto', minHeight: '400px' }}>
              <>
                <div className="component-header">
                  <div className="component-title">
                    <Fingerprint size={18} className="text-primary" />
                    <h3>Your Work Personality</h3>
                  </div>
                  <div className="component-meta">
                    <span>Updates every {bigFiveIntervalDays} days</span>
                  </div>
                </div>
                <div className="component-content">
                  <BigFiveProfile />
                </div>
              </>
            </div>
          </div>

          {/* AI Disclaimer Banner */}
          <div className="flex items-center justify-center gap-2 p-3 mt-4 mb-2 mx-4 sm:mx-8 text-xs text-amber-500 bg-amber-500/10 rounded-lg border border-amber-500/20 text-center shadow-inner">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>Note: These analytics are based on complex mathematical logic and artificial intelligence. They can sometimes be inaccurate.</span>
          </div>

          {/* Data Status Footer */}
          <div className="data-status-footer">
            <div className="status-item">
              <div className={`status-dot ${dataIntegrityClass}`} />
              <span>Data: {dataIntegrityLabel}</span>
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
