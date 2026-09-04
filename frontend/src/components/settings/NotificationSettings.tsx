import React from 'react';
import { Mail, Sparkles, Zap, Flame, BarChart3, Lock } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import '../../styles/pages/settings.css';

const NotificationSettings: React.FC = () => {
  const isUltra = useUserStore((state) => state.isUltra);

  return (
    <div className="notifications-settings-container">
      {/* Early Access / Roadmap Banner */}
      <div className="notifications-roadmap-banner">
        <div className="roadmap-banner-header">
          <div className="roadmap-badge-group">
            <span className="roadmap-icon-wrap">
              <Sparkles size={15} />
            </span>
            <h4 className="roadmap-title">Smart Notifications — Coming Soon</h4>
          </div>
          <span className="roadmap-access-tag">
            {isUltra ? 'Ultra Priority' : 'Available Soon'}
          </span>
        </div>
        <p className="roadmap-description">
          Automated daily execution digests, focus reminders, and habit streak alerts are currently in final development.
          {isUltra ? (
            <span className="roadmap-highlight"> As an Ultra member, you will receive priority access as soon as the rollout goes live.</span>
          ) : (
            <span className="roadmap-highlight"> Priority access will roll out to Ultra users first.</span>
          )}
        </p>
      </div>

      {/* Email Notifications Section */}
      <div className="notifications-group">
        <div className="notifications-group-header">
          <Mail size={15} className="group-header-icon" />
          <h3 className="group-header-title">Email Notifications</h3>
        </div>

        <div className="notifications-items-list">
          <div className="notification-item-card">
            <div className="notification-item-main">
              <div className="item-icon-box mail-digest-icon">
                <Mail size={16} />
              </div>
              <div className="item-text-group">
                <p className="item-title">Daily Execution Digest</p>
                <p className="item-subtitle">Morning summary of your scheduled tasks and active daily habits</p>
              </div>
            </div>
            <div className="item-status-badge">
              <Lock size={12} />
              <span>In Development</span>
            </div>
          </div>

          <div className="notification-item-card">
            <div className="notification-item-main">
              <div className="item-icon-box report-icon">
                <BarChart3 size={16} />
              </div>
              <div className="item-text-group">
                <p className="item-title">Weekly Performance Report</p>
                <p className="item-subtitle">Weekly consistency score, completed goals, and burnout insights</p>
              </div>
            </div>
            <div className="item-status-badge">
              <Lock size={12} />
              <span>In Development</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop & Push Notifications Section */}
      <div className="notifications-group">
        <div className="notifications-group-header">
          <Zap size={15} className="group-header-icon" />
          <h3 className="group-header-title">Focus & Habit Alerts</h3>
        </div>

        <div className="notifications-items-list">
          <div className="notification-item-card">
            <div className="notification-item-main">
              <div className="item-icon-box deepwork-icon">
                <Zap size={16} />
              </div>
              <div className="item-text-group">
                <p className="item-title">Deep Work & Focus Reminders</p>
                <p className="item-subtitle">Live prompt to lock in deep work blocks before peak focus hours</p>
              </div>
            </div>
            <div className="item-status-badge">
              <Lock size={12} />
              <span>In Development</span>
            </div>
          </div>

          <div className="notification-item-card">
            <div className="notification-item-main">
              <div className="item-icon-box streak-icon">
                <Flame size={16} />
              </div>
              <div className="item-text-group">
                <p className="item-title">Habit Streak Warning</p>
                <p className="item-subtitle">Gentle evening nudge when a critical habit streak is about to break</p>
              </div>
            </div>
            <div className="item-status-badge">
              <Lock size={12} />
              <span>In Development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
