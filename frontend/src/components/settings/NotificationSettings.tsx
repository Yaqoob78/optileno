import React from 'react';
import { Bell, Mail, Clock, Sparkles } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

const notificationRowStyle: React.CSSProperties = {
  border: '1px solid var(--s-border, rgba(255, 255, 255, 0.08))',
  background: 'var(--s-bg-item, rgba(15, 23, 42, 0.6))',
};

const NotificationSettings: React.FC = () => {
  const isUltra = useUserStore((state) => state.isUltra);

  return (
    <div className="space-y-5">
      {/* Early Access / Roadmap Banner */}
      <div 
        className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-400" />
          <h4 className="text-sm font-semibold text-white">
            Smart Notifications — Available Soon
          </h4>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 ml-auto">
            Ultra First Access
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          Automated daily digests, local desktop alerts, and habit streak reminders are currently in final development. 
          {isUltra ? (
            <span className="text-indigo-200 font-medium"> Because you are an Ultra subscriber, you will receive priority early access as soon as the rollout goes live.</span>
          ) : (
            <span> This feature will be available soon, with priority access rolling out to Ultra users first.</span>
          )}
        </p>
      </div>

      {/* Email Notifications Section */}
      <div className="setting-section">
        <h3 className="section-title mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Mail size={15} style={{ color: 'var(--s-text-secondary, #94a3b8)' }} />
          Email Notifications
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-lg" style={notificationRowStyle}>
            <div>
              <p className="text-sm font-medium text-slate-200">Daily Execution Digest</p>
              <p className="text-xs text-slate-400 mt-0.5">Morning summary of scheduled tasks and active habits</p>
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md">
              Available soon (Ultra first)
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg" style={notificationRowStyle}>
            <div>
              <p className="text-sm font-medium text-slate-200">Weekly Performance Report</p>
              <p className="text-xs text-slate-400 mt-0.5">Weekly consistency score, completed goals, and burnout insights</p>
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md">
              Available soon (Ultra first)
            </span>
          </div>
        </div>
      </div>

      {/* Desktop & Push Notifications Section */}
      <div className="setting-section">
        <h3 className="section-title mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Bell size={15} style={{ color: 'var(--s-text-secondary, #94a3b8)' }} />
          System & Push Alerts
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3.5 rounded-lg" style={notificationRowStyle}>
            <div>
              <p className="text-sm font-medium text-slate-200">Deep Work & Focus Reminders</p>
              <p className="text-xs text-slate-400 mt-0.5">Live prompt to lock in deep work blocks before high-focus hours</p>
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md">
              Available soon (Ultra first)
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-lg" style={notificationRowStyle}>
            <div>
              <p className="text-sm font-medium text-slate-200">Habit Streak Warning</p>
              <p className="text-xs text-slate-400 mt-0.5">Gentle evening nudge when a critical habit streak is about to break</p>
            </div>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-md">
              Available soon (Ultra first)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
