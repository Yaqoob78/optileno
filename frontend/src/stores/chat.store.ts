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
    [key: string]: any;
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
  isKept?: boolean;
  metadata?: {
    summary?: string;
    wordCount?: number;
    duration?: number;
    category?: string;
    sessionId?: string;
  };
}

type ChatMode =
  | "coach"
  | "strategist"
  | "analyst"
  | "therapist"
  | "creative"
  | "mentor"
  | "general"
  | "KEEP";

interface ChatSession {
  id: string;
  isActive: boolean;
  typingState: {
    isTyping: boolean;
    startedAt: Date | null;
  };
  context: {
    previousTopics: string[];
    memory: Map<string, any>;
    references: string[];
  };
}

type ChatState = {
  activeConversation: Conversation | null;
  conversations: Conversation[];
  session: ChatSession;
  currentMode: ChatMode;
  modeSettings: Record<
    ChatMode,
    {
      temperature: number;
      maxTokens: number;
      systemPrompt: string;
    }
  >;
  createConversation: (title?: string, mode?: ChatMode) => Conversation;
  setActiveConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  archiveConversation: (conversationId: string) => void;
  toggleKeepConversation: (conversationId: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  editMessage: (messageId: string, content: string) => void;
  updateMessageMetadata: (messageId: string, metadata: Record<string, any>) => void;
  truncateFromIndex: (index: number) => void;
  deleteMessage: (messageId: string) => void;
  clearMessages: () => void;
  setMode: (mode: ChatMode) => void;
  updateModeSettings: (
    mode: ChatMode,
    settings: Partial<ChatState["modeSettings"][ChatMode]>,
  ) => void;
  startTyping: () => void;
  stopTyping: () => void;
  updateContext: (updates: Partial<ChatSession["context"]>) => void;
  importConversations: (conversations: Conversation[]) => void;
  exportConversations: () => Conversation[];
  searchConversations: (query: string) => Conversation[];
  filterByMode: (mode: ChatMode) => Conversation[];
  filterByTag: (tag: string) => Conversation[];
  clearAll: () => void;
};

const defaultModeSettings: ChatState["modeSettings"] = {
  coach: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt:
      "You are Leno, Optileno's productivity intelligence agent. Help the user prioritize workload, build consistency, and execute efficiently.",
  },
  strategist: {
    temperature: 0.8,
    maxTokens: 1500,
    systemPrompt:
      "You are Leno, Optileno's strategic planning agent. Help analyze project roadmaps, prioritize high-impact milestones, and make decisive plans.",
  },
  analyst: {
    temperature: 0.3,
    maxTokens: 2000,
    systemPrompt:
      "You are Leno, Optileno's productivity analytics agent. Interpret focus metrics, habit completion rates, and burnout trends with precision.",
  },
  therapist: {
    temperature: 0.9,
    maxTokens: 800,
    systemPrompt:
      "You are Leno, Optileno's wellness and focus support agent. Provide calm, grounded guidance to mitigate burnout and protect focus.",
  },
  creative: {
    temperature: 1.0,
    maxTokens: 1200,
    systemPrompt:
      "You are Leno, Optileno's creative planning partner. Help brainstorm structured solutions, tackle complex blockers, and organize innovative workflows.",
  },
  mentor: {
    temperature: 0.6,
    maxTokens: 1000,
    systemPrompt:
      "You are Leno, Optileno's execution mentor. Help the user develop disciplined habits, refine workflows, and master productivity skills.",
  },
  general: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt:
      "You are Leno, Optileno's dedicated planning and productivity intelligence agent. Provide direct, grounded, and actionable guidance.",
  },
  KEEP: {
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt:
      "You are Leno, Optileno's dedicated planning and productivity intelligence agent. Maintain structured context for long-term storage.",
  },
};

const generateId = () => crypto.randomUUID();

const isChatMode = (value: unknown): value is ChatMode =>
  [
    "coach",
    "strategist",
    "analyst",
    "therapist",
    "creative",
    "mentor",
    "general",
    "KEEP",
  ].includes(String(value));

const toDate = (value: unknown, fallback = new Date()): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(fallback.getTime());
};

const normalizeMessage = (
  message: Partial<Message> & Pick<Message, "role" | "content">,
): Message => ({
  id: String(message.id ?? generateId()),
  role: message.role,
  content: String(message.content ?? ""),
  timestamp: toDate(message.timestamp),
  metadata: message.metadata ? { ...message.metadata } : undefined,
});

const normalizeConversation = (conversation: Partial<Conversation>): Conversation => {
  const createdAt = toDate(conversation.createdAt);
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages.map((message) => normalizeMessage(message))
    : [];

  return {
    id: String(conversation.id ?? generateId()),
    title:
      typeof conversation.title === "string" && conversation.title.trim()
        ? conversation.title.trim()
        : `Conversation ${Math.max(1, messages.length)}`,
    messages,
    createdAt,
    updatedAt: toDate(conversation.updatedAt, createdAt),
    mode: isChatMode(conversation.mode) ? conversation.mode : "general",
    tags: Array.isArray(conversation.tags)
      ? conversation.tags.filter(Boolean).map((tag) => String(tag))
      : [],
    isKept: Boolean(conversation.isKept),
    metadata: conversation.metadata ? { ...conversation.metadata } : undefined,
  };
};

const sortByUpdatedAt = (conversations: Conversation[]) =>
  [...conversations].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

const upsertConversation = (
  conversations: Conversation[],
  conversation: Conversation,
): Conversation[] => {
  const next = conversations.filter((item) => item.id !== conversation.id);
  next.unshift(conversation);
  return sortByUpdatedAt(next);
};

const resolveActiveConversation = (
  conversations: Conversation[],
  activeConversationId?: string | null,
): Conversation | null => {
  if (!activeConversationId) return null;
  return conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
};

const createSessionState = (): ChatSession => ({
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
});

const updateConversation = (
  state: ChatState,
  conversationId: string,
  updater: (conversation: Conversation) => Conversation,
): Pick<ChatState, "conversations" | "activeConversation"> => {
  const current =
    state.conversations.find((conversation) => conversation.id === conversationId) ??
    (state.activeConversation?.id === conversationId ? state.activeConversation : null);

  if (!current) {
    return {
      conversations: state.conversations,
      activeConversation: state.activeConversation,
    };
  }

  const updated = normalizeConversation(updater(current));
  const conversations = upsertConversation(state.conversations, updated);

  return {
    conversations,
    activeConversation:
      state.activeConversation?.id === updated.id
        ? updated
        : resolveActiveConversation(conversations, state.activeConversation?.id),
  };
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      activeConversation: null,
      conversations: [],
      currentMode: "general",
      modeSettings: defaultModeSettings,
      session: createSessionState(),

      createConversation: (title, mode = "general") => {
        const conversation = normalizeConversation({
          id: generateId(),
          title: title || `Conversation ${get().conversations.length + 1}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          mode,
          tags: [],
          isKept: false,
        });

        set((state) => ({
          conversations: upsertConversation(state.conversations, conversation),
          activeConversation: conversation,
        }));

        return conversation;
      },

      setActiveConversation: (conversationId) => {
        const conversation = resolveActiveConversation(get().conversations, conversationId);
        if (conversation) {
          set({ activeConversation: conversation });
        }
      },

      deleteConversation: (conversationId) => {
        set((state) => {
          const conversations = state.conversations.filter(
            (conversation) => conversation.id !== conversationId,
          );
          const fallbackConversation =
            state.activeConversation?.id === conversationId
              ? sortByUpdatedAt(conversations)[0] ?? null
              : resolveActiveConversation(conversations, state.activeConversation?.id);

          return {
            conversations,
            activeConversation: fallbackConversation,
          };
        });
      },

      archiveConversation: (conversationId) => {
        set((state) =>
          updateConversation(state, conversationId, (conversation) => ({
            ...conversation,
            tags: conversation.tags.includes("archived")
              ? conversation.tags
              : [...conversation.tags, "archived"],
            updatedAt: new Date(),
          })),
        );
      },

      toggleKeepConversation: (conversationId) => {
        set((state) =>
          updateConversation(state, conversationId, (conversation) => ({
            ...conversation,
            isKept: !conversation.isKept,
            updatedAt: new Date(),
          })),
        );
      },

      addMessage: (message) => {
        const messageId = String((message as any).id || generateId());
        const newMessage = normalizeMessage({
          ...message,
          id: messageId,
          timestamp: (message as any).timestamp || new Date(),
        });

        set((state) => {
          const baseConversation =
            state.activeConversation ??
            normalizeConversation({
              id: generateId(),
              title: `Conversation ${state.conversations.length + 1}`,
              messages: [],
              createdAt: newMessage.timestamp,
              updatedAt: newMessage.timestamp,
              mode: state.currentMode,
              tags: [],
            });

          const shouldRetitle =
            !baseConversation.messages.some((message) => message.role === "user") &&
            newMessage.role === "user" &&
            (!baseConversation.title ||
              baseConversation.title.startsWith("Conversation ") ||
              baseConversation.title === "New Chat");

          const updatedConversation = normalizeConversation({
            ...baseConversation,
            title: shouldRetitle
              ? newMessage.content.replace(/\s+/g, " ").trim().slice(0, 48) || "New Chat"
              : baseConversation.title,
            messages: [...baseConversation.messages, newMessage],
            updatedAt: newMessage.timestamp,
          });

          return {
            conversations: upsertConversation(state.conversations, updatedConversation),
            activeConversation: updatedConversation,
          };
        });
      },

      editMessage: (messageId, content) => {
        const idStr = String(messageId);
        set((state) => {
          if (!state.activeConversation) return state;

          return updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              messages: conversation.messages.map((message) =>
                String(message.id) === idStr
                  ? {
                      ...message,
                      content,
                    }
                  : message,
              ),
              updatedAt: new Date(),
            }),
          );
        });
      },

      updateMessageMetadata: (messageId, metadata) => {
        const idStr = String(messageId);
        set((state) => {
          if (!state.activeConversation) return state;

          return updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              messages: conversation.messages.map((message) =>
                String(message.id) === idStr
                  ? {
                      ...message,
                      metadata: {
                        ...message.metadata,
                        ...metadata,
                      },
                    }
                  : message,
              ),
              updatedAt: new Date(),
            }),
          );
        });
      },

      truncateFromIndex: (index) => {
        set((state) => {
          if (!state.activeConversation) return state;

          return updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              messages: conversation.messages.slice(0, Math.max(0, index)),
              updatedAt: new Date(),
            }),
          );
        });
      },

      deleteMessage: (messageId) => {
        set((state) => {
          if (!state.activeConversation) return state;

          return updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              messages: conversation.messages.filter(
                (message) => message.id !== messageId,
              ),
              updatedAt: new Date(),
            }),
          );
        });
      },

      clearMessages: () => {
        set((state) => {
          if (!state.activeConversation) return state;

          return updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              messages: [],
              updatedAt: new Date(),
            }),
          );
        });
      },

      setMode: (mode) => {
        set((state) => {
          if (!state.activeConversation) {
            return { currentMode: mode };
          }

          const updatedState = updateConversation(
            state,
            state.activeConversation.id,
            (conversation) => ({
              ...conversation,
              mode,
              updatedAt: new Date(),
            }),
          );

          return {
            currentMode: mode,
            ...updatedState,
          };
        });
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
              memory:
                updates.memory instanceof Map
                  ? new Map(updates.memory)
                  : state.session.context.memory,
            },
          },
        }));
      },

      importConversations: (conversations) => {
        const normalizedConversations = sortByUpdatedAt(
          conversations.map((conversation) => normalizeConversation(conversation)),
        );

        set({
          conversations: normalizedConversations,
          activeConversation: normalizedConversations[0] ?? null,
        });
      },

      exportConversations: () => get().conversations.map((conversation) => normalizeConversation(conversation)),

      searchConversations: (query) => {
        const normalizedQuery = query.toLowerCase();
        return get().conversations.filter((conversation) => {
          const inTitle = conversation.title.toLowerCase().includes(normalizedQuery);
          const inMessages = conversation.messages.some((message) =>
            message.content.toLowerCase().includes(normalizedQuery),
          );
          const inTags = conversation.tags.some((tag) =>
            tag.toLowerCase().includes(normalizedQuery),
          );

          return inTitle || inMessages || inTags;
        });
      },

      filterByMode: (mode) =>
        get().conversations.filter((conversation) => conversation.mode === mode),

      filterByTag: (tag) =>
        get().conversations.filter((conversation) => conversation.tags.includes(tag)),

      clearAll: () => {
        set({
          activeConversation: null,
          conversations: [],
          currentMode: "general",
          session: createSessionState(),
        });
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversation: state.activeConversation,
        currentMode: state.currentMode,
        modeSettings: state.modeSettings,
      }),
      merge: (persistedState, currentState) => {
        const typedState = (persistedState || {}) as Partial<ChatState>;
        const normalizedConversations = Array.isArray(typedState.conversations)
          ? sortByUpdatedAt(
              typedState.conversations.map((conversation) =>
                normalizeConversation(conversation),
              ),
            )
          : currentState.conversations;

        let normalizedActiveConversation = typedState.activeConversation
          ? normalizeConversation(typedState.activeConversation)
          : resolveActiveConversation(
              normalizedConversations,
              currentState.activeConversation?.id,
            );

        if (
          normalizedActiveConversation &&
          !normalizedConversations.some(
            (conversation) => conversation.id === normalizedActiveConversation?.id,
          )
        ) {
          normalizedConversations.unshift(normalizedActiveConversation);
        }

        normalizedActiveConversation = resolveActiveConversation(
          normalizedConversations,
          normalizedActiveConversation?.id,
        );

        return {
          ...currentState,
          ...typedState,
          conversations: sortByUpdatedAt(normalizedConversations),
          activeConversation: normalizedActiveConversation,
          currentMode: isChatMode(typedState.currentMode)
            ? typedState.currentMode
            : currentState.currentMode,
          modeSettings: {
            ...defaultModeSettings,
            ...(typedState.modeSettings ?? {}),
          },
          session: createSessionState(),
        };
      },
    },
  ),
);

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
