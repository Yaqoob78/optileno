import { useEffect, useCallback } from 'react';
import { useAnalyticsStore } from '../stores/analytics.store';
import { analyticsService } from '../services/api/analytics.service';
import { AppEvent, EventFactory } from '../types/events.types';

export const useAnalytics = () => {
  const {
    addEvent,
    startFocusSession,
    endFocusSession,
    recordInterruption,
    syncWithBackend,
    currentMetrics,
    insights,
    detectedPatterns,
    isLoading,
  } = useAnalyticsStore();

  // Initialize analytics on mount
  useEffect(() => {
    // Auto-sync every 5 minutes
    const syncInterval = setInterval(() => {
      if (!isLoading) {
        syncWithBackend();
      }
    }, 5 * 60 * 1000);

    // Cleanup
    return () => clearInterval(syncInterval);
  }, [isLoading, syncWithBackend]);

  // Track page views
  useEffect(() => {
    const trackPageView = () => {
      const event: AppEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'analytics_event',
        subtype: 'behavior_change_detected',
        insight: {
          title: 'Page View',
          description: `User viewed ${window.location.pathname}`,
          confidence: 1,
          impact: 'low',
          category: 'productivity',
        },
        patterns: {
          frequency: 1,
        },
        metadata: {
          derivedFrom: [],
          firstObserved: new Date(),
          lastObserved: new Date(),
          page: window.location.pathname,
          referrer: document.referrer,
        },
        timestamp: new Date(),
        sessionId: sessionStorage.getItem('analytics_session_id') || 'unknown',
        source: 'system',
      };

      addEvent(event);
      analyticsService.submitEvent(event);
    };

    trackPageView();
  }, [addEvent]);

  // Event emission helpers
  const emitTaskEvent = useCallback((taskId: string, task: any) => {
    const event = EventFactory.taskStarted(taskId, task);
    addEvent(event);
    analyticsService.submitEvent(event);
  }, [addEvent]);

  const emitHabitEvent = useCallback((habitId: string, habit: any, streakCount: number) => {
    const event = EventFactory.habitCompleted(habitId, habit, streakCount);
    addEvent(event);
    analyticsService.submitEvent(event);
  }, [addEvent]);

  const emitChatEvent = useCallback((
    messageId: string,
    conversationId: string,
    text: string,
    mode: any,
    sentiment: any,
    intent: any
  ) => {
    const event = EventFactory.chatMessageSent(
      messageId,
      conversationId,
      text,
      mode,
      sentiment,
      intent
    );
    addEvent(event);
    analyticsService.submitEvent(event);
  }, [addEvent]);

  // Focus session management
  const startFocusTracking = useCallback((taskId?: string) => {
    startFocusSession(taskId);
  }, [startFocusSession]);

  const stopFocusTracking = useCallback(() => {
    endFocusSession();
  }, [endFocusSession]);

  const trackInterruption = useCallback(() => {
    recordInterruption();
  }, [recordInterruption]);

  // Real-time metrics access
  const getFocusMetrics = useCallback(() => {
    return {
      score: currentMetrics.focusScore,
      decayRate: currentMetrics.focusDecayRate,
      deepWorkRatio: currentMetrics.deepWorkRatio,
      averageDuration: currentMetrics.averageFocusDuration,
    };
  }, [currentMetrics]);

  const getPlanningMetrics = useCallback(() => {
    return {
      accuracy: currentMetrics.planningAccuracy,
      executionRatio: currentMetrics.executionRatio,
      overplanningIndex: currentMetrics.overplanningIndex,
      procrastinationScore: currentMetrics.procrastinationScore,
    };
  }, [currentMetrics]);

  const getConsistencyMetrics = useCallback(() => {
    return {
      habitConsistency: currentMetrics.habitConsistency,
      streakVariance: currentMetrics.streakVariance,
      routineStability: currentMetrics.routineStability,
    };
  }, [currentMetrics]);

  // Pattern detection
  const getActivePatterns = useCallback(() => {
    return detectedPatterns.filter(pattern =>
      new Date().getTime() - pattern.lastSeen.getTime() < 7 * 24 * 60 * 60 * 1000
    );
  }, [detectedPatterns]);

  // Insight access
  const getRecentInsights = useCallback((limit: number = 5) => {
    return insights.slice(-limit).reverse();
  }, [insights]);

  // Manual sync
  const manualSync = useCallback(async () => {
    await syncWithBackend();
  }, [syncWithBackend]);

  return {
    // Event Emission
    emitTaskEvent,
    emitHabitEvent,
    emitChatEvent,

    // Focus Tracking
    startFocusTracking,
    stopFocusTracking,
    trackInterruption,

    // Metrics Access
    getFocusMetrics,
    getPlanningMetrics,
    getConsistencyMetrics,
    getAllMetrics: () => currentMetrics,

    // Patterns & Insights
    getActivePatterns,
    getRecentInsights,

    // System
    isLoading,
    manualSync,

    // Direct store access (for advanced use)
    store: useAnalyticsStore,
  };
};

// Specialized hooks for common use cases
export const useFocusAnalytics = () => {
  const { startFocusTracking, stopFocusTracking, trackInterruption, getFocusMetrics } = useAnalytics();

  return {
    startFocusTracking,
    stopFocusTracking,
    trackInterruption,
    getFocusMetrics,
  };
};

export const useTaskAnalytics = () => {
  const { emitTaskEvent, getPlanningMetrics } = useAnalytics();

  return {
    emitTaskEvent,
    getPlanningMetrics,
  };
};

export const useHabitAnalytics = () => {
  const { emitHabitEvent, getConsistencyMetrics } = useAnalytics();

  return {
    emitHabitEvent,
    getConsistencyMetrics,
  };
};

export const useChatAnalytics = () => {
  const { emitChatEvent } = useAnalytics();

  return {
    emitChatEvent,
  };
};

export const useInsights = () => {
  const { getRecentInsights, getActivePatterns } = useAnalytics();

  return {
    getRecentInsights,
    getActivePatterns,
  };
};