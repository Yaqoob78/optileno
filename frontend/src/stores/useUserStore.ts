import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserState, defaultProfile, defaultPreferences } from "../types/user.types";
import {
  canonicalPlanTypeForTier,
  resolvePlanTierFromProfile,
} from "../utils/plan";

const normalizeProfileForStore = (baseProfile: any, incoming: any) => {
  const merged = {
    ...baseProfile,
    ...incoming,
    stats: {
      ...baseProfile.stats,
      ...(incoming?.stats || {}),
    },
    subscription: {
      ...baseProfile.subscription,
      ...(incoming?.subscription || {}),
    },
  };

  const normalizedTier = resolvePlanTier(merged);
  const normalizedType = canonicalPlanTypeForTier(normalizedTier);

  return {
    ...merged,
    role: (merged?.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    plan_tier: normalizedTier,
    planType: normalizedType,
    plan_type: normalizedType,
    subscription: {
      ...merged.subscription,
      tier: normalizedTier,
    },
  };
};

const resolvePlanTier = (
  profile: Partial<{
    email: string;
    role: string;
    tier: string;
    plan_tier: string;
    planType: string;
    plan_type: string;
    subscription: { tier: string };
  }>
): 'explorer' | 'ultra' => resolvePlanTierFromProfile(profile);

const deriveUserFlags = (profile: any) => {
  const tier = resolvePlanTier(profile || {});
  const joinedAtRaw = profile?.stats?.joinedAt;
  const joinedAt = joinedAtRaw ? new Date(joinedAtRaw) : new Date();
  const now = new Date();
  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  return {
    isPremium: tier === 'ultra',
    isUltra: tier === 'ultra',
    accountAge: ageDays,
  };
};

const withDerived = (profile: any) => ({
  profile,
  ...deriveUserFlags(profile),
});


export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // Initial state
      profile: defaultProfile,
      preferences: defaultPreferences,
      isAuthenticated: false,
      ...deriveUserFlags(defaultProfile),

      // Profile actions
      setProfile: (profile) => set((state) => {
        const nextProfile = normalizeProfileForStore(state.profile, profile);
        return withDerived(nextProfile);
      }),

      updateProfile: (updates) => set((state) => {
        const nextProfile = normalizeProfileForStore(state.profile, updates);
        return withDerived(nextProfile);
      }),

      // Preferences actions
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences },
      })),

      updatePreference: (key, value) => set((state) => {
        const currentValue = state.preferences[key];

        // Handle different types of preferences
        if (key === 'theme' || key === 'language' || key === 'hasCompletedOnboarding') {
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
        const finalProfile = normalizeProfileForStore(defaultProfile, profile);
        return set({
          ...withDerived(finalProfile),
          preferences: preferences || defaultPreferences,
          isAuthenticated: true,
        });
      },

      logout: () => set({
        ...withDerived(defaultProfile),
        preferences: defaultPreferences,
        isAuthenticated: false,
      }),

      // Stats actions
      incrementStats: (stats) => set((state) => {
        const nextProfile = {
          ...state.profile,
          stats: {
            ...state.profile.stats,
            totalSessions: state.profile.stats.totalSessions + (stats.totalSessions || 0),
            totalTokens: state.profile.stats.totalTokens + (stats.totalTokens || 0),
            avgRating: stats.avgRating !== undefined
              ? (state.profile.stats.avgRating + stats.avgRating) / 2
              : state.profile.stats.avgRating,
          },
        };
        return withDerived(nextProfile);
      }),

      // Generic update for AI context
      updateUserContext: (payload) => {
        set((state) => {
          const profilePatch = (payload as any)?.profile;
          const nextProfile = profilePatch
            ? normalizeProfileForStore(state.profile, profilePatch)
            : state.profile;
          return {
            ...(payload as any),
            ...withDerived(nextProfile),
          };
        });
      },
    }),
    {
      name: 'user-storage', // localStorage key
      partialize: (state) => ({
        profile: state.profile,
        preferences: state.preferences,
        isAuthenticated: state.isAuthenticated,
      }),
      merge: (persistedState, currentState) => {
        const typedPersisted = (persistedState as Partial<UserState>) || {};
        const mergedProfile = normalizeProfileForStore(
          defaultProfile,
          typedPersisted.profile || currentState.profile
        );
        return {
          ...currentState,
          ...typedPersisted,
          ...withDerived(mergedProfile),
        } as UserState;
      },
    }
  )
);
