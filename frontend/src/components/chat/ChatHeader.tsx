import React from "react";

import "../../styles/components/chats/ChatHeader.css";
interface ChatHeaderProps {
  activeTab: 'keep' | 'clear' | null;
  onTabChange: (tab: 'keep' | 'clear') => void;
}

export default function ChatHeader({ 
  activeTab, 
  onTabChange
}: ChatHeaderProps) {
  return (
    <div className="chat-tabs-container">
      <button
        onClick={() => onTabChange('keep')}
        className={`chat-tab ${activeTab === 'keep' ? 'active keep-active' : ''}`}
        title={activeTab === 'keep' ? "Keep mode is on" : "Enable keep mode"}
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

      <button
        onClick={() => onTabChange('clear')}
        className={`chat-tab ${activeTab === 'clear' ? 'active clear-flow-active' : ''}`}
        title={activeTab === 'clear' ? "Clear flow mode is on" : "Enable clear flow mode"}
      >
        <div className="flex items-center justify-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="3 6 5 6 21 6" strokeWidth="2"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2"/>
          </svg>
          <span>Clear Flow</span>
        </div>
      </button>
    </div>
  );
}
