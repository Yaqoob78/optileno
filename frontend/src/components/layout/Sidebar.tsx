import React, { useState } from "react";
import {
  User,
  ChevronRight,
  ChevronLeft,
  Calendar,
  BarChart3,
  Settings,
  LayoutDashboard,
  Zap,
  MessageSquare,
  Home,
  FileText,
  Bell,
  HelpCircle
} from "lucide-react";
import "../../styles/layout/sidebar.css";
import { useUser } from "../../hooks/useUser";

interface MenuItem {
  id: number;
  icon: React.ReactNode;
  label: string;
  gradient: string;
}

interface SidebarProps {
  isOpen: boolean;
  menuItems: MenuItem[];
  currentPage: string;
  onPageChange: (page: string) => void;
  onToggle: () => void;
}

export default function Sidebar({
  isOpen,
  menuItems,
  currentPage,
  onPageChange,
  onToggle
}: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { user, isUltra } = useUser();
  const profile = { planType: isUltra ? 'ULTRA' : 'EXPLORER' }; // Simplified for display

  return (
    <aside className="premium-sidebar">
      {/* Sidebar Header */}
      <div className="sidebar-header">
        {isOpen ? (
          <div className="sidebar-header-open">
            <div className="sidebar-brand">
              {/* LOGO DIV - Empty, gets background from CSS */}
              <div className="sidebar-logo" />
              <div className="sidebar-brand-text">
                <h1 className="sidebar-title">Optileno</h1>
                <p className="sidebar-subtitle">AI</p>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="sidebar-toggle"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
        ) : (
          <div className="sidebar-header-collapsed">
            <button
              onClick={onToggle}
              className="sidebar-toggle"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={20} />
            </button>
            {/* LOGO DIV - Empty, gets background from CSS */}
            <div className="sidebar-logo" />
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = currentPage === item.label;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.label)}
              onMouseEnter={() => setHoveredItem(item.label)}
              onMouseLeave={() => setHoveredItem(null)}
              className={`nav-menu-item ${isActive ? 'active' : ''} ${!isOpen ? 'nav-menu-item-collapsed' : ''
                }`}
              aria-label={item.label}
            >
              {/* Icon Container */}
              <div className={`menu-icon-container ${isActive ? 'menu-icon-active' : ''}`}>
                <div className={`menu-icon-gradient ${item.gradient.replace(' ', '-')}`} />
                <div className={`menu-icon ${isActive ? 'text-white' : 'text-gray-300'}`}>
                  {item.icon}
                </div>
                {isActive && (
                  <div className="active-indicator" />
                )}
              </div>

              {/* Text Content (when open) */}
              {isOpen && (
                <div className="nav-menu-text">
                  <span className={`nav-menu-label ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {item.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <div className="user-profile-section">
        {isOpen ? (
          <div className="user-profile-open">
            <div className="user-avatar-container">
              <div className="user-avatar">
                <User size={18} className="text-gray-300" />
              </div>
              <div className="user-online-status" />
            </div>
            <div className={`user-info ${profile.planType === 'ULTRA' ? 'ultra-glow' : ''}`}>
              <p className="user-name">{user.name || (user.email === 'khan011504@gmail.com' ? 'Owner' : 'User')}</p>
              <div className={`user-badge ${profile.planType === 'ULTRA' ? 'ultra' : ''}`}>
                <Zap size={10} className={profile.planType === 'ULTRA' ? 'text-purple-400' : 'text-amber-400'} />
                <span className="user-badge-text">{profile.planType === 'ULTRA' ? 'ULTRA' : 'Pro'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="user-profile-collapsed">
            <div className="user-avatar-container">
              <div className="user-avatar">
                <User size={20} className="text-gray-300" />
              </div>
              <div className="user-online-status" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}