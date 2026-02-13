// src/components/chat/ChatHeader.tsx - ONLY CLEAR FLOW & KEEP
import React, { useState } from "react";
import { Trash2, Save } from "lucide-react";

import "../../styles/components/chats/ChatHeader.css";
// Update the ChatHeader.tsx to pass isClearing prop
interface ChatHeaderProps {
  activeTab: 'keep' | 'clear' | null;
  onTabChange: (tab: 'keep' | 'clear') => void;
  isClearing?: boolean;
}

export default function ChatHeader({ 
  activeTab, 
  onTabChange,
  isClearing = false 
}: ChatHeaderProps) {
  return (
    <div className="chat-tabs-container">
      {/* Keep Button */}
      <button
        onClick={() => onTabChange('keep')}
        className={`chat-tab ${activeTab === 'keep' ? 'active keep-active' : ''}`}
        title={activeTab === 'keep' ? "Keep mode active - messages saved" : "Save and keep all messages"}
      >
        <div className="flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeWidth="2"/>
            <polyline points="17 21 17 13 7 13 7 21" strokeWidth="2"/>
            <polyline points="7 3 7 8 15 8" strokeWidth="2"/>
          </svg>
          <span>Keep</span>
        </div>
      </button>
      
      {/* Clear Flow Button */}
      <button
        onClick={() => onTabChange('clear')}
        className={`chat-tab ${activeTab === 'clear' ? 'active clear-flow-active' : ''} ${isClearing ? 'clearing-active' : ''}`}
        title={activeTab === 'clear' ? "Clear Flow active - messages disappearing" : "Start clearing chat messages"}
      >
        <div className="flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6" strokeWidth="2"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2"/>
          </svg>
          <span>Clear Flow</span>
        </div>
        {isClearing && (
          <div className="clearing-indicator">
            <div className="clearing-pulse"></div>
          </div>
        )}
      </button>
    </div>
  );
}