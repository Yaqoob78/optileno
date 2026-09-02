import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Edit3,
  Sparkles,
} from "lucide-react";
import { renderSafeMarkdown } from "../../utils/markdownUtils";
import "../../styles/components/chats/Chatbubble.css";

export interface ChatBubbleMessage {
  id: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  provider?: string;
  model?: string;
  isError?: boolean;
  isStreaming?: boolean;
  rating?: number;
}

interface ChatBubbleProps {
  message: ChatBubbleMessage;
  messageIndex?: number;
  isLatestAssistant?: boolean;
  isGenerating?: boolean;
  onRetry?: (messageId: string | number) => void;
  onEditSubmit?: (messageId: string | number, newContent: string, messageIndex?: number) => void;
  onFeedback?: (messageId: string | number, rating: 1 | -1 | 0) => void;
}

export default function ChatBubble({
  message,
  messageIndex,
  isLatestAssistant = false,
  isGenerating = false,
  onRetry,
  onEditSubmit,
  onFeedback,
}: ChatBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Sync editValue if message.content changes
  useEffect(() => {
    setEditValue(message.content);
  }, [message.content]);

  // Auto-resize edit textarea when editing mode is opened
  useEffect(() => {
    if (isEditing && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.style.height = "auto";
      editTextareaRef.current.style.height = `${Math.min(
        Math.max(editTextareaRef.current.scrollHeight, 60),
        240,
      )}px`;
    }
  }, [isEditing, editValue]);

  // Handle copying response text to clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  // Delegated copy handler for code blocks within rendered markdown
  const handleContainerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyBtn = target.closest<HTMLButtonElement>(".code-copy-btn");
    if (!copyBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const rawCode = copyBtn.getAttribute("data-code");
    if (!rawCode) return;

    const decoded = decodeURIComponent(rawCode);
    navigator.clipboard
      .writeText(decoded)
      .then(() => {
        const textSpan = copyBtn.querySelector(".copy-btn-text");
        const originalText = textSpan ? textSpan.textContent : "Copy";
        copyBtn.classList.add("copied");
        if (textSpan) textSpan.textContent = "Copied!";

        setTimeout(() => {
          copyBtn.classList.remove("copied");
          if (textSpan) textSpan.textContent = originalText || "Copy";
        }, 2000);
      })
      .catch((err) => console.error("Failed to copy code snippet:", err));
  }, []);

  const handleEditSave = () => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setIsEditing(false);
    if (trimmed !== message.content && onEditSubmit) {
      onEditSubmit(message.id, trimmed, messageIndex);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(message.content);
    }
  };

  const handleRatingToggle = (targetRating: 1 | -1) => {
    if (!onFeedback) return;
    const newRating = message.rating === targetRating ? 0 : targetRating;
    onFeedback(message.id, newRating);
  };

  // ================= USER MESSAGE =================
  if (isUser) {
    return (
      <div className="chat-turn chat-turn-user">
        <article className="user-message-container" aria-label="Your message">
          {isEditing ? (
            <div className="user-edit-container">
              <textarea
                ref={editTextareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="user-edit-textarea"
                rows={2}
                placeholder="Edit your message…"
              />
              <div className="user-edit-actions">
                <span className="user-edit-hint">Enter to submit · Esc to cancel</span>
                <div className="user-edit-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditValue(message.content);
                    }}
                    className="user-edit-cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEditSave}
                    disabled={!editValue.trim() || isGenerating}
                    className="user-edit-save-btn"
                  >
                    Save & Submit
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="user-message-bubble-wrapper">
              <div className="user-message">
                <p className="message-text">{message.content}</p>
              </div>
              <div className="user-turn-actions">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={isGenerating}
                  className="turn-action-btn"
                  aria-label="Edit and resubmit message"
                  title="Edit and resubmit"
                >
                  <Edit3 size={13.5} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="turn-action-btn"
                  aria-label="Copy prompt"
                  title={copied ? "Copied!" : "Copy message"}
                >
                  {copied ? <Check size={13.5} className="text-emerald-400" /> : <Copy size={13.5} />}
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    );
  }

  // ================= ASSISTANT MESSAGE =================
  const displayContent =
    message.content.trim() ||
    (message.isStreaming
      ? ""
      : "Hello! How can I assist you with your tasks, habits, or schedule today?");
  const htmlContent = renderSafeMarkdown(displayContent, message.isStreaming);

  return (
    <div className="chat-turn chat-turn-assistant">
      <article
        className={`assistant-message${message.isError ? " assistant-message-error" : ""}${
          message.isStreaming ? " assistant-message-streaming" : ""
        }`}
        aria-label="Leno's reply"
      >
        <div className="assistant-header-row">
          <div className="assistant-avatar-badge" aria-hidden="true">
            <Sparkles size={13} className="assistant-avatar-icon" />
          </div>
          <span className="assistant-name">Leno</span>
          {message.provider && (
            <span className="assistant-provider-tag">{message.provider}</span>
          )}
          {message.timestamp && (
            <span className="assistant-timestamp">{message.timestamp}</span>
          )}
        </div>

        {!message.content.trim() && message.isStreaming ? (
          <div className="assistant-thinking-indicator" aria-label="Leno is thinking">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-text">Thinking…</span>
          </div>
        ) : (
          <>
            <div
              ref={contentRef}
              onClick={handleContainerClick}
              className="message-text markdown-content"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            {message.isStreaming && (
              <span className="inline-streaming-cursor" aria-hidden="true">
                ●
              </span>
            )}
          </>
        )}

        {/* Message Actions Bar (Copy, Feedback, Retry) */}
        {!message.isStreaming && (
          <div className="assistant-actions-bar">
            <button
              type="button"
              onClick={handleCopyText}
              className={`action-pill-btn ${copied ? "action-pill-btn-active" : ""}`}
              aria-label="Copy response"
              title={copied ? "Copied to clipboard!" : "Copy response"}
            >
              {copied ? (
                <>
                  <Check size={13.5} className="text-emerald-400" />
                  <span className="action-pill-text">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={13.5} />
                  <span className="action-pill-text">Copy</span>
                </>
              )}
            </button>

            {onFeedback && (
              <>
                <button
                  type="button"
                  onClick={() => handleRatingToggle(1)}
                  className={`action-pill-btn ${
                    message.rating === 1 ? "action-pill-btn-active active-thumb-up" : ""
                  }`}
                  aria-label="Good response"
                  aria-pressed={message.rating === 1}
                  title="Good response"
                >
                  <ThumbsUp size={13.5} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRatingToggle(-1)}
                  className={`action-pill-btn ${
                    message.rating === -1 ? "action-pill-btn-active active-thumb-down" : ""
                  }`}
                  aria-label="Poor response"
                  aria-pressed={message.rating === -1}
                  title="Poor response"
                >
                  <ThumbsDown size={13.5} />
                </button>
              </>
            )}

            {(isLatestAssistant || message.isError) && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message.id)}
                disabled={isGenerating}
                className="action-pill-btn action-pill-retry"
                aria-label="Regenerate response"
                title="Regenerate response"
              >
                <RotateCcw size={13.5} className={isGenerating ? "animate-spin" : ""} />
                <span className="action-pill-text">Retry</span>
              </button>
            )}
          </div>
        )}
      </article>
    </div>
  );
}
