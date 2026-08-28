jest.mock('../services/api/planner.service', () => ({
  plannerApi: {
    getTasks: jest.fn(),
    getGoals: jest.fn(),
    getHabits: jest.fn(),
    onTaskCreated: jest.fn(),
    onTaskUpdated: jest.fn(),
    onTaskDeleted: jest.fn(),
    onHabitCreated: jest.fn(),
    onGoalCreated: jest.fn(),
    onGoalUpdated: jest.fn(),
    onHabitCompleted: jest.fn(),
    onGoalProgressChanged: jest.fn(),
    onDeepWorkStarted: jest.fn(),
    onPlanGenerated: jest.fn(),
  },
}));

jest.mock('../services/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    clearAuthTokens: jest.fn(),
    setAuthTokens: jest.fn(),
  },
}));

jest.mock('../services/realtime/socket-client', () => ({
  realtimeClient: {
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn(),
  },
  socket: {
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
  },
}));

import { clearSessionScopedData } from '../utils/sessionReset';
import { usePlannerStore } from '../stores/planner.store';
import { useChatStore } from '../stores/chat.store';
import { useAnalyticsStore } from '../stores/analytics.store';

describe('User Data Isolation and Session Reset', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('wipes planner, chat, analytics and localStorage keys completely on reset', () => {
    // 1. Simulate existing user data (e.g. user A's tasks/chats/activities)
    usePlannerStore.setState({
      tasks: [{ id: '1', title: 'Football training', status: 'done', priority: 'high', category: 'sports' }] as any,
    });
    useChatStore.setState({
      conversations: [{ id: 'conv-1', title: 'Football chat', messages: [] }] as any,
    });
    useAnalyticsStore.setState({
      events: [{ id: 'evt-1', type: 'task_event', subtype: 'task_completed', timestamp: new Date() }] as any,
    });

    localStorage.setItem('state-backup', JSON.stringify({ userId: '1', data: 'mock' }));
    localStorage.setItem('optileno_achievements_seen:test@example.com', JSON.stringify(['badge1']));
    sessionStorage.setItem('emergency-backup', 'mock');

    expect(usePlannerStore.getState().tasks.length).toBe(1);
    expect(useChatStore.getState().conversations.length).toBe(1);
    expect(useAnalyticsStore.getState().events.length).toBe(1);

    // 2. Perform session reset
    clearSessionScopedData();

    // 3. Verify all in-memory stores and caches are wiped
    expect(usePlannerStore.getState().tasks.length).toBe(0);
    expect(useChatStore.getState().conversations.length).toBe(0);
    expect(useAnalyticsStore.getState().events.length).toBe(0);
    expect(localStorage.getItem('state-backup')).toBeNull();
    expect(localStorage.getItem('optileno_achievements_seen:test@example.com')).toBeNull();
    expect(sessionStorage.getItem('emergency-backup')).toBeNull();
  });
});
