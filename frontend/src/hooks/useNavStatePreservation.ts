import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../stores/chat.store';
import { usePlannerStore } from '../stores/planner.store';
import { useUserStore } from '../stores/useUserStore';

/**
 * Hook to ensure state persists across route navigation
 * Prevents state from being reset when changing pages
 */
export const useNavStatePreservation = () => {
  const location = useLocation();
  const previousLocationRef = useRef(location.pathname);

  useEffect(() => {
    // Track navigation
    if (location.pathname !== previousLocationRef.current) {
      console.log(`📍 Navigated from ${previousLocationRef.current} to ${location.pathname}`);

      // Verify state is still in stores
      const chatStore = useChatStore.getState();
      const plannerStore = usePlannerStore.getState();
      const userStore = useUserStore.getState();

      console.log('🔍 State check after navigation:');
      console.log('  - Chat conversations:', chatStore.conversations.length);
      console.log('  - Planner tasks:', plannerStore.tasks.length);
      console.log('  - User authenticated:', !!userStore.profile?.id);

      // If state was lost, attempt to restore from sessionStorage/localStorage
      if (!chatStore.conversations.length && !plannerStore.tasks.length) {
        console.warn('⚠️ State appears to be lost, checking backup storage...');
        
        try {
          // Check sessionStorage for preserved data
          const preservedChat = sessionStorage.getItem('chat_preserved');
          const preservedPlanner = sessionStorage.getItem('planner_preserved');

          if (preservedChat) {
            const conversations = JSON.parse(preservedChat);
            if (conversations.length > 0) {
              console.log('✓ Restored chat from sessionStorage');
              // Restore to store
              useChatStore.setState({ conversations });
            }
          }

          if (preservedPlanner) {
            const planner = JSON.parse(preservedPlanner);
            console.log('✓ Restored planner data from sessionStorage');
            usePlannerStore.setState(planner);
          }
        } catch (err) {
          console.error('Failed to restore from backup:', err);
        }
      }

      previousLocationRef.current = location.pathname;
    }
  }, [location.pathname]);

  return {
    currentPath: location.pathname,
    previousPath: previousLocationRef.current
  };
};
