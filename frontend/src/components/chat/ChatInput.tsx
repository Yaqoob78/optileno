// src/components/chat/ChatInput.tsx
import React, { useRef, useEffect } from "react";
import { ArrowUp, Focus } from "lucide-react";

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
            placeholder="Ask Leno anything…"
            className="chat-input-field"
            rows={1}
            disabled={disabled}
          />

          <div className="chat-input-toolbar">
            <span className="chat-input-hint" aria-hidden="true">
              Shift+Enter for a new line
            </span>

            <div className="chat-input-actions">
              <button
                onClick={onFocusMode}
                className={`focus-button ${focusModeActive ? 'focus-button-active' : ''}`}
                aria-label={focusModeActive ? 'Exit focus mode' : 'Enter focus mode'}
                aria-pressed={focusModeActive}
                title={focusModeActive ? 'Exit distraction-free focus mode' : 'Enter distraction-free focus mode'}
                disabled={disabled}
              >
                <Focus size={17} />
              </button>

              <button
                onClick={() => onSend(inputValue)}
                disabled={disabled || !inputValue.trim()}
                className="send-button"
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
