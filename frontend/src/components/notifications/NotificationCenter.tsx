import React, { useMemo, useState, useEffect } from 'react';
import { X, Bell, AlertCircle, Info, Trash2 } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';
import { api } from '../../services/api/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  read_at?: string;
  createdAt: string;
  action_url?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const normalizeNotification = (incoming: any): Notification => ({
    id: String(incoming?.id ?? crypto.randomUUID()),
    type: String(incoming?.type ?? 'info'),
    title: String(incoming?.title ?? 'Notification'),
    message: String(incoming?.message ?? ''),
    priority: (String(incoming?.priority ?? 'medium').toLowerCase() as Notification['priority']),
    read: Boolean(incoming?.read ?? incoming?.is_read ?? false),
    read_at: incoming?.read_at ? String(incoming.read_at) : undefined,
    createdAt: String(incoming?.createdAt ?? incoming?.created_at ?? new Date().toISOString()),
    action_url: incoming?.action_url ? String(incoming.action_url) : undefined,
  });

  useEffect(() => {
    if (!isOpen) return;

    // Listen for new notifications
    const onNewNotification = (data: any) => {
      const newNotif: Notification = normalizeNotification(data?.notification ?? data);
      setNotifications((prev) => [newNotif, ...prev]);
    };
    socket.on('notification:new', onNewNotification);

    // Fetch existing notifications
    fetchNotifications();

    return () => {
      socket.off('notification:new', onNewNotification);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const fetchNotifications = async () => {
    try {
      const response = await api.get<Notification[]>('/users/me/notifications');
      if (!response.success || !response.data) return;
      const normalized = (response.data || []).map((notification) =>
        normalizeNotification(notification)
      );
      setNotifications(normalized);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/users/me/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/users/me/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/users/me/notifications/read-all');
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
      setFilter('all');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'medium':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  if (!isOpen) return null;

  return (
    <div id="notification-center" className="fixed inset-0 z-[120] overflow-hidden" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-[88vw] max-w-md border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 py-3 border-b border-white/10">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${filter === 'unread'
                ? 'bg-blue-500 text-white'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Bell className="w-12 h-12 mb-4 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filtered.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 transition ${!notif.read ? 'bg-blue-500/10 hover:bg-blue-500/15' : 'hover:bg-white/5'
                    }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-1">
                      {getIcon(notif.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-white">
                            {notif.title}
                          </p>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="ml-2 flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-slate-400">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-xs text-blue-300 hover:text-blue-200 font-medium"
                          >
                            Mark read
                          </button>
                        )}
                        {notif.action_url && (
                          <a
                            href={notif.action_url}
                            className="text-xs text-blue-300 hover:text-blue-200 font-medium"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="ml-auto p-1 rounded transition hover:bg-white/10"
                          aria-label="Delete notification"
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/95">
          <button
            onClick={markAllAsRead}
            className="w-full py-2 text-sm font-medium text-blue-300 hover:text-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={unreadCount === 0}
          >
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
};
