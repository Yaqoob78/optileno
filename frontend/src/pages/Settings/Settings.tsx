// pages/Settings/Settings.tsx
import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  User,
  Info,
  ChevronRight,
  LogOut,
  CreditCard,
  Sparkles
} from 'lucide-react';
import GeneralSettings from '../../components/settings/GeneralSettings';
import NotificationSettings from '../../components/settings/NotificationSettings';
import DataSettings from '../../components/settings/DataSettings';
import ProfileSettings from '../../components/settings/ProfileSettings';
import AboutSettings from '../../components/settings/AboutSettings';
import BillingSettings from '../../components/settings/BillingSettings';
import { useUserStore } from '../../stores/useUserStore';
import { useNavigate } from 'react-router-dom';
import '../../styles/pages/settings.css';

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs: Tab[] = [
    { id: 'general', label: 'General', icon: <SettingsIcon size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'data', label: 'Data', icon: <Database size={18} /> },
    { id: 'profile', label: 'Profile', icon: <User size={18} /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard size={18} /> },
    { id: 'about', label: 'About', icon: <Info size={18} /> },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return <GeneralSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'data':
        return <DataSettings />;
      case 'profile':
        return <ProfileSettings />;
      case 'about':
        return <AboutSettings />;
      case 'billing':
        return <BillingSettings />;
      default:
        return <GeneralSettings />;
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container pt-8 mb-6 flex justify-start">
        <div className="relative group">
          <div className="absolute -inset-2 bg-white/5 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <SettingsIcon
            size={32}
            className="settings-logo-animated text-[var(--s-text-primary)] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] relative z-10"
          />
        </div>
      </div>

      <div className="settings-container">
        {/* Sidebar Navigation */}
        <div className="settings-sidebar">
          <nav className="settings-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="nav-icon">
                  {tab.icon}
                </span>
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="settings-main">
          <div className="card-header">
            <h2 className="section-title">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>

          <div className="settings-content">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}