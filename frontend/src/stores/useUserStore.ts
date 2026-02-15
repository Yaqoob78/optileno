import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserState, defaultProfile, defaultPreferences } from "../types/user.types";

const OWNER_EMAIL = 'khan011504@gmail.com';

const isOwnerEmail = (email?: string | null): boolean =>
  (email || '').toLowerCase().trim() === OWNER_EMAIL;

const normalizePlanTier = (value?: string | null): 'explorer' | 'ultra' => {
  const normalized = (value || '').toLowerCase().trim();
  if (['ultra', 'pro', 'premium', 'enterprise', 'elite'].includes(normalized)) return 'ultra';
  return 'explorer';
};

const normalizePlanType = (
  planType?: string | null,
  planTier?: string | null,
  subscriptionTier?: string | null
): 'EXPLORER' | 'ULTRA' => {
  const normalizedType = (planType || '').toUpperCase().trim();
  if (normalizedType === 'ULTRA' || normalizedType === 'PRO' || normalizedType === 'ENTERPRISE' || normalizedType === 'PREMIUM') {
    return 'ULTRA';
  }
  const tier = normalizePlanTier(planTier || subscriptionTier || '');
  return tier === 'ultra' ? 'ULTRA' : 'EXPLORER';
};

const resolvePlanTier = (profile: Partial<{ email: string; role: string; planType: string; plan_tier: string; subscription: { tier: string } }>): 'explorer' | 'ultra' => {
  if (isOwnerEmail(profile.email) || (profile.role || '').toLowerCase().trim() === 'admin') {
    return 'ultra';
  }
  const typeCandidate = (profile.planType || '').toUpperCase().trim();
  if (['ULTRA', 'PRO', 'PREMIUM', 'ENTERPRISE'].includes(typeCandidate)) {
    return 'ultra';
  }
  return normalizePlanTier(profile.plan_tier || profile.subscription?.tier || '');
};

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
  const normalizedType = normalizePlanType(
    merged?.planType,
    normalizedTier,
    merged?.subscription?.tier
  );

  return {
    ...merged,
    role: (merged?.role === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
    plan_tier: normalizedTier,
    planType: normalizedType,
    subscription: {
      ...merged.subscription,
      tier: normalizedTier,
    },
  };
};


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
          isOwnerEmail(profile.email) ||
          profile.planType === 'ULTRA' ||
          profile.role === 'admin' ||
          normalizePlanTier(profile.plan_tier || profile.subscription?.tier) === 'ultra'
        );
      },

      get isUltra() {
        const { profile } = get();
        return (
          isOwnerEmail(profile.email) ||
          profile.planType === 'ULTRA' ||
          profile.role === 'admin' ||
          normalizePlanTier(profile.plan_tier || profile.subscription?.tier) === 'ultra'
        );
      },

      get accountAge() {
        const joined = new Date(get().profile.stats.joinedAt);
        const now = new Date();
        return Math.floor((now.getTime() - joined.getTime()) / (1000 * 60 * 60 * 24));
      },

      // Profile actions
      setProfile: (profile) => set((state) => ({
        profile: normalizeProfileForStore(state.profile, profile),
      })),

      updateProfile: (updates) => set((state) => ({
        profile: normalizeProfileForStore(state.profile, updates),
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
        const finalProfile = normalizeProfileForStore(defaultProfile, profile);
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
