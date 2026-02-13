// src/components/chat/TypingIndicator.tsx
import React from 'react';
import { Bot } from 'lucide-react';

interface TypingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
  className?: string;
}

export default function TypingIndicator({ 
  message = "AI is thinking",
  size = 'medium',
  showIcon = true,
  className = ''
}: TypingIndicatorProps) {
  const sizeClasses = {
    small: 'text-sm gap-2',
    medium: 'text-base gap-3',
    large: 'text-lg gap-4'
  };

  return (
    <div 
      className={`flex items-center ${sizeClasses[size]} ${className}`}
      aria-label="Leno is typing"
      role="status"
    >
      {showIcon && (
        <div className="flex-shrink-0">
          <Bot size={size === 'small' ? 16 : size === 'medium' ? 20 : 24} className="text-emerald-400 animate-pulse-subtle" />
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <span className="text-gray-300">{message}</span>
        <div className="typing-indicator-dots">
          <div className="typing-indicator-dot animate-typing" />
          <div className="typing-indicator-dot animate-typing" style={{ animationDelay: '150ms' }} />
          <div className="typing-indicator-dot animate-typing" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}