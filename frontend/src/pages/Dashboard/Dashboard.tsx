import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Brain,
  Target,
  Calendar,
  ArrowRight,
  Clock,
  TrendingUp,
  Users,
  MessageSquare,
  CheckCircle,
  Award,
  Coffee,
  Sun,
  Moon,
  Bell,
  Settings,
  ChevronRight,
  BarChart3,
  X, // Added X icon
  Target as TargetIcon
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useProductivityScore } from '../../hooks/useProductivityScore';


import { usePlanner } from '../../hooks/usePlanner';
import { useUser } from '../../hooks/useUser';
import { useTheme } from '../../hooks/useTheme';
import { useRealtime } from '../../hooks/useRealtime';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { useChatStore } from '../../stores/chat.store';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { usePlannerStore } from '../../stores/planner.store';

import DashboardStatsCard from '../../components/dashboard/DashboardStatsCard';
import RecentActivityWidget from '../../components/dashboard/RecentActivityWidget';
import '../../styles/pages/dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const { user, login, isPremium: _isPremium } = useUser();
  const { getFocusMetrics, getRecentInsights } = useAnalytics();

  // Use Global Stores for Real-Time Sync
  const currentMetrics = useAnalyticsStore((state) => state.currentMetrics);
  const plannerTasks = usePlannerStore((state) => state.tasks);
  const activeConversation = useChatStore((state) => state.activeConversation);
  const userStats = useUserStore((state) => state.profile.stats);

  // Determine Productivity Score using the same hook as Analytics page for consistency
  const { score: productivityData } = useProductivityScore('daily');

  // Real-time from hook > Store > 0
  const productivityScore = productivityData?.score ?? (currentMetrics.productivityScore > 0 ? currentMetrics.productivityScore : 0);

  // Determine Task Counts (Real-time from store)
  const totalTasks = plannerTasks.length;
  const completedTasks = plannerTasks.filter(t => t.status === 'completed').length;

  // Action to fetch analytics if stale
  const fetchAnalytics = useAnalyticsStore((state) => state.fetchAnalytics);

  // Force Premium for owner email
  const isPremium = user?.email === 'khan011504@gmail.com' ? true : _isPremium;

  // Real-time integration
  const { onTaskCreated, onDeepWorkCompleted, onAnalyticsUpdate } = useRealtime();

  const metrics = getFocusMetrics();
  const insights = getRecentInsights(2);

  const quotes = [
    { text: "Productivity is never an accident. It is always the result of a commitment to excellence.", author: "Paul J. Meyer" },
    { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    const quoteTimer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length);
    }, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(quoteTimer);
    };
  }, []);

  // Fetch fresh analytics data on mount
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    // Check for payment success
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      setShowSuccessModal(true);
      // Clean up URL
      navigate('/dashboard', { replace: true });

      // Refresh user profile to get Pro status
      const refreshUser = async () => {
        const profileRes = await userService.getProfile();
        if (profileRes.success && profileRes.data) {
          // Use store directly to update profile
          useUserStore.getState().setProfile(profileRes.data as any);
        }
      };
      refreshUser();
    }
  }, [location, login, navigate]);

  // Subscribe to real-time events
  useEffect(() => {
    onTaskCreated(() => {
      // Task created, component will update via context
    });

    onDeepWorkCompleted(() => {
      // Deep work completed, component will update
    });

    onAnalyticsUpdate(() => {
      // Analytics updated, refresh metrics display
    });
  }, [onTaskCreated, onDeepWorkCompleted, onAnalyticsUpdate]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className={`dashboard-container theme-${theme}`}>

      {/* Animated Background Elements */}
      <div className="background-canvas">
        <div className="gradient-sphere sphere-1" />
        <div className="gradient-sphere sphere-2" />
        <div className="gradient-sphere sphere-3" />
        <div className="grid-overlay" />
      </div>

      <div className="dashboard-content">

        {/* Payment Success Banner */}
        {showSuccessModal && (
          <div className="mb-6 p-4 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="w-10 height-10 rounded-full bg-primary flex items-center justify-center text-white">
                <Award size={20} />
              </div>
              <div>
                <h4 className="font-bold text-main">Welcome to Pro!</h4>
                <p className="text-secondary text-sm">Your subscription has been activated successfully.</p>
              </div>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="text-muted hover:text-main">
              <CheckCircle size={20} />
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="dashboard-header">
          <div className="header-left">
            <div className="brand-logo">
              <div className="logo-icon-wrapper">
                <Sparkles className="logo-icon" />
              </div>
              <div className="logo-text">
                <span className="logo-primary">DASHBOARD</span>
                <span className="logo-version">LENO AI</span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="time-display">
              <Clock size={16} />
              <span className="time-text">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="theme-toggle-container">
              <button className="theme-toggle-btn" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* User Welcome Section */}
        <div className="user-welcome-section">
          <div className="welcome-greeting">
            <div className="greeting-text">
              <div className="greeting-line">Welcome to your</div>
              <div className="greeting-line emphasis">Personal Command Center</div>
            </div>
            <div className="user-display">
              <div className="user-avatar">
                <div className="avatar-circle">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="user-status active" />
              </div>
              <div className="user-info">
                <div className="user-name">{user?.name || 'Creator'}</div>
                <div className="user-plan-tag">
                  <span className={`plan-badge ${isPremium ? '' : 'free'}`}>
                    {isPremium ? 'PREMIUM ACTIVE' : 'FREE VERSION'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Analytics Box */}
        <div className="user-analytics-box glass-card">
          <div className="analytics-header">
            <div className="analytics-title">
              <div className="title-icon-wrapper">
                <BarChart3 className="title-icon" />
              </div>
              <div className="title-text">
                <div className="title-main">Your Productivity Hub</div>
                <div className="title-sub">Real-time performance insights</div>
              </div>
            </div>
            <div className="plan-indicator">
              <div className="plan-label">PLAN</div>
              <div className={`plan-value ${isPremium ? 'premium' : ''}`}>
                {isPremium ? 'Premium Pro' : 'Free Tier'}
              </div>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="analytics-metric">
              <div className="metric-header">
                <Clock className="metric-icon" size={20} />
                <span className="metric-label">Time Invested</span>
              </div>
              <div className="metric-value">{userStats.timeSpentToday || 0}m today</div>
              <div className="metric-trend trend-up">
                <TrendingUp size={14} />
                <span>+{Math.floor((userStats.totalTimeSpent || 0) / 7)}m/week avg</span>
              </div>
            </div>

            <div className="analytics-metric">
              <div className="metric-header">
                <Target className="metric-icon" size={20} />
                <span className="metric-label">Tasks Ready</span>
              </div>
              <div className="metric-value">{totalTasks} Tasks</div>
              <div className="metric-trend">
                <CheckCircle size={14} />
                <span>{completedTasks} completed</span>
              </div>
            </div>

            <div className="analytics-metric">
              <div className="metric-header">
                <Brain className="metric-icon" size={20} />
                <span className="metric-label">Productivity Score</span>
              </div>
              <div className="metric-value">{Math.round(productivityScore)}%</div>
              <div className="progress-ring">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle className="progress-ring-background" cx="30" cy="30" r="26" />
                  <circle
                    className="progress-ring-foreground"
                    cx="30" cy="30" r="26"
                    strokeDasharray="163.36"
                    strokeDashoffset={163.36 * (1 - (productivityScore / 100))}
                  />
                </svg>
                <span className="ring-value">{Math.round(productivityScore)}%</span>
              </div>
            </div>

            {/* KEEP MODE: Saved Chat Box */}
            <div
              className="analytics-metric saved-chat-metric"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                cursor: 'default' // Container itself isn't the link anymore
              }}
            >
              <div className="metric-header" style={{ marginBottom: '10px' }}>
                <MessageSquare className="metric-icon" size={20} style={{ color: '#a78bfa' }} />
                <span className="metric-label" style={{ color: '#d8b4fe' }}>Saved Chats (Keep Mode)</span>
              </div>

              <div className="saved-chats-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                {activeConversation?.isKept && (
                  // Show current active one first if kept
                  <div
                    key="active"
                    onClick={() => navigate('/chat')}
                    className="saved-chat-item active"
                    style={{
                      padding: '8px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      animation: 'pulse-soft 2s infinite'
                    }}
                  >
                    <div className="chat-title" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>Current Session</div>
                    <div className="chat-preview" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeConversation.messages[activeConversation.messages.length - 1]?.content.substring(0, 30) || "Start typing..."}...
                    </div>
                  </div>
                )}

                {useChatStore.getState().conversations.filter(c => c.isKept && c.id !== activeConversation?.id).slice(0, 3).map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      useChatStore.getState().setActiveConversation(chat.id);
                      navigate('/chat');
                    }}
                    className="saved-chat-item group"
                    style={{
                      padding: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  >
                    <div className="flex justify-between items-start">
                      <div className="chat-title" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e2e8f0', maxWidth: '85%' }}>{chat.title || "Untitled Chat"}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          useChatStore.getState().toggleKeepConversation(chat.id);
                        }}
                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ padding: '2px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="chat-preview" style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '10px' }}>
                      {chat.messages[chat.messages.length - 1]?.content.substring(0, 30)}...
                    </div>
                  </div>
                ))}

                {!activeConversation?.isKept && useChatStore.getState().conversations.filter(c => c.isKept).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No chats saved yet. <br /> Use toggle in Chat.
                  </div>
                )}
              </div>
            </div>

            <div className="analytics-metric">
              <div className="metric-header">
                <Award className="metric-icon" size={20} />
                <span className="metric-label">Achievements</span>
              </div>
              <div className="achievements-preview">
                <div className="achievement-badge" data-tooltip="Focus Master">🎯</div>
                <div className="achievement-badge" data-tooltip="Early Bird">☀️</div>
                <div className="achievement-badge" data-tooltip="Task Ninja">⚡</div>
                <div className="achievement-count">+3 more</div>
              </div>
            </div>
          </div>
        </div>

        {/* Community Activity Section */}
        <div className="community-section glass-card">
          <div className="section-header">
            <div className="section-title">
              <Users className="section-title-icon" />
              <span>Optileno Activity</span>
            </div>
            <div className="section-subtitle">Real-time community updates</div>
          </div>

          <div className="activity-feed">
            <div className="activity-item">
              <div className="activity-icon">
                <Sparkles size={16} />
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <span className="user-mention">@Sarah Chen</span> just completed a 3-hour deep work session
                </div>
                <div className="activity-time">2 minutes ago</div>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon">
                <Calendar size={16} />
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <span className="user-mention">@Alex Morgan</span> has planned their entire week using AI
                </div>
                <div className="activity-time">15 minutes ago</div>
              </div>
            </div>

            <div className="activity-item">
              <div className="activity-icon">
                <Brain size={16} />
              </div>
              <div className="activity-content">
                <div className="activity-text">
                  <span className="user-mention">@James Wilson</span> improved productivity by 40% this month
                </div>
                <div className="activity-time">1 hour ago</div>
              </div>
            </div>
          </div>

          <div className="testimonial-grid">
            <div className="testimonial-card">
              <div className="testimonial-icon">🎯</div>
              <div className="testimonial-text">
                "The Deep Work Blocks transformed my focus. Unmatched efficiency!"
              </div>
              <div className="testimonial-author">
                — <span className="author-name">Marcus R.</span>, Software Engineer
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-icon">📊</div>
              <div className="testimonial-text">
                "Analytics gave me insights I didn't know I needed. Game changer!"
              </div>
              <div className="testimonial-author">
                — <span className="author-name">Lisa M.</span>, Project Manager
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-icon">✨</div>
              <div className="testimonial-text">
                "Mood tracking + AI suggestions = Best work-life balance ever"
              </div>
              <div className="testimonial-author">
                — <span className="author-name">David K.</span>, Entrepreneur
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section glass-card">
          <div className="section-header">
            <div className="section-title">
              <Zap className="section-title-icon" />
              <span>Instant Actions</span>
            </div>
            <div className="section-subtitle">Leno is ready to assist</div>
          </div>

          <div className="actions-grid">
            <button
              className="action-card action-primary"
              onClick={() => navigate('/chat')}
            >
              <div className="action-icon-wrapper">
                <MessageSquare className="action-icon" />
              </div>
              <div className="action-content">
                <div className="action-title">Leno</div>
                <div className="action-subtitle">Ready to help</div>
              </div>
              <ChevronRight className="action-arrow" />
            </button>

            <button
              className="action-card action-secondary"
              onClick={() => navigate('/planner')}
            >
              <div className="action-icon-wrapper">
                <Zap className="action-icon" />
              </div>
              <div className="action-content">
                <div className="action-title">Deep Work Session</div>
                <div className="action-subtitle">Start 2-hour focus</div>
              </div>
              <ChevronRight className="action-arrow" />
            </button>

            <button
              className="action-card action-accent"
              onClick={() => navigate('/habits')}
            >
              <div className="action-icon-wrapper">
                <CheckCircle className="action-icon" />
              </div>
              <div className="action-content">
                <div className="action-title">Add Habit</div>
                <div className="action-subtitle">Track new routine</div>
              </div>
              <ChevronRight className="action-arrow" />
            </button>

            <button
              className="action-card action-success"
              onClick={() => navigate('/analytics')}
            >
              <div className="action-icon-wrapper">
                <Target className="action-icon" />
              </div>
              <div className="action-content">
                <div className="action-title">Goal Review</div>
                <div className="action-subtitle">Weekly progress</div>
              </div>
              <ChevronRight className="action-arrow" />
            </button>
          </div>
        </div>

        {/* Evolution Message */}
        <div className="evolution-message glass-card">
          <div className="message-content">
            <div className="message-icon">
              <Sparkles size={24} />
            </div>
            <div className="message-text">
              Leno is consistently evolving with you, becoming your personalized productivity partner.
              Every interaction makes it smarter, more intuitive, and perfectly tailored to your workflow.
            </div>
          </div>
        </div>

        {/* Quotes Section */}
        <div className="quotes-section">
          <div className="quotes-container">
            <div className="quote-card">
              <div className="quote-mark">❝</div>
              <div className="quote-text">
                {quotes[quoteIndex].text}
              </div>
              <div className="quote-author">
                — {quotes[quoteIndex].author}
              </div>
            </div>
            <div className="quote-progress">
              {quotes.map((_, index) => (
                <div
                  key={index}
                  className={`progress-dot ${index === quoteIndex ? 'active' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}