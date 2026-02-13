import React, { useState } from 'react';
import { Bell, Mail } from 'lucide-react';

import { LockedFeature } from '../common/LockedFeature';
import { useUserStore } from '../../stores/useUserStore';

const NotificationSettings: React.FC = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const _isUltra = useUserStore((state) => state.isUltra);
  const user = useUserStore((state) => state.profile);
  // Force Ultra for owner
  const isUltra = user?.email === 'khan011504@gmail.com' ? true : _isUltra;

  if (!isUltra) {
    return (
      <div className="space-y-4">
        <LockedFeature
          title="Pro Notifications"
          description="Upgrade to Ultra for real-time alerts."
        />
        <div className="opacity-30 pointer-events-none">
          <div className="setting-section">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <Mail size={14} />
              Email
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50">
              <p className="text-xs text-white">Activity Reports</p>
              <div className="w-8 h-4 rounded-full bg-slate-800 relative" />
            </div>
          </div>
          <div className="setting-section">
            <h3 className="section-title mb-4 flex items-center gap-2">
              <Bell size={14} />
              Desktop
            </h3>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50">
              <p className="text-xs text-white">System Alerts</p>
              <div className="w-8 h-4 rounded-full bg-slate-800 relative" />
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
          <Mail size={14} className="text-slate-500" />
          Email Notifications
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/50">
          <div>
            <p className="text-sm font-medium text-white opacity-50">Activity Digest</p>
            <p className="text-[10px] text-indigo-400 font-semibold mt-1">Will be available soon</p>
          </div>
          <button className="toggle-switch opacity-20 cursor-not-allowed" disabled />
        </div>
      </div>

      <div className="setting-section">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Bell size={14} className="text-slate-500" />
          Desktop Notifications
        </h3>
        <div className="flex items-center justify-between p-4 rounded-lg border border-slate-800 bg-slate-900/50">
          <div>
            <p className="text-sm font-medium text-white opacity-50">Local Alerts</p>
            <p className="text-[10px] text-indigo-400 font-semibold mt-1">Will be available soon</p>
          </div>
          <button className="toggle-switch opacity-20 cursor-not-allowed" disabled />
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;