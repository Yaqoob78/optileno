// frontend/src/hooks/useUser.ts
import { useEffect, useCallback } from 'react';
import { apiClient } from '../services/api/client';
import { useUserStore } from "../stores/useUserStore";
import { usePlannerStore } from "../stores/planner.store";
import type { UserProfile } from "../types/user.types";

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'user' | 'premium' | 'admin';
    tier: 'free' | 'pro' | 'enterprise' | 'elite';
    plan_type?: string;
    subscription?: {
      tier: 'free' | 'pro' | 'enterprise' | 'elite';
      expiresAt: string | null;
      features: string[];
    };
    stats: {
      totalSessions: number;
      totalTokens: number;
      avgRating: number;
      joinedAt: string;
    };
  };
}

export const useUser = () => {
  const {
    profile,
    preferences,
    isAuthenticated,
    login: storeLogin,
    logout: storeLogout,
    setProfile,
    setPreferences,
  } = useUserStore();

  const handleLogin = useCallback(
    async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        // Clear old cached user data before login
        localStorage.removeItem('user-storage');

        // Use apiClient for making requests
        const response = await apiClient.post<LoginResponse>('/auth/login', credentials);

        if (!response.success || !response.data) {
          return { success: false, error: response.error?.message || 'Login failed' };
        }

        const { access_token, refresh_token, user } = response.data;

        // Set tokens - handled by cookies, but can call to clear internal state if needed
        apiClient.setAuthTokens();

        // Debug: Log what the backend sent
        console.log('🔐 Login response user data:', user);

        // Check if this is the owner email - always Ultra
        const isOwner = user.email === 'khan011504@gmail.com';
        const shouldBeUltra = isOwner || user.subscription?.tier === 'pro' || user.tier === 'pro' || user.tier === 'elite' || user.role === 'premium' || user.role === 'admin' || user.plan_type === 'ULTRA';

        console.log('🔐 Is Owner:', isOwner, '| Should be Ultra:', shouldBeUltra);

        // Map backend user to our store shape
        const profileData: UserProfile = {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar || '',
          role: user.role,
          subscription: {
            tier: isOwner ? 'elite' : (user.subscription?.tier || user.tier || 'free'),
            expiresAt: user.subscription?.expiresAt ? new Date(user.subscription.expiresAt as string) : null,
            features: isOwner ? ['all-features'] : (user.subscription?.features || (user.tier === 'pro' ? ['premium-chat', 'full-analytics'] : ['basic-chat'])),
          },
          stats: {
            totalSessions: user.stats.totalSessions,
            totalTokens: user.stats.totalTokens,
            avgRating: user.stats.avgRating,
            joinedAt: new Date(user.stats.joinedAt),
            lastActiveAt: new Date(),
          },
          planType: shouldBeUltra ? 'ULTRA' : 'EXPLORER',
        };

        console.log('🔐 Final profile data:', profileData);

        // Login to store
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
    // Also reset planner state
    usePlannerStore.getState().resetPlanner();
    // Optional: redirect to login page
    // window.location.href = '/login';
  }, [storeLogout]);

  // Listen for forced logout from token refresh failure
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
        // Call backend PATCH /user/profile if you have it
        // await apiClient.patch('/user/profile', updates);

        // Update local store
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
    // State
    user: profile,
    preferences,
    isAuthenticated,
    isPremium,
    isUltra,

    // Actions
    login: handleLogin,
    logout: handleLogout,
    updateProfile: updateUserProfile,

    // Quick selectors (optional convenience)
    userId: profile?.id || null,
    userEmail: profile?.email || null,
    userName: profile?.name || null,
  };
};