import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  read_at?: string;
  created_at: string;
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

  useEffect(() => {
    if (!isOpen) return;

    // Listen for new notifications
    socket.on('notification:received', (data: any) => {
      const newNotif: Notification = {
        id: Math.random().toString(),
        ...data.notification,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    });

    // Fetch existing notifications
    fetchNotifications();

    return () => {
      socket.off('notification:received');
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/v1/notifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-6 py-4 border-b border-gray-200">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filter === 'unread'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread ({notifications.filter((n) => !n.read).length})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bell className="w-12 h-12 mb-4 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filtered.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-50 transition ${
                    !notif.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-1">
                      {getIcon(notif.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {notif.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notif.message}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="ml-2 flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs text-gray-500">
                          {new Date(notif.created_at).toLocaleTimeString()}
                        </span>
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Mark read
                          </button>
                        )}
                        {notif.action_url && (
                          <a
                            href={notif.action_url}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="ml-auto p-1 hover:bg-gray-200 rounded transition"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500 hover:text-gray-700" />
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
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition">
            Mark all as read
          </button>
        </div>
      </div>
    </div>
  );
};
