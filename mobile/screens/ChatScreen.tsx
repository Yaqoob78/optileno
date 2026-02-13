// mobile/screens/ChatScreen.tsx
/**
 * Chat Screen
 * AI agent chat interface with real-time messaging
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { RealtimeService } from '../services/RealtimeService';

export default function ChatScreen() {
  const { colors, spacing } = useAppTheme();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [agentMode, setAgentMode] = useState('CHAT');

  useEffect(() => {
    RealtimeService.on('chat:message', (data) => {
      setMessages((prev: any) => [...prev, data]);
    });
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      content: inputText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev: any) => [...prev, userMessage]);
    setInputText('');

    // Send to agent
    RealtimeService.emitToServer('chat:message', {
      message: inputText,
      mode: agentMode,
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modeSelector: {
      flexDirection: 'row',
      padding: spacing.md,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      gap: spacing.sm,
    },
    modeButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: spacing.sm,
      backgroundColor: colors.card,
    },
    modeButtonActive: {
      backgroundColor: colors.primary,
    },
    modeButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    modeButtonTextActive: {
      color: colors.text,
    },
    messagesList: {
      flex: 1,
      padding: spacing.md,
    },
    messageBubble: {
      marginBottom: spacing.md,
      maxWidth: '85%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: spacing.md,
      padding: spacing.md,
    },
    agentMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: spacing.md,
      padding: spacing.md,
    },
    messageText: {
      color: colors.text,
      fontSize: 14,
    },
    inputContainer: {
      flexDirection: 'row',
      padding: spacing.md,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: spacing.md,
      alignItems: 'flex-end',
    },
    input: {
      flex: 1,
      backgroundColor: colors.card,
      color: colors.text,
      borderRadius: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonText: {
      color: colors.text,
      fontSize: 16,
    },
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={styles.modeSelector}>
        {['CHAT', 'PLAN', 'ANALYZE', 'TASK'].map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeButton,
              agentMode === mode && styles.modeButtonActive,
            ]}
            onPress={() => setAgentMode(mode)}
          >
            <Text
              style={[
                styles.modeButtonText,
                agentMode === mode && styles.modeButtonTextActive,
              ]}
            >
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        style={styles.messagesList}
        data={messages}
        keyExtractor={(item: any) => item.id.toString()}
        renderItem={({ item }: { item: any }) => (
          <View
            style={[
              styles.messageBubble,
              item.sender === 'user' ? styles.userMessage : styles.agentMessage,
            ]}
          >
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
