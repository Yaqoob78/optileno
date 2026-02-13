// src/components/chat/ChatInput.tsx
import React, { useRef, useEffect } from "react";
import { Send, Focus } from "lucide-react";

import "../../styles/components/chats/ChatInput.css";

interface ChatInputProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (message: string) => void;
  onFocusMode: () => void;
}

export default function ChatInput({ 
  inputValue, 
  onInputChange, 
  onSend, 
  onFocusMode 
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(inputValue);
    }
  };

  return (
    <div className="chat-input-container">
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="chat-input-field"
            rows={1}
          />
          <div className="chat-input-actions">
            {/* Focus Button */}
            <button
              onClick={onFocusMode}
              className="focus-button"
              aria-label="Focus mode"
              title="Focus mode"
            >
              <Focus size={18} />
            </button>
            
            {/* Send Button */}
            <button
              onClick={() => onSend(inputValue)}
              disabled={!inputValue.trim()}
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