// src/components/chat/ChatInput.tsx
import React, { useRef, useEffect } from "react";
import { Send, Focus } from "lucide-react";

import "../../styles/components/chats/ChatInput.css";

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (message: string) => void;
  onFocusMode: () => void;
  focusModeActive?: boolean;
  disabled?: boolean;
}

export default function ChatInput({ 
  inputValue, 
  onInputChange, 
  onSend, 
  onFocusMode,
  focusModeActive = false,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(inputValue);
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-inner">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask Leno anything. Shift+Enter for a new line."
            className="chat-input-field"
            rows={1}
            disabled={disabled}
          />
          <div className="chat-input-actions">
            <button
              onClick={onFocusMode}
              className={`focus-button ${focusModeActive ? 'focus-button-active' : ''}`}
              aria-label={focusModeActive ? 'Exit focus mode' : 'Enter focus mode'}
              aria-pressed={focusModeActive}
              title={focusModeActive ? 'Exit distraction-free focus mode' : 'Enter distraction-free focus mode'}
              disabled={disabled}
            >
              <Focus size={18} />
            </button>
            
            {/* Send Button */}
            <button
              onClick={() => onSend(inputValue)}
              disabled={disabled || !inputValue.trim()}
              className="send-button"
              aria-label="Send message"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
