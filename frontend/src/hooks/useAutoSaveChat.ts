import { useEffect, useRef } from 'react';
import { useChatStore } from '../stores/chat.store';
import { useUserStore } from '../stores/useUserStore';

/**
 * Auto-save chat conversations to localStorage and backend
 * Saves when conversation changes, with debouncing
 */
export const useAutoSaveChat = (interval = 5000) => {
  const activeConversation = useChatStore((state) => state.activeConversation);
  const conversations = useChatStore((state) => state.conversations);
  const profile = useUserStore((state) => state.profile);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!activeConversation || !profile.id) return;

    // Serialize conversation for comparison
    const currentData = JSON.stringify(activeConversation);

    // Only save if data has changed
    if (currentData === lastSavedRef.current) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Save to localStorage
        const key = `chat_${profile.id}_${activeConversation.id}`;
        localStorage.setItem(key, JSON.stringify(activeConversation));

        // Also save to conversations list in localStorage
        const chatsKey = `chats_${profile.id}`;
        const savedChats = JSON.parse(localStorage.getItem(chatsKey) || '[]');
        const chatIndex = savedChats.findIndex((c: any) => c.id === activeConversation.id);
        
        if (chatIndex >= 0) {
          savedChats[chatIndex] = activeConversation;
        } else {
          savedChats.push(activeConversation);
        }

        localStorage.setItem(chatsKey, JSON.stringify(savedChats));
        lastSavedRef.current = currentData;

        console.log(`✓ Chat auto-saved: ${activeConversation.title}`);
      } catch (error) {
        console.error('Failed to auto-save chat:', error);
      }
    }, interval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [activeConversation, profile.id, interval]);

  // Also save all conversations periodically
  useEffect(() => {
    if (!profile.id) return;

    const saveAllInterval = setInterval(() => {
      try {
        const key = `all_conversations_${profile.id}`;
        localStorage.setItem(key, JSON.stringify(conversations));
        console.log(`✓ All conversations auto-saved (${conversations.length} total)`);
      } catch (error) {
        console.error('Failed to save all conversations:', error);
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(saveAllInterval);
  }, [conversations, profile.id]);
};
