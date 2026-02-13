// frontend/src/components/settings/AIPreferencesSettings.tsx
import React, { useState, useEffect } from 'react';
import { Brain, Zap, Lightbulb, MessageSquare, Save } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

interface AIPreferences {
  personality: 'direct' | 'friendly' | 'formal' | 'casual';
  responseLength: 'concise' | 'detailed' | 'very_detailed';
  focus_areas: string[];
  auto_suggestions: boolean;
  learning_mode: boolean;
  dark_mode_ai: boolean;
}

const PERSONALITIES = [
  { id: 'direct', label: 'Direct', description: 'Get straight to the point' },
  { id: 'friendly', label: 'Friendly', description: 'Warm and conversational' },
  { id: 'formal', label: 'Formal', description: 'Professional tone' },
  { id: 'casual', label: 'Casual', description: 'Relaxed and fun' }
];

const FOCUS_AREAS = [
  'Productivity',
  'Wellness',
  'Learning',
  'Fitness',
  'Creativity',
  'Finance',
  'Relationships'
];

export default function AIPreferencesSettings() {
  const [preferences, setPreferences] = useState<AIPreferences>({
    personality: 'friendly',
    responseLength: 'detailed',
    focus_areas: ['Productivity', 'Wellness'],
    auto_suggestions: true,
    learning_mode: true,
    dark_mode_ai: true
  });
  const [saved, setSaved] = useState(false);
  const userId = useUserStore((state) => state.profile?.id);

  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    // Load from storage/API
    const stored = localStorage.getItem(`ai_preferences_${userId}`);
    if (stored) {
      setPreferences(JSON.parse(stored));
    }
  };

  const handleSave = async () => {
    localStorage.setItem(`ai_preferences_${userId}`, JSON.stringify(preferences));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleFocusArea = (area: string) => {
    setPreferences(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.includes(area)
        ? prev.focus_areas.filter(a => a !== area)
        : [...prev.focus_areas, area]
    }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Personality */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={20} className="text-blue-400" />
          <h3 className="text-lg font-bold text-white">AI Personality</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">How would you like the AI to interact with you?</p>
        
        <div className="grid grid-cols-2 gap-3">
          {PERSONALITIES.map(p => (
            <button
              key={p.id}
              onClick={() => setPreferences(prev => ({ ...prev, personality: p.id as any }))}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                preferences.personality === p.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <p className="font-semibold text-white text-sm">{p.label}</p>
              <p className="text-xs text-gray-400 mt-1">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Response Length */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} className="text-cyan-400" />
          <h3 className="text-lg font-bold text-white">Response Style</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">Prefer longer explanations or quick answers?</p>
        
        <div className="space-y-2">
          {['concise', 'detailed', 'very_detailed'].map(length => (
            <label key={length} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
              <input
                type="radio"
                name="responseLength"
                value={length}
                checked={preferences.responseLength === length}
                onChange={(e) => setPreferences(prev => ({ ...prev, responseLength: e.target.value as any }))}
                className="w-4 h-4"
              />
              <span className="text-white text-sm font-medium capitalize">{length.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Focus Areas */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={20} className="text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Focus Areas</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">What areas should AI focus on?</p>
        
        <div className="grid grid-cols-2 gap-2">
          {FOCUS_AREAS.map(area => (
            <button
              key={area}
              onClick={() => toggleFocusArea(area)}
              className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                preferences.focus_areas.includes(area)
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Features */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={20} className="text-purple-400" />
          <h3 className="text-lg font-bold text-white">Smart Features</h3>
        </div>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.auto_suggestions}
              onChange={(e) => setPreferences(prev => ({ ...prev, auto_suggestions: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-white font-medium text-sm">Auto Suggestions</p>
              <p className="text-gray-400 text-xs">AI suggests actions based on context</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.learning_mode}
              onChange={(e) => setPreferences(prev => ({ ...prev, learning_mode: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-white font-medium text-sm">Learning Mode</p>
              <p className="text-gray-400 text-xs">AI explains concepts and reasoning</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.dark_mode_ai}
              onChange={(e) => setPreferences(prev => ({ ...prev, dark_mode_ai: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="text-white font-medium text-sm">Dark Mode AI</p>
              <p className="text-gray-400 text-xs">Optimize responses for dark theme</p>
            </div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-semibold text-white transition-all"
        >
          <Save size={18} />
          Save Preferences
        </button>
        {saved && (
          <div className="text-green-400 text-sm font-medium animate-pulse">✓ Preferences saved</div>
        )}
      </div>
    </div>
  );
}
