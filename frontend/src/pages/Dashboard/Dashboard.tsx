import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Zap,
  Brain,
  Target,
  Activity,
  Clock,
  TrendingUp,
  MessageSquare,
  CheckCircle,
  Award,
  Sun,
  Moon,
  ChevronRight,
  BarChart3,
  X,
  Quote,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useProductivityScore } from '../../hooks/useProductivityScore';

import { useUser } from '../../hooks/useUser';
import { useTheme } from '../../hooks/useTheme';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { useChatStore } from '../../stores/chat.store';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { usePlannerStore } from '../../stores/planner.store';
import { normalizeTaskStatus } from '../../services/api/planner.service';
import SEO from '../../components/common/SEO';

import RecentActivityWidget from '../../components/dashboard/RecentActivityWidget';
import '../../styles/pages/dashboard.css';

interface AchievementBadge {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  const { user, isPremium } = useUser();
  // Retained for its side effects: page-view tracking and periodic backend sync
  useAnalytics();

  // Use Global Stores for Real-Time Sync
  const plannerTasks = usePlannerStore((state) => state.tasks);
  const activeConversation = useChatStore((state) => state.activeConversation);
  const conversations = useChatStore((state) => state.conversations);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const toggleKeepConversation = useChatStore((state) => state.toggleKeepConversation);
  const userStats = useUserStore((state) => state.profile.stats);
  const accountAge = useUserStore((state) => state.accountAge);

  // Determine Productivity Score using the same hook as Analytics page for consistency
  const { score: productivityData } = useProductivityScore('daily');

  // Real-time from hook > Store > null (explicit no-data state)
  const productivityScore = productivityData?.score ?? null;
  const productivityScoreValue = productivityScore ?? 0;

  // Determine Task Counts (Real-time from store)
  const totalTasks = plannerTasks.length;
  const completedTasks = plannerTasks.filter((task) => normalizeTaskStatus(task.status) === 'done').length;
  const keptConversations = conversations
    .filter((conversation) => conversation.isKept && conversation.id !== activeConversation?.id)
    .slice(0, 3);

  // Honest usage average: total minutes spread over the account's lifetime
  const daysActive = Math.max(1, (accountAge ?? 0) + 1);
  const avgMinutesPerDay = Math.round((userStats.totalTimeSpent || 0) / daysActive);

  // Achievements earned from real usage data only
  const achievements = useMemo<AchievementBadge[]>(() => {
    const earned: AchievementBadge[] = [];
    if (completedTasks >= 1) {
      earned.push({ id: 'first-task', label: 'Task Finisher', icon: <CheckCircle size={16} /> });
    }
    if (completedTasks >= 10) {
      earned.push({ id: 'task-ninja', label: 'Task Ninja', icon: <Zap size={16} /> });
    }
    if ((userStats.timeSpentToday || 0) >= 60) {
      earned.push({ id: 'deep-focus', label: 'Deep Focus', icon: <Brain size={16} /> });
    }
    if (productivityScoreValue >= 70) {
      earned.push({ id: 'peak-performer', label: 'Peak Performer', icon: <TrendingUp size={16} /> });
    }
    if ((accountAge ?? 0) >= 7) {
      earned.push({ id: 'week-strong', label: 'One Week Strong', icon: <Sun size={16} /> });
    }
    return earned;
  }, [completedTasks, userStats.timeSpentToday, productivityScoreValue, accountAge]);
  const visibleAchievements = achievements.slice(0, 4);
  const extraAchievements = achievements.length - visibleAchievements.length;

  // Action to fetch analytics if stale
  const fetchAnalytics = useAnalyticsStore((state) => state.fetchAnalytics);
  const fetchTasks = usePlannerStore((state) => state.fetchTasks);

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

  // Fetch fresh analytics and planner data on mount so stats are
  // accurate even on a fresh device where the persisted stores are empty
  useEffect(() => {
    fetchAnalytics();
    fetchTasks().catch((error) => {
      console.error('Failed to refresh planner tasks', error);
    });
  }, [fetchAnalytics, fetchTasks]);

  useEffect(() => {
    // Check for payment success
    const params = new URLSearchParams(location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('order_id');
    const subscriptionId = params.get('subscription_id');

    if (paymentStatus === 'success') {
      const verifyAndRefresh = async () => {
        try {
          // Verify payment on backend to ensure DB is updated.
          // Never show a confirmation banner without server-side verification.
          if (orderId || subscriptionId) {
            const { paymentService } = await import('../../services/api/payment.service');
            if (subscriptionId) {
              await paymentService.verifySubscription(subscriptionId);
            } else if (orderId) {
              await paymentService.verifyPayment(orderId);
            }
            setShowSuccessModal(true);
          }

          // Refresh user profile so ProtectedRoute updates subscription_status
          const profileRes = await userService.getProfile();
          if (profileRes.success && profileRes.data) {
            useUserStore.getState().setProfile(profileRes.data as any);
          }
        } catch (error) {
          console.error("Payment verification failed", error);
          setPaymentErrorMessage("We could not confirm your payment yet. Please refresh in a moment or contact support if it continues.");
        } finally {
          // Clean up URL
          navigate('/dashboard', { replace: true });
        }
      };

      verifyAndRefresh();
    }
  }, [location, navigate]);

  const getChatPreview = (content?: string) => {
    if (!content?.trim()) return 'Start typing...';
    return content.length > 30 ? `${content.substring(0, 30)}...` : content;
  };

  return (
    <div className={`dashboard-container theme-${theme}`}>
      <SEO title="Dashboard | Optileno" description="Your AI productivity command center overview." robots="noindex,nofollow" />

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
          <div className="dashboard-status-banner is-success">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                <Award size={20} />
              </div>
              <div>
                <h4 className="font-bold text-main">Payment Confirmed</h4>
                <p className="text-secondary text-sm">Your subscription is now active.</p>
              </div>
            </div>
            <button onClick={() => setShowSuccessModal(false)} className="text-muted hover:text-main" aria-label="Dismiss payment confirmation">
              <X size={20} />
            </button>
          </div>
        )}

        {paymentErrorMessage && (
          <div className="dashboard-status-banner is-error">
            <div>
              <h4 className="font-bold text-main">Payment Verification Pending</h4>
              <p className="text-secondary text-sm">{paymentErrorMessage}</p>
            </div>
            <button onClick={() => setPaymentErrorMessage(null)} className="text-muted hover:text-main" aria-label="Dismiss payment warning">
              <X size={20} />
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
              <button
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
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
                    {isPremium ? 'ULTRA ACTIVE' : 'EXPLORER'}
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
                {isPremium ? 'ULTRA' : 'EXPLORER'}
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
              <div className="metric-trend">
                <Clock size={14} />
                <span>{avgMinutesPerDay}m/day average</span>
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
              <div className="metric-value">{productivityScore === null ? '--' : `${Math.round(productivityScore)}%`}</div>
              <div className="progress-ring">
                <svg width="60" height="60" viewBox="0 0 60 60" role="img" aria-label={productivityScore === null ? 'Productivity score not available yet' : `Productivity score ${Math.round(productivityScore)} percent`}>
                  <circle className="progress-ring-background" cx="30" cy="30" r="26" />
                  <circle
                    className="progress-ring-foreground"
                    cx="30" cy="30" r="26"
                    strokeDasharray="163.36"
                    strokeDashoffset={163.36 * (1 - (productivityScoreValue / 100))}
                  />
                </svg>
                <span className="ring-value">{productivityScore === null ? '--' : `${Math.round(productivityScore)}%`}</span>
              </div>
            </div>

            {/* KEEP MODE: Saved Chat Box */}
            <div className="analytics-metric saved-chat-metric">
              <div className="metric-header">
                <MessageSquare className="metric-icon" size={20} />
                <span className="metric-label">Saved Chats (Keep Mode)</span>
              </div>

              <div className="saved-chats-list">
                {activeConversation?.isKept && (
                  <button
                    key="active"
                    type="button"
                    onClick={() => navigate('/chat')}
                    className="saved-chat-item active"
                  >
                    <div className="chat-title">Current Session</div>
                    <div className="chat-preview">
                      {getChatPreview(activeConversation.messages[activeConversation.messages.length - 1]?.content)}
                    </div>
                  </button>
                )}

                {keptConversations.map(chat => (
                  <div
                    key={chat.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveConversation(chat.id);
                      navigate('/chat');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveConversation(chat.id);
                        navigate('/chat');
                      }
                    }}
                    className="saved-chat-item"
                  >
                    <div className="saved-chat-row">
                      <div className="chat-title">{chat.title || "Untitled Chat"}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleKeepConversation(chat.id);
                        }}
                        className="saved-chat-remove"
                        aria-label={`Remove "${chat.title || 'Untitled Chat'}" from saved chats`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="chat-preview">
                      {getChatPreview(chat.messages[chat.messages.length - 1]?.content)}
                    </div>
                  </div>
                ))}

                {!activeConversation?.isKept && keptConversations.length === 0 && (
                  <div className="saved-chats-empty">
                    No chats saved yet. <br /> Use the keep toggle in Chat.
                  </div>
                )}
              </div>
            </div>

            <div className="analytics-metric">
              <div className="metric-header">
                <Award className="metric-icon" size={20} />
                <span className="metric-label">Achievements</span>
              </div>
              {achievements.length > 0 ? (
                <div className="achievements-preview">
                  {visibleAchievements.map((badge) => (
                    <div key={badge.id} className="achievement-badge" data-tooltip={badge.label}>
                      {badge.icon}
                    </div>
                  ))}
                  {extraAchievements > 0 && (
                    <div className="achievement-count">+{extraAchievements} more</div>
                  )}
                </div>
              ) : (
                <div className="achievements-empty">
                  Complete tasks and focus sessions to earn your first badge.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="community-section glass-card">
          <div className="section-header">
            <div className="section-title">
              <Activity className="section-title-icon" />
              <span>Your Activity</span>
            </div>
            <div className="section-subtitle">What you've accomplished recently</div>
          </div>

          <RecentActivityWidget />
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
              onClick={() => navigate('/planner')}
            >
              <div className="action-icon-wrapper">
                <CheckCircle className="action-icon" />
              </div>
              <div className="action-content">
                <div className="action-title">Habit Tracker</div>
                <div className="action-subtitle">Open your routines</div>
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
              <div className="quote-mark"><Quote size={40} /></div>
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
