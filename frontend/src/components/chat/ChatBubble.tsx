import React from "react";
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

  if (isUser) {
    // User turns: compact, right-aligned quiet pill — like modern AI chats,
    // the user's words sit on a subtle surface, never a loud gradient.
    return (
      <div className="chat-turn chat-turn-user">
        <article className="user-message" aria-label="Your message">
          <p className="message-text">{message.content}</p>
        </article>
      </div>
    );
  }

  // Assistant turns: open, full-width prose with no bubble chrome,
  // so replies read like a document instead of a text message.
  return (
    <div className="chat-turn chat-turn-assistant">
      <article
        className={`assistant-message${message.isError ? " assistant-message-error" : ""}`}
        aria-label="Leno's reply"
      >
        <div
          className="message-text markdown-content"
          dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(message.content) }}
        />
        <div className="message-meta">
          <span className="message-meta-text">
            {message.provider ? `Leno · ${message.timestamp}` : message.timestamp}
          </span>
        </div>
      </article>
    </div>
  );
}
