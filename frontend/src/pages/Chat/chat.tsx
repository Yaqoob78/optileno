// src/pages/chat.tsx - PERSISTENT STATE VERSION
import React, { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../../services/api/client";
import { useRealtime } from "../../hooks/useRealtime";
import { useNavStatePreservation } from "../../hooks/useNavStatePreservation";
import "../../styles/pages/chat.css";
import ChatBubble from "../../components/chat/ChatBubble";
import ChatInput from "../../components/chat/ChatInput";
import ChatHeader from "../../components/chat/ChatHeader";
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { useUserStore } from "../../stores/useUserStore";
import { useChatStore } from "../../stores/chat.store"; // IMPORT STORE
import { usePlannerStore } from "../../stores/planner.store";
import { Lock } from "lucide-react";

// Types compatible with store
interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date;
  provider?: string;
  model?: string;
  metadata?: any;
}

type ChatMode = 'NORMAL' | 'KEEP' | 'CLEAR_FLOW';
type AIMode = 'CHAT' | 'PLAN' | 'ANALYZE' | 'TASK';

interface Suggestion {
  id: number;
  text: string;
  aiMode: AIMode;
  description: string;
}

export default function Chat() {
  // Ensure state persists when navigating to this page
  useNavStatePreservation();

  // GLOBAL STORE STATE
  const activeConversation = useChatStore((state) => state.activeConversation);
  const createConversation = useChatStore((state) => state.createConversation);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateContext = useChatStore((state) => state.updateContext);
  const toggleKeep = useChatStore((state) => state.toggleKeepConversation);
  const deleteMessage = useChatStore((state) => state.deleteMessage); // Import deleteMessage


  // Local UI State
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mode states
  const [chatMode, setChatMode] = useState<ChatMode>(activeConversation?.isKept ? 'KEEP' : 'NORMAL');
  const [aiMode, setAiMode] = useState<AIMode>('CHAT');
  const [uiActiveTab, setUiActiveTab] = useState<'keep' | 'clear' | null>(activeConversation?.isKept ? 'keep' : null);

  // Suggestion states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [suggestionTimer, setSuggestionTimer] = useState<number | null>(null);

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Real-time integration
  const { onMessageReceived, onConversationUpdated } = useRealtime();
  const _isUltra = useUserStore((state) => state.isUltra);
  const userProfile = useUserStore((state) => state.profile);
  // Force Ultra for owner and check subscription tier
  const isOwner = userProfile?.email === 'khan011504@gmail.com';
  const isUltra = _isUltra || isOwner || userProfile?.role === 'premium' || userProfile?.role === 'admin' || userProfile?.planType === 'ULTRA';

  // Initialize Conversation if missing
  useEffect(() => {
    if (!activeConversation) {
      createConversation("New Chat");
    }
  }, [activeConversation, createConversation]); // Removed addMessage from dependencies to prevent duplication

  // Add welcome message if conversation is new and has no messages
  useEffect(() => {
    if (activeConversation && activeConversation.messages.length === 0) {
      addMessage({
        role: 'assistant',
        content: "Hello! I'm Leno, your AI assistant. How can I help you today?",
        metadata: { welcome: true }
      });
    }
  }, [activeConversation, addMessage]);

  // Sync Keep Mode state
  useEffect(() => {
    if (activeConversation?.isKept) {
      setChatMode('KEEP');
      setUiActiveTab('keep');
    }
  }, [activeConversation?.isKept]);

  // Check Daily Limits
  const checkDailyLimits = (): boolean => {
    if (isUltra) return true;

    const today = new Date().toISOString().split('T')[0];
    const key = `daily_usage_${today}`;
    const usage = JSON.parse(localStorage.getItem(key) || '{"conversations": 0, "tokens": 0}');

    if (usage.conversations >= 20) {
      alert("Daily conversation limit (20) reached. Upgrade to Ultra to continue.");
      return false;
    }
    if (usage.tokens >= 1000) {
      alert("Daily token limit (1000) reached. Upgrade to Ultra to continue.");
      return false;
    }
    return true;
  };

  const updateDailyUsage = (inputLength: number) => {
    if (isUltra) return;

    const today = new Date().toISOString().split('T')[0];
    const key = `daily_usage_${today}`;
    const usage = JSON.parse(localStorage.getItem(key) || '{"conversations": 0, "tokens": 0}');

    // Estimate tokens: ~1 token per 4 chars + base cost
    const estimatedTokens = Math.ceil(inputLength / 4) + 10;

    const newUsage = {
      conversations: usage.conversations + 1,
      tokens: usage.tokens + estimatedTokens
    };

    localStorage.setItem(key, JSON.stringify(newUsage));
  };

  // Suggestions data
  const suggestions: Suggestion[] = [
    { id: 1, text: "Let's just talk", aiMode: 'CHAT', description: "Casual conversation" },
    { id: 2, text: "Help me plan something", aiMode: 'PLAN', description: "Planning assistance" },
    { id: 3, text: "Show my progress", aiMode: 'ANALYZE', description: "Progress analysis" },
    { id: 4, text: "Give me a small task", aiMode: 'TASK', description: "Quick tasks" }
  ];

  // Scroll page up a bit on load
  useEffect(() => {
    window.scrollTo({
      top: 100,
      behavior: 'smooth'
    });
  }, []);

  // Auto-scroll to bottom for new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages, scrollToBottom]);

  // Subscribe to real-time message events
  useEffect(() => {
    onMessageReceived((data) => {
      // Add the received message to the store
      if (data?.message?.ai_response) {
        addMessage({
          role: 'assistant',
          content: data.message.ai_response,
          metadata: {
            provider: data.message.provider,
            model: data.message.model,
            intent: data.message.intent
          }
        });
      }
      scrollToBottom();
    });

    onConversationUpdated(() => {
      // Conversation updated, refresh UI
      scrollToBottom();
    });
  }, [scrollToBottom, onMessageReceived, onConversationUpdated, addMessage]);

  // Enforce Clear Flow limits (3 exchanges = 6 messages)
  useEffect(() => {
    if (chatMode === 'CLEAR_FLOW' && activeConversation) {
      const msgs = activeConversation.messages;
      // 3 exchanges = User + AI + User + AI + User + AI = 6 messages
      if (msgs.length > 6) {
        // Delete oldest messages to keep only last 6
        const messagesToDelete = msgs.slice(0, msgs.length - 6);
        messagesToDelete.forEach(msg => {
          // Add a small delay/stagger or just delete
          deleteMessage(msg.id);
        });
      }
    }
  }, [chatMode, activeConversation?.messages, deleteMessage]);


  // Initialize suggestion timer (5 seconds)
  useEffect(() => {
    const msgCount = activeConversation?.messages.length || 0;
    // Only show if just welcome message (length 1) and user hasn't typed
    if (msgCount <= 1 && !userHasTyped) {
      const timer = window.setTimeout(() => {
        setShowSuggestions(true);
      }, 1000); // Faster suggestion show

      setSuggestionTimer(timer);
    } else {
      setShowSuggestions(false);
    }

    return () => {
      if (suggestionTimer) {
        window.clearTimeout(suggestionTimer);
      }
    };
  }, [activeConversation?.messages.length, userHasTyped]);

  // Handle Keep button
  const handleKeepClick = () => {
    if (activeConversation) {
      if (activeConversation.isKept) {
        // EXITING Keep Mode:
        // 1. Do NOT toggle 'isKept' off (we want it saved on dashboard)
        // 2. Start a fresh conversation (refresh only on exit)
        createConversation("New Chat");

        setChatMode('NORMAL');
        setUiActiveTab(null);
        setToast({ message: "Chat saved to Dashboard!", type: "success" });
      } else {
        // ENTERING Keep Mode:
        toggleKeep(activeConversation.id); // Set isKept = true
        setChatMode('KEEP');
        setUiActiveTab('keep');
        setToast({ message: "💾 Keep Mode Active: Session recording...", type: "success" });
      }
    }
  };

  // Handle Clear Flow button
  const handleClearFlowClick = () => {
    if (chatMode === 'CLEAR_FLOW') {
      // Exit Clear Flow -> Fresh Start
      createConversation("New Chat"); // Start fresh
      setChatMode('NORMAL');
      setUiActiveTab(null);
      setToast({ message: "Chat reset for fresh start", type: "info" });
    } else if (chatMode === 'KEEP') {
      alert("Keep mode is active. Disable Keep first to activate Clear Flow.");
    } else {
      if (window.confirm("⚠️ Clear Flow Mode: Messages will start disappearing after 3 exchanges. Continue?")) {
        setChatMode('CLEAR_FLOW');
        setUiActiveTab('clear');
      }
    }
  };

  // ✅ FIXED: Added the missing sendMessage function
  const sendMessage = async (
    userMessage: string,
    currentAiMode: AIMode,
    conversationHistory: Array<{ role: string, content: string }>,
    sessionId: string | null
  ): Promise<any> => {
    try {
      // Use the standard api client instead of raw fetch to avoid consistency issues
      const response = await api.post('/chat/send', {
        message: userMessage,
        mode: currentAiMode,
        history: conversationHistory,
        session_id: sessionId,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Chat failed');
      }

      return response.data;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  // Get AI response from API service
  const getAIResponse = async (userMessage: string, currentAiMode: AIMode): Promise<{ content: string, session_id: string, actions: any[], provider?: string, model?: string }> => {

    try {
      // Prepare conversation history
      const msgs = activeConversation?.messages || [];
      const conversationHistory = msgs
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        })) as any;

      // Call the API with session management
      const data = await sendMessage(
        userMessage,
        currentAiMode,
        conversationHistory,
        sessionId
      );


      // Update session ID from response
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }

      return {
        content: data.message || "I received your message.",
        session_id: data.session_id,
        actions: data.actions || [],
        provider: data.provider,
        model: data.model
      };

    } catch (error: any) {
      console.error("❌ getAIResponse failed:", error.message || error);
      throw new Error(`API failed: ${error.message}`);
    }
  };

  // Fallback responses
  const getFallbackResponse = (mode: AIMode): string => {
    const fallbacks = {
      CHAT: "I understand. Let me help you with that. What specific assistance do you need?",
      PLAN: "I'll help you plan! What specific project or task would you like to organize?",
      ANALYZE: "Let me analyze your progress. What data or information should I look at?",
      TASK: "Here's a quick task: Take 5 minutes to organize your workspace. Would you like another?"
    };

    return fallbacks[mode];
  };

  // Toast state
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'info' } | null>(null);

  // Clear toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Handle AI Actions
  const handleAIActions = (actions: any[]) => {
    if (!actions || actions.length === 0) return;

    actions.forEach(action => {

      switch (action.type) {
        case 'CREATE_TASK':
          setToast({ message: `📝 Task created: ${action.result?.title || 'New Task'}`, type: 'success' });
          // Refresh planner store to show new task
          usePlannerStore.getState().fetchTasks();
          break;

        case 'CREATE_GOAL':
          setToast({ message: `🎯 Goal created: ${action.result?.title || 'New Goal'}`, type: 'success' });
          // Refresh planner store to show new goal
          usePlannerStore.getState().fetchGoals();
          break;

        case 'CREATE_HABIT':
          setToast({ message: `🔄 Habit created: ${action.result?.name || 'New Habit'}`, type: 'success' });
          // Refresh planner store to show new habit
          usePlannerStore.getState().fetchHabits();
          break;

        case 'CREATE_GOAL_CASCADE':
        case 'PLANNER_CREATE_GOAL':
          setToast({ message: `🎯 Goal created: ${action.result?.goal?.title || action.result?.title || 'New Goal'}`, type: 'success' });
          // Cascade may create tasks/habits too
          usePlannerStore.getState().fetchGoals();
          usePlannerStore.getState().fetchTasks();
          usePlannerStore.getState().fetchHabits();
          break;

        case 'PLANNER_CREATE_TASK':
          setToast({ message: `📝 Task created: ${action.result?.task?.title || 'New Task'}`, type: 'success' });
          usePlannerStore.getState().fetchTasks();
          break;

        case 'PLANNER_TRACK_HABIT':
          setToast({ message: `✅ Habit tracked`, type: 'success' });
          usePlannerStore.getState().fetchHabits();
          break;

        case 'DELETE_TASK':
          setToast({ message: `🗑️ Task deleted`, type: 'info' });
          usePlannerStore.getState().fetchTasks();
          break;

        case 'DELETE_GOAL':
          setToast({ message: `🗑️ Goal deleted`, type: 'info' });
          usePlannerStore.getState().fetchGoals();
          break;

        case 'DELETE_HABIT':
          setToast({ message: `🗑️ Habit deleted`, type: 'info' });
          usePlannerStore.getState().fetchHabits();
          break;

        case 'PLANNER_START_DEEP_WORK':
          setToast({ message: "🎯 Deep Work Session Started!", type: 'success' });
          break;

        case 'ANALYTICS_VIEW_DASHBOARD':
        case 'SHOW_ANALYTICS': // Fallback legacy intent name if passed as action
          setToast({ message: "Opening Analytics...", type: 'info' });
          // In a real app, use useNavigate here: navigate('/analytics')
          break;

        case 'GET_DAILY_ACHIEVEMENT_SCORE':
        case 'GET_GOAL_PROGRESS_REPORT':
        case 'ANALYTICS_ANALYZE_PATTERNS':
          setToast({ message: "Analytics updated", type: 'info' });
          break;

        case 'ANALYTICS_LOG_EVENT':
          // Background event, no UI needed
          break;

        default:
          console.warn("Unknown action type:", action.type);
      }
    });
  };

  // Handle suggestion click
  const handleSuggestionClick = async (suggestion: Suggestion) => {
    if (!checkDailyLimits()) return;
    updateDailyUsage(suggestion.text.length);

    // Add user message to store
    addMessage({
      role: 'user',
      content: suggestion.text
    });

    setAiMode(suggestion.aiMode);
    setShowSuggestions(false);
    setUserHasTyped(true);

    if (suggestionTimer) {
      window.clearTimeout(suggestionTimer);
    }

    setIsTyping(true);

    try {
      const response = await getAIResponse(suggestion.text, suggestion.aiMode);

      // Add AI response to store
      addMessage({
        role: 'assistant',
        content: response.content,
        metadata: {
          provider: response.provider,
          model: response.model
        }
      });

      // Execute Actions
      handleAIActions(response.actions);

    } catch (error: any) {
      console.error("Suggestion API error:", error);

      // Only add error message, no fallback to prevent duplicates
      addMessage({
        role: 'assistant',
        content: `⚠️ API Error: ${error.message}. Please check if backend is running.`
      });
    } finally {
      setIsTyping(false);
    }
  };

  // Handle manual message send
  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    if (!checkDailyLimits()) return;
    updateDailyUsage(message.length);

    if (suggestionTimer) {
      window.clearTimeout(suggestionTimer);
    }

    setShowSuggestions(false);
    setUserHasTyped(true);

    // Add user message to store
    addMessage({
      role: 'user',
      content: message
    });

    setInputValue('');
    setIsTyping(true);

    try {
      const response = await getAIResponse(message, aiMode);

      // Add AI response to store
      addMessage({
        role: 'assistant',
        content: response.content,
        metadata: {
          provider: response.provider,
          model: response.model
        }
      });

      // Execute Actions
      handleAIActions(response.actions);

    } catch (error: any) {
      console.error("Send API error:", error);

      // Only add error message, no fallback to prevent duplicates
      addMessage({
        role: 'assistant',
        content: `⚠️ API Error: ${error.message}. Please check if backend is running.`
      });

    } finally {
      setIsTyping(false);
    }
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (!userHasTyped && value.trim()) {
      setUserHasTyped(true);
      setShowSuggestions(false);

      if (suggestionTimer) {
        window.clearTimeout(suggestionTimer);
      }
    }
  };

  const handleFocusMode = () => {
    alert("Focus mode activated! Minimizing distractions...");
  };

  const messages = activeConversation?.messages || [];

  return (
    <ErrorBoundary componentName="Chat">
      <div className="chat-container">
        <ChatHeader
          activeTab={uiActiveTab}
          onTabChange={(tab) => {
            if (tab === 'keep') handleKeepClick();
            if (tab === 'clear') handleClearFlowClick();
          }}
          isClearing={chatMode === 'CLEAR_FLOW'}
        />

        {/* Toast Notification */}
        {toast && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce-in">
            <div className={`px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border border-white/10 flex items-center gap-3 ${toast.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
              <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : 'bg-blue-400'
                } animate-pulse`} />
              <span className="text-sm font-medium text-white shadow-sm">{toast.message}</span>
            </div>
          </div>
        )}

        <div className="chat-messages-area">
          <div className="max-w-3xl mx-auto space-y-4 p-4 md:p-6">
            {chatMode !== 'NORMAL' && (
              <div className={`mode-indicator ${chatMode === 'KEEP' ? 'keep-mode' : 'clear-mode'}`}>
                <span className="mode-text">
                  {chatMode === 'KEEP' ? '💾 Keep Mode Active' : '⏳ Clear Flow Mode Active'}
                </span>
                {chatMode === 'CLEAR_FLOW' && (
                  <span className="clear-warning">Messages auto-delete after 3 exchanges</span>
                )}
              </div>
            )}

            {aiMode !== 'CHAT' && (
              <div className="ai-mode-indicator">
                <span className="ai-mode-text">AI Mode: {aiMode}</span>
              </div>
            )}

            {messages.map((message: any) => (
              <ChatBubble key={message.id} message={{
                ...message,
                // Normalize timestamp for bubble component
                timestamp: typeof message.timestamp === 'object'
                  ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : message.timestamp
              }} />
            ))}

            {showSuggestions && messages.length <= 1 && !userHasTyped && (
              <div className="suggestions-container">
                <p className="suggestions-title">How would you like to start?</p>
                <div className="suggestions-grid">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
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
                      <div className="typing-dot" style={{ animationDelay: '0ms' }} />
                      <div className="typing-dot" style={{ animationDelay: '150ms' }} />
                      <div className="typing-dot" style={{ animationDelay: '300ms' }} />
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
          onSend={handleSend}
          onFocusMode={handleFocusMode}
        />
      </div>
    </ErrorBoundary>
  );
}
