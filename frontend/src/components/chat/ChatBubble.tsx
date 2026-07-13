import React from "react";
import { Bot, Cpu, User2, Zap } from "lucide-react";
import { marked } from "marked";
import "../../styles/components/chats/Chatbubble.css";

interface ChatBubbleProps {
  message: {
    id: string | number;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
    provider?: string;
    model?: string;
    isError?: boolean;
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

const ALLOWED_MARKDOWN_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

const isSafeHref = (href: string) => {
  if (href.startsWith("/") || href.startsWith("#")) return true;

  try {
    const url = new URL(href, window.location.origin);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
};

const renderSafeMarkdown = (content: string) => {
  if (typeof DOMParser === "undefined") return content;

  const parsed = marked.parse(content, {
    async: false,
    breaks: true,
    gfm: true,
  });
  const document = new DOMParser().parseFromString(parsed, "text/html");

  const sanitizeNode = (node: Node) => {
    if (node.nodeType !== 1) return;

    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();

    if (!ALLOWED_MARKDOWN_TAGS.has(tag)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (tag === "a" && ["href", "title"].includes(attribute.name)) return;
      element.removeAttribute(attribute.name);
    });

    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      if (!isSafeHref(href)) {
        element.removeAttribute("href");
      } else if (/^https?:/i.test(href)) {
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer noopener");
      }
    }

    Array.from(element.childNodes).forEach(sanitizeNode);
  };

  Array.from(document.body.childNodes).forEach(sanitizeNode);
  return document.body.innerHTML;
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
        }${message.isError ? " error-message-bubble" : ""}`}
      >
        <div className="message-content-wrapper">
          {isUser ? (
            <p className="message-text">{message.content}</p>
          ) : (
            <div
              className="message-text markdown-content"
              dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(message.content) }}
            />
          )}
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
