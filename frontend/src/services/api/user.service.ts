// services/api/user.service.ts
import { api, ApiResponse } from './client';

export interface UserProfileRequest {
  name?: string;
  email?: string;
  avatar?: string;
  preferences?: {
    theme?: string;
    language?: string;
    timezone?: string;
    notifications?: any;
    aiBehavior?: any;
    usageTime?: {
      date?: string;
      minutes?: number;
      totalMinutes?: number;
      updatedAt?: string;
    };
  };
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatar: string;
  role: 'user' | 'premium' | 'admin';
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt: string | null;
    features: string[];
  };
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: {
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
    };
    aiBehavior: {
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
    };
  };
  stats: {
    totalSessions: number;
    totalTokens: number;
    avgRating: number;
    joinedAt: string;
    timeSpentToday?: number;
    totalTimeSpent?: number;
    lastActivityAt?: string;
  };
  metadata?: {
    lastActiveAt: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    accountStatus: 'active' | 'suspended' | 'deleted';
  };
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateEmailRequest {
  newEmail: string;
  currentPassword: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
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

export interface SubscriptionResponse {
  currentPlan: SubscriptionPlan;
  nextBillingDate: string | null;
  paymentMethod: {
    type: 'card' | 'paypal' | 'other';
    lastFour?: string;
    expiry?: string;
  } | null;
  usage: {
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
  };
  history: Array<{
    date: string;
    action: 'upgrade' | 'downgrade' | 'renewal' | 'cancellation';
    plan: string;
    amount: number;
  }>;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  status: 'success' | 'failed';
  metadata?: Record<string, any>;
}

export interface Notification {
  id: string;
  type: 'system' | 'achievement' | 'reminder' | 'update';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  action?: {
    label: string;
    url: string;
  };
  priority: 'low' | 'medium' | 'high';
}

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
    lastUsed: string;
    ipAddress: string;
  }>;
}

class UserService {
  /**
   * Login user
   */
  async login(credentials: any): Promise<ApiResponse<any>> {
    return api.post('/auth/login', credentials);
  }

  /**
   * Register user
   */
  async register(data: any): Promise<ApiResponse<any>> {
    return api.post('/auth/register', data);
  }

  /**
   * Logout user
   */
  async logout(): Promise<ApiResponse<any>> {
    return api.post('/auth/logout');
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<ApiResponse<UserProfileResponse>> {
    return api.get<UserProfileResponse>('/users/me');
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: UserProfileRequest): Promise<ApiResponse<UserProfileResponse>> {
    return api.patch<UserProfileResponse>('/users/me', updates);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(file: File): Promise<ApiResponse<{ avatarUrl: string }>> {
    return api.upload<{ avatarUrl: string }>('/users/me/avatar', file);
  }

  /**
   * Update user password
   */
  async updatePassword(request: UpdatePasswordRequest): Promise<ApiResponse<void>> {
    return api.post('/users/me/password', request);
  }

  /**
   * Update user email
   */
  async updateEmail(request: UpdateEmailRequest): Promise<ApiResponse<void>> {
    return api.post('/users/me/email', request);
  }

  /**
   * Delete user account
   */
  async deleteAccount(confirmation: string): Promise<ApiResponse<void>> {
    return api.post('/users/me/delete', { confirmation });
  }

  /**
   * Get subscription information
   */
  async getSubscription(): Promise<ApiResponse<SubscriptionResponse>> {
    return api.get<SubscriptionResponse>('/users/me/subscription');
  }

  /**
   * Get available subscription plans
   */
  async getSubscriptionPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    return api.get<SubscriptionPlan[]>('/subscriptions/plans');
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(planId: string, interval: 'monthly' | 'yearly'): Promise<ApiResponse<SubscriptionResponse>> {
    return api.post<SubscriptionResponse>('/subscriptions/upgrade', { planId, interval });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<ApiResponse<void>> {
    return api.post('/subscriptions/cancel');
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(): Promise<ApiResponse<void>> {
    return api.post('/subscriptions/reactivate');
  }

  /**
   * Get billing history
   */
  async getBillingHistory(limit = 20, offset = 0): Promise<ApiResponse<Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed' | 'refunded';
    receiptUrl?: string;
  }>>> {
    return api.get(`/subscriptions/invoices?limit=${limit}&offset=${offset}`);
  }

  /**
   * Update payment method
   */
  async updatePaymentMethod(paymentMethodId: string): Promise<ApiResponse<void>> {
    return api.post('/subscriptions/payment-method', { paymentMethodId });
  }

  /**
   * Get user activity logs
   */
  async getActivityLogs(
    filters?: {
      action?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<ActivityLog[]>> {
    const params = filters ? new URLSearchParams() : undefined;
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params?.set(key, String(value));
        }
      });
    }

    const url = params ? `/users/me/activity?${params}` : '/users/me/activity';
    return api.get<ActivityLog[]>(url);
  }

  /**
   * Get user notifications
   */
  async getNotifications(
    filters?: {
      read?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<Notification[]>> {
    const params = filters ? new URLSearchParams() : undefined;
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params?.set(key, String(value));
        }
      });
    }

    const url = params ? `/users/me/notifications?${params}` : '/users/me/notifications';
    return api.get<Notification[]>(url);
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string): Promise<ApiResponse<void>> {
    return api.patch(`/users/me/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsAsRead(): Promise<ApiResponse<void>> {
    return api.post('/users/me/notifications/read-all');
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<ApiResponse<void>> {
    return api.delete(`/users/me/notifications/${notificationId}`);
  }

  /**
   * Get security settings
   */
  async getSecuritySettings(): Promise<ApiResponse<SecuritySettings>> {
    return api.get<SecuritySettings>('/users/me/security');
  }

  /**
   * Update security settings
   */
  async updateSecuritySettings(settings: Partial<SecuritySettings>): Promise<ApiResponse<SecuritySettings>> {
    return api.patch<SecuritySettings>('/users/me/security', settings);
  }

  /**
   * Enable two-factor authentication
   */
  async enableTwoFactor(): Promise<ApiResponse<{ secret: string; qrCode: string }>> {
    return api.post<{ secret: string; qrCode: string }>('/users/me/two-factor/enable');
  }

  /**
   * Disable two-factor authentication
   */
  async disableTwoFactor(code: string): Promise<ApiResponse<void>> {
    return api.post('/users/me/two-factor/disable', { code });
  }

  /**
   * Verify two-factor authentication
   */
  async verifyTwoFactor(code: string): Promise<ApiResponse<{ verified: boolean }>> {
    return api.post<{ verified: boolean }>('/users/me/two-factor/verify', { code });
  }

  /**
   * Revoke a trusted device
   */
  async revokeTrustedDevice(deviceId: string): Promise<ApiResponse<void>> {
    return api.delete(`/users/me/security/devices/${deviceId}`);
  }

  /**
   * Terminate all sessions (logout from all devices)
   */
  async terminateAllSessions(): Promise<ApiResponse<void>> {
    return api.post('/users/me/security/terminate-sessions');
  }

  /**
   * Export user data
   */
  async exportData(): Promise<ApiResponse<{ url: string; expiresAt: string }>> {
    return api.post<{ url: string; expiresAt: string }>('/users/me/export');
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<ApiResponse<{
    totalChats: number;
    totalTokens: number;
    averageRating: number;
    dailyActivity: Array<{
      date: string;
      sessions: number;
      messages: number;
    }>;
    mostUsedFeatures: Array<{
      feature: string;
      count: number;
    }>;
    achievements: Array<{
      id: string;
      name: string;
      description: string;
      unlockedAt: string;
    }>;
  }>> {
    return api.get('/users/me/stats');
  }

  /**
   * Get API keys
   */
  async getApiKeys(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    keyPrefix: string;
    createdAt: string;
    lastUsed: string | null;
    permissions: string[];
  }>>> {
    return api.get('/users/me/api-keys');
  }

  /**
   * Create API key
   */
  async createApiKey(name: string, permissions: string[]): Promise<ApiResponse<{ id: string; key: string }>> {
    return api.post<{ id: string; key: string }>('/users/me/api-keys', { name, permissions });
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(apiKeyId: string): Promise<ApiResponse<void>> {
    return api.delete(`/users/me/api-keys/${apiKeyId}`);
  }

  /**
   * Search users (admin only)
   */
  async searchUsers(
    query: string,
    filters?: {
      role?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ApiResponse<Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    createdAt: string;
  }>>> {
    const params = new URLSearchParams({ query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      });
    }

    return api.get(`/admin/users?${params}`);
  }

  /**
   * Validate user session
   */
  async validateSession(): Promise<ApiResponse<{ valid: boolean; user?: UserProfileResponse }>> {
    return api.get<{ valid: boolean; user?: UserProfileResponse }>('/auth/validate');
  }

  /**
   * Refresh user session
   */
  async refreshSession(): Promise<ApiResponse<any>> {
    return api.post('/auth/refresh');
  }
}

// Create singleton instance
export const userService = new UserService();

// Convenience exports for common operations
export const getProfile = userService.getProfile.bind(userService);
export const updateProfile = userService.updateProfile.bind(userService);
export const updateAvatar = userService.updateAvatar.bind(userService);
export const getSubscription = userService.getSubscription.bind(userService);
export const updateSubscription = userService.updateSubscription.bind(userService);
export const getNotifications = userService.getNotifications.bind(userService);
export const markAllNotificationsAsRead = userService.markAllNotificationsAsRead.bind(userService);
export const getSecuritySettings = userService.getSecuritySettings.bind(userService);
export const enableTwoFactor = userService.enableTwoFactor.bind(userService);
export const exportData = userService.exportData.bind(userService);
export const getStats = userService.getStats.bind(userService);
export const validateSession = userService.validateSession.bind(userService);
