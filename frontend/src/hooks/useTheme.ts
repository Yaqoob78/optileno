// hooks/useTheme.ts
import { useSyncExternalStore } from 'react';
import { useSettingsStore } from "../stores/useSettingsStore";

const DARK_QUERY = '(prefers-color-scheme: dark)';

const subscribeSystemTheme = (callback: () => void) => {
  const mediaQuery = window.matchMedia(DARK_QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
};

const getSystemPrefersDark = () => window.matchMedia(DARK_QUERY).matches;

export const useTheme = () => {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  // Reactive OS preference so `auto` follows live dark/light mode changes.
  const systemPrefersDark = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemPrefersDark,
    () => false
  );

  const resolvedTheme: 'dark' | 'light' =
    theme === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : theme;

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return { theme, resolvedTheme, setTheme, toggleTheme };
};
