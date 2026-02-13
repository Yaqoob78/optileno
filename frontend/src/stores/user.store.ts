// stores/user.store.ts
import { useUserStore } from "./useUserStore";
export { useUserStore };
export * from "../types/user.types";

// Optional: Helper hooks for common patterns
export const useUserProfile = () => useUserStore((state) => state.profile);
export const useUserPreferences = () => useUserStore((state) => state.preferences);
export const useIsPremium = () => useUserStore((state) => state.isPremium);
export const useUserStats = () => useUserStore((state) => state.profile.stats);
export const useAIPreferences = () => useUserStore((state) => state.preferences.aiBehavior);