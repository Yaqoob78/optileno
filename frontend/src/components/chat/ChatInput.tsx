// src/components/chat/ChatInput.tsx
import React, { useRef, useEffect } from "react";
import { ArrowUp, Focus, Square } from "lucide-react";

import "../../styles/components/chats/ChatInput.css";

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (message: string) => void;
  onFocusMode: () => void;
  onStopGenerating?: () => void;
  isGenerating?: boolean;
  focusModeActive?: boolean;
  disabled?: boolean;
}

export default function ChatInput({ 
  inputValue, 
  onInputChange, 
  onSend, 
  onFocusMode,
  onStopGenerating,
  isGenerating = false,
  focusModeActive = false,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea seamlessly between 1 row and max 180px
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textarea.scrollHeight, 40), 180);
      textarea.style.height = `${targetHeight}px`;
    }
  }, [inputValue]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isGenerating) return;
    if (disabled) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (trimmed) {
        onSend(trimmed);
      }
    }
  };

  const handleSendClick = () => {
    if (isGenerating) return;
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSend(trimmed);
    }
  };

  return (
    <div className="chat-input-container">
      <div className="chat-input-inner">
        <div className={`chat-input-wrapper ${isGenerating ? 'is-generating-glow' : ''}`}>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isGenerating ? "Leno is responding…" : "Ask Leno anything…"}
            className="chat-input-field"
            rows={1}
            disabled={disabled && !isGenerating}
            aria-label="Chat input"
          />

          <div className="chat-input-toolbar">
            <span className="chat-input-hint" aria-hidden="true">
              {isGenerating ? "Generation in progress" : "Shift+Enter for a new line"}
            </span>

            <div className="chat-input-actions">
              <button
                type="button"
                onClick={onFocusMode}
                className={`focus-button ${focusModeActive ? 'focus-button-active' : ''}`}
                aria-label={focusModeActive ? 'Exit focus mode' : 'Enter focus mode'}
                aria-pressed={focusModeActive}
                title={focusModeActive ? 'Exit distraction-free focus mode' : 'Enter distraction-free focus mode'}
                disabled={disabled}
              >
                <Focus size={17} />
              </button>

              {isGenerating ? (
                <button
                  type="button"
                  onClick={onStopGenerating}
                  className="stop-button"
                  aria-label="Stop generating response"
                  title="Stop generating"
                >
                  <Square size={13} fill="currentColor" />
                  <span className="stop-button-text">Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSendClick}
                  disabled={disabled || !inputValue.trim()}
                  className="send-button"
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
