// src/components/chat/Chatbox.tsx
import React, { useState } from "react";
import { 
  MoreVertical, 
  MessageSquare, 
  Archive, 
  Bell, 
  Settings, 
  User 
} from "lucide-react";

interface ChatboxProps {
  unreadCount?: number;
  onNewChat?: () => void;
  onViewArchived?: () => void;
  onNotifications?: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
}

export default function Chatbox({ 
  unreadCount = 0,
  onNewChat,
  onViewArchived,
  onNotifications,
  onSettings,
  onProfile
}: ChatboxProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { 
      icon: <MessageSquare size={18} />, 
      label: "New Chat", 
      onClick: onNewChat, 
      color: "text-emerald-400" 
    },
    { 
      icon: <Archive size={18} />, 
      label: "Archived", 
      onClick: onViewArchived, 
      color: "text-blue-400" 
    },
    { 
      icon: <Bell size={18} />, 
      label: "Notifications", 
      onClick: onNotifications, 
      color: "text-amber-400", 
      badge: unreadCount 
    },
    { 
      icon: <Settings size={18} />, 
      label: "Settings", 
      onClick: onSettings, 
      color: "text-gray-400" 
    },
    { 
      icon: <User size={18} />, 
      label: "Profile", 
      onClick: onProfile, 
      color: "text-purple-400" 
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 w-56 glass-morphism-heavy rounded-xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold text-white">Chat Actions</h3>
            <p className="text-xs text-gray-400 mt-1">Quick access</p>
          </div>
          
          <div className="p-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white/5 transition-all"
              >
                <div className={item.color}>
                  {item.icon}
                </div>
                <span className="flex-1 text-sm text-gray-300 text-left">
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="px-2 py-1 text-xs bg-rose-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-white/10 bg-black/20">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-subtle" />
              <span className="text-xs text-gray-400">System Online</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-full bg-gradient-primary shadow-lg hover:shadow-xl transition-all"
        aria-label="Chat actions"
      >
        <div className="absolute inset-0 bg-gradient-primary rounded-full blur opacity-50" />
        
        <div className="relative z-10 flex items-center justify-center">
          <MoreVertical size={24} className="text-white" />
        </div>

        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center border-2 border-gray-900">
            {unreadCount}
          </div>
        )}
      </button>
    </div>
  );
}