import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Globe, Settings as SettingsIcon } from 'lucide-react';

const GeneralSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState('en-US');

  return (
    <div className="space-y-4">
      {/* Theme Section */}
      <div className="setting-section">
        <h3 className="mb-4">Appearance</h3>
        <p className="text-slate-500 text-xs mb-4">
          Personalize your workspace theme
        </p>

        <div className="grid grid-cols-3 gap-3">
          {['light', 'dark', 'auto'].map((t) => (
            <button
              key={t}
              className={`p-4 rounded-lg border flex flex-col items-center justify-center transition-all ${theme === t
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                : 'border-slate-800 bg-slate-900/50 text-slate-500 hover:border-slate-700'
                }`}
              onClick={() => setTheme(t as any)}
            >
              <div className="text-xl mb-1">{t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🔄'}</div>
              <span className="text-xs font-semibold uppercase tracking-wider">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Language Section */}
      <div className="setting-section">
        <h3 className="mb-4">Language</h3>

        <select
          className="w-full"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="es-ES">Spanish</option>
          <option value="fr-FR">French</option>
          <option value="de-DE">German</option>
        </select>
      </div>
    </div>
  );
};

export default GeneralSettings;