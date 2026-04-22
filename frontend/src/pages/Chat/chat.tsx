import React, { useCallback, useEffect, useRef, useState } from "react";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestionTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearSuggestionTimer = useCallback(() => {
    if (suggestionTimerRef.current) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
  }, []);

  const startFreshConversation = useCallback(() => {
    clearSuggestionTimer();
    createConversation("New Chat");
    setSessionId(null);
    setShowSuggestions(false);
    setUserHasTyped(false);
  }, [clearSuggestionTimer, createConversation]);

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
    };
  }, [clearSuggestionTimer]);

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
    if (!activeConversation) {
      createConversation("New Chat");
    }
  }, [activeConversation, createConversation]);

  useEffect(() => {
    if (!activeConversation) return;

    const hasUserMessages = activeConversation.messages.some(
      (message) => message.role === "user",
    );
    setUserHasTyped(hasUserMessages);
    setSessionId(null);

    if (activeConversation.isKept) {
      setChatMode("KEEP");
      setUiActiveTab("keep");
      return;
    }

    setUiActiveTab((current) => (current === "keep" ? null : current));
    setChatMode((current) => (current === "KEEP" ? "NORMAL" : current));
  }, [activeConversation?.id, activeConversation?.isKept, activeConversation?.messages]);

  useEffect(() => {
    if (
      activeConversation &&
      activeConversation.messages.length === 0
    ) {
      addMessage({
        role: "assistant",
        content: "Hello! I'm Leno, your AI assistant. How can I help you today?",
        metadata: { welcome: true },
      });
    }
  }, [activeConversation, addMessage]);

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
  ) => {
    const response = await api.post("/chat/send", {
      message: userMessage,
      mode: currentAiMode,
      history: conversationHistory,
      session_id: currentSessionId,
    });

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

  const getAIResponse = async (userMessage: string, currentAiMode: AIMode) => {
    const conversationHistory = (activeConversation?.messages || [])
      .slice(-10)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const data = await sendMessage(
      userMessage,
      currentAiMode,
      conversationHistory,
      sessionId,
    );

    if (data.session_id && data.session_id !== sessionId) {
      setSessionId(data.session_id);
    }

    return {
      content: data.message || "I received your message.",
      actions: Array.isArray(data.actions) ? data.actions : [],
      provider: data.provider,
      model: data.model,
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
                type:
                  action.type === "DELETE_HABIT" ? "info" : "success",
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
              };
            break;

          case "PLANNER_START_DEEP_WORK":
            nextToast =
              nextToast || {
                message: "Deep work session started.",
                type: "success",
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

  const submitMessage = async (message: string, requestedMode: AIMode) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;
    if (!checkDailyLimits()) return;

    updateDailyUsage(trimmedMessage.length);
    clearSuggestionTimer();
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

    try {
      const response = await getAIResponse(trimmedMessage, requestedMode);

      addMessage({
        role: "assistant",
        content: response.content,
        metadata: {
          provider: response.provider,
          model: response.model,
        },
      });

      await handleAIActions(response.actions);
    } catch (error: any) {
      console.error("Chat request failed:", error);

      addMessage({
        role: "assistant",
        content: "Something went wrong. Please try again in a moment.",
      });

      setToast({
        message: "Message failed to send cleanly.",
        type: "info",
      });
    } finally {
      if (isMountedRef.current) {
        setIsTyping(false);
        setIsSending(false);
      }
    }
  };

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

  const handleFocusMode = () => {
    setToast({ message: "Focus mode activated.", type: "info" });
  };

  const messages = activeConversation?.messages || [];

  return (
    <ErrorBoundary componentName="Chat">
      <div className="chat-container">
        <ChatHeader
          activeTab={uiActiveTab}
          onTabChange={(tab) => {
            if (tab === "keep") handleKeepClick();
            if (tab === "clear") handleClearFlowClick();
          }}
        />

        {toast && (
          <div className="chat-toast-shell">
            <div
              className={`chat-toast ${
                toast.type === "success" ? "chat-toast-success" : "chat-toast-info"
              }`}
            >
              <div className="chat-toast-dot" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        <div className="chat-messages-area">
          <div className="chat-thread-shell">
            {messages.map((message: Message) => (
              <ChatBubble
                key={message.id}
                message={{
                  ...message,
                  provider: message.metadata?.provider ?? message.provider,
                  model: message.metadata?.model ?? message.model,
                  timestamp: formatTimestamp(message.timestamp),
                }}
              />
            ))}

            {showSuggestions && messages.length <= 1 && !userHasTyped && (
              <div className="suggestions-container">
                <p className="suggestions-title">How would you like to start?</p>
                <div className="suggestions-grid">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => void handleSuggestionClick(suggestion)}
                      className="suggestion-button"
                      title={suggestion.description}
                    >
                      <span className="suggestion-text">{suggestion.text}</span>
                      <span className="suggestion-desc">{suggestion.description}</span>
                    </button>
                  ))}
                </div>
              </div>
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
                    <span className="text-sm text-tertiary">Assistant is typing...</span>
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
          disabled={isSending}
        />
      </div>
    </ErrorBoundary>
  );
}
