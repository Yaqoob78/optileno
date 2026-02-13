// src/components/chat/ContextSelector.tsx
import React from "react";
import { 
  MessageSquare, 
  BarChart3, 
  Calendar, 
  Settings,
  LayoutDashboard 
} from "lucide-react";

export type ChatContext = 
  | "All Chats" 
  | "Unread" 
  | "Archived"
  | "Analytics"
  | "Planner"
  | "Settings"
  | "Dashboard";

interface ContextSelectorProps {
  value: ChatContext;
  onChange: (context: ChatContext) => void;
  compact?: boolean;
}

const CONTEXTS = [
  { 
    key: "All Chats" as ChatContext, 
    icon: <MessageSquare size={18} />, 
    color: "bg-gradient-emerald" 
  },
  { 
    key: "Unread" as ChatContext, 
    icon: <MessageSquare size={18} />, 
    color: "bg-gradient-blue" 
  },
  { 
    key: "Archived" as ChatContext, 
    icon: <MessageSquare size={18} />, 
    color: "bg-gradient-gray" 
  },
  { 
    key: "Analytics" as ChatContext, 
    icon: <BarChart3 size={18} />, 
    color: "bg-gradient-amber" 
  },
  { 
    key: "Planner" as ChatContext, 
    icon: <Calendar size={18} />, 
    color: "bg-gradient-purple" 
  },
  { 
    key: "Settings" as ChatContext, 
    icon: <Settings size={18} />, 
    color: "bg-gradient-gray-dark" 
  },
  { 
    key: "Dashboard" as ChatContext, 
    icon: <LayoutDashboard size={18} />, 
    color: "bg-gradient-violet" 
  },
];

export default function ContextSelector({ 
  value, 
  onChange,
  compact = false 
}: ContextSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {CONTEXTS.map((context) => {
        const isActive = value === context.key;
        
        return (
          <button
            key={context.key}
            onClick={() => onChange(context.key)}
            className={`context-selector-button ${isActive ? context.color + ' text-white' : ''} ${
              compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'
            }`}
            aria-label={`Switch to ${context.key}`}
          >
            <div className={`${isActive ? 'scale-110' : ''} transition-transform`}>
              {context.icon}
            </div>
            <span className="font-medium whitespace-nowrap">
              {compact ? context.key.split(' ')[0] : context.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}