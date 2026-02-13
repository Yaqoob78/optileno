// types/user.types.ts

// User profile types
export type UserRole = 'user' | 'premium' | 'admin';

export type SubscriptionTier = 'free' | 'pro' | 'enterprise' | 'elite';

export interface Subscription {
  tier: SubscriptionTier;
  expiresAt: Date | null;
  features: string[];
  paymentMethod?: {
    type: 'card' | 'paypal' | 'other';
    lastFour?: string;
    expiry?: string;
  };
}

export interface UserStats {
  totalSessions: number;
  totalTokens: number;
  avgRating: number;
  joinedAt: Date;
  lastActiveAt: Date;
  timeSpentToday?: number;
  totalTimeSpent?: number;
  lastActivityAt?: string;
  achievements?: Array<{
    id: string;
    name: string;
    description: string;
    unlockedAt: Date;
    icon?: string;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: UserRole;
  planType: 'EXPLORER' | 'ULTRA'; // Add planType
  subscription: Subscription;
  stats: UserStats;
  metadata?: {
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    accountStatus: 'active' | 'suspended' | 'deleted';
    timezone?: string;
    language?: string;
  };
}

// Preferences types
export interface NotificationPreferences {
  email: {
    enabled: boolean;
    frequency: 'instant' | 'daily' | 'weekly';
    types: {
      reminders: boolean;
      summaries: boolean;
      insights: boolean;
      updates: boolean;
    };
  };
  push: {
    enabled: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    types: {
      messages: boolean;
      tasks: boolean;
      goals: boolean;
      system: boolean;
    };
  };
  sound: {
    enabled: boolean;
    volume: number;
    types: {
      message: boolean;
      completion: boolean;
      alert: boolean;
    };
  };
}

export interface AIBehaviorSettings {
  mode: 'balanced' | 'creative' | 'concise' | 'detailed';
  personality: 'professional' | 'friendly' | 'enthusiastic' | 'analytical';
  responseStyle: {
    length: 'short' | 'medium' | 'long';
    temperature: number;
    maxTokens: number;
  };
  context: {
    useMemory: boolean;
    memorySize: number;
    includeMetadata: boolean;
  };
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  aiBehavior: AIBehaviorSettings;
  usageTime?: {
    date?: string;
    minutes?: number;
    totalMinutes?: number;
    updatedAt?: string;
  };
  accessibility?: {
    fontSize: 'small' | 'medium' | 'large';
    contrast: 'normal' | 'high';
    animations: boolean;
  };
}

// Security types
export interface SecuritySettings {
  twoFactorEnabled: boolean;
  loginAlerts: boolean;
  sessionManagement: {
    maxSessions: number;
    autoLogout: number; // minutes
  };
  trustedDevices: Array<{
    id: string;
    name: string;
    lastUsed: Date;
    ipAddress: string;
  }>;
}

// Activity types
export interface ActivityLog {
  id: string;
  timestamp: Date;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
}

// Notification types
export type NotificationType = 'system' | 'achievement' | 'reminder' | 'update';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  action?: {
    label: string;
    url: string;
  };
  priority: 'low' | 'medium' | 'high';
}

// API Key types
export interface APIKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsed: Date | null;
  permissions: string[];
}

// Export types
export interface UserDataExport {
  profile: UserProfile;
  conversations?: any[];
  tasks?: any[];
  analytics?: any[];
  createdAt: Date;
}

// Billing types
export interface BillingHistoryItem {
  id: string;
  date: Date;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  receiptUrl?: string;
}

// Subscription plan types
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: {
    chatHistory: number;
    fileUploads: number;
    aiModels: string[];
    supportLevel: 'basic' | 'priority' | 'dedicated';
  };
  popular?: boolean;
}

// Usage statistics
export interface UsageStatistics {
  chatTokens: {
    used: number;
    total: number;
  };
  fileStorage: {
    used: number;
    total: number;
  };
  apiCalls: {
    used: number;
    total: number;
  };
}

export type UserState = {
  updateUserContext(payload: Record<string, any>): unknown;
  profile: UserProfile;
  preferences: UserPreferences;
  isAuthenticated: boolean;
  setProfile: (profile: Partial<UserProfile>) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: K extends 'theme' | 'language'
      ? UserPreferences[K]
      : Partial<UserPreferences[K]>
  ) => void;
  login: (profile: UserProfile, preferences?: UserPreferences) => void;
  logout: () => void;
  incrementStats: (stats: Partial<UserProfile['stats']>) => void;
  isPremium: boolean;
  isUltra: boolean;
  accountAge: number;
};

export const defaultPreferences: UserPreferences = {
  theme: 'dark',
  language: 'en',
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
  notifications: {
    email: {
      enabled: true,
      frequency: 'daily',
      types: { reminders: true, summaries: true, insights: true, updates: false }
    },
    push: {
      enabled: true,
      quietHours: { enabled: true, start: '22:00', end: '08:00' },
      types: { messages: true, tasks: true, goals: false, system: true }
    },
    sound: {
      enabled: false,
      volume: 50,
      types: { message: true, completion: true, alert: false }
    },
  },
  aiBehavior: {
    mode: 'balanced',
    personality: 'professional',
    responseStyle: { length: 'medium', temperature: 0.7, maxTokens: 1000 },
    context: { useMemory: true, memorySize: 10, includeMetadata: false }
  },
};

export const defaultProfile: UserProfile = {
  id: '',
  email: '',
  name: '',
  avatar: '',
  role: 'user',
  planType: 'EXPLORER',
  subscription: {
    tier: 'free',
    expiresAt: null,
    features: ['basic-chat', 'basic-analytics'],
  },
  stats: {
    totalSessions: 0,
    totalTokens: 0,
    avgRating: 0,
    joinedAt: new Date(),
    lastActiveAt: new Date(),
  },
};
