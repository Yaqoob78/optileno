import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { SettingsState, defaultNotifications, defaultAIBehavior, defaultFocus, defaultPrivacy, defaultAccessibility, defaultFlags } from "../types/settings.types";


export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initial state - DEFAULT TO DARK
      theme: 'dark',
      language: 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notifications: defaultNotifications,
      aiBehavior: defaultAIBehavior,
      focus: defaultFocus,
      privacy: defaultPrivacy,
      accessibility: defaultAccessibility,
      flags: defaultFlags,

      // Derived state
      get isDarkMode() {
        const { theme } = get();
        if (theme === 'auto') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return theme === 'dark';
      },

      get hasNotificationsEnabled() {
        const { notifications } = get();
        return notifications.email.enabled || notifications.push.enabled;
      },

      get focusModeActive() {
        return get().focus.enabled;
      },

      // Actions - Theme & Language
      setTheme: (theme) => {
        // Update store state
        set({ theme });

        // Apply theme to HTML immediately
        const appliedTheme = theme === 'auto'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;

        document.documentElement.setAttribute('data-theme', appliedTheme);

        // Setup system theme listener for auto mode
        if (theme === 'auto') {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleSystemThemeChange = (e: MediaQueryListEvent) => {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
          };

          // Remove previous listener and add new one
          mediaQuery.removeEventListener('change', handleSystemThemeChange);
          mediaQuery.addEventListener('change', handleSystemThemeChange);
        }
      },

      setLanguage: (language) => set({ language }),
      setTimezone: (timezone) => set({ timezone }),

      // Actions - Notifications
      setNotificationPreferences: (preferences) => set((state) => ({
        notifications: {
          ...state.notifications,
          ...preferences,
        },
      })),

      toggleNotificationType: (category, type) => set((state) => {
        const categorySettings = state.notifications[category];
        if ('types' in categorySettings) {
          return {
            notifications: {
              ...state.notifications,
              [category]: {
                ...categorySettings,
                types: {
                  ...categorySettings.types,
                  [type]: !categorySettings.types[type as keyof typeof categorySettings.types],
                },
              },
            },
          };
        }
        return state;
      }),

      setQuietHours: (enabled, start, end) => set((state) => ({
        notifications: {
          ...state.notifications,
          push: {
            ...state.notifications.push,
            quietHours: {
              enabled,
              start: start || state.notifications.push.quietHours.start,
              end: end || state.notifications.push.quietHours.end,
            },
          },
        },
      })),

      // Actions - AI Behavior
      setAIMode: (mode) => set((state) => ({
        aiBehavior: {
          ...state.aiBehavior,
          mode,
        },
      })),

      setPersonality: (personality) => set((state) => ({
        aiBehavior: {
          ...state.aiBehavior,
          personality,
        },
      })),

      updateResponseStyle: (style) => set((state) => ({
        aiBehavior: {
          ...state.aiBehavior,
          responseStyle: {
            ...state.aiBehavior.responseStyle,
            ...style,
          },
        },
      })),

      toggleContextMemory: (enabled) => set((state) => ({
        aiBehavior: {
          ...state.aiBehavior,
          context: {
            ...state.aiBehavior.context,
            useMemory: enabled,
          },
        },
      })),

      // Actions - Focus Settings
      toggleFocusMode: (enabled) => set((state) => ({
        focus: {
          ...state.focus,
          enabled,
        },
      })),

      updateFocusSettings: (settings) => set((state) => ({
        focus: {
          ...state.focus,
          ...settings,
        },
      })),

      setBreakSettings: (duration, frequency) => set((state) => ({
        focus: {
          ...state.focus,
          breaks: {
            ...state.focus.breaks,
            duration,
            frequency,
          },
        },
      })),

      // Actions - Privacy
      updatePrivacySettings: (settings) => set((state) => ({
        privacy: {
          ...state.privacy,
          ...settings,
        },
      })),

      setDataCollection: (enabled) => set((state) => ({
        privacy: {
          ...state.privacy,
          dataCollection: {
            analytics: enabled,
            usagePatterns: enabled,
            performanceMetrics: enabled,
          },
        },
      })),

      setRetentionPolicy: (policy) => set((state) => ({
        privacy: {
          ...state.privacy,
          retention: {
            ...state.privacy.retention,
            ...policy,
          },
        },
      })),

      // Actions - Accessibility
      updateAccessibility: (settings) => set((state) => ({
        accessibility: {
          ...state.accessibility,
          ...settings,
        },
      })),

      setFontSize: (fontSize) => set((state) => ({
        accessibility: {
          ...state.accessibility,
          fontSize,
        },
      })),

      toggleAnimations: (enabled) => set((state) => ({
        accessibility: {
          ...state.accessibility,
          animations: {
            ...state.accessibility.animations,
            enabled,
          },
        },
      })),

      // Actions - Quick Flags
      toggleFlag: (flag) => set((state) => ({
        flags: {
          ...state.flags,
          [flag]: !state.flags[flag],
        },
      })),

      setFlag: (flag, value) => set((state) => ({
        flags: {
          ...state.flags,
          [flag]: value,
        },
      })),

      // Reset & Defaults
      resetToDefaults: () => {
        // Apply default theme to HTML
        document.documentElement.setAttribute('data-theme', 'dark');

        set({
          theme: 'dark',
          language: 'en-US',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notifications: defaultNotifications,
          aiBehavior: defaultAIBehavior,
          focus: defaultFocus,
          privacy: defaultPrivacy,
          accessibility: defaultAccessibility,
          flags: defaultFlags,
        });
      },

      resetSection: (section) => {
        const defaults: Record<string, any> = {
          theme: 'dark',
          language: 'en-US',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notifications: defaultNotifications,
          aiBehavior: defaultAIBehavior,
          focus: defaultFocus,
          privacy: defaultPrivacy,
          accessibility: defaultAccessibility,
        };

        if (section in defaults) {
          if (section === 'theme') {
            document.documentElement.setAttribute('data-theme', defaults[section]);
          }
          set({ [section]: defaults[section] });
        }
      },

      // Generic update for AI context
      updateSettings: (payload) => {
        set((state) => ({ ...state, ...payload }));
      },

      // Export/Import
      exportSettings: () => {
        return get();
      },

      importSettings: (settings) => {
        // Apply theme if imported
        if (settings.theme !== undefined) {
          const appliedTheme = settings.theme === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : settings.theme;
          document.documentElement.setAttribute('data-theme', appliedTheme);
        }

        set(settings);
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        timezone: state.timezone,
        notifications: state.notifications,
        aiBehavior: state.aiBehavior,
        focus: state.focus,
        privacy: state.privacy,
        accessibility: state.accessibility,
        flags: state.flags,
      }),
    }
  )
);
