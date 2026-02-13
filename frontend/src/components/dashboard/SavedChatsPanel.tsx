// frontend/src/components/dashboard/SavedChatsPanel.tsx
import React, { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Search, MoreVertical, Lock } from 'lucide-react';
import { keepModeService } from '../../services/keepMode.service';
import { useUserStore } from '../../stores/useUserStore';
import { useChatStore } from '../../stores/chat.store';

interface SavedChat {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  mode: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  summary?: string;
}

export default function SavedChatsPanel() {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const userId = useUserStore((state) => state.profile?.id);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const isPremium = useUserStore((state) => state.isPremium);

  useEffect(() => {
    loadSavedChats();
  }, [userId]);

  const loadSavedChats = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const chats = await keepModeService.getSavedChats(userId);
      setSavedChats(chats);
    } catch (error) {
      console.error('Error loading saved chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChat = async (chat: SavedChat) => {
    if (!isPremium) {
      // Show premium lock
      return;
    }
    try {
      const fullChat = await keepModeService.loadChat(chat.id);
      setActiveConversation(fullChat.id);
      setSelectedChat(chat.id);
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this saved chat?')) {
      try {
        await keepModeService.deleteChat(chatId);
        setSavedChats(savedChats.filter(c => c.id !== chatId));
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (!userId) return;
    
    try {
      if (query.trim()) {
        const results = await keepModeService.searchChats(userId, query);
        setSavedChats(results);
      } else {
        await loadSavedChats();
      }
    } catch (error) {
      console.error('Error searching chats:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-900 to-black p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-3">Saved Conversations</h2>
        
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Chats List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {savedChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare size={32} className="mb-2 opacity-50" />
            <p className="text-sm">No saved conversations yet</p>
          </div>
        ) : (
          savedChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => handleLoadChat(chat)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 group relative ${
                selectedChat === chat.id
                  ? 'bg-blue-600/20 border border-blue-500/30'
                  : 'bg-white/5 border border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-blue-400 flex-shrink-0" />
                    <p className="font-medium text-white truncate text-sm">{chat.title}</p>
                  </div>
                  {chat.summary && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{chat.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">{chat.mode}</span>
                    <span className="text-xs text-gray-500">{formatDate(chat.updated_at)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg flex-shrink-0"
                  title="Delete chat"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Premium lock indicator */}
      {!isPremium && savedChats.length > 0 && (
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center gap-2">
          <Lock size={14} className="text-purple-400" />
          <span className="text-xs text-purple-300">Unlock Premium to view all saved chats</span>
        </div>
      )}
    </div>
  );
}
