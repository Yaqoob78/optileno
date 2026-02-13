import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserState, defaultProfile, defaultPreferences } from "../types/user.types";


export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // Initial state
      profile: defaultProfile,
      preferences: defaultPreferences,
      isAuthenticated: false,

      // Derived state
      get isPremium() {
        const { profile } = get();
        return (
          profile.planType === 'ULTRA' ||
          profile.role === 'admin' ||
          profile.role === 'premium' ||
          ['elite', 'pro', 'enterprise'].includes(profile.subscription?.tier)
        );
      },

      get isUltra() {
        const { profile } = get();
        return (
          profile.planType === 'ULTRA' ||
          profile.role === 'admin' ||
          ['elite', 'enterprise'].includes(profile.subscription?.tier)
        );
      },

      get accountAge() {
        const joined = new Date(get().profile.stats.joinedAt);
        const now = new Date();
        return Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24));
      },

      // Profile actions
      setProfile: (profile) => set((state) => ({
        profile: { ...state.profile, ...profile }
      })),

      updateProfile: (updates) => set((state) => ({
        profile: {
          ...state.profile,
          ...updates,
          stats: {
            ...state.profile.stats,
            ...(updates.stats || {}),
          },
        },
      })),

      // Preferences actions
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      })),

      updatePreference: (key, value) => set((state) => {
        const currentValue = state.preferences[key];

        // Handle different types of preferences
        if (key === 'theme' || key === 'language') {
          // For primitive values
          return {
            preferences: {
              ...state.preferences,
              [key]: value,
            },
          };
        } else {
          // For object values (notifications, aiPreferences)
          return {
            preferences: {
              ...state.preferences,
              [key]: {
                ...(currentValue as object),
                ...(value as object),
              },
            },
          };
        }
      }),

      // Authentication actions
      login: (profile, preferences) => {
        const finalProfile = {
          ...defaultProfile,
          ...profile,
          planType: profile?.planType || defaultProfile.planType,
          role: profile?.role || defaultProfile.role,
          subscription: profile?.subscription || defaultProfile.subscription,
        };
        return set({
          profile: finalProfile,
          preferences: preferences || defaultPreferences,
          isAuthenticated: true,
        });
      },

      logout: () => set({
        profile: defaultProfile,
        preferences: defaultPreferences,
        isAuthenticated: false,
      }),

      // Stats actions
      incrementStats: (stats) => set((state) => ({
        profile: {
          ...state.profile,
          stats: {
            ...state.profile.stats,
            totalSessions: state.profile.stats.totalSessions + (stats.totalSessions || 0),
            totalTokens: state.profile.stats.totalTokens + (stats.totalTokens || 0),
            avgRating: stats.avgRating !== undefined
              ? (state.profile.stats.avgRating + stats.avgRating) / 2
              : state.profile.stats.avgRating,
          },
        },
      })),

      // Generic update for AI context
      updateUserContext: (payload) => {
        set((state) => ({ ...state, ...payload }));
      },
    }),
    {
      name: 'user-storage', // localStorage key
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
