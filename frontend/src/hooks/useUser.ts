// frontend/src/hooks/useUser.ts
import { useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { useUserStore } from "../stores/useUserStore";
import { usePlannerStore } from "../stores/planner.store";
import type { UserProfile } from "../types/user.types";

interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role?: 'user' | 'admin' | string;
    tier?: string;
    plan_tier?: 'explorer' | 'ultra' | string;
    plan_type?: string;
    planType?: string;
    subscription?: {
      tier: string;
      expiresAt: string | null;
      features: string[];
    };
    entitlements?: Record<string, boolean | number | string>;
    limits?: Record<string, number | boolean | string>;
    stats: {
      totalSessions: number;
      totalTokens: number;
      avgRating: number;
      joinedAt: string;
      lastActiveAt?: string;
    };
  };
}

const normalizePlanTier = (user: LoginResponse["user"]): 'explorer' | 'ultra' => {
  const direct = (user.plan_tier || '').toLowerCase().trim();
  if (direct === 'ultra') return 'ultra';
  if (direct === 'explorer') return 'explorer';

  const planType = (user.planType || user.plan_type || '').toUpperCase().trim();
  if (['ULTRA', 'PRO', 'PREMIUM', 'ENTERPRISE'].includes(planType)) return 'ultra';

  const tier = (user.subscription?.tier || user.tier || '').toLowerCase().trim();
  if (['ultra', 'pro', 'premium', 'enterprise', 'elite'].includes(tier)) return 'ultra';

  if ((user.role || '').toLowerCase().trim() === 'admin') return 'ultra';
  return 'explorer';
};

export const useUser = () => {
  const {
    profile,
    preferences,
    isAuthenticated,
    login: storeLogin,
    logout: storeLogout,
    setProfile,
  } = useUserStore();

  const handleLogin = useCallback(
    async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        localStorage.removeItem('user-storage');

        const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
        if (!response.success || !response.data) {
          return { success: false, error: response.error?.message || 'Login failed' };
        }

        const { user } = response.data;
        apiClient.setAuthTokens();

        const isOwner = user.email === 'khan011504@gmail.com';
        const planTier = isOwner ? 'ultra' : normalizePlanTier(user);
        const shouldBeUltra = planTier === 'ultra';

        const profileData: UserProfile = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar || '',
          role: user.role === 'admin' ? 'admin' : 'user',
          planType: shouldBeUltra ? 'ULTRA' : 'EXPLORER',
          plan_tier: planTier,
          subscription: {
            tier: planTier,
            expiresAt: user.subscription?.expiresAt ? new Date(user.subscription.expiresAt) : null,
            features: user.subscription?.features || (shouldBeUltra ? ['all-features'] : ['basic-chat', 'basic-analytics']),
          },
          entitlements: user.entitlements,
          limits: user.limits as any,
          stats: {
            totalSessions: user.stats.totalSessions,
            totalTokens: user.stats.totalTokens,
            avgRating: user.stats.avgRating,
            joinedAt: new Date(user.stats.joinedAt),
            lastActiveAt: user.stats.lastActiveAt ? new Date(user.stats.lastActiveAt) : new Date(),
          },
        };

        storeLogin(profileData);
        return { success: true };
      } catch (err: any) {
        console.error('Login error:', err);
        return {
          success: false,
          error: err?.response?.data?.error?.message || 'Something went wrong during login',
        };
      }
    },
    [storeLogin]
  );

  const handleLogout = useCallback(() => {
    apiClient.clearAuthTokens();
    storeLogout();
    usePlannerStore.getState().resetPlanner();
  }, [storeLogout]);

  useEffect(() => {
    const handleAuthLogout = () => {
      handleLogout();
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [handleLogout]);

  const updateUserProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      try {
        setProfile(updates);
      } catch (err) {
        console.error('Profile update failed:', err);
      }
    },
    [setProfile]
  );

  const isPremium = useUserStore((s) => s.isPremium);
  const isUltra = useUserStore((s) => s.isUltra);

  return {
    user: profile,
    preferences,
    isAuthenticated,
    isPremium,
    isUltra,
    login: handleLogin,
    logout: handleLogout,
    updateProfile: updateUserProfile,
    userId: profile?.id || null,
    userEmail: profile?.email || null,
    userName: profile?.name || null,
  };
};
