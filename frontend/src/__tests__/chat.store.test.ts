import { useChatStore } from '../stores/chat.store';

describe('useChatStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearAll();
  });

  afterEach(() => {
    useChatStore.getState().clearAll();
  });

  it('keeps the conversation list in sync with active conversation message edits', () => {
    const store = useChatStore.getState();
    const conversation = store.createConversation('Test Chat');

    store.addMessage({
      role: 'user',
      content: 'Hello there',
    });

    let state = useChatStore.getState();
    let listedConversation = state.conversations.find((item) => item.id === conversation.id);

    expect(state.activeConversation?.messages).toHaveLength(1);
    expect(listedConversation?.messages).toHaveLength(1);
    expect(listedConversation?.messages[0]?.content).toBe('Hello there');

    const messageId = String(state.activeConversation?.messages[0]?.id);
    state.editMessage(messageId, 'Hello again');

    state = useChatStore.getState();
    listedConversation = state.conversations.find((item) => item.id === conversation.id);

    expect(state.activeConversation?.messages[0]?.content).toBe('Hello again');
    expect(listedConversation?.messages[0]?.content).toBe('Hello again');

    state.deleteMessage(messageId);

    state = useChatStore.getState();
    listedConversation = state.conversations.find((item) => item.id === conversation.id);

    expect(state.activeConversation?.messages).toHaveLength(0);
    expect(listedConversation?.messages).toHaveLength(0);
  });

  it('updates message metadata cleanly for feedback and streaming status', () => {
    const store = useChatStore.getState();
    store.createConversation('Feedback Test');

    store.addMessage({
      role: 'assistant',
      content: 'Here is the plan.',
    });

    let state = useChatStore.getState();
    const msgId = String(state.activeConversation?.messages[0]?.id);

    state.updateMessageMetadata(msgId, { rating: 1, isStreaming: true });

    state = useChatStore.getState();
    expect(state.activeConversation?.messages[0]?.metadata?.rating).toBe(1);
    expect(state.activeConversation?.messages[0]?.metadata?.isStreaming).toBe(true);

    state.updateMessageMetadata(msgId, { isStreaming: false });
    state = useChatStore.getState();
    expect(state.activeConversation?.messages[0]?.metadata?.rating).toBe(1);
    expect(state.activeConversation?.messages[0]?.metadata?.isStreaming).toBe(false);
  });

  it('truncates conversation from a given index for edit and retry branching', () => {
    const store = useChatStore.getState();
    store.createConversation('Branching Test');

    store.addMessage({ role: 'user', content: 'Message 1' });
    store.addMessage({ role: 'assistant', content: 'Reply 1' });
    store.addMessage({ role: 'user', content: 'Message 2' });
    store.addMessage({ role: 'assistant', content: 'Reply 2' });

    let state = useChatStore.getState();
    expect(state.activeConversation?.messages).toHaveLength(4);

    // Truncate from index 2 (removes Message 2 and Reply 2)
    state.truncateFromIndex(2);

    state = useChatStore.getState();
    expect(state.activeConversation?.messages).toHaveLength(2);
    expect(state.activeConversation?.messages[0]?.content).toBe('Message 1');
    expect(state.activeConversation?.messages[1]?.content).toBe('Reply 1');
  });

  it('preserves empty assistant message shell with waiting/streaming metadata and updates content', () => {
    const store = useChatStore.getState();
    store.createConversation('Streaming Shell Test');

    store.addMessage({ role: 'user', content: 'Help me plan today' });

    const assistantId = 'assistant-shell-123';
    store.addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      metadata: { isStreaming: true, isWaiting: true },
    } as any);

    let state = useChatStore.getState();
    expect(state.activeConversation?.messages).toHaveLength(2);
    const assistantMsg = state.activeConversation?.messages[1];
    expect(assistantMsg?.id).toBe(assistantId);
    expect(assistantMsg?.role).toBe('assistant');
    expect(assistantMsg?.content).toBe('');
    expect(assistantMsg?.metadata?.isStreaming).toBe(true);
    expect(assistantMsg?.metadata?.isWaiting).toBe(true);

    // Update metadata on API response
    state.updateMessageMetadata(assistantId, { isWaiting: false, provider: 'gemini' });
    state = useChatStore.getState();
    expect(state.activeConversation?.messages[1]?.metadata?.isWaiting).toBe(false);
    expect(state.activeConversation?.messages[1]?.metadata?.isStreaming).toBe(true);

    // Stream chunks
    state.editMessage(assistantId, 'Here is');
    state = useChatStore.getState();
    expect(state.activeConversation?.messages[1]?.content).toBe('Here is');

    state.editMessage(assistantId, 'Here is your plan for today.');
    state.updateMessageMetadata(assistantId, { isStreaming: false });
    state = useChatStore.getState();
    expect(state.activeConversation?.messages[1]?.content).toBe('Here is your plan for today.');
    expect(state.activeConversation?.messages[1]?.metadata?.isStreaming).toBe(false);
  });
});
