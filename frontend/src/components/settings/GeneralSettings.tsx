import React, { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
];

const normalizeLanguage = (value?: string) =>
  LANGUAGE_OPTIONS.some((option) => option.value === value) ? value! : 'en-US';

const GeneralSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const profile = useUserStore((state) => state.profile);
  const setProfile = useUserStore((state) => state.setProfile);
  const setPreferences = useUserStore((state) => state.setPreferences);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState<string | null>(null);

  useEffect(() => {
    const savedLanguage = (profile as any).preferences?.language || profile.metadata?.language;
    if (savedLanguage) {
      setLanguage(normalizeLanguage(savedLanguage));
    }
  }, [profile, setLanguage]);

  const handleLanguageChange = async (nextLanguage: string) => {
    const previousLanguage = language;
    setLanguage(nextLanguage);
    setIsSavingLanguage(true);
    setLanguageError(null);

    try {
      const response = await userService.updateProfile({
        preferences: { language: nextLanguage },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Unable to save language preference.');
      }

      setProfile(response.data as any);
      setPreferences({ language: nextLanguage });
    } catch (error) {
      setLanguage(previousLanguage);
      setLanguageError(error instanceof Error ? error.message : 'Unable to save language preference.');
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: <Sun size={20} /> },
    { value: 'dark' as const, label: 'Dark', icon: <Moon size={20} /> },
    { value: 'auto' as const, label: 'System', icon: <Monitor size={20} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="setting-section">
        <h3 className="mb-4">Appearance</h3>
        <p className="text-slate-500 text-xs mb-4">Personalize your workspace theme</p>

        <div className="settings-theme-options">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`settings-theme-option ${theme === option.value ? 'is-selected' : ''}`}
              onClick={() => setTheme(option.value)}
              aria-pressed={theme === option.value}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setting-section">
        <h3 className="mb-4">Language</h3>
        <select
          className="settings-language-select"
          value={normalizeLanguage(language)}
          onChange={(event) => void handleLanguageChange(event.target.value)}
          disabled={isSavingLanguage}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        {isSavingLanguage && <p className="settings-field-status">Saving language preference...</p>}
        {languageError && <p className="settings-field-error" role="alert">{languageError}</p>}
      </div>
    </div>
  );
};

export default GeneralSettings;
