import React, { useState, useEffect } from 'react';
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
  Brain,
  Activity,
  BarChart3,
  Target,
  Zap,
  Clock,
  TrendingDown,
  ChevronRight,
  Download,
  RefreshCw,
  Info,
  Shield,
  Cpu,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  Trophy,
  Fingerprint
} from 'lucide-react';
import '../../styles/pages/analytics.css';
import '../../styles/components/analytics/customScrollbar.css';
import { LockedFeature } from '../../components/common/LockedFeature';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { useUser } from '../../hooks/useUser';
import { useRealtime } from '../../hooks/useRealtime';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { useProductivityScore } from '../../hooks/useProductivityScore';
import { useFocusScore } from '../../hooks/useFocusScore';
import { useBurnoutRisk } from '../../hooks/useBurnoutRisk';


export default function AnalyticsPage() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [loading, setLoading] = useState<boolean>(false);

  // Safe time range for hooks that don't support yearly yet
  const safeTimeRange = timeRange === 'yearly' ? 'monthly' : timeRange;

  // Use subscription tier and owner status for premium features
  const { isUltra: storeIsUltra, user } = useUser();
  const isOwner = user?.email?.toLowerCase().trim() === 'khan011504@gmail.com';
  const isUltra = storeIsUltra || isOwner || user?.role === 'premium' || user?.role === 'admin' || user?.planType === 'ULTRA';
  const navigate = useNavigate();

  const {
    dailyMetrics,
    userInsights,
    currentMetrics,
    fetchAnalytics,
    fetchHistoricalAnalytics,
    detectedPatterns,
    predictions,
    focusSessions,
    logEvent
  } = useAnalyticsStore();

  // Real-time integration
  const { onAnalyticsUpdate, onInsightGenerated } = useRealtime();

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Subscribe to real-time analytics updates
  useEffect(() => {
    const unsubscribeAnalytics = onAnalyticsUpdate(() => {
      fetchAnalytics(); // Refresh analytics when update received
    });

    const unsubscribeInsight = onInsightGenerated(() => {
      fetchAnalytics(); // Refresh analytics when new insight generated
    });

    return () => {
      unsubscribeAnalytics?.();
      unsubscribeInsight?.();
    };
  }, [fetchAnalytics, onAnalyticsUpdate, onInsightGenerated]);

  // Real-time productivity scoring
  const {
    score: productivityData,
    weeklyAverage: weeklyProductivityAvg,
    monthlyAverage: monthlyProductivityAvg,
    isLoading: productivityLoading
  } = useProductivityScore(safeTimeRange);

  // Real-time focus scoring
  const {
    score: focusData,
    weeklyAverage: weeklyFocusAvg,
    monthlyAverage: monthlyFocusAvg,
    isLoading: focusLoading
  } = useFocusScore(safeTimeRange);

  // AI-powered burnout risk
  const {
    risk: burnoutData,
    weeklyAverage: weeklyBurnoutAvg,
    monthlyData: monthlyBurnoutData,
    isLoading: burnoutLoading
  } = useBurnoutRisk(safeTimeRange);

  // Get real productivity score (not hardcoded)
  const getRealProductivityScore = () => {
    if (timeRange === 'monthly' && monthlyProductivityAvg !== null) {
      return Math.round(monthlyProductivityAvg);
    } else if (timeRange === 'weekly' && weeklyProductivityAvg !== null) {
      return Math.round(weeklyProductivityAvg);
    } else if (productivityData) {
      return Math.round(productivityData.score);
    }
    // Fallback to persisted store metrics (prevents 0 flash on refresh)
    if (currentMetrics.productivityScore > 0) {
      return Math.round(currentMetrics.productivityScore);
    }
    return 0; // Start from 0, not hardcoded value
  };

  const currentProductivityScore = getRealProductivityScore();

  // Get display score based on time range
  const getDisplayScore = () => {
    // Show persisted data while loading (Stale-while-revalidate)
    // Only return 0 if we truly have no data and are loading
    if (productivityLoading && currentProductivityScore === 0) return 0;
    return currentProductivityScore;
  };

  const getScoreLabel = () => {
    if (timeRange === 'monthly') return 'Monthly Average';
    if (timeRange === 'weekly') return 'Weekly Average';
    return 'Today\'s Score';
  };

  // Dynamic color based on score
  const getProductivityColor = (score: number) => {
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
  const getRealFocusScore = () => {
    if (timeRange === 'monthly' && monthlyFocusAvg !== null) {
      if (typeof monthlyFocusAvg === 'object' && 'average_score' in monthlyFocusAvg) {
        return Math.round(monthlyFocusAvg.average_score);
      }
      return Math.round(currentMetrics.focusScore || 0);
    } else if (timeRange === 'weekly' && weeklyFocusAvg !== null) {
      if (typeof weeklyFocusAvg === 'object' && 'average_score' in weeklyFocusAvg) {
        return Math.round(weeklyFocusAvg.average_score);
      }
      return Math.round(currentMetrics.focusScore || 0);
    } else if (focusData) {
      return Math.round(focusData.score);
    }
    return Math.round(currentMetrics.focusScore || 0);
  };

  const getFocusMinutes = () => {
    if (timeRange === 'monthly' && monthlyFocusAvg !== null) {
      return monthlyFocusAvg.average_minutes;
    } else if (timeRange === 'weekly' && weeklyFocusAvg !== null) {
      return weeklyFocusAvg.average_minutes;
    } else if (focusData) {
      return focusData.total_minutes;
    }
    return Math.round(currentMetrics.averageFocusDuration || 0);
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

  const focusColors = getFocusColor(currentFocusScore);

  const stats = [
    {
      label: 'Productivity Score',
      value: productivityLoading && displayProductivityScore === 0 ? '...' : displayProductivityScore.toString(),
      change: productivityData?.grade || getScoreLabel(),
      trend: displayProductivityScore > 60 ? 'up' : displayProductivityScore > 40 ? 'neutral' : 'down',
      icon: TrendingUp,
      progress: displayProductivityScore,
      subtitle: productivityData?.next_update ? `Updates at ${productivityData.next_update}` : undefined,
      customColors: productivityColors
    },
    {
      label: 'Focus Score',
      value: focusLoading && currentFocusScore === 0 ? '...' : currentFocusScore.toString(),
      change: focusData?.status || `${focusMinutes}m total`,
      trend: currentFocusScore > 60 ? 'up' : currentFocusScore > 40 ? 'neutral' : 'down',
      icon: Clock,
      progress: currentFocusScore,
      subtitle: focusData?.grade ? `Grade: ${focusData.grade}` : undefined,
      customColors: focusColors
    },
    {
      label: 'Burnout Risk',
      value: burnoutLoading ? '...' : (() => {
        if (timeRange === 'monthly' && monthlyBurnoutData) return `${monthlyBurnoutData.average_risk.toFixed(0)}%`;
        if (timeRange === 'weekly' && weeklyBurnoutAvg) return `${weeklyBurnoutAvg.average_risk.toFixed(0)}%`;
        if (burnoutData) return `${burnoutData.risk.toFixed(0)}%`;
        return '--';
      })(),
      change: (() => {
        if (timeRange === 'monthly' && monthlyBurnoutData) return monthlyBurnoutData.level;
        if (timeRange === 'weekly' && weeklyBurnoutAvg) return weeklyBurnoutAvg.level;
        return burnoutData?.level || 'Low';
      })(),
      trend: (() => {
        const risk = timeRange === 'monthly' && monthlyBurnoutData ? monthlyBurnoutData.average_risk
          : timeRange === 'weekly' && weeklyBurnoutAvg ? weeklyBurnoutAvg.average_risk
            : burnoutData?.risk || 0;
        return risk < 40 ? 'down' : risk < 60 ? 'neutral' : 'up';
      })(),
      icon: Activity,
      progress: (() => {
        const risk = timeRange === 'monthly' && monthlyBurnoutData ? monthlyBurnoutData.average_risk
          : timeRange === 'weekly' && weeklyBurnoutAvg ? weeklyBurnoutAvg.average_risk
            : burnoutData?.risk || 0;
        return 100 - risk; // Invert for progress bar (lower risk = higher progress)
      })(),
      subtitle: burnoutData?.ai_insights?.[0] || monthlyBurnoutData?.note,
      customColors: (() => {
        const risk = timeRange === 'monthly' && monthlyBurnoutData ? monthlyBurnoutData.average_risk
          : timeRange === 'weekly' && weeklyBurnoutAvg ? weeklyBurnoutAvg.average_risk
            : burnoutData?.risk || 0;

        // Inverted colors (low risk = green, high risk = red)
        if (risk === 0) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', glow: '0 0 10px rgba(16, 185, 129, 0.3)' };
        if (risk <= 20) return { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669', glow: 'none' };
        if (risk <= 40) return { bg: 'transparent', text: 'var(--text-primary)', glow: 'none' };
        if (risk <= 60) return { bg: 'rgba(251, 191, 36, 0.08)', text: '#f59e0b', glow: 'none' };
        if (risk <= 80) return { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444', glow: '0 0 8px rgba(239, 68, 68, 0.3)' };
        return { bg: '#2a0000', text: '#ff1a1a', glow: '0 0 15px rgba(255, 26, 26, 0.5)' }; // Critical
      })()
    },
    {
      label: 'AI-Powered Analytics',
      value: 'AI',
      change: 'Real-Time',
      trend: 'neutral',
      icon: Brain,
      progress: 100,
      isDisclaimer: true,
      customColors: {
        bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
        text: 'transparent',
        glow: 'none'
      }
    }
  ];

  // Calculate last updated time
  const getLastUpdatedText = () => {
    if (currentMetrics.lastUpdated) {
      const now = new Date();
      const updated = new Date(currentMetrics.lastUpdated);
      const diffMs = now.getTime() - updated.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      return `${Math.floor(diffMins / 60)}h ago`;
    }
    return 'Syncing...';
  };

  // Handle refresh
  const handleRefresh = async () => {
    setLoading(true);
    await fetchAnalytics();
    setTimeout(() => setLoading(false), 800);
  };

  // Handle time range change
  const handleTimeRangeChange = (range: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    setTimeRange(range);
    if (range === 'yearly') {
      // Show yearly message
      return;
    }
    fetchHistoricalAnalytics(range);
  };

  return (
    <ErrorBoundary componentName="Analytics">
      <div className={`analytics-page theme-${darkMode ? 'dark' : 'light'}`}>
        {/* Animated Background */}
        <div className="analytics-background">
          <div className="background-waves" />
          <div className="data-grid-overlay" />
          <div className="particles-container">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="data-particle" style={{
                animationDelay: `${i * 0.15}s`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`
              }} />
            ))}
          </div>
        </div>

        <div className="analytics-content-wrapper">
          {/* Top Navigation / Header */}
          <div className="analytics-navbar">
            <div className="nav-left">
              <div className="analytics-brand">
                <div className="brand-icon-container">
                  <Brain className="brand-icon" />
                  <div className="brand-pulse" />
                </div>
                <div className="brand-text">
                  <h1 className="brand-title">Intelligence Nexus</h1>
                  <p className="brand-subtitle">AI-Powered Performance Analytics</p>
                </div>
              </div>
            </div>

            <div className="nav-right">
              <div className="time-range-selector">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((range) => (
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
                <button className="nav-action-btn" onClick={handleRefresh} title="Refresh Analytics">
                  <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                </button>
                <button
                  className="nav-action-btn"
                  onClick={() => setDarkMode(!darkMode)}
                  title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              </div>
            </div>
          </div>

          {/* Yearly Message - Shown when time range is yearly */}
          {timeRange === 'yearly' && (
            <div className="glass-card p-8 rounded-xl text-center my-6">
              <div className="flex flex-col items-center justify-center">
                <Trophy className="w-16 h-16 text-yellow-500 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Yearly Analytics Report</h2>
                <p className="text-gray-300 mb-4">
                  Your comprehensive yearly analytics will be ready on January 1, 2027.
                </p>
                <p className="text-gray-400 text-sm">
                  Real-time analysis in progress. We'll deliver your personalized insights and performance summary.
                </p>
              </div>
            </div>
          )}

          {/* Stats Dashboard - 4 Cards at Top */}
          <div className="stats-overview-grid">
            {stats.map((stat, index) => {
              const isDisclaimer = (stat as any).isDisclaimer;

              return (
                <div
                  key={index}
                  className={`stat-card glass-card ${isDisclaimer ? 'disclaimer-card' : ''}`}
                  style={(stat as any).customColors ? {
                    background: (stat as any).customColors.bg,
                    boxShadow: (stat as any).customColors.glow
                  } : {}}
                >
                  {isDisclaimer ? (
                    // Special disclaimer card layout
                    <div className="disclaimer-content">
                      <div className="disclaimer-icon">
                        <stat.icon size={32} style={{
                          color: 'var(--primary)',
                          filter: 'drop-shadow(0 0 8px rgba(124, 58, 237, 0.3))'
                        }} />
                      </div>
                      <div className="disclaimer-text">
                        <h4 style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          marginBottom: '0.5rem'
                        }}>
                          AI-Powered Insights
                        </h4>
                        <p style={{
                          fontSize: '0.75rem',
                          lineHeight: '1.5',
                          color: 'var(--text-tertiary)',
                          margin: 0
                        }}>
                          These metrics are calculated using real-time data and AI analysis to help you grow.
                          <span style={{
                            color: 'var(--primary)',
                            fontWeight: 500,
                            display: 'block',
                            marginTop: '0.25rem'
                          }}>
                            Your journey to peak performance starts here.
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    // Normal stat card layout
                    <>
                      <div className="stat-header">
                        <div className="stat-icon-wrapper">
                          <stat.icon className="stat-icon" size={20} />
                        </div>
                        <div className={`trend-indicator ${stat.trend}`}>
                          {stat.trend === 'up' ? <TrendingUp size={14} /> : stat.trend === 'down' ? <TrendingDown size={14} /> : <Activity size={14} />}
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
                        <div className="stat-subtitle" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
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
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Analytics Grid - 6 Components */}
          <div className="analytics-main-grid">
            {/* Left Column - 3 Components */}
            <div className="grid-column left-column">
              {/* AI Intelligence Score */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Brain size={18} />
                        <h3>AI Intelligence Score</h3>
                        <span className="component-badge ai-badge">Neural Link</span>
                      </div>
                    </div>
                    <div className="component-content">
                      <AIIntelligenceScore timeRange={timeRange} />
                    </div>
                  </>
                ) : <LockedFeature title="AI Intelligence" className="h-full" />}
              </div>

              {/* Mood Tracker */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Activity size={18} />
                        <h3>Mood Tracker</h3>
                        <span className="component-badge">Emotional</span>
                      </div>
                    </div>
                    <div className="component-content">
                      <MoodTracker />
                    </div>
                  </>
                ) : <LockedFeature title="Mood Tracker" className="h-full" />}
              </div>

              {/* Goal Progress — AI Probability Analysis */}
              <div className="component-card glass-card">
                {isUltra ? (
                  <>
                    <div className="component-header">
                      <div className="component-title">
                        <Target size={18} />
                        <h3>Goal Analytics</h3>
                        <span className="component-badge ai-badge">AI Probability</span>
                      </div>
                    </div>
                    <div className="component-content">
                      <GoalProgress />
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
                        <Zap size={18} />
                        <h3>Focus Heatmap</h3>
                        <span className="component-badge">Hotspots</span>
                      </div>
                    </div>
                    <div className="component-content">
                      <FocusHeatmap timeRange={safeTimeRange} />
                    </div>
                  </>
                ) : <LockedFeature title="Focus Heatmap" className="h-full" />}
              </div>

              {/* AI Strategic Insight */}
              <div className="component-card glass-card">
                <div className="component-header">
                  <div className="component-title">
                    <Sparkles size={18} />
                    <h3>AI Strategic Insight</h3>
                    <span className="component-badge ai-badge">Actionable</span>
                  </div>
                </div>
                <div className="component-content">
                  <StrategicInsight />
                </div>
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
              {isUltra ? (
                <>
                  <div className="component-header">
                    <div className="component-title">
                      <Fingerprint size={18} className="text-primary" />
                      <h3>Behavioral Fingerprint</h3>
                      <span className="component-badge">Big Five Profile</span>
                    </div>
                    <div className="component-meta">
                      <Calendar size={14} />
                      <span>14-Day Baseline Analysis</span>
                    </div>
                  </div>
                  <div className="component-content">
                    <BigFiveProfile />
                  </div>
                </>
              ) : <LockedFeature title="Behavioral Analytics" className="h-full" />}
            </div>
          </div>

          {/* Data Status Footer */}
          <div className="data-status-footer">
            <div className="status-item">
              <div className="status-dot processing" />
              <span>AI Processing: Real-time</span>
            </div>
            <div className="status-item">
              <div className={`status-dot ${currentMetrics.lastUpdated ? 'success' : 'warning'}`} />
              <span>Data Integrity: {currentMetrics.lastUpdated ? '100%' : 'Syncing'}</span>
            </div>
            <div className="status-item">
              <div className="status-dot success" />
              <span>Last analyzed: {getLastUpdatedText()}</span>
            </div>
            <div className="status-item">
              <div className="status-dot" />
              <span>Patterns: {detectedPatterns.length} detected</span>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
