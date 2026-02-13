// frontend/src/components/settings/GmailIntegrationSettings.tsx
import React, { useState, useEffect } from 'react';
import { Mail, Check, AlertCircle, Loader2, Link2, Unlink2 } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

interface GmailSettings {
  connected: boolean;
  email?: string;
  sync_enabled: boolean;
  auto_task_creation: boolean;
  sync_frequency: 'instant' | 'hourly' | 'daily';
  labels_to_sync: string[];
  last_sync?: string;
}

export default function GmailIntegrationSettings() {
  const [settings, setSettings] = useState<GmailSettings>({
    connected: false,
    sync_enabled: false,
    auto_task_creation: false,
    sync_frequency: 'hourly',
    labels_to_sync: ['IMPORTANT', 'INBOX'],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const userId = useUserStore((state) => state.profile?.id);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    const stored = localStorage.getItem(`gmail_settings_${userId}`);
    if (stored) {
      setSettings(JSON.parse(stored));
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      // In production, this would initiate OAuth flow
      const mockConnected = !settings.connected;
      const mockEmail = mockConnected ? 'user@gmail.com' : undefined;
      
      setSettings(prev => ({
        ...prev,
        connected: mockConnected,
        email: mockEmail,
        last_sync: mockConnected ? new Date().toISOString() : undefined
      }));
      
      setMessage({
        type: 'success',
        text: mockConnected ? 'Gmail connected successfully' : 'Gmail disconnected'
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to connect Gmail' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    localStorage.setItem(`gmail_settings_${userId}`, JSON.stringify(settings));
    setMessage({ type: 'success', text: 'Settings saved successfully' });
    setTimeout(() => setMessage(null), 3000);
  };

  const formatLastSync = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Connection Status */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Mail size={24} className="text-red-500" />
            <div>
              <h3 className="text-lg font-bold text-white">Gmail Integration</h3>
              <p className="text-sm text-gray-400">Sync emails and create tasks automatically</p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${settings.connected ? 'bg-green-500' : 'bg-gray-500'}`}></div>
        </div>

        {settings.connected && settings.email && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
            <Check size={16} className="text-green-400" />
            <span className="text-sm text-green-300">Connected as {settings.email}</span>
          </div>
        )}

        {message && (
          <div className={`rounded-lg p-3 mb-4 flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {message.type === 'success' ? (
              <Check size={16} className="text-green-400" />
            ) : (
              <AlertCircle size={16} className="text-red-400" />
            )}
            <span className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
              {message.text}
            </span>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
            settings.connected
              ? 'bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300'
              : 'bg-red-600 hover:bg-red-700 border border-red-500 text-white'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              {settings.connected ? (
                <>
                  <Unlink2 size={18} />
                  Disconnect Gmail
                </>
              ) : (
                <>
                  <Link2 size={18} />
                  Connect Gmail
                </>
              )}
            </>
          )}
        </button>
      </div>

      {settings.connected && (
        <>
          {/* Sync Settings */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Sync Preferences</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sync_enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, sync_enabled: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <p className="text-white font-medium text-sm">Enable Email Sync</p>
                  <p className="text-gray-400 text-xs">Automatically sync emails to planner</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_task_creation}
                  onChange={(e) => setSettings(prev => ({ ...prev, auto_task_creation: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <div>
                  <p className="text-white font-medium text-sm">Auto Task Creation</p>
                  <p className="text-gray-400 text-xs">Create tasks from important emails automatically</p>
                </div>
              </label>
            </div>
          </div>

          {/* Sync Frequency */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Sync Frequency</h3>
            
            <div className="space-y-2">
              {['instant', 'hourly', 'daily'].map(freq => (
                <label key={freq} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="syncFrequency"
                    value={freq}
                    checked={settings.sync_frequency === freq}
                    onChange={(e) => setSettings(prev => ({ ...prev, sync_frequency: e.target.value as any }))}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="text-white text-sm font-medium capitalize">{freq}</p>
                    <p className="text-gray-400 text-xs">
                      {freq === 'instant' && 'Real-time sync (may use more data)'}
                      {freq === 'hourly' && 'Check every hour'}
                      {freq === 'daily' && 'Check once daily'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Last Sync Info */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <p className="text-sm text-gray-400">Last sync: {formatLastSync(settings.last_sync)}</p>
          </div>
        </>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-semibold text-white transition-all"
      >
        Save Settings
      </button>
    </div>
  );
}
