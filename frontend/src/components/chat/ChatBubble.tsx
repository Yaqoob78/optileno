// src/components/chat/ChatBubble.tsx - FIXED TEXT OVERFLOW
import React from "react";
import { Cpu, Zap } from "lucide-react";
import "../../styles/components/chats/Chatbubble.css";

interface ChatBubbleProps {
  message: {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    provider?: string;
    model?: string;
  };
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`message-bubble ${message.role === 'user' ? 'user-message-bubble' : 'ai-message-bubble'
          }`}
      >
        <div className="message-content-wrapper">
          <p className="message-text">
            {message.content}
          </p>
        </div>
        <div className="timestamp-wrapper">
          {message.provider && (
            <span className="provider-badge" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginRight: '8px',
              fontSize: '0.7em',
              opacity: 0.9,
              textTransform: 'uppercase',
              fontWeight: 700,
              color: message.provider === 'NVIDIA' ? '#76b900' : message.provider === 'Groq' ? '#f55036' : 'var(--text-muted)'
            }}>
              {message.provider === 'NVIDIA' ? (
                <>
                  <Cpu size={10} color="#76b900" fill="#76b900" fillOpacity={0.2} />
                  <span>NVIDIA 405B</span>
                </>
              ) : message.provider === 'Groq' ? (
                <>
                  <Zap size={10} color="#f55036" fill="#f55036" fillOpacity={0.2} />
                  <span>Groq</span>
                </>
              ) : (
                message.provider
              )}
            </span>
          )}
          <span className="message-timestamp">{message.timestamp}</span>
        </div>
      </div>
    </div>
  );
}