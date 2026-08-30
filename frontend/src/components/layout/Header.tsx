import React, { useEffect, useMemo, useState } from "react";
import { Bell, Menu, User, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api/client";
import { socket } from "../../services/realtime/socket-client";
import { useUser } from "../../hooks/useUser";
import { NotificationCenter } from "../notifications/NotificationCenter";
import "../../styles/layout/header.css";

interface HeaderProps {
  page: string;
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export default function Header({ page, onMenuToggle, isMobile }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { isUltra } = useUser();

  const pageTitles: Record<string, string> = {
    "Chat": "Chat Leno",
    "Planner": "Planner",
    "Analytics": "Analytics",
    "Settings": "Settings",
    "Dashboard": "Dashboard"
  };

  const unreadBadgeLabel = useMemo(() => {
    if (unreadCount <= 0) return "";
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    let mounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await api.get<any>("/users/me/notifications?read=false&limit=200");
        if (!mounted || !response.success || !response.data) {
          return;
        }

        const data = Array.isArray(response.data)
          ? response.data
          : Array.isArray((response.data as any).notifications)
            ? (response.data as any).notifications
            : [];
        setUnreadCount(data.length);
      } catch {
        // Keep notification UI silent on network/API failures.
      }
    };

    const onRealtimeNotification = () => {
      setUnreadCount((prev) => prev + 1);
    };

    // Drawer actions (mark read / delete / mark all) update the badge instantly
    const onNotificationsChanged = () => {
      fetchUnreadCount();
    };

    fetchUnreadCount();
    socket.on("notification:new", onRealtimeNotification);
    window.addEventListener('notifications:changed', onNotificationsChanged);

    const pollId = window.setInterval(fetchUnreadCount, 60_000);

    return () => {
      mounted = false;
      socket.off("notification:new", onRealtimeNotification);
      window.removeEventListener('notifications:changed', onNotificationsChanged);
      window.clearInterval(pollId);
    };
  }, []);

  const handleNotificationToggle = () => {
    setNotificationsOpen((prev) => !prev);
  };

  const handleNotificationClose = () => {
    setNotificationsOpen(false);
  };

  const handleGoToPlan = () => {
    navigate('/settings/billing', { state: { tab: 'billing' } });
  };

  return (
    <>
      <header className="premium-header">
        <div className="header-container">
          <div className="header-content">
            {/* Mobile Menu Button */}
            {isMobile && (
              <button
                className="mobile-menu-btn"
                onClick={onMenuToggle}
                aria-label="Open menu"
              >
                <Menu size={22} />
              </button>
            )}

            {/* Left Section - Page Title */}
            <div className="header-title-section">
              <h1 className="header-title">
                {pageTitles[page] || page}
              </h1>
            </div>

            {/* Right Section - Actions */}
            <div className="header-actions">
              {/* Upgrade Pill Button (Only shown to Free/Explorer users) */}
              {!isUltra && (
                <button
                  type="button"
                  className="header-upgrade-btn"
                  onClick={handleGoToPlan}
                  aria-label="Upgrade Plan"
                  title="Upgrade to Ultra Pro"
                >
                  <Sparkles size={13} className="header-sparkle-icon" />
                  <span>Upgrade</span>
                </button>
              )}

              {/* Notifications */}
              <div className="notification-container">
                <button
                  className="notification-button"
                  onClick={handleNotificationToggle}
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                  aria-controls="notification-center"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="notification-badge">
                      {unreadBadgeLabel}
                    </span>
                  )}
                </button>
              </div>

              {/* User Avatar in Header -> Directly navigates to Plan / Settings */}
              <button
                type="button"
                className="header-profile-btn"
                onClick={handleGoToPlan}
                aria-label="Profile Settings and Plan"
                title="Profile Settings & Upgrade Plan"
              >
                <User size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>
      <NotificationCenter isOpen={notificationsOpen} onClose={handleNotificationClose} />
    </>
  );
}
