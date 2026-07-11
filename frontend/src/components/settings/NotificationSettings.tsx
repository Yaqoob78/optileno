import React from 'react';
import { Bell, Mail } from 'lucide-react';

import { LockedFeature } from '../common/LockedFeature';
import { useUserStore } from '../../stores/useUserStore';

const notificationRowStyle: React.CSSProperties = {
  border: '1px solid var(--s-border)',
  background: 'var(--s-bg-item)',
};

const NotificationSettings: React.FC = () => {
  const isUltra = useUserStore((state) => state.isUltra);

  if (!isUltra) {
    return (
      <div className="space-y-4">
        <LockedFeature
          title="Ultra Notifications"
          description="Upgrade to Ultra for real-time alerts."
        />
        <div className="opacity-30 pointer-events-none">
          <div className="setting-section">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <Mail size={14} />
              Email
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg" style={notificationRowStyle}>
              <p className="text-xs" style={{ color: 'var(--s-text-primary)' }}>Activity Reports</p>
              <div className="w-8 h-4 rounded-full relative" style={{ background: 'var(--s-input-border)' }} />
            </div>
          </div>
          <div className="setting-section">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <Bell size={14} />
              Desktop
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg" style={notificationRowStyle}>
              <p className="text-xs" style={{ color: 'var(--s-text-primary)' }}>System Alerts</p>
              <div className="w-8 h-4 rounded-full relative" style={{ background: 'var(--s-input-border)' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="setting-section">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Mail size={14} style={{ color: 'var(--s-text-secondary)' }} />
          Email Notifications
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg" style={notificationRowStyle}>
          <div>
            <p className="text-sm font-medium opacity-60" style={{ color: 'var(--s-text-primary)' }}>Activity Digest</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: 'var(--s-accent)' }}>Will be available soon</p>
          </div>
          <button className="toggle-switch opacity-20 cursor-not-allowed" disabled aria-label="Activity digest (coming soon)" />
        </div>
      </div>

      <div className="setting-section">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Bell size={14} style={{ color: 'var(--s-text-secondary)' }} />
          Desktop Notifications
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg" style={notificationRowStyle}>
          <div>
            <p className="text-sm font-medium opacity-60" style={{ color: 'var(--s-text-primary)' }}>Local Alerts</p>
            <p className="text-[10px] font-semibold mt-1" style={{ color: 'var(--s-accent)' }}>Will be available soon</p>
          </div>
          <button className="toggle-switch opacity-20 cursor-not-allowed" disabled aria-label="Local alerts (coming soon)" />
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
