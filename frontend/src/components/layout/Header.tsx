import React, { useEffect, useMemo, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { api } from "../../services/api/client";
import { socket } from "../../services/realtime/socket-client";
import { NotificationCenter } from "../notifications/NotificationCenter";
import "../../styles/layout/header.css"; // CSS CONNECTION

interface HeaderProps {
  page: string;
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export default function Header({ page, onMenuToggle, isMobile }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

    fetchUnreadCount();
    socket.on("notification:new", onRealtimeNotification);

    const pollId = window.setInterval(fetchUnreadCount, 60_000);

    return () => {
      mounted = false;
      socket.off("notification:new", onRealtimeNotification);
      window.clearInterval(pollId);
    };
  }, []);

  const handleNotificationToggle = () => {
    setNotificationsOpen((prev) => !prev);
  };

  const handleNotificationClose = () => {
    setNotificationsOpen(false);
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
            </div>
          </div>
        </div>
      </header>
      <NotificationCenter isOpen={notificationsOpen} onClose={handleNotificationClose} />
    </>
  );
}
