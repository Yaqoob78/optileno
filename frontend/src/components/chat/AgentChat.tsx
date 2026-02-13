import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader, Zap, TrendingUp, CheckSquare, Brain } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';
import { usePlanner } from '../../hooks/usePlanner';


interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  mode?: string;
  timestamp: string;
  confirmations?: any[];
}

interface AgentChatProps {
  conversationId?: string;
}

export const AgentChat: React.FC<AgentChatProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<'CHAT' | 'PLAN' | 'ANALYZE' | 'TASK'>('CHAT');
  const [agentThinking, setAgentThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const modes = [
    { id: 'CHAT', label: 'Chat', icon: Brain },
    { id: 'PLAN', label: 'Plan', icon: CheckSquare },
    { id: 'ANALYZE', label: 'Analyze', icon: TrendingUp },
    { id: 'TASK', label: 'Task', icon: Zap },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Listen for agent updates
    socket.on('agent:thinking', (data: any) => {
      setAgentThinking(true);
    });

    socket.on('agent:conversation:updated', (data: any) => {
      if (data.update.state === 'complete') {
        setAgentThinking(false);
      }
    });

    return () => {
      socket.off('agent:thinking');
      socket.off('agent:conversation:updated');
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const { forceRefresh } = usePlanner();

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputValue;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setAgentThinking(true);

    try {
      const response = await fetch('/api/v1/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          message: textToSend,
          mode: agentMode,
        }),
      });

      const data = await response.json();

      // Check if any actions were executed and refresh planner data
      if (data.actions && data.actions.length > 0) {
        console.log("⚡ AI executed actions, refreshing planner...");
        forceRefresh();
      }

      const agentMessage: Message = {
        id: Math.random().toString(), // data.message_id might be missing
        role: 'agent',
        content: data.message || "I didn't get a response.",
        mode: agentMode,
        timestamp: new Date().toISOString(),
        confirmations: data.pending_confirmations
      };

      setMessages((prev) => [...prev, agentMessage]);
      setAgentThinking(false);
    } catch (error) {
      console.error('Failed to send message:', error);
      setAgentThinking(false);
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble: React.FC<{ message: Message }> = ({ message }) => (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${message.role === 'user'
          ? 'bg-blue-600 text-white rounded-br-none'
          : 'bg-gray-200 text-gray-900 rounded-bl-none'
          }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>

        {/* Confirmation Actions */}
        {message.confirmations && message.confirmations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs font-semibold mb-2">Requires Confirmation:</p>
            {message.confirmations.map((conf, idx) => (
              <div key={idx} className="bg-white p-2 rounded text-xs mb-2 shadow-sm">
                <div className="font-medium text-blue-800 mb-1">{conf.description}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleSendMessage("Yes, proceed.")}
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleSendMessage("No, cancel.")}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p
          className={`text-xs mt-2 ${message.role === 'user' ? 'text-blue-100' : 'text-gray-600'
            }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Mode Selector */}
      <div className="flex gap-2 p-4 border-b border-gray-200 bg-gray-50">
        {modes.map((mode) => {
          const IconComponent = mode.icon;
          return (
            <button
              key={mode.id}
              onClick={() => setAgentMode(mode.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${agentMode === mode.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
            >
              <IconComponent className="w-4 h-4" />
              {mode.label}
            </button>
          );
        })}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Brain className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm">Choose a mode and ask me anything!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {agentThinking && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Loader className="w-4 h-4 animate-spin" />
                Agent is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {isLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
