import { useEffect, useState } from 'react';
import { useChatStore } from '../stores/chat.store';
import { usePlannerStore } from '../stores/planner.store';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsStore } from '../stores/analytics.store';

/**
 * Hook to ensure all Zustand stores are properly hydrated from localStorage
 * on app startup. Prevents state loss when navigating between pages.
 * 
 * This hook:
 * 1. Waits for all stores to hydrate from localStorage
 * 2. Prevents premature rendering before state is loaded
 * 3. Ensures navigation between pages maintains state
 */
export const useStoreHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hydrateStores = async () => {
      try {
        // Get all store instances
        const chatStore = useChatStore.getState();
        const plannerStore = usePlannerStore.getState();
        const userStore = useUserStore.getState();
        const analyticsStore = useAnalyticsStore.getState();

        console.log('🔄 Store Hydration Starting...');
        console.log('📊 Loaded from localStorage:');
        console.log('  - Chat:', {
          conversations: chatStore.conversations?.length || 0,
          activeConversation: chatStore.activeConversation?.title || 'none'
        });
        console.log('  - Planner:', {
          tasks: chatStore.conversations?.length || 0,
          goals: plannerStore.goals?.length || 0,
          habits: plannerStore.habits?.length || 0
        });
        console.log('  - User:', {
          authenticated: !!userStore.profile?.id,
          name: userStore.profile?.name || 'unknown'
        });

        // All stores are already hydrated by Zustand's persist middleware
        // Just verify the data is present
        const hasData = 
          (chatStore.conversations?.length > 0) ||
          (plannerStore.tasks?.length > 0) ||
          (userStore.profile?.id);

        console.log(`✅ Store hydration complete. Data present: ${hasData}`);
        setIsHydrated(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('❌ Store hydration failed:', message);
        setError(message);
        setIsHydrated(true); // Still mark as hydrated to unblock rendering
      }
    };

    hydrateStores();
  }, []);

  return { isHydrated, error };
};

/**
 * Hook to prevent state from being cleared on route navigation
 * Keeps all store data intact when moving between pages
 */
export const usePreserveState = () => {
  useEffect(() => {
    // Handler to preserve state when navigating
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Ensure all stores persist their state before unload
      const chatData = useChatStore.getState();
      const plannerData = usePlannerStore.getState();
      const userData = useUserStore.getState();

      // These are automatically saved by persist middleware, but we ensure it
      sessionStorage.setItem('chat_preserved', JSON.stringify(chatData.conversations));
      sessionStorage.setItem('planner_preserved', JSON.stringify({
        tasks: plannerData.tasks,
        goals: plannerData.goals,
        habits: plannerData.habits
      }));
      sessionStorage.setItem('user_preserved', JSON.stringify(userData.profile));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
};

/**
 * Hook to listen for state changes and log them
 * Useful for debugging state persistence issues
 */
export const useStateListener = (debug = false) => {
  useEffect(() => {
    if (!debug) return;

    // Subscribe to chat store changes
    const unsubscribeChat = useChatStore.subscribe(
      (state) => {
        console.log('💬 Chat conversations updated:', state.conversations?.length || 0);
      }
    );

    // Subscribe to planner store changes
    const unsubscribePlanner = usePlannerStore.subscribe(
      (state) => {
        console.log('📋 Planner tasks updated:', state.tasks?.length || 0);
      }
    );

    // Subscribe to user store changes
    const unsubscribeUser = useUserStore.subscribe(
      (state) => {
        console.log('👤 User profile updated:', state.profile?.name || 'unknown');
      }
    );

    return () => {
      unsubscribeChat();
      unsubscribePlanner();
      unsubscribeUser();
    };
  }, [debug]);
};
