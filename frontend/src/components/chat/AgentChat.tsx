import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, Loader, Zap, TrendingUp, CheckSquare, Brain, AlertCircle } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';
import { usePlanner } from '../../hooks/usePlanner';
import { api } from '../../services/api/client';


interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  mode?: string;
  timestamp: string;
  confirmations?: any[];
  error?: boolean;
}

interface AgentChatProps {
  conversationId?: string;
}

// Lightweight markdown-ish renderer (bold, headers, bullets, code)
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="font-bold text-sm mt-2 mb-1">{renderInline(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="font-bold text-base mt-2 mb-1">{renderInline(line.slice(3))}</h3>);
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="shrink-0 mt-0.5">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-1.5 ml-1">
          <span className="shrink-0 font-medium">{numMatch[1]}.</span>
          <span>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }

    // Empty lines -> small spacer
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Normal text
    elements.push(<p key={i} className="leading-relaxed">{renderInline(line)}</p>);
  }

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, idx) => {
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    if (codeParts.length > 1) {
      return codeParts.map((cp, cIdx) => {
        if (cp.startsWith('`') && cp.endsWith('`')) {
          return <code key={`${idx}-${cIdx}`} className="bg-gray-700/30 px-1 py-0.5 rounded text-xs font-mono">{cp.slice(1, -1)}</code>;
        }
        return cp;
      });
    }
    return part;
  });
}

export const AgentChat: React.FC<AgentChatProps> = ({ conversationId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<'CHAT' | 'PLAN' | 'ANALYZE' | 'TASK'>('CHAT');
  const [agentThinking, setAgentThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stable session ID for multi-turn context
  const sessionId = useMemo(
    () => conversationId || crypto.randomUUID(),
    [conversationId]
  );

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
    const handleThinking = (data?: { session_id?: string }) => {
      if (data?.session_id && data.session_id !== sessionId) {
        return;
      }

      setAgentThinking(true);
    };

    const handleConversationUpdated = (data?: { session_id?: string; update?: { state?: string } }) => {
      if (data?.session_id && data.session_id !== sessionId) {
        return;
      }

      if (data?.update?.state === 'complete') {
        setAgentThinking(false);
      }
    };

    // Listen for agent updates
    socket.on('agent:thinking', handleThinking);
    socket.on('agent:conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('agent:thinking', handleThinking);
      socket.off('agent:conversation:updated', handleConversationUpdated);
    };
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const { forceRefresh } = usePlanner();

  // Build conversation history from messages for the backend
  const buildHistory = useCallback((): Array<{ role: string; content: string }> => {
    return messages
      .slice(-10) // Last 10 messages for context
      .map((m) => ({
        role: m.role === 'agent' ? 'assistant' : 'user',
        content: m.content,
      }));
  }, [messages]);

  // Debounce guard
  const lastSendRef = useRef<number>(0);

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputValue;
    if (!textToSend.trim()) return;

    // Debounce: prevent double sends within 500ms
    const now = Date.now();
    if (now - lastSendRef.current < 500) return;
    lastSendRef.current = now;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setAgentThinking(true);

    try {
      const response = await api.post<any>('/chat/send', {
        message: textToSend,
        mode: agentMode,
        session_id: sessionId,
        history: buildHistory(),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to send message');
      }
      const data = response.data;

      // Check if any actions were executed and refresh planner data
      if (data.actions && data.actions.length > 0) {
        console.log("⚡ AI executed actions, refreshing planner...");
        forceRefresh();
      }

      const agentMessage: Message = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: data.message || "I didn't get a response.",
        mode: agentMode,
        timestamp: new Date().toISOString(),
        confirmations: data.pending_confirmations
      };

      setMessages((prev) => [...prev, agentMessage]);
      setAgentThinking(false);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setAgentThinking(false);

      // Show error to user instead of silently failing
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'agent',
        content: error?.message || "Something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const MessageBubble: React.FC<{ message: Message }> = ({ message }) => (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md xl:max-w-lg px-4 py-3 rounded-lg ${message.role === 'user'
          ? 'bg-blue-600 text-white rounded-br-none'
          : message.error
            ? 'bg-red-100 text-red-800 rounded-bl-none border border-red-200'
            : 'bg-gray-200 text-gray-900 rounded-bl-none'
          }`}
      >
        {message.error && (
          <div className="flex items-center gap-1.5 mb-1 text-red-600">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Error</span>
          </div>
        )}
        <div className="text-sm">
          {message.role === 'agent' && !message.error
            ? renderMarkdown(message.content)
            : <span className="whitespace-pre-wrap">{message.content}</span>
          }
        </div>

        {/* Confirmation Actions */}
        {message.confirmations && message.confirmations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs font-semibold mb-2">Requires Confirmation:</p>
            {message.confirmations.map((conf: any, idx: number) => (
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
            onKeyDown={(e) => {
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
