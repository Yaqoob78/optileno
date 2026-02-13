// stores/chat.store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    latency?: number;
    rating?: number;
    model?: string;
    contextId?: string;
    [key: string]: any; // Allow flexible metadata
  };
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  mode: ChatMode;
  tags: string[];
  isKept?: boolean; // New property for Dashboard "Keep Mode"
  metadata?: {
    summary?: string;
    wordCount?: number;
    duration?: number;
    category?: string;
  };
}

type ChatMode =
  | "coach"       // Productivity coaching
  | "strategist"  // Strategic planning
  | "analyst"     // Data analysis
  | "therapist"   // Wellness support
  | "creative"    // Creative brainstorming
  | "mentor"      // Learning & growth
  | "general"     // General assistant
  | "KEEP";       // Added KEEP mode compatibility if needed

interface ChatSession {
  id: string;
  isActive: boolean;
  typingState: {
    isTyping: boolean;
    startedAt: Date | null;
  };
  context: {
    previousTopics: string[];
    memory: Map<string, any>; // Simple memory for context
    references: string[]; // Document/file references
  };
}

type ChatState = {
  // Active conversation
  activeConversation: Conversation | null;

  // Conversation history
  conversations: Conversation[];

  // Current session state
  session: ChatSession;

  // AI mode and settings
  currentMode: ChatMode;
  modeSettings: Record<ChatMode, {
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  }>;

  // Actions - Conversation Management
  createConversation: (title?: string, mode?: ChatMode) => Conversation;
  setActiveConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  archiveConversation: (conversationId: string) => void;
  toggleKeepConversation: (conversationId: string) => void; // New Action

  // Actions - Messages
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;

  // Actions - Mode & Settings
  setMode: (mode: ChatMode) => void;
  updateModeSettings: (mode: ChatMode, settings: Partial<ChatState['modeSettings'][ChatMode]>) => void;

  // Actions - Session State
  startTyping: () => void;
  stopTyping: () => void;
  updateContext: (updates: Partial<ChatSession['context']>) => void;

  // Actions - Batch Operations
  importConversations: (conversations: Conversation[]) => void;
  exportConversations: () => Conversation[];

  // Derived State
  recentConversations: Conversation[];
  totalMessages: number;
  conversationCount: number;

  // Search & Filter
  searchConversations: (query: string) => Conversation[];
  filterByMode: (mode: ChatMode) => Conversation[];
  filterByTag: (tag: string) => Conversation[];

  // Cleanup
  clearAll: () => void;
};

// Default mode settings
const defaultModeSettings: ChatState['modeSettings'] = {
  coach: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are a productivity coach. Help users plan, prioritize, and achieve their goals efficiently."
  },
  strategist: {
    temperature: 0.8,
    maxTokens: 1500,
    systemPrompt: "You are a strategic advisor. Help analyze situations, plan strategies, and make informed decisions."
  },
  analyst: {
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt: "You are a data analyst. Help interpret data, find patterns, and provide actionable insights."
  },
  therapist: {
    temperature: 0.9,
    maxTokens: 800,
    systemPrompt: "You are a wellness assistant. Provide supportive, empathetic guidance for mental wellbeing."
  },
  creative: {
    temperature: 1.0,
    maxTokens: 1200,
    systemPrompt: "You are a creative partner. Help brainstorm ideas, solve problems creatively, and inspire innovation."
  },
  mentor: {
    temperature: 0.6,
    maxTokens: 1000,
    systemPrompt: "You are a learning mentor. Help users acquire new skills, understand concepts, and grow professionally."
  },
  general: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are Leno, a helpful AI assistant. Provide accurate, useful information and assistance."
  },
  KEEP: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: "You are Leno, a helpful AI assistant. Maintain context for long-term storage."
  }
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      activeConversation: null,
      conversations: [],
      currentMode: "general",
      modeSettings: defaultModeSettings,

      session: {
        id: generateId(),
        isActive: true,
        typingState: {
          isTyping: false,
          startedAt: null,
        },
        context: {
          previousTopics: [],
          memory: new Map(),
          references: [],
        },
      },

      // Derived state
      get recentConversations() {
        return get().conversations
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, 10);
      },

      get totalMessages() {
        return get().conversations.reduce(
          (total, conv) => total + conv.messages.length,
          0
        );
      },

      get conversationCount() {
        return get().conversations.length;
      },

      // Conversation Management
      createConversation: (title, mode = "general") => {
        const conversation: Conversation = {
          id: generateId(),
          title: title || `Conversation ${get().conversations.length + 1}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          mode,
          tags: [],
        };

        set((state) => ({
          conversations: [...state.conversations, conversation],
          activeConversation: conversation,
        }));

        return conversation;
      },

      setActiveConversation: (conversationId) => {
        const conversation = get().conversations.find(c => c.id === conversationId);
        if (conversation) {
          set({ activeConversation: conversation });
        }
      },

      deleteConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.filter(c => c.id !== conversationId),
          activeConversation:
            state.activeConversation?.id === conversationId
              ? null
              : state.activeConversation,
        }));
      },

      archiveConversation: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map(c =>
            c.id === conversationId
              ? { ...c, tags: [...c.tags, 'archived'] }
              : c
          ),
        }));
      },

      toggleKeepConversation: (conversationId) => {
        set((state) => {
          const updatedConversations = state.conversations.map(c =>
            c.id === conversationId
              ? { ...c, isKept: !c.isKept, updatedAt: new Date() }
              : c
          );

          return {
            conversations: updatedConversations,
            activeConversation: state.activeConversation?.id === conversationId
              ? { ...state.activeConversation, isKept: !state.activeConversation.isKept, updatedAt: new Date() }
              : state.activeConversation
          };
        });
      },

      // Message Actions
      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          timestamp: new Date(),
        };

        set((state) => {
          if (!state.activeConversation) {
            // Create a new conversation if none exists
            const conversation = get().createConversation();
            return {
              activeConversation: {
                ...conversation,
                messages: [newMessage],
                updatedAt: new Date(),
              },
            };
          }

          return {
            activeConversation: {
              ...state.activeConversation,
              messages: [...state.activeConversation.messages, newMessage],
              updatedAt: new Date(),
            },
          };
        });
      },

      editMessage: (messageId, content) => {
        set((state) => {
          if (!state.activeConversation) return state;

          return {
            activeConversation: {
              ...state.activeConversation,
              messages: state.activeConversation.messages.map(msg =>
                msg.id === messageId
                  ? { ...msg, content, timestamp: new Date() }
                  : msg
              ),
              updatedAt: new Date(),
            },
          };
        });
      },

      deleteMessage: (messageId) => {
        set((state) => {
          if (!state.activeConversation) return state;

          return {
            activeConversation: {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(msg => msg.id !== messageId),
              updatedAt: new Date(),
            },
          };
        });
      },

      clearMessages: () => {
        set((state) => ({
          activeConversation: state.activeConversation
            ? {
              ...state.activeConversation,
              messages: [],
              updatedAt: new Date(),
            }
            : null,
        }));
      },

      // Mode & Settings Actions
      setMode: (mode) => {
        set({ currentMode: mode });

        // Update active conversation mode if exists
        set((state) => ({
          activeConversation: state.activeConversation
            ? { ...state.activeConversation, mode, updatedAt: new Date() }
            : null,
        }));
      },

      updateModeSettings: (mode, settings) => {
        set((state) => ({
          modeSettings: {
            ...state.modeSettings,
            [mode]: {
              ...state.modeSettings[mode],
              ...settings,
            },
          },
        }));
      },

      // Session State Actions
      startTyping: () => {
        set((state) => ({
          session: {
            ...state.session,
            typingState: {
              isTyping: true,
              startedAt: new Date(),
            },
          },
        }));
      },

      stopTyping: () => {
        set((state) => ({
          session: {
            ...state.session,
            typingState: {
              isTyping: false,
              startedAt: null,
            },
          },
        }));
      },

      updateContext: (updates) => {
        set((state) => ({
          session: {
            ...state.session,
            context: {
              ...state.session.context,
              ...updates,
            },
          },
        }));
      },

      // Batch Operations
      importConversations: (conversations) => {
        set({ conversations });
      },

      exportConversations: () => {
        return get().conversations;
      },

      // Search & Filter
      searchConversations: (query) => {
        const lowerQuery = query.toLowerCase();
        return get().conversations.filter(conv =>
          conv.title.toLowerCase().includes(lowerQuery) ||
          conv.messages.some(msg =>
            msg.content.toLowerCase().includes(lowerQuery)
          ) ||
          conv.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      },

      filterByMode: (mode) => {
        return get().conversations.filter(conv => conv.mode === mode);
      },

      filterByTag: (tag) => {
        return get().conversations.filter(conv => conv.tags.includes(tag));
      },

      // Cleanup
      clearAll: () => {
        set({
          activeConversation: null,
          conversations: [],
          session: {
            id: generateId(),
            isActive: true,
            typingState: {
              isTyping: false,
              startedAt: null,
            },
            context: {
              previousTopics: [],
              memory: new Map(),
              references: [],
            },
          },
        });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversation: state.activeConversation,
        currentMode: state.currentMode,
        modeSettings: state.modeSettings,
      }),
    }
  )
);

// Helper hooks for common patterns
export const useActiveConversation = () =>
  useChatStore((state) => state.activeConversation);

export const useMessages = () =>
  useChatStore((state) => state.activeConversation?.messages || []);

export const useConversationList = () =>
  useChatStore((state) => state.conversations);

export const useChatMode = () =>
  useChatStore((state) => state.currentMode);

export const useTypingState = () =>
  useChatStore((state) => state.session.typingState);