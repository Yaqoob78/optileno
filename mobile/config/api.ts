// mobile/config/api.ts
/**
 * API Configuration
 */

// Change this to your backend URL
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',

  // Tasks
  TASKS: '/api/v1/tasks',
  DEEP_WORK: '/api/v1/deep-work',

  // Chat
  CHAT: '/api/v1/chat',
  AGENT: '/api/v1/agent/message',

  // Analytics
  ANALYTICS_FORECAST: '/api/v1/analytics/forecast',
  ANALYTICS_GOAL: '/api/v1/analytics/goal-achievement',
  ANALYTICS_PERFORMANCE: '/api/v1/analytics/performance-score',
  ANALYTICS_WELLNESS: '/api/v1/analytics/wellness-score',

  // Notifications
  NOTIFICATIONS: '/api/v1/notifications',
  NOTIFICATIONS_PREFERENCES: '/api/v1/notifications/preferences',

  // Collaboration
  TASKS_SHARE: '/api/v1/tasks/share',
  TASKS_SHARED: '/api/v1/tasks/shared-with-me',
  TASKS_COMMENTS: '/api/v1/tasks/{id}/comments',
  COLLABORATION_STATS: '/api/v1/collaboration/stats',
};
