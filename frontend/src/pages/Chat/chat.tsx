import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { api } from "../../services/api/client";
import { useNavStatePreservation } from "../../hooks/useNavStatePreservation";
import "../../styles/pages/chat.css";
import ChatBubble from "../../components/chat/ChatBubble";
import ChatInput from "../../components/chat/ChatInput";
import ChatHeader from "../../components/chat/ChatHeader";
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { useUserStore } from "../../stores/useUserStore";
import { useChatStore } from "../../stores/chat.store";
import { usePlannerStore } from "../../stores/planner.store";

interface Message {
  id: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string | Date;
  provider?: string;
  model?: string;
  metadata?: any;
}

type ChatMode = "NORMAL" | "KEEP" | "CLEAR_FLOW";
type AIMode = "CHAT" | "PLAN" | "ANALYZE" | "TASK";

interface Suggestion {
  id: number;
  text: string;
  aiMode: AIMode;
  description: string;
}

interface ToastState {
  message: string;
  type: "success" | "info";
  category?: "task" | "goal" | "habit" | "deepwork" | "analytics";
}

interface PlannerRefreshTargets {
  tasks?: boolean;
  goals?: boolean;
  habits?: boolean;
}

const SUGGESTIONS: Suggestion[] = [
  { id: 1, text: "Let's just talk", aiMode: "CHAT", description: "Casual conversation" },
  { id: 2, text: "Help me plan something", aiMode: "PLAN", description: "Planning assistance" },
  { id: 3, text: "Show my progress", aiMode: "ANALYZE", description: "Progress analysis" },
  { id: 4, text: "Give me a small task", aiMode: "TASK", description: "Quick tasks" },
];
const CHAT_REQUEST_TIMEOUT_MS = 75000;

const formatTimestamp = (value: string | Date) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const readUsage = (key: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      conversations: Number(parsed.conversations) || 0,
      tokens: Number(parsed.tokens) || 0,
    };
  } catch {
    return { conversations: 0, tokens: 0 };
  }
};

export default function Chat() {
  useNavStatePreservation();

  const activeConversation = useChatStore((state) => state.activeConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const updateMessageMetadata = useChatStore((state) => state.updateMessageMetadata);
  const truncateFromIndex = useChatStore((state) => state.truncateFromIndex);
  const toggleKeep = useChatStore((state) => state.toggleKeepConversation);
  const deleteMessage = useChatStore((state) => state.deleteMessage);

  const isUltra = useUserStore((state) => state.isUltra);
  const userProfile = useUserStore((state) => state.profile);

  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>(
    activeConversation?.isKept ? "KEEP" : "NORMAL",
  );
  const [aiMode, setAiMode] = useState<AIMode>("CHAT");
  const [uiActiveTab, setUiActiveTab] = useState<"keep" | "clear" | null>(
    activeConversation?.isKept ? "keep" : null,
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const activeStreamingMessageIdRef = useRef<string | null>(null);

  const clearSuggestionTimer = useCallback(() => {
    if (suggestionTimerRef.current) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
  }, []);

  const clearStreamingTimer = useCallback(() => {
    if (streamingTimerRef.current) {
      window.clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
  }, []);

  const startFreshConversation = useCallback((notify = false) => {
    clearSuggestionTimer();
    clearStreamingTimer();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    createConversation("New Chat");
    setInputValue("");
    setIsTyping(false);
    setIsSending(false);
    setShowSuggestions(false);
    setUserHasTyped(false);
    if (notify) {
      setToast({
        message: "Started a fresh new chat session.",
        type: "info",
      });
    }
  }, [clearSuggestionTimer, clearStreamingTimer, createConversation]);

  const refreshPlannerState = useCallback(
    async ({ tasks, goals, habits }: PlannerRefreshTargets) => {
      const plannerStore = usePlannerStore.getState();
      const refreshers: Array<Promise<void>> = [];

      if (tasks) refreshers.push(plannerStore.fetchTasks());
      if (goals) refreshers.push(plannerStore.fetchGoals());
      if (habits) refreshers.push(plannerStore.fetchHabits());

      if (refreshers.length === 0) return;
      await Promise.allSettled(refreshers);
    },
    [],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearSuggestionTimer();
      clearStreamingTimer();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clearSuggestionTimer, clearStreamingTimer]);

  useEffect(() => {
    const prefill = localStorage.getItem("optileno_chat_prefill");
    if (prefill && prefill.trim()) {
      setInputValue(prefill.trim());
      localStorage.removeItem("optileno_chat_prefill");
    }

    const preferredMode = localStorage.getItem("optileno_chat_mode");
    if (
      preferredMode === "CHAT" ||
      preferredMode === "PLAN" ||
      preferredMode === "ANALYZE" ||
      preferredMode === "TASK"
    ) {
      setAiMode(preferredMode);
    }
    localStorage.removeItem("optileno_chat_mode");
  }, []);

  useEffect(() => {
    const currentActive = useChatStore.getState().activeConversation;
    if (!currentActive || !currentActive.isKept) {
      startFreshConversation();
    }
  }, [startFreshConversation]);

  useEffect(() => {
    if (!activeConversation) return;

    const hasUserMessages = activeConversation.messages.some(
      (message) => message.role === "user",
    );
    setUserHasTyped(hasUserMessages);

    if (activeConversation.isKept) {
      setChatMode("KEEP");
      setUiActiveTab("keep");
      return;
    }

    setUiActiveTab((current) => (current === "keep" ? null : current));
    setChatMode((current) => (current === "KEEP" ? "NORMAL" : current));
  }, [activeConversation?.id, activeConversation?.isKept, activeConversation?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeConversation?.messages, isTyping]);

  useEffect(() => {
    if (chatMode !== "CLEAR_FLOW" || !activeConversation) return;

    const messages = activeConversation.messages;
    if (messages.length <= 6) return;

    messages
      .slice(0, messages.length - 6)
      .forEach((message) => deleteMessage(String(message.id)));
  }, [activeConversation, chatMode, deleteMessage]);

  useEffect(() => {
    clearSuggestionTimer();

    const messageCount = activeConversation?.messages.length || 0;
    if (messageCount <= 1 && !userHasTyped) {
      suggestionTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setShowSuggestions(true);
        }
      }, 900);
      return;
    }

    setShowSuggestions(false);
  }, [activeConversation?.id, activeConversation?.messages.length, clearSuggestionTimer, userHasTyped]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const getDailyUsageKey = () => {
    const today = new Date().toISOString().split("T")[0];
    const userKey = userProfile?.id ? String(userProfile.id) : "anon";
    return `daily_usage_${userKey}_${today}`;
  };

  const getChatDailyLimit = () => {
    const profileLimit = Number(userProfile?.limits?.chat_daily_limit);
    if (Number.isFinite(profileLimit) && profileLimit > 0) return profileLimit;
    return isUltra ? 150 : 15;
  };

  const checkDailyLimits = () => {
    const key = getDailyUsageKey();
    const usage = readUsage(key);
    const dailyLimit = getChatDailyLimit();

    if (usage.conversations >= dailyLimit) {
      setToast({
        message: `Daily request limit (${dailyLimit}) reached.`,
        type: "info",
      });
      return false;
    }

    return true;
  };

  const updateDailyUsage = (inputLength: number) => {
    const key = getDailyUsageKey();
    const usage = readUsage(key);
    const estimatedTokens = Math.ceil(inputLength / 4) + 10;

    localStorage.setItem(
      key,
      JSON.stringify({
        conversations: usage.conversations + 1,
        tokens: usage.tokens + estimatedTokens,
      }),
    );
  };

  const sendMessage = async (
    userMessage: string,
    currentAiMode: AIMode,
    conversationHistory: Array<{ role: string; content: string }>,
    currentSessionId: string | null,
    signal?: AbortSignal,
  ) => {
    const response = await api.post(
      "/chat/send",
      {
        message: userMessage,
        mode: currentAiMode,
        history: conversationHistory,
        session_id: currentSessionId,
      },
      {
        timeout: CHAT_REQUEST_TIMEOUT_MS,
        signal,
      },
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Chat failed");
    }

    return response.data as {
      message?: string;
      session_id?: string;
      actions?: any[];
      provider?: string;
      model?: string;
    };
  };

  const handleAIActions = useCallback(
    async (actions: any[]) => {
      if (!Array.isArray(actions) || actions.length === 0) return;

      const refreshTargets: PlannerRefreshTargets = {};
      let nextToast: ToastState | null = null;

      actions.forEach((action) => {
        switch (action.type) {
          case "CREATE_TASK":
          case "PLANNER_CREATE_TASK":
          case "PLANNER_UPDATE_TASK":
          case "PLANNER_COMPLETE_TASK":
          case "DELETE_TASK":
            refreshTargets.tasks = true;
            nextToast =
              nextToast ||
              {
                message:
                  action.type === "DELETE_TASK"
                    ? "Task updated."
                    : `Task ready: ${action.result?.task?.title || action.result?.title || "Planner updated"}`,
                type: action.type === "DELETE_TASK" ? "info" : "success",
                category: "task",
              };
            break;

          case "CREATE_GOAL":
          case "CREATE_GOAL_CASCADE":
          case "PLANNER_CREATE_GOAL":
          case "PLANNER_ADD_GOAL":
          case "DELETE_GOAL":
            refreshTargets.goals = true;
            if (action.type === "CREATE_GOAL_CASCADE" || action.type === "PLANNER_CREATE_GOAL") {
              refreshTargets.tasks = true;
              refreshTargets.habits = true;
            }
            nextToast =
              nextToast ||
              {
                message:
                  action.type === "DELETE_GOAL"
                    ? "Goal updated."
                    : `Goal ready: ${action.result?.goal?.title || action.result?.title || "Planner updated"}`,
                type: action.type === "DELETE_GOAL" ? "info" : "success",
                category: "goal",
              };
            break;

          case "CREATE_HABIT":
          case "PLANNER_CREATE_HABIT":
          case "PLANNER_TRACK_HABIT":
          case "DELETE_HABIT":
            refreshTargets.habits = true;
            nextToast =
              nextToast ||
              {
                message:
                  action.type === "PLANNER_TRACK_HABIT"
                    ? "Habit tracked."
                    : action.type === "DELETE_HABIT"
                      ? "Habit updated."
                      : `Habit ready: ${
                          action.result?.habit?.name ||
                          action.result?.name ||
                          action.result?.title ||
                          "Planner updated"
                        }`,
                type: action.type === "DELETE_HABIT" ? "info" : "success",
                category: "habit",
              };
            break;

          case "BREAKDOWN_GOAL":
          case "PLANNER_CREATE_PLAN":
            refreshTargets.tasks = true;
            refreshTargets.goals = true;
            refreshTargets.habits = true;
            nextToast =
              nextToast || {
                message: "Planner updated from your chat.",
                type: "success",
                category: "goal",
              };
            break;

          case "PLANNER_START_DEEP_WORK":
            nextToast =
              nextToast || {
                message: "Deep work session started.",
                type: "success",
                category: "deepwork",
              };
            break;

          case "GET_DAILY_ACHIEVEMENT_SCORE":
          case "GET_GOAL_PROGRESS_REPORT":
          case "ANALYTICS_ANALYZE_PATTERNS":
          case "SHOW_ANALYTICS":
          case "ANALYTICS_VIEW_DASHBOARD":
            nextToast =
              nextToast || {
                message: "Analytics refreshed.",
                type: "info",
                category: "analytics",
              };
            break;

          default:
            break;
        }
      });

      if (nextToast) {
        setToast(nextToast);
      }

      await refreshPlannerState(refreshTargets);
    },
    [refreshPlannerState],
  );

  /**
   * Streams progressive text tokens smoothly into the UI
   */
  const playStreamingResponse = (
    fullText: string,
    messageId: string,
    onComplete: () => void,
  ) => {
    clearStreamingTimer();
    activeStreamingMessageIdRef.current = messageId;

    let currentIndex = 0;
    const totalLength = fullText.length;
    // Dynamic chunk step based on total length for steady reading speed
    const stepSize = Math.max(1, Math.ceil(totalLength / 65));
    const intervalMs = 20;

    const streamNextChunk = () => {
      if (!isMountedRef.current || activeStreamingMessageIdRef.current !== messageId) {
        return;
      }

      currentIndex = Math.min(currentIndex + stepSize, totalLength);
      const partialText = fullText.slice(0, currentIndex);
      editMessage(messageId, partialText);

      if (currentIndex < totalLength) {
        streamingTimerRef.current = window.setTimeout(streamNextChunk, intervalMs);
      } else {
        activeStreamingMessageIdRef.current = null;
        updateMessageMetadata(messageId, { isStreaming: false });
        onComplete();
      }
    };

    streamNextChunk();
  };

  /**
   * Immediately halts active generation or streaming
   */
  const handleStopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    clearStreamingTimer();

    if (activeStreamingMessageIdRef.current) {
      updateMessageMetadata(activeStreamingMessageIdRef.current, {
        isStreaming: false,
        stopped: true,
      });
      activeStreamingMessageIdRef.current = null;
    }

    setIsTyping(false);
    setIsSending(false);
    setToast({
      message: "Generation stopped.",
      type: "info",
    });
  }, [clearStreamingTimer, updateMessageMetadata]);

  const submitMessage = async (
    message: string,
    requestedMode: AIMode,
    overrideHistory?: Array<{ role: string; content: string }>,
  ) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;
    if (!checkDailyLimits()) return;

    clearSuggestionTimer();
    clearStreamingTimer();
    setShowSuggestions(false);
    setUserHasTyped(true);
    setAiMode(requestedMode);

    addMessage({
      role: "user",
      content: trimmedMessage,
    });

    setInputValue("");
    setIsTyping(true);
    setIsSending(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const historyToUse =
        overrideHistory ||
        (useChatStore.getState().activeConversation?.messages || [])
          .filter((msg) => !msg.metadata?.error && !msg.metadata?.welcome)
          .slice(-10)
          .map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

      const response = await sendMessage(
        trimmedMessage,
        requestedMode,
        historyToUse,
        activeConversation?.id ?? null,
        abortController.signal,
      );

      // Successful network response
      setIsTyping(false);
      updateDailyUsage(trimmedMessage.length);

      const assistantMsgContent = response.message || "I received your message.";
      const assistantId = crypto.randomUUID();

      // Insert assistant message shell with streaming flag
      addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        metadata: {
          provider: response.provider,
          model: response.model,
          isStreaming: true,
        },
      } as any);

      // Play smooth streaming playback
      playStreamingResponse(assistantMsgContent, assistantId, async () => {
        if (isMountedRef.current) {
          setIsSending(false);
          await handleAIActions(response.actions || []);
        }
      });
    } catch (error: any) {
      if (
        axios.isCancel(error) ||
        error.name === "AbortError" ||
        error.name === "CanceledError"
      ) {
        // Request was deliberately cancelled by user
        return;
      }

      console.error("Chat request failed:", error);

      addMessage({
        role: "assistant",
        content: "Something went wrong. Please try again in a moment.",
        metadata: { error: true },
      });

      setToast({
        message: "Message failed to send cleanly.",
        type: "info",
      });
      setIsTyping(false);
      setIsSending(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  /**
   * Retry handler: regenerate response from last user turn
   */
  const handleRetry = useCallback(
    async (messageId: string | number) => {
      if (isSending || isTyping) return;
      const conversation = useChatStore.getState().activeConversation;
      if (!conversation) return;

      const msgs = conversation.messages;
      const msgIndex = msgs.findIndex((m) => String(m.id) === String(messageId));
      if (msgIndex === -1) return;

      // Find the user message preceding this assistant message
      let userPrompt = "";
      let truncateTargetIndex = msgIndex;

      for (let i = msgIndex - 1; i >= 0; i--) {
        if (msgs[i].role === "user") {
          userPrompt = msgs[i].content;
          // Truncate from the assistant message forward
          truncateTargetIndex = msgIndex;
          break;
        }
      }

      if (!userPrompt) return;

      // Truncate thread from the assistant response index onwards
      truncateFromIndex(truncateTargetIndex);

      // Resubmit prompt
      const updatedHistory = msgs
        .slice(0, truncateTargetIndex)
        .filter((m) => !m.metadata?.error && !m.metadata?.welcome)
        .map((m) => ({ role: m.role, content: m.content }));

      await submitMessage(userPrompt, aiMode, updatedHistory);
    },
    [aiMode, isSending, isTyping, truncateFromIndex],
  );

  /**
   * Edit and resubmit user message: forks conversation from that point
   */
  const handleEditSubmit = useCallback(
    async (
      _messageId: string | number,
      newContent: string,
      messageIndex?: number,
    ) => {
      if (isSending || isTyping) return;
      const conversation = useChatStore.getState().activeConversation;
      if (!conversation) return;

      const targetIndex =
        typeof messageIndex === "number"
          ? messageIndex
          : conversation.messages.findIndex((m) => String(m.id) === String(_messageId));

      if (targetIndex === -1) return;

      // Truncate conversation from the edited user message onwards
      truncateFromIndex(targetIndex);

      // Resubmit with new content
      await submitMessage(newContent, aiMode);
    },
    [aiMode, isSending, isTyping, truncateFromIndex],
  );

  /**
   * Feedback rating handler
   */
  const handleFeedback = useCallback(
    (messageId: string | number, rating: 1 | -1 | 0) => {
      updateMessageMetadata(String(messageId), { rating });
      if (rating !== 0) {
        setToast({
          message: "Thank you for the feedback!",
          type: "success",
        });
      }
    },
    [updateMessageMetadata],
  );

  const handleSuggestionClick = async (suggestion: Suggestion) => {
    await submitMessage(suggestion.text, suggestion.aiMode);
  };

  const handleSend = async (message: string) => {
    await submitMessage(message, aiMode);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (!userHasTyped && value.trim()) {
      setUserHasTyped(true);
      setShowSuggestions(false);
      clearSuggestionTimer();
    }
  };

  const handleKeepClick = () => {
    if (!activeConversation) return;

    if (activeConversation.isKept) {
      startFreshConversation();
      setChatMode("NORMAL");
      setUiActiveTab(null);
      setToast({ message: "Chat saved to Dashboard.", type: "success" });
      return;
    }

    toggleKeep(activeConversation.id);
    setChatMode("KEEP");
    setUiActiveTab("keep");
    setToast({ message: "Keep mode enabled.", type: "success" });
  };

  const handleClearFlowClick = () => {
    if (chatMode === "CLEAR_FLOW") {
      startFreshConversation();
      setChatMode("NORMAL");
      setUiActiveTab(null);
      setToast({ message: "Clear flow disabled.", type: "info" });
      return;
    }

    if (chatMode === "KEEP") {
      setToast({ message: "Disable Keep mode first.", type: "info" });
      return;
    }

    setChatMode("CLEAR_FLOW");
    setUiActiveTab("clear");
    setToast({ message: "Clear flow enabled.", type: "success" });
  };

  const handleFocusMode = () => setIsFocusMode((active) => !active);

  const messages = activeConversation?.messages || [];
  const isGenerating = isSending || isTyping;

  // Find index of the latest assistant message for retry button
  let latestAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      latestAssistantIndex = i;
      break;
    }
  }

  return (
    <ErrorBoundary componentName="Chat">
      <div className={`chat-container ${isFocusMode ? "chat-focus-mode" : ""}`}>
        <ChatHeader
          activeTab={uiActiveTab}
          onTabChange={(tab) => {
            if (tab === "keep") handleKeepClick();
            if (tab === "clear") handleClearFlowClick();
          }}
          onNewChat={() => startFreshConversation(true)}
        />

        {toast && (
          <div className="chat-toast-shell">
            <div
              className={`chat-toast ${
                toast.type === "success" ? "chat-toast-success" : "chat-toast-info"
              }${toast.category ? ` chat-toast-${toast.category}` : ""}`}
            >
              <div className="chat-toast-dot" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        <div className="chat-messages-area">
          <div className="chat-thread-shell">
            {messages.length === 0 ? (
              <div className="chat-hero-empty-state">
                <div className="chat-hero-header">
                  <h1 className="chat-hero-title">
                    {userProfile?.display_name || userProfile?.username
                      ? `Hello, ${userProfile?.display_name || userProfile?.username}`
                      : "Hello"}
                  </h1>
                  <p className="chat-hero-subtitle">
                    How can I help you be more productive today?
                  </p>
                </div>

                <div className="chat-hero-cards-grid">
                  <button
                    type="button"
                    className="chat-hero-card"
                    onClick={() => void handleSend("Help me plan my day and prioritize my top goals")}
                  >
                    <span className="hero-card-tag">Plan</span>
                    <span className="hero-card-title">Plan Today's Schedule</span>
                    <span className="hero-card-desc">Structure high-priority tasks and deep work slots</span>
                  </button>

                  <button
                    type="button"
                    className="chat-hero-card"
                    onClick={() => void handleSend("Break down my major milestone into actionable subtasks")}
                  >
                    <span className="hero-card-tag">Tasks</span>
                    <span className="hero-card-title">Break Down Goals</span>
                    <span className="hero-card-desc">Deconstruct big milestones into step-by-step actions</span>
                  </button>

                  <button
                    type="button"
                    className="chat-hero-card"
                    onClick={() => void handleSend("Analyze my weekly habit consistency and burnout risks")}
                  >
                    <span className="hero-card-tag">Analyze</span>
                    <span className="hero-card-title">Review Consistency</span>
                    <span className="hero-card-desc">Evaluate habit streaks, progress rates, and fatigue</span>
                  </button>

                  <button
                    type="button"
                    className="chat-hero-card"
                    onClick={() => void handleSend("Let's start a 45-minute deep work focus block")}
                  >
                    <span className="hero-card-tag">Focus</span>
                    <span className="hero-card-title">Deep Work Session</span>
                    <span className="hero-card-desc">Lock in a distraction-free execution block</span>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message: Message, index: number) => (
                <ChatBubble
                  key={message.id}
                  message={{
                    ...message,
                    provider: message.metadata?.provider ?? message.provider,
                    model: message.metadata?.model ?? message.model,
                    isError: Boolean(message.metadata?.error),
                    isStreaming: Boolean(message.metadata?.isStreaming),
                    rating: message.metadata?.rating,
                    timestamp: formatTimestamp(message.timestamp),
                  }}
                  messageIndex={index}
                  isLatestAssistant={index === latestAssistantIndex}
                  isGenerating={isGenerating}
                  onRetry={handleRetry}
                  onEditSubmit={handleEditSubmit}
                  onFeedback={handleFeedback}
                />
              ))
            )}

            {isTyping && (
              <div className="flex justify-start">
                <div className="typing-indicator">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="typing-dot" style={{ animationDelay: "0ms" }} />
                      <div className="typing-dot" style={{ animationDelay: "150ms" }} />
                      <div className="typing-dot" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-tertiary">Leno is thinking…</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onSend={(message) => void handleSend(message)}
          onFocusMode={handleFocusMode}
          onStopGenerating={handleStopGenerating}
          isGenerating={isGenerating}
          focusModeActive={isFocusMode}
          disabled={isGenerating}
        />
      </div>
    </ErrorBoundary>
  );
}
