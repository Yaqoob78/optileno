// stores/settings.store.ts
import { useSettingsStore } from "./useSettingsStore";
export { useSettingsStore };
export * from "../types/settings.types";

// Helper hooks for common patterns
export const useTheme = () => useSettingsStore((state) => state.theme);
export const useIsDarkMode = () => useSettingsStore((state) => state.isDarkMode);
export const useNotifications = () => useSettingsStore((state) => state.notifications);
export const useAIBehavior = () => useSettingsStore((state) => state.aiBehavior);
export const useFocusSettings = () => useSettingsStore((state) => state.focus);
export const usePrivacySettings = () => useSettingsStore((state) => state.privacy);
export const useAccessibility = () => useSettingsStore((state) => state.accessibility);
export const useFlags = () => useSettingsStore((state) => state.flags);