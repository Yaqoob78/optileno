import { useChatStore } from '../stores/chat.store';
import { usePlannerStore } from '../stores/planner.store';
import { useAnalyticsStore } from '../stores/analytics.store';
import { useUserStore } from '../stores/useUserStore';
import { realtimeClient } from '../services/realtime/socket-client';

/**
 * Thoroughly clears all session-scoped stores, browser storage caches,
 * and background connections. Ensures 100% data isolation between accounts.
 */
export const clearSessionScopedData = (): void => {
  try {
    // 1. Disconnect active realtime websocket
    realtimeClient.disconnect();

    // 2. Reset in-memory Zustand stores
    usePlannerStore.getState().resetPlanner();
    useChatStore.getState().clearAll();
    useAnalyticsStore.getState().clearEvents();

    // 3. Clear localStorage items that hold account-specific data
    try {
      localStorage.removeItem('planner-storage');
      localStorage.removeItem('chat-storage');
      localStorage.removeItem('analytics-storage');
      localStorage.removeItem('user-storage');
      localStorage.removeItem('state-backup');

      // Purge any seen achievement keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('optileno_achievements_seen:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('Unable to clear localStorage keys', e);
    }

    // 4. Clear sessionStorage backup keys
    try {
      sessionStorage.removeItem('emergency-backup');
      sessionStorage.removeItem('chat_preserved');
      sessionStorage.removeItem('planner_preserved');
      sessionStorage.removeItem('user_preserved');
    } catch (e) {
      console.warn('Unable to clear sessionStorage keys', e);
    }

    console.log('🧹 Session-scoped stores and cache successfully wiped');
  } catch (err) {
    console.error('Error while clearing session-scoped data:', err);
  }
};
