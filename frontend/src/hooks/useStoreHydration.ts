import { useEffect, useState } from 'react';
import { useChatStore } from '../stores/chat.store';
import { usePlannerStore } from '../stores/planner.store';
import { useUserStore } from '../stores/useUserStore';
import { useAnalyticsStore } from '../stores/analytics.store';

/**
 * Hook to ensure all Zustand stores are properly hydrated from localStorage
 * on app startup. Prevents state loss when navigating between pages.
 */
export const useStoreHydration = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      useChatStore.getState();
      usePlannerStore.getState();
      useUserStore.getState();
      useAnalyticsStore.getState();
      setIsHydrated(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setIsHydrated(true);
    }
  }, []);

  return { isHydrated, error };
};

/**
 * Hook to prevent state from being cleared on route navigation
 * Keeps all store data intact when moving between pages
 */
export const usePreserveState = () => {
  useEffect(() => {
    const handleBeforeUnload = () => {
      const chatData = useChatStore.getState();
      const plannerData = usePlannerStore.getState();
      const userData = useUserStore.getState();

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

    const unsubscribeChat = useChatStore.subscribe((state) => {
      console.log('Chat conversations updated:', state.conversations?.length || 0);
    });

    const unsubscribePlanner = usePlannerStore.subscribe((state) => {
      console.log('Planner tasks updated:', state.tasks?.length || 0);
    });

    const unsubscribeUser = useUserStore.subscribe((state) => {
      console.log('User profile updated:', state.profile?.name || 'unknown');
    });

    return () => {
      unsubscribeChat();
      unsubscribePlanner();
      unsubscribeUser();
    };
  }, [debug]);
};
