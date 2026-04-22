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
});
