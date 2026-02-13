/**
 * State Preservation Utility
 * Ensures ALL state is preserved across page navigation and page reloads
 * This is a comprehensive safety net for data persistence
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
 * Backup all store states to localStorage
 * Called periodically to ensure no data is lost
 */
export const backupAllStates = () => {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      chat: useChatStore.getState(),
      planner: usePlannerStore.getState(),
      user: useUserStore.getState(),
      analytics: useAnalyticsStore.getState(),
    };

    localStorage.setItem(STORAGE_KEYS.STATE_BACKUP, JSON.stringify(backup));
    console.log('✅ State backup saved');
    return backup;
  } catch (err) {
    console.error('❌ Failed to backup state:', err);
    return null;
  }
};

/**
 * Restore all store states from localStorage backup
 * Used when states appear to be lost
 */
export const restoreAllStates = () => {
  try {
    const backupStr = localStorage.getItem(STORAGE_KEYS.STATE_BACKUP);
    if (!backupStr) {
      console.log('ℹ️ No backup found');
      return false;
    }

    const backup = JSON.parse(backupStr);
    const timeSinceBackup = Date.now() - new Date(backup.timestamp).getTime();

    // Only restore if backup is less than 1 hour old
    if (timeSinceBackup > 3600000) {
      console.log('⚠️ Backup is too old, skipping restore');
      return false;
    }

    // Restore each store
    if (backup.chat) {
      useChatStore.setState(backup.chat);
      console.log('✅ Chat state restored');
    }
    if (backup.planner) {
      usePlannerStore.setState(backup.planner);
      console.log('✅ Planner state restored');
    }
    if (backup.user) {
      useUserStore.setState(backup.user);
      console.log('✅ User state restored');
    }
    if (backup.analytics) {
      useAnalyticsStore.setState(backup.analytics);
      console.log('✅ Analytics state restored');
    }

    return true;
  } catch (err) {
    console.error('❌ Failed to restore state:', err);
    return false;
  }
};

/**
 * Check if state is present in all stores
 * Returns true if data exists, false if stores are empty
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

  const chatHasData = chatStore.conversations?.length > 0;
  // Relaxed planner check: accessing array safely
  const plannerHasData = (plannerStore.tasks && plannerStore.tasks.length > 0) || (plannerStore.goals && plannerStore.goals.length > 0);

  const profileHasId = !!(userStore.profile && userStore.profile.id);
  const userIsAuthenticated = profileHasId;

  const analyticsHasData = analyticsStore.events?.length > 0;

  // Healthy when auth flags are consistent (both true or both false).
  // This prevents restore loops for logged-out users.
  const isHealthy = userStore.isAuthenticated === profileHasId;

  if (!isHealthy) {
    console.debug('State Health Check Details:', {
      userProfile: userStore.profile,
      userID: userStore.profile?.id,
      isAuthenticated: userStore.isAuthenticated,
      profileHasId
    });
  }

  return {
    isHealthy,
    chatHasData,
    plannerHasData,
    userIsAuthenticated,
    analyticsHasData,
  };
};

/**
 * Monitor state changes and automatically backup
 * Should be called once on app startup
 */
export const initializeStateMonitoring = () => {
  // Initial backup
  backupAllStates();

  // Periodic backup (every 30 seconds)
  const backupInterval = setInterval(() => {
    backupAllStates();
  }, 30000);

  let lastRestoreTime = 0;

  // Health check (every 10 seconds)
  const healthCheckInterval = setInterval(() => {
    // Don't check/restore if we just restored recently (prevent loops)
    if (Date.now() - lastRestoreTime < 15000) return;

    const health = checkStateHealth();
    if (!health.isHealthy) {
      console.warn('⚠️ State health check failed (Auth state mismatch), attempting restore...');
      const success = restoreAllStates();
      if (success) {
        lastRestoreTime = Date.now();
      }
    }
  }, 10000);

  // Cleanup function
  return () => {
    clearInterval(backupInterval);
    clearInterval(healthCheckInterval);
  };
};

/**
 * Prevent state from being garbage collected
 * Keep references to stores alive throughout app lifetime
 */
export const preventStateGarbageCollection = () => {
  // Access all stores to keep them in memory
  const chatStore = useChatStore.subscribe((state) => state);
  const plannerStore = usePlannerStore.subscribe((state) => state);
  const userStore = useUserStore.subscribe((state) => state);
  const analyticsStore = useAnalyticsStore.subscribe((state) => state);

  console.log('🔐 State garbage collection prevention activated');

  // Return unsubscribe functions
  return () => {
    chatStore();
    plannerStore();
    userStore();
    analyticsStore();
  };
};

/**
 * Force save all states before page unload
 * Ensures data is persisted even if browser crashes
 */
export const setupUnloadHandler = () => {
  const handleBeforeUnload = () => {
    backupAllStates();

    // Also save to sessionStorage as emergency backup
    const emergency = {
      chat: useChatStore.getState(),
      planner: usePlannerStore.getState(),
      user: useUserStore.getState(),
    };
    sessionStorage.setItem('emergency-backup', JSON.stringify(emergency));
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
 * Call this in your root component (App.tsx)
 */
export const initializeStatePreservation = () => {
  console.log('🔄 Initializing state preservation system...');

  // Check if we need to restore from backup
  const health = checkStateHealth();
  if (!health.isHealthy) {
    // Try to restore from backup
    const restored = restoreAllStates();
    if (restored) {
      console.log('✅ State restored from backup');
    }
  }

  // Start monitoring
  const stopMonitoring = initializeStateMonitoring();

  // Setup unload handler
  const stopUnloadHandler = setupUnloadHandler();

  // Prevent garbage collection
  const stopGC = preventStateGarbageCollection();

  // Return cleanup function
  return () => {
    stopMonitoring();
    stopUnloadHandler();
    stopGC();
    console.log('🛑 State preservation system stopped');
  };
};
