// frontend/src/hooks/useChat.ts
import { useState } from "react";
import { useChatStore } from "../stores/chat.store";
import { api } from "../services/api/client";
import { handleAIResponse } from "../services/ai/ai.service";
import type { AIUnifiedResponse } from "../services/ai/ai.service";

export const useChat = () => {
  const addMessage = useChatStore((s) => s.addMessage);
  const startTyping = useChatStore((s) => s.startTyping);
  const stopTyping = useChatStore((s) => s.stopTyping);
  const messages = useChatStore(
    (s) => s.activeConversation?.messages || []
  );

  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const content = input.trim();

    // Optimistic user message
    addMessage({
      role: "user",
      content,
    });

    setInput("");
    setError(null);
    startTyping();

    try {
      const res = await api.post<AIUnifiedResponse>(
        "/chat",
        { message: content }
      );

      if (!res || !res.data) {
        throw new Error("Empty AI response");
      }

      const aiResponse = res.data;

      // Assistant message
      addMessage({
        role: "assistant",
        content: aiResponse.message,
      });

      // Execute planner / analytics actions
      handleAIResponse(aiResponse);

    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.message || "Failed to send message");
    } finally {
      stopTyping();
    }
  };

  return {
    messages,
    input,
    setInput,
    sendMessage,
    error,
  };
};
