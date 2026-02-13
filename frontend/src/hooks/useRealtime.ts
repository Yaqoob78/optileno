// frontend/src/hooks/useRealtime.ts
/**
 * Custom hook for subscribing to real-time events
 * Usage: const { onTaskCreated, onAnalyticsUpdate } = useRealtime();
 */

import { useEffect, useCallback } from 'react';
import { realtimeClient, TaskEvent, DeepWorkEvent, AnalyticsEvent, InsightEvent, NotificationEvent } from '../services/realtime/socket-client';

export function useRealtime() {
  // Task events
  const onTaskCreated = useCallback((callback: (event: TaskEvent) => void) => {
    realtimeClient.on('planner:task:created', callback);
    return () => realtimeClient.off('planner:task:created', callback);
  }, []);

  const onTaskUpdated = useCallback((callback: (event: TaskEvent) => void) => {
    realtimeClient.on('planner:task:updated', callback);
    return () => realtimeClient.off('planner:task:updated', callback);
  }, []);

  const onTaskDeleted = useCallback((callback: (data: { task_id: string; timestamp: string }) => void) => {
    realtimeClient.on('planner:task:deleted', callback);
    return () => realtimeClient.off('planner:task:deleted', callback);
  }, []);

  // Deep Work events
  const onDeepWorkStarted = useCallback((callback: (event: DeepWorkEvent) => void) => {
    realtimeClient.on('planner:deepwork:started', callback);
    return () => realtimeClient.off('planner:deepwork:started', callback);
  }, []);

  const onDeepWorkCompleted = useCallback((callback: (event: DeepWorkEvent) => void) => {
    realtimeClient.on('planner:deepwork:completed', callback);
    return () => realtimeClient.off('planner:deepwork:completed', callback);
  }, []);

  // Habit events
  const onHabitCreated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:habit:created', callback);
    return () => realtimeClient.off('planner:habit:created', callback);
  }, []);

  const onHabitCompleted = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:habit:completed', callback);
    return () => realtimeClient.off('planner:habit:completed', callback);
  }, []);

  const onHabitStreakUpdated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:habit:streak_updated', callback);
    return () => realtimeClient.off('planner:habit:streak_updated', callback);
  }, []);

  // Plan events
  const onPlanGenerated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:plan:generated', callback);
    return () => realtimeClient.off('planner:plan:generated', callback);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // GOAL EVENTS (NEW - for real-time goal tracking)
  // ═══════════════════════════════════════════════════════════════════

  const onGoalCreated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:goal:created', callback);
    return () => realtimeClient.off('planner:goal:created', callback);
  }, []);

  const onGoalUpdated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('planner:goal:updated', callback);
    return () => realtimeClient.off('planner:goal:updated', callback);
  }, []);

  const onGoalProgressChanged = useCallback((callback: (data: {
    goal_id: string;
    progress: number;
    previous_progress: number;
    timestamp: string;
  }) => void) => {
    realtimeClient.on('planner:goal:progress_changed', callback);
    return () => realtimeClient.off('planner:goal:progress_changed', callback);
  }, []);

  const onGoalMilestoneReached = useCallback((callback: (data: {
    goal_id: string;
    milestone: string;
    timestamp: string;
  }) => void) => {
    realtimeClient.on('planner:goal:milestone_reached', callback);
    return () => realtimeClient.off('planner:goal:milestone_reached', callback);
  }, []);

  const onGoalCompleted = useCallback((callback: (data: {
    goal_id: string;
    title: string;
    timestamp: string;
  }) => void) => {
    realtimeClient.on('planner:goal:completed', callback);
    return () => realtimeClient.off('planner:goal:completed', callback);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // AI AGENT EVENTS (NEW - for AI suggestions with confirmations)
  // ═══════════════════════════════════════════════════════════════════

  const onAISuggestion = useCallback((callback: (data: {
    suggestion_type: string;
    action_id: string;
    data: any;
    message: string;
    requires_confirmation: boolean;
  }) => void) => {
    realtimeClient.on('ai:suggestion', callback);
    return () => realtimeClient.off('ai:suggestion', callback);
  }, []);

  const onAIActionConfirmed = useCallback((callback: (data: {
    action_id: string;
    result: any;
  }) => void) => {
    realtimeClient.on('ai:action:confirmed', callback);
    return () => realtimeClient.off('ai:action:confirmed', callback);
  }, []);

  // Analytics events
  const onAnalyticsUpdate = useCallback((callback: (event: AnalyticsEvent) => void) => {
    realtimeClient.on('analytics:update', callback);
    return () => realtimeClient.off('analytics:update', callback);
  }, []);

  // Insight events
  const onInsightGenerated = useCallback((callback: (event: InsightEvent) => void) => {
    realtimeClient.on('analytics:insight', callback);
    return () => realtimeClient.off('analytics:insight', callback);
  }, []);

  // Notification events
  const onNotification = useCallback((callback: (event: NotificationEvent) => void) => {
    realtimeClient.on('notification:new', callback);
    return () => realtimeClient.off('notification:new', callback);
  }, []);

  // Chat events
  const onMessageReceived = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('chat:message:received', callback);
    return () => realtimeClient.off('chat:message:received', callback);
  }, []);

  const onConversationUpdated = useCallback((callback: (data: any) => void) => {
    realtimeClient.on('chat:conversation:updated', callback);
    return () => realtimeClient.off('chat:conversation:updated', callback);
  }, []);

  // Connection status
  const isConnected = useCallback(() => {
    return realtimeClient.isConnected();
  }, []);

  return {
    // Task events
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    // Deep Work events
    onDeepWorkStarted,
    onDeepWorkCompleted,
    // Habit events
    onHabitCreated,
    onHabitCompleted,
    onHabitStreakUpdated,
    // Plan events
    onPlanGenerated,
    // Goal events (NEW)
    onGoalCreated,
    onGoalUpdated,
    onGoalProgressChanged,
    onGoalMilestoneReached,
    onGoalCompleted,
    // AI Agent events (NEW)
    onAISuggestion,
    onAIActionConfirmed,
    // Analytics events
    onAnalyticsUpdate,
    onInsightGenerated,
    // Notification events
    onNotification,
    // Chat events
    onMessageReceived,
    onConversationUpdated,
    // Status
    isConnected,
  };
}

/**
 * Hook to setup realtime connection on mount
 * Usage: useRealtimeConnection(userId, token);
 */
export function useRealtimeConnection(userId: string | null, token?: string) {
  useEffect(() => {
    if (!userId) return;

    // Connect to socket
    realtimeClient
      .connect(userId, token)
      .then(() => {
        console.log('🔌 Real-time connected');
      })
      .catch((error) => {
        console.error('Failed to connect to real-time:', error);
      });

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount, keep connection alive
      // realtimeClient.disconnect();
    };
  }, [userId, token]);
}
