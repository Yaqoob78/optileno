// types/chat.types.ts

// Message related types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageMetadata {
  tokens?: number;
  latency?: number;
  rating?: number;
  model?: string;
  provider?: string;
  contextId?: string;
  suggestions?: string[];
  confidence?: number;
  processingTime?: number;
  finishReason?: string;
  warnings?: string[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface ConversationMetadata {
  summary?: string;
  wordCount?: number;
  duration?: number;
  tags?: string[];
  category?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
}

export type ConversationMode =
  | 'coach'
  | 'strategist'
  | 'analyst'
  | 'therapist'
  | 'creative'
  | 'mentor'
  | 'general';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  mode: ConversationMode;
  createdAt: Date;
  updatedAt: Date;
  metadata?: ConversationMetadata;
  tags: string[];
}

export interface ConversationPreview {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  mode: ConversationMode;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

// AI Model types
export interface AIModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  limits: {
    maxTokens: number;
    maxContext: number;
  };
  status: 'available' | 'beta' | 'deprecated';
}

export interface AIModelParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences?: string[];
}

// Chat analysis types
export interface ChatAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
  intent: string;
  entities: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  suggestions: Array<{
    text: string;
    type: 'quick_reply' | 'follow_up' | 'action';
    confidence?: number;
  }>;
}

// Streaming types
export interface ChatStreamChunk {
  content: string;
  done: boolean;
  metadata?: Partial<MessageMetadata>;
}

// Search types
export interface ConversationSearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  content: string;
  timestamp: Date;
  score: number;
}

// Export types
export type ExportFormat = 'txt' | 'pdf' | 'json' | 'markdown';

export interface ExportResult {
  url: string;
  expiresAt: Date;
  format: ExportFormat;
  size: number;
}

// Statistics types
export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  mostActiveDay: string;
  favoriteMode: ConversationMode;
  recentActivity: Array<{
    date: string;
    count: number;
  }>;
}

// Rating types
export interface MessageRating {
  messageId: string;
  conversationId: string;
  rating: number;
  feedback?: string;
  timestamp: Date;
}