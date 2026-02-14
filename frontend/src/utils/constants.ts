// utils/constants.ts

/**
 * App Constants
 */
export const APP = {
  NAME: 'Optileno',
  VERSION: '2.1.0',
  DESCRIPTION: 'AI-powered productivity and intelligence platform',
  COMPANY: 'Optileno Labs',
  SUPPORT_EMAIL: 'support@optileno.com',
  WEBSITE: 'https://optileno.com',
  PRIVACY_POLICY: 'https://optileno.com/privacy',
  TERMS_OF_SERVICE: 'https://optileno.com/terms',
};

/**
 * AI Modes and Personalities
 */
export const AI_MODES = {
  COACH: 'coach',
  STRATEGIST: 'strategist',
  ANALYST: 'analyst',
  THERAPIST: 'therapist',
  CREATIVE: 'creative',
  MENTOR: 'mentor',
  GENERAL: 'general',
} as const;

export type AIMode = typeof AI_MODES[keyof typeof AI_MODES];

export const AI_MODE_LABELS: Record<AIMode, string> = {
  [AI_MODES.COACH]: 'Productivity Coach',
  [AI_MODES.STRATEGIST]: 'Strategic Advisor',
  [AI_MODES.ANALYST]: 'Data Analyst',
  [AI_MODES.THERAPIST]: 'Wellness Assistant',
  [AI_MODES.CREATIVE]: 'Creative Partner',
  [AI_MODES.MENTOR]: 'Learning Mentor',
  [AI_MODES.GENERAL]: 'General Assistant',
};

export const AI_MODE_DESCRIPTIONS: Record<AIMode, string> = {
  [AI_MODES.COACH]: 'Helps with planning, productivity, and goal achievement',
  [AI_MODES.STRATEGIST]: 'Provides strategic advice and decision support',
  [AI_MODES.ANALYST]: 'Analyzes data and provides insights',
  [AI_MODES.THERAPIST]: 'Offers wellness support and mental health guidance',
  [AI_MODES.CREATIVE]: 'Assists with brainstorming and creative projects',
  [AI_MODES.MENTOR]: 'Helps with learning and skill development',
  [AI_MODES.GENERAL]: 'General purpose assistant for everyday tasks',
};

export const AI_MODE_ICONS: Record<AIMode, string> = {
  [AI_MODES.COACH]: '🏆',
  [AI_MODES.STRATEGIST]: '🎯',
  [AI_MODES.ANALYST]: '📊',
  [AI_MODES.THERAPIST]: '🧠',
  [AI_MODES.CREATIVE]: '🎨',
  [AI_MODES.MENTOR]: '👨‍🏫',
  [AI_MODES.GENERAL]: '🤖',
};

/**
 * AI Personalities
 */
export const AI_PERSONALITIES = {
  PROFESSIONAL: 'professional',
  FRIENDLY: 'friendly',
  ENTHUSIASTIC: 'enthusiastic',
  ANALYTICAL: 'analytical',
} as const;

export type AIPersonality = typeof AI_PERSONALITIES[keyof typeof AI_PERSONALITIES];

/**
 * Task and Planner Constants
 */
export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
} as const;

export type TaskStatus = typeof TASK_STATUS[keyof typeof TASK_STATUS];

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export type TaskPriority = typeof TASK_PRIORITY[keyof typeof TASK_PRIORITY];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TASK_PRIORITY.LOW]: '#10B981',    // Green
  [TASK_PRIORITY.MEDIUM]: '#3B82F6', // Blue
  [TASK_PRIORITY.HIGH]: '#F59E0B',   // Amber
  [TASK_PRIORITY.URGENT]: '#EF4444', // Red
};

export const GOAL_TYPES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
} as const;

export type GoalType = typeof GOAL_TYPES[keyof typeof GOAL_TYPES];

/**
 * Analytics Constants
 */
export const METRIC_RANGES = {
  PRODUCTIVITY: { min: 0, max: 100, optimal: 80 },
  FOCUS: { min: 0, max: 100, optimal: 75 },
  ENERGY: { min: 0, max: 100, optimal: 70 },
  STRESS: { min: 0, max: 100, optimal: 30 }, // Lower is better
  SATISFACTION: { min: 0, max: 100, optimal: 85 },
};

export const TREND_DIRECTIONS = {
  IMPROVING: 'improving',
  DECLINING: 'declining',
  STABLE: 'stable',
} as const;

export type TrendDirection = typeof TREND_DIRECTIONS[keyof typeof TREND_DIRECTIONS];

export const INSIGHT_TYPES = {
  POSITIVE: 'positive',
  WARNING: 'warning',
  SUGGESTION: 'suggestion',
  ACHIEVEMENT: 'achievement',
  PATTERN: 'pattern',
} as const;

export type InsightType = typeof INSIGHT_TYPES[keyof typeof INSIGHT_TYPES];

export const IMPACT_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ImpactLevel = typeof IMPACT_LEVELS[keyof typeof IMPACT_LEVELS];

/**
 * User and Subscription Constants
 */
export const USER_ROLES = {
  USER: 'user',
  PREMIUM: 'premium',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, string[]> = {
  [SUBSCRIPTION_TIERS.FREE]: [
    'Basic AI Chat',
    'Daily Analytics',
    'Task Management',
    '5 Chat History',
    'Community Support',
  ],
  [SUBSCRIPTION_TIERS.PRO]: [
    'Advanced AI Models',
    'Real-time Analytics',
    'Goal Tracking',
    'Unlimited Chat History',
    'Priority Support',
    'Custom AI Personalities',
    'Data Export',
  ],
  [SUBSCRIPTION_TIERS.ENTERPRISE]: [
    'Everything in Pro',
    'Team Collaboration',
    'Advanced Security',
    'Custom Integrations',
    'Dedicated Support',
    'Custom AI Training',
    'API Access',
    'White-label Option',
  ],
};

/**
 * Time Constants
 */
export const TIME = {
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_WEEK: 7,
  DAYS_PER_MONTH: 30, // Average
  DAYS_PER_YEAR: 365,

  DEEP_WORK_DURATION: 50, // minutes
  BREAK_DURATION: 10, // minutes
  FOCUS_SESSION_MIN: 25, // minutes
  FOCUS_SESSION_MAX: 120, // minutes
};

/**
 * UI and Layout Constants
 */
export const UI = {
  SIDEBAR_WIDTH: 256,
  SIDEBAR_COLLAPSED_WIDTH: 72,
  HEADER_HEIGHT: 64,
  STATUS_BAR_HEIGHT: 40,
  BORDER_RADIUS: {
    SM: '0.375rem',
    MD: '0.5rem',
    LG: '0.75rem',
    XL: '1rem',
    '2XL': '1.5rem',
  },
  TRANSITION_DURATION: {
    FAST: '150ms',
    NORMAL: '300ms',
    SLOW: '500ms',
  },
  Z_INDEX: {
    DROPDOWN: 1000,
    STICKY: 1020,
    FIXED: 1030,
    MODAL_BACKDROP: 1040,
    MODAL: 1050,
    POPOVER: 1060,
    TOOLTIP: 1070,
  },
};

/**
 * Notification Constants
 */
export const NOTIFICATION_TYPES = {
  SYSTEM: 'system',
  ACHIEVEMENT: 'achievement',
  REMINDER: 'reminder',
  UPDATE: 'update',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type NotificationPriority = typeof NOTIFICATION_PRIORITY[keyof typeof NOTIFICATION_PRIORITY];

/**
 * File and Upload Constants
 */
export const FILE = {
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  MAX_FILES_PER_UPLOAD: 5,
};

/**
 * API Constants
 */
export const API = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

/**
 * Local Storage Keys
 */
export const STORAGE_KEYS = {
  USER_PROFILE: 'optileno_user_profile',
  USER_PREFERENCES: 'optileno_user_preferences',
  CHAT_HISTORY: 'optileno_chat_history',
  PLANNER_DATA: 'optileno_planner_data',
  ANALYTICS_CACHE: 'optileno_analytics_cache',
  THEME: 'optileno_theme',
  LANGUAGE: 'optileno_language',
  ACCESS_TOKEN: 'optileno_access_token',
  REFRESH_TOKEN: 'optileno_refresh_token',
};

/**
 * Error Codes and Messages
 */
export const ERRORS = {
  NETWORK: {
    TIMEOUT: 'Request timeout. Please check your connection.',
    OFFLINE: 'You appear to be offline. Please check your connection.',
    SERVER_ERROR: 'Server error. Please try again later.',
  },
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'You are not authorized to perform this action.',
  },
  VALIDATION: {
    REQUIRED: 'This field is required.',
    EMAIL: 'Please enter a valid email address.',
    PASSWORD: 'Password must be at least 8 characters.',
  },
  GENERAL: {
    UNEXPECTED: 'An unexpected error occurred. Please try again.',
    NOT_FOUND: 'The requested resource was not found.',
    RATE_LIMIT: 'Too many requests. Please try again later.',
  },
};

/**
 * Feature Flags
 */
export const FEATURE_FLAGS = {
  ENABLE_AI_STREAMING: true,
  ENABLE_DARK_MODE: true,
  ENABLE_OFFLINE_MODE: false,
  ENABLE_BETA_FEATURES: false,
  ENABLE_AUTOSAVE: true,
  ENABLE_ANALYTICS: true,
};

/**
 * Keyboard Shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  NEW_CHAT: ['ctrl', 'n'],
  SEARCH: ['ctrl', 'k'],
  TOGGLE_SIDEBAR: ['ctrl', 'b'],
  TOGGLE_DARK_MODE: ['ctrl', 'd'],
  FOCUS_MODE: ['ctrl', 'f'],
  SAVE: ['ctrl', 's'],
  ESCAPE: ['escape'],
} as const;

/**
 * Color Palette
 */
export const COLORS = {
  PRIMARY: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  DANGER: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  NEUTRAL: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

/**
 * Default Settings
 */
export const DEFAULTS = {
  AI_MODE: AI_MODES.GENERAL,
  AI_TEMPERATURE: 0.7,
  AI_MAX_TOKENS: 1000,
  THEME: 'dark',
  LANGUAGE: 'en-US',
  TIMEZONE: Intl.DateTimeFormat().resolvedOptions().timeZone,
  NOTIFICATIONS: {
    email: true,
    push: true,
    sound: false,
  },
  AUTOSAVE_DELAY: 1000, // 1 second
};

/**
 * Environment Variables (with fallbacks)
 */
export const ENV = {
  API_URL: import.meta.env.VITE_API_URL || `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')}/api/v1`,
  WS_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000',
  NODE_ENV: import.meta.env.NODE_ENV || 'development',
  IS_DEV: import.meta.env.DEV || false,
  IS_PROD: import.meta.env.PROD || false,
};
