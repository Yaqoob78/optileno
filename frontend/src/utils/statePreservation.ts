/**
 * State Preservation Utility
 * Ensures active user state is preserved across page navigation and reloads.
 * Strictly scopes all backups to the currently authenticated user ID to prevent
 * cross-user data leakage.
 */

import { useChatStore } from '../stores/chat.store';
import { usePlannerStore } from '../stores/planner.store';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsStore } from '../stores/analytics.store';

// Storage keys
const STORAGE_KEYS = {
  CHAT: 'chat-storage',
  PLANNER: 'planner-storage',
  USER: 'user-storage',
  ANALYTICS: 'analytics-storage',
  STATE_BACKUP: 'state-backup',
};

/**
 * Clear all local state backups from localStorage and sessionStorage
 */
export const clearAllStateBackups = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.STATE_BACKUP);
    sessionStorage.removeItem('emergency-backup');
    sessionStorage.removeItem('chat_preserved');
    sessionStorage.removeItem('planner_preserved');
    sessionStorage.removeItem('user_preserved');
  } catch (err) {
    console.warn('Unable to clear state backups:', err);
  }
};

/**
 * Backup all store states to localStorage for the active authenticated user
 */
export const backupAllStates = () => {
  try {
    const userStore = useUserStore.getState();
    const userId = userStore.profile?.id;

    // Only create backups if there is a logged-in user
    if (!userStore.isAuthenticated || !userId) {
      return null;
    }

    const backup = {
      timestamp: new Date().toISOString(),
      userId: String(userId),
      chat: useChatStore.getState(),
      planner: usePlannerStore.getState(),
      user: userStore,
      analytics: useAnalyticsStore.getState(),
    };

    localStorage.setItem(STORAGE_KEYS.STATE_BACKUP, JSON.stringify(backup));
    return backup;
  } catch (err) {
    console.error('❌ Failed to backup state:', err);
    return null;
  }
};

/**
 * Restore all store states from localStorage backup ONLY if the backup
 * matches the currently logged-in user.
 */
export const restoreAllStates = () => {
  try {
    const backupStr = localStorage.getItem(STORAGE_KEYS.STATE_BACKUP);
    if (!backupStr) {
      return false;
    }

    const userStore = useUserStore.getState();
    const currentUserId = userStore.profile?.id ? String(userStore.profile.id) : null;

    if (!userStore.isAuthenticated || !currentUserId) {
      // Unauthenticated session: purge any lingering backup from previous session
      clearAllStateBackups();
      return false;
    }

    const backup = JSON.parse(backupStr);

    // If backup belongs to another user or is missing a userId, purge it and do NOT restore!
    if (!backup.userId || String(backup.userId) !== currentUserId) {
      console.warn('⚠️ Stale backup from different user detected; discarding.');
      clearAllStateBackups();
      return false;
    }

    const timeSinceBackup = Date.now() - new Date(backup.timestamp).getTime();

    // Only restore if backup is less than 1 hour old
    if (timeSinceBackup > 3600000) {
      clearAllStateBackups();
      return false;
    }

    // Restore stores safely for this specific user
    if (backup.chat) {
      useChatStore.setState(backup.chat);
    }
    if (backup.planner) {
      usePlannerStore.setState(backup.planner);
    }
    if (backup.user) {
      useUserStore.setState(backup.user);
    }
    if (backup.analytics) {
      useAnalyticsStore.setState(backup.analytics);
    }

    console.log(`✅ State safely restored for user ${currentUserId}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to restore state:', err);
    clearAllStateBackups();
    return false;
  }
};

/**
 * Check if state is present in all stores
 */
export const checkStateHealth = (): {
  isHealthy: boolean;
  chatHasData: boolean;
  plannerHasData: boolean;
  userIsAuthenticated: boolean;
  analyticsHasData: boolean;
} => {
  const chatStore = useChatStore.getState();
  const plannerStore = usePlannerStore.getState();
  const userStore = useUserStore.getState();
  const analyticsStore = useAnalyticsStore.getState();

  const chatHasData = (chatStore.conversations?.length ?? 0) > 0;
  const plannerHasData = ((plannerStore.tasks?.length ?? 0) > 0) || ((plannerStore.goals?.length ?? 0) > 0);
  const profileHasId = Boolean(userStore.profile?.id);
  const userIsAuthenticated = profileHasId && userStore.isAuthenticated;
  const analyticsHasData = (analyticsStore.events?.length ?? 0) > 0;

  // Healthy when auth state matches profile presence
  const isHealthy = userStore.isAuthenticated === profileHasId;

  return {
    isHealthy,
    chatHasData,
    plannerHasData,
    userIsAuthenticated,
    analyticsHasData,
  };
};

/**
 * Monitor state changes and automatically backup periodically
 */
export const initializeStateMonitoring = () => {
  backupAllStates();

  const backupInterval = setInterval(() => {
    backupAllStates();
  }, 30000);

  let lastRestoreTime = 0;

  const healthCheckInterval = setInterval(() => {
    if (Date.now() - lastRestoreTime < 15000) return;

    const userStore = useUserStore.getState();
    if (!userStore.isAuthenticated || !userStore.profile?.id) {
      return; // Do not run restore loops for logged-out / guest states
    }

    const health = checkStateHealth();
    if (!health.isHealthy) {
      const success = restoreAllStates();
      if (success) {
        lastRestoreTime = Date.now();
      }
    }
  }, 10000);

  return () => {
    clearInterval(backupInterval);
    clearInterval(healthCheckInterval);
  };
};

/**
 * Force save all states before page unload
 */
export const setupUnloadHandler = () => {
  const handleBeforeUnload = () => {
    const userStore = useUserStore.getState();
    if (userStore.isAuthenticated && userStore.profile?.id) {
      backupAllStates();
      const emergency = {
        userId: userStore.profile.id,
        chat: useChatStore.getState(),
        planner: usePlannerStore.getState(),
        user: userStore,
      };
      sessionStorage.setItem('emergency-backup', JSON.stringify(emergency));
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('unload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('unload', handleBeforeUnload);
  };
};

/**
 * Complete state preservation initialization
 */
export const initializeStatePreservation = () => {
  const userStore = useUserStore.getState();
  if (userStore.isAuthenticated && userStore.profile?.id) {
    const health = checkStateHealth();
    if (!health.isHealthy) {
      restoreAllStates();
    }
  } else {
    // If not authenticated, ensure no stale leftovers exist
    clearAllStateBackups();
  }

  const stopMonitoring = initializeStateMonitoring();
  const stopUnloadHandler = setupUnloadHandler();

  return () => {
    stopMonitoring();
    stopUnloadHandler();
  };
};
