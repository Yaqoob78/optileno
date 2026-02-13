// hooks/useTheme.ts
import { useEffect } from 'react';
import { useSettingsStore } from "../stores/useSettingsStore";

export const useTheme = () => {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Just return the theme and setTheme - store handles the rest
  return { theme, setTheme, toggleTheme };
};