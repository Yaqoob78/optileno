import React from "react";
import { Bot, Cpu, User2, Zap } from "lucide-react";
import "../../styles/components/chats/Chatbubble.css";

interface ChatBubbleProps {
  message: {
    id: string | number;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    provider?: string;
    model?: string;
  };
}

const getProviderLabel = (provider?: string, model?: string) => {
  if (!provider) return null;

  const normalized = provider.toLowerCase();
  if (normalized === "nvidia") {
    return {
      label: model ? `NVIDIA ${model}` : "NVIDIA",
      className: "provider-badge provider-badge-nvidia",
      icon: <Cpu size={11} />,
    };
  }

  if (normalized === "groq") {
    return {
      label: model ? `Groq ${model}` : "Groq",
      className: "provider-badge provider-badge-groq",
      icon: <Zap size={11} />,
    };
  }

  return {
    label: model ? `${provider} ${model}` : provider,
    className: "provider-badge",
    icon: <Bot size={11} />,
  };
};

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const provider = getProviderLabel(message.provider, message.model);

  return (
    <div className={`chat-row ${isUser ? "chat-row-user" : "chat-row-assistant"}`}>
      <div
        className={`message-avatar ${
          isUser ? "message-avatar-user" : "message-avatar-assistant"
        }`}
        aria-hidden="true"
      >
        {isUser ? <User2 size={16} /> : <Bot size={16} />}
      </div>

      <article
        className={`message-bubble ${
          isUser ? "user-message-bubble" : "ai-message-bubble"
        }`}
      >
        <div className="message-content-wrapper">
          <p className="message-text">{message.content}</p>
        </div>

        <div className="message-meta">
          {!isUser && provider && (
            <span className={provider.className}>
              {provider.icon}
              <span>{provider.label}</span>
            </span>
          )}

          <span className="message-timestamp">{message.timestamp}</span>
        </div>
      </article>
    </div>
  );
}
