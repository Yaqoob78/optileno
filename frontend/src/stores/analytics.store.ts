import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api/client';
import {
  AppEvent,
  UserMetrics,
  TaskEvent,
  DeepWorkEvent,
  HabitEvent,
  GoalEvent,
  ChatEvent,
  AnalyticsEvent,
  createEventId
} from '../types/events.types';
import { socket } from '../services/realtime/socket-client';
import { normalizeTaskStatus } from '../services/api/planner.service';

// Helper function for consistency score
function calculateConsistencyScore(streakCount: number): number {
  if (streakCount <= 0) return 0;
  if (streakCount >= 30) return 100;
  return Math.min(100, (streakCount / 30) * 100);
}

let realtimeListenersInitialized = false;
let socketListenersInitialized = false;

// Analytics State
interface AnalyticsState {
  dailyMetrics: Array<{
    date: string;
    productivity: number;
    focus: number;
    stress: number;
  }>;

  // Raw Events Storage
  events: AppEvent[];

  // Real-time Computed Metrics
  currentMetrics: UserMetrics;
  historicalMetrics: UserMetrics[];

  // Derived Insights
  insights: AnalyticsEvent[];

  // AI Strategic Insights (New)
  userInsights: Array<{
    id: string;
    type: 'strategy' | 'warning' | 'kudos';
    content: string;
    title?: string;
    timestamp: Date;
  }>;

  // Patterns & Trends
  detectedPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: 'positive' | 'negative' | 'neutral';
    lastSeen: Date;
  }>;

  // Focus Tracking
  focusSessions: Array<{
    startTime: Date;
    endTime?: Date;
    duration: number;
    quality: number;
    interruptions: number;
    taskId?: string;
  }>;

  // Loading States
  isLoading: boolean;
  lastSynced?: Date;

  // Predictions
  predictions: Array<{
    type: string;
    confidence: number;
    description: string;
    timeframe: string;
  }>;

  // Actions
  addEvent: (event: AppEvent) => void;
  addEvents: (events: AppEvent[]) => void;
  clearEvents: () => void;
  getEventsByType: <T extends AppEvent['type']>(type: T) => AppEvent[];
  getEventsByTimeRange: (start: Date, end: Date) => AppEvent[];

  // Real-time Computation
  computeMetrics: () => UserMetrics;
  detectPatterns: () => void;
  generateInsights: () => AnalyticsEvent[];
  fetchAnalytics: () => Promise<void>;
  fetchHistoricalAnalytics: (timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly') => Promise<void>;
  fetchPredictions: () => Promise<void>;

  // Focus Tracking

  startFocusSession: (taskId?: string) => void;
  endFocusSession: () => void;
  recordInterruption: () => void;

  // Data Export
  exportData: () => {
    events: AppEvent[];
    metrics: UserMetrics[];
    insights: AnalyticsEvent[];
  };

  // Sync with Backend
  syncWithBackend: () => Promise<void>;
  logEvent: (event: string, source: string, metadata?: any) => Promise<void>;

  // Real-time Listeners
  initRealtimeListeners: () => void;
  initSocketListeners: () => void;
}

// Initial Metrics
const initialMetrics: UserMetrics = {
  // Focus & Productivity
  focusScore: 0,
  productivityScore: 0,
  focusDecayRate: 0,
  deepWorkRatio: 0,
  averageFocusDuration: 0,

  // Planning & Execution
  planningAccuracy: 0,
  executionRatio: 0,
  overplanningIndex: 0,
  procrastinationScore: 0,

  // Consistency
  habitConsistency: 0,
  streakVariance: 0,
  routineStability: 0,

  // Energy & Wellbeing
  energyEfficiency: 0,
  burnoutRisk: 0,
  recoveryRate: 0,

  // Time Patterns
  peakProductivityHours: [],
  focusWindows: [],
  distractionPatterns: [],

  // Behavioral Insights
  behavioralPatterns: [],

  lastUpdated: new Date(0),
};

const toDate = (value: unknown, fallback = new Date(0)): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date(fallback.getTime());
};

const normalizeEvent = (event: AppEvent): AppEvent => {
  const timestamp = toDate(event.timestamp);
  const normalizedEvent: AppEvent = {
    ...event,
    timestamp,
  };

  if (normalizedEvent.type === 'goal_event') {
    return {
      ...normalizedEvent,
      goal: {
        ...normalizedEvent.goal,
        targetDate: normalizedEvent.goal.targetDate
          ? toDate(normalizedEvent.goal.targetDate, timestamp)
          : undefined,
      },
    };
  }

  if (normalizedEvent.type === 'analytics_event') {
    return {
      ...normalizedEvent,
      metadata: {
        ...normalizedEvent.metadata,
        firstObserved: toDate(normalizedEvent.metadata.firstObserved, timestamp),
        lastObserved: toDate(normalizedEvent.metadata.lastObserved, timestamp),
      },
    };
  }

  return normalizedEvent;
};

const normalizeMetrics = (metrics?: Partial<UserMetrics>): UserMetrics => ({
  ...initialMetrics,
  ...metrics,
  lastUpdated: toDate(metrics?.lastUpdated, initialMetrics.lastUpdated),
});

const normalizeDetectedPattern = (
  pattern: AnalyticsState['detectedPatterns'][number],
): AnalyticsState['detectedPatterns'][number] => ({
  ...pattern,
  lastSeen: toDate(pattern.lastSeen),
});

const normalizeFocusSession = (
  session: AnalyticsState['focusSessions'][number],
): AnalyticsState['focusSessions'][number] => ({
  ...session,
  startTime: toDate(session.startTime),
  endTime: session.endTime ? toDate(session.endTime, session.startTime) : undefined,
});

const normalizeUserInsight = (
  insight: AnalyticsState['userInsights'][number],
): AnalyticsState['userInsights'][number] => ({
  ...insight,
  timestamp: toDate(insight.timestamp),
});

const toAnalyticsEvent = (event: AnalyticsEvent): AnalyticsEvent =>
  normalizeEvent(event) as AnalyticsEvent;

const getInsightKey = (insight: AnalyticsEvent) =>
  `${insight.subtype}:${insight.insight?.title || ''}:${insight.insight?.description || ''}`;

const mergeInsights = (
  existing: AnalyticsEvent[],
  incoming: AnalyticsEvent[],
): AnalyticsEvent[] => {
  const merged = existing.map(toAnalyticsEvent);
  const seen = new Set(merged.map(getInsightKey));

  incoming.map(toAnalyticsEvent).forEach((insight) => {
    const key = getInsightKey(insight);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(insight);
    }
  });

  return merged.slice(-100);
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      // Initial State
      events: [],
      currentMetrics: initialMetrics,
      historicalMetrics: [],
      insights: [],
      userInsights: [], // Initial empty state
      dailyMetrics: [], // Initial empty state
      predictions: [],
      detectedPatterns: [],
      focusSessions: [],
      isLoading: false,

      // Actions
      addEvent: (event) => {
        set((state) => {
          const normalizedEvent = normalizeEvent(event);
          const newEvents = [...state.events, normalizedEvent].slice(-1000);

          return {
            events: newEvents,
            currentMetrics: computeRealTimeMetrics(newEvents, state.focusSessions),
          };
        });

        // Async pattern detection
        setTimeout(() => {
          get().detectPatterns();
        }, 0);
      },

      addEvents: (events) => {
        set((state) => {
          const normalizedEvents = events.map((event) => normalizeEvent(event));
          const newEvents = [...state.events, ...normalizedEvents].slice(-1000);

          return {
            events: newEvents,
            currentMetrics: computeRealTimeMetrics(newEvents, state.focusSessions),
          };
        });

        setTimeout(() => {
          get().detectPatterns();
        }, 0);
      },

      clearEvents: () => {
        set({
          events: [],
          currentMetrics: initialMetrics,
          historicalMetrics: [],
          insights: [],
          detectedPatterns: [],
        });
      },

      // Initialize real-time listeners
      initRealtimeListeners: () => {
        if (typeof window === 'undefined' || realtimeListenersInitialized) {
          return;
        }

        realtimeListenersInitialized = true;

        // Listen for planner events that affect analytics
        window.addEventListener('task_created', (e: any) => {
          const task = e.detail;
          const normalizedStatus = normalizeTaskStatus(task.status);
          const plannedDuration = Number(
            task.estimatedDuration ??
            task.plannedDuration ??
            task.estimated_duration_minutes ??
            task.duration ??
            60,
          );
          const event: TaskEvent = {
            id: `task_created_${Date.now()}`,
            type: 'task_event',
            subtype: 'task_created',
            timestamp: new Date(),
            taskId: task.id,
            task: {
              title: task.title,
              plannedDuration,
              status: normalizedStatus === 'done'
                ? 'completed'
                : normalizedStatus === 'in-progress'
                  ? 'in-progress'
                  : 'planned',
              category: task.category || 'work',
              priority: task.priority || 'medium',
              energy: task.energy || 'medium',
              tags: task.tags || []
            },
            metrics: {
              startTimeOfDay: new Date().getHours()
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { taskId: task.id, title: task.title }
          };
          get().addEvent(event);
        });

        window.addEventListener('task_updated', (e: any) => {
          const task = e.detail;
          const normalizedStatus = normalizeTaskStatus(task.status);
          const plannedDuration = Number(
            task.estimatedDuration ??
            task.plannedDuration ??
            task.estimated_duration_minutes ??
            task.duration ??
            60,
          );
          const event: TaskEvent = {
            id: `task_updated_${Date.now()}`,
            type: 'task_event',
            subtype: normalizedStatus === 'done'
              ? 'task_completed'
              : normalizedStatus === 'in-progress'
                ? 'task_started'
                : 'task_edited',
            timestamp: new Date(),
            taskId: task.id,
            task: {
              title: task.title,
              plannedDuration,
              status: normalizedStatus === 'done'
                ? 'completed'
                : normalizedStatus === 'in-progress'
                  ? 'in-progress'
                  : 'planned',
              category: task.category || 'work',
              priority: task.priority || 'medium',
              energy: task.energy || 'medium',
              tags: task.tags || []
            },
            metrics: {
              startTimeOfDay: new Date().getHours()
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { taskId: task.id, status: normalizedStatus }
          };
          get().addEvent(event);
        });

        window.addEventListener('goal_created', (e: any) => {
          const goal = e.detail;
          const progress = goal.progress ?? goal.current_progress ?? 0;
          const event: GoalEvent = {
            id: `goal_created_${Date.now()}`,
            type: 'goal_event',
            subtype: 'goal_created',
            timestamp: new Date(),
            goalId: goal.id,
            goal: {
              title: goal.title,
              targetDate: goal.targetDate || goal.target_date,
              progress,
              category: goal.category || 'personal',
              priority: goal.priority || 'medium'
            },
            metrics: {
              progressChange: 0,
              velocity: 0
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { goalId: goal.id, title: goal.title }
          };
          get().addEvent(event);
        });

        window.addEventListener('goal_updated', (e: any) => {
          const goal = e.detail;
          const progress = goal.progress ?? goal.current_progress ?? 0;
          const event: GoalEvent = {
            id: `goal_updated_${Date.now()}`,
            type: 'goal_event',
            subtype: 'goal_progressed',
            timestamp: new Date(),
            goalId: goal.id,
            goal: {
              title: goal.title,
              targetDate: goal.targetDate || goal.target_date,
              progress,
              category: goal.category || 'personal',
              priority: goal.priority || 'medium'
            },
            metrics: {
              progressChange: goal.progressChange ?? goal.progress_change ?? 0,
              velocity: 0
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { goalId: goal.id, progress }
          };
          get().addEvent(event);
        });

        window.addEventListener('habit_created', (e: any) => {
          const habit = e.detail;
          const event: HabitEvent = {
            id: `habit_created_${Date.now()}`,
            type: 'habit_event',
            subtype: 'habit_created',
            timestamp: new Date(),
            habitId: habit.id,
            habit: {
              title: habit.name || habit.title,
              frequency: habit.frequency || 'daily',
              category: habit.category || 'health',
              difficulty: habit.difficulty || 'medium'
            },
            metrics: {
              streakCount: 0,
              streakMaintained: true,
              timeOfDay: new Date().getHours(),
              consistencyScore: 0
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { habitId: habit.id, name: habit.name }
          };
          get().addEvent(event);
        });

        window.addEventListener('habit_completed', (e: any) => {
          const habit = e.detail;
          const streakCount = habit.streak ?? habit.currentStreak ?? 0;
          const event: HabitEvent = {
            id: `habit_completed_${Date.now()}`,
            type: 'habit_event',
            subtype: 'habit_completed',
            timestamp: new Date(),
            habitId: habit.id,
            habit: {
              title: habit.name || habit.title,
              frequency: habit.frequency || 'daily',
              category: habit.category || 'health',
              difficulty: habit.difficulty || 'medium'
            },
            metrics: {
              streakCount,
              streakMaintained: true,
              timeOfDay: new Date().getHours(),
              consistencyScore: calculateConsistencyScore(streakCount)
            },
            sessionId: `session_${Date.now()}`,
            source: 'planner',
            metadata: { habitId: habit.id, name: habit.name || habit.title, streak: streakCount }
          };
          get().addEvent(event);
        });
      },

      // Initialize socket listeners for real-time updates
      initSocketListeners: () => {
        if (socketListenersInitialized) {
          return;
        }

        socketListenersInitialized = true;

        // Subscribe to analytics updates from backend
        socket.on('analytics:updated', (data: any) => {
          // Update metrics from backend broadcast
          if (data?.metrics) {
            set((state) => ({
              currentMetrics: {
                ...state.currentMetrics,
                ...data.metrics,
                lastUpdated: new Date(),
              },
            }));
          }
          // Add event to local store
          if (data?.event) {
            const event: AnalyticsEvent = {
              id: `socket_${Date.now()}`,
              type: 'analytics_event',
              subtype: data.event,
              timestamp: new Date(),
              insight: {
                title: data.title || 'Analytics Update',
                description: data.description || 'Analytics data updated',
                confidence: 0.8,
                impact: 'medium',
                category: 'productivity'
              },
              patterns: {
                frequency: 1
              },
              sessionId: `session_${Date.now()}`,
              source: 'system',
              metadata: {
                derivedFrom: [],
                firstObserved: new Date(),
                lastObserved: new Date(),
                ...data.metadata
              }
            };
            get().addEvent(event);
          }
        });

        // Subscribe to focus score updates
        socket.on('focus_score_updated', (data: any) => {
          if (data?.focus !== undefined) {
            set((state) => ({
              currentMetrics: {
                ...state.currentMetrics,
                focusScore: data.focus,
                lastUpdated: new Date(),
              },
            }));
          }
        });
      },

      getEventsByType: (type) => {
        return get().events.filter(event => event.type === type);
      },

      getEventsByTimeRange: (start, end) => {
        return get().events.filter(event =>
          new Date(event.timestamp) >= start && new Date(event.timestamp) <= end
        );
      },

      computeMetrics: () => {
        const { events, focusSessions } = get();
        const metrics = computeRealTimeMetrics(events, focusSessions);
        set({ currentMetrics: metrics });
        return metrics;
      },

      detectPatterns: () => {
        const { events } = get();
        const patterns = detectBehavioralPatterns(events);

        set({ detectedPatterns: patterns });

        // Generate insights from patterns
        const insights = generatePatternInsights(patterns, events);
        if (insights.length > 0) {
          set((state) => ({
            insights: mergeInsights(state.insights, insights),
          }));
        }
      },

      generateInsights: () => {
        const { events, currentMetrics } = get();
        const insights = generateAnalyticsInsights(events, currentMetrics);

        set((state) => ({
          insights: mergeInsights(state.insights, insights),
        }));

        return insights;
      },

      fetchAnalytics: async () => {
        // Stale-while-revalidate: Don't set isLoading=true immediately if we have data
        // This prevents the UI from flashing "Loading..." or empty states on refresh
        const hasData = get().events.length > 0 || get().currentMetrics.focusScore > 0;
        if (!hasData) {
          set({ isLoading: true });
        }

        try {
          // Direct call to API since we need custom parsing
          const response = await api.get<any>('/analytics/comprehensive');

          if (response.success && response.data) {
            const data = response.data;
            const backendMetrics = data.metrics || {};

            // Map nested backend metrics to flat UserMetrics
            const mappedMetrics: UserMetrics = {
              ...get().currentMetrics,

              // Focus
              focusScore: backendMetrics.focus?.score ?? get().currentMetrics.focusScore,
              productivityScore: backendMetrics.productivity?.score ?? get().currentMetrics.productivityScore,
              averageFocusDuration: backendMetrics.focus?.average_session ?? get().currentMetrics.averageFocusDuration,

              // Planning
              planningAccuracy: backendMetrics.planning?.accuracy ?? get().currentMetrics.planningAccuracy,

              // Consistency
              habitConsistency: backendMetrics.consistency?.consistency_score ?? get().currentMetrics.habitConsistency,

              // Wellbeing
              burnoutRisk: backendMetrics.wellbeing?.burnout_risk ?? get().currentMetrics.burnoutRisk,

              // Preserve other calculated fields that might not be in backend response
              lastUpdated: new Date(data.last_updated || Date.now()),
            };

            // Map Insights
            const mappedInsights = (data.insights || []).map((i: any) => ({
              id: i.id?.toString() || createEventId(),
              type: i.type === 'achievement' ? 'kudos' : i.type === 'warning' ? 'warning' : 'strategy',
              content: i.description || i.title,
              timestamp: new Date(i.generated_at || Date.now()),
              title: i.title,
              actionItems: i.action_items || []
            }));

            // Map Patterns
            const mappedPatterns = (data.patterns || []).map((p: any) => ({
              pattern: p.type,
              frequency: p.frequency || 1,
              impact: 'neutral', // Backend doesn't fully give impact yet
              lastSeen: new Date(p.last_detected || Date.now())
            }));

            // Store historical data
            set({
              isLoading: false,
              userInsights: mappedInsights.length > 0
                ? mappedInsights.map((insight: any) => normalizeUserInsight(insight))
                : get().userInsights,
              currentMetrics: normalizeMetrics(mappedMetrics),
              detectedPatterns: mappedPatterns.length > 0
                ? mappedPatterns.map((pattern: any) => normalizeDetectedPattern(pattern))
                : get().detectedPatterns,
              historicalMetrics: [...get().historicalMetrics, normalizeMetrics(mappedMetrics)].slice(-50),
              lastSynced: new Date()
            });
          } else {
            console.error('Failed to fetch analytics');
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Error fetching analytics:', error);
          set({ isLoading: false });
        }
        get().fetchPredictions(); // Trigger predictions fetch as part of main fetch
      },

      fetchHistoricalAnalytics: async (timeRange: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
        try {
          const response = await api.get<any>(`/analytics/historical/${timeRange}`);

          if (response.success && response.data) {
            const historicalData = response.data;

            // Update state with historical data based on time range
            set((state) => ({
              historicalMetrics: [
                ...state.historicalMetrics,
                ...historicalData.focus_scores?.map((score: any) => ({
                  ...state.currentMetrics,
                  focusScore: score.score,
                  lastUpdated: new Date(score.date),
                })) || []
              ].slice(-50), // Keep only last 50 entries to prevent memory issues
            }));
          }
        } catch (error) {
          console.error(`Error fetching ${timeRange} analytics:`, error);
        }
      },


      fetchPredictions: async () => {
        try {
          // We can use the service or api client directly. Service expects format but we can use api client for raw response check
          const response = await api.get<any>('/analytics/predictions');
          if (response.success && response.data) {
            set({ predictions: response.data });
          }
        } catch (error) {
          console.error('Failed to fetch predictions:', error);
        }
      },

      startFocusSession: (taskId) => {
        const sessionId = createEventId();
        const session = {
          startTime: new Date(),
          duration: 0,
          quality: 0,
          interruptions: 0,
          taskId,
        };

        set((state) => ({
          focusSessions: [...state.focusSessions, session],
        }));

        // Emit focus event
        const event: DeepWorkEvent = {
          id: createEventId(),
          type: 'deep_work_event',
          subtype: 'focus_zone_entered',
          sessionId: sessionId,
          metrics: {
            duration: 0,
            interruptions: 0,
            focusScore: 8,
            energyBefore: 'medium',
            energyAfter: 'medium',
            timeOfDay: new Date().getHours(),
          },
          context: { taskId },
          timestamp: new Date(),
          source: 'planner',
          metadata: {
            sessionType: 'focus_start',
            taskId
          },
        };

        get().addEvent(event);
      },

      endFocusSession: () => {
        const { focusSessions } = get();
        if (focusSessions.length === 0) return;

        const lastSession = focusSessions[focusSessions.length - 1];
        if (lastSession.endTime) return;

        const endTime = new Date();
        const duration = (endTime.getTime() - lastSession.startTime.getTime()) / (1000 * 60); // minutes

        const updatedSessions = [...focusSessions];
        updatedSessions[updatedSessions.length - 1] = {
          ...lastSession,
          endTime,
          duration,
          quality: calculateSessionQuality(duration, lastSession.interruptions),
        };

        set({ focusSessions: updatedSessions });

        // Emit deep work event
        const event: DeepWorkEvent = {
          id: createEventId(),
          type: 'deep_work_event',
          subtype: 'deep_work_completed',
          sessionId: createEventId(),
          metrics: {
            duration,
            interruptions: lastSession.interruptions,
            focusScore: Math.max(1, 10 - lastSession.interruptions * 2),
            energyBefore: 'medium',
            energyAfter: lastSession.interruptions > 3 ? 'low' : 'medium',
            timeOfDay: new Date().getHours(),
          },
          context: { taskId: lastSession.taskId },
          timestamp: new Date(),
          source: 'planner',
          metadata: {
            sessionType: 'focus_completed',
            duration,
            interruptions: lastSession.interruptions,
          },
        };

        get().addEvent(event);
      },

      recordInterruption: () => {
        const { focusSessions } = get();
        if (focusSessions.length === 0) return;

        const updatedSessions = [...focusSessions];
        const lastIndex = updatedSessions.length - 1;
        updatedSessions[lastIndex] = {
          ...updatedSessions[lastIndex],
          interruptions: updatedSessions[lastIndex].interruptions + 1,
        };

        set({ focusSessions: updatedSessions });

        // Emit interruption event
        const event: DeepWorkEvent = {
          id: createEventId(),
          type: 'deep_work_event',
          subtype: 'deep_work_interrupted',
          sessionId: createEventId(),
          metrics: {
            duration: 0,
            interruptions: updatedSessions[lastIndex].interruptions,
            focusScore: Math.max(1, 8 - updatedSessions[lastIndex].interruptions),
            energyBefore: 'medium',
            energyAfter: 'medium',
            timeOfDay: new Date().getHours(),
          },
          context: { taskId: updatedSessions[lastIndex].taskId },
          timestamp: new Date(),
          source: 'planner',
          metadata: {
            sessionType: 'interruption',
            interruptionCount: updatedSessions[lastIndex].interruptions,
          },
        };

        get().addEvent(event);
      },

      exportData: () => {
        const { events, historicalMetrics, insights } = get();
        return {
          events,
          metrics: historicalMetrics,
          insights,
        };
      },

      syncWithBackend: async () => {
        set({ isLoading: true });

        try {
          const data = get().exportData();
          const response = await api.post('/analytics/sync', data);

          if (response.success && response.data) {
            const syncPayload = response.data as any;
            const backendInsights = Array.isArray(syncPayload)
              ? syncPayload
              : Array.isArray(syncPayload.insights)
                ? syncPayload.insights
                : [];

            // Merge backend insights
            set((state) => ({
              insights: backendInsights.length > 0
                ? mergeInsights(state.insights, backendInsights as AnalyticsEvent[])
                : state.insights,
              lastSynced: new Date(),
            }));
          }
        } catch (error) {
          console.error('Failed to sync with backend:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      logEvent: async (event, source, metadata = {}) => {
        try {
          await api.post('/analytics/events', {
            event,
            source,
            metadata
          });
          // After logging a significant event, refresh analytics to see changes
          if (['analytics_engagement', 'task_completed', 'habit_completed'].includes(event)) {
            get().fetchAnalytics();
          }
        } catch (error) {
          console.error('Failed to log event:', error);
        }
      },
    }),
    {
      name: 'analytics-storage',
      partialize: (state) => ({
        events: state.events.slice(-1000), // Keep last 1000 events
        historicalMetrics: state.historicalMetrics.slice(-100), // Keep last 100 metrics
        insights: state.insights.slice(-50), // Keep last 50 insights
        detectedPatterns: state.detectedPatterns,
        focusSessions: state.focusSessions.slice(-50), // Keep last 50 sessions
      }),
      merge: (persistedState, currentState) => {
        const typedState = (persistedState || {}) as Partial<AnalyticsState>;
        const events = Array.isArray(typedState.events)
          ? typedState.events.map((event) => normalizeEvent(event as AppEvent)).slice(-1000)
          : currentState.events;
        const focusSessions = Array.isArray(typedState.focusSessions)
          ? typedState.focusSessions.map((session) =>
              normalizeFocusSession(session as AnalyticsState['focusSessions'][number]),
            ).slice(-50)
          : currentState.focusSessions;
        const historicalMetrics = Array.isArray(typedState.historicalMetrics)
          ? typedState.historicalMetrics.map((metrics) => normalizeMetrics(metrics)).slice(-100)
          : currentState.historicalMetrics;
        const insights = Array.isArray(typedState.insights)
          ? typedState.insights.map((insight) => toAnalyticsEvent(insight as AnalyticsEvent)).slice(-50)
          : currentState.insights;
        const detectedPatterns =
          Array.isArray(typedState.detectedPatterns) && typedState.detectedPatterns.length > 0
            ? typedState.detectedPatterns.map((pattern) =>
                normalizeDetectedPattern(pattern as AnalyticsState['detectedPatterns'][number]),
              )
            : detectBehavioralPatterns(events);
        const userInsights = Array.isArray(typedState.userInsights)
          ? typedState.userInsights.map((insight) =>
              normalizeUserInsight(insight as AnalyticsState['userInsights'][number]),
            )
          : currentState.userInsights;
        const currentMetrics =
          events.length > 0 || focusSessions.length > 0
            ? computeRealTimeMetrics(events, focusSessions)
            : normalizeMetrics(typedState.currentMetrics);

        return {
          ...currentState,
          ...typedState,
          events,
          focusSessions,
          historicalMetrics,
          insights,
          detectedPatterns,
          userInsights,
          currentMetrics,
          lastSynced: typedState.lastSynced
            ? toDate(typedState.lastSynced)
            : currentState.lastSynced,
        };
      },
    }
  )
);

// Initialize real-time listeners after store is created
useAnalyticsStore.getState().initRealtimeListeners();
useAnalyticsStore.getState().initSocketListeners();

// ==============================
// REAL-TIME COMPUTATION FUNCTIONS
// ==============================

function computeRealTimeMetrics(events: AppEvent[], focusSessions: AnalyticsState['focusSessions']): UserMetrics {
  // Filter events from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentEvents = events.filter(e => new Date(e.timestamp) >= sevenDaysAgo);

  // Extract event types
  const taskEvents = recentEvents.filter((e): e is TaskEvent => e.type === 'task_event');
  const habitEvents = recentEvents.filter((e): e is HabitEvent => e.type === 'habit_event');
  const deepWorkEvents = recentEvents.filter((e): e is DeepWorkEvent => e.type === 'deep_work_event');
  const chatEvents = recentEvents.filter((e): e is ChatEvent => e.type === 'chat_event');
  const focusScore = computeFocusScore(deepWorkEvents, focusSessions);
  const planningAccuracy = computePlanningAccuracy(taskEvents);
  const habitConsistency = computeHabitConsistency(habitEvents);

  // Compute metrics
  return {
    // Focus & Productivity
    focusScore,
    productivityScore: (focusScore + planningAccuracy + habitConsistency) / 3,
    focusDecayRate: computeFocusDecayRate(deepWorkEvents),
    deepWorkRatio: computeDeepWorkRatio(deepWorkEvents, taskEvents),
    averageFocusDuration: computeAverageFocusDuration(focusSessions),

    // Planning & Execution
    planningAccuracy,
    executionRatio: computeExecutionRatio(taskEvents),
    overplanningIndex: computeOverplanningIndex(taskEvents),
    procrastinationScore: computeProcrastinationScore(taskEvents, chatEvents),

    // Consistency
    habitConsistency,
    streakVariance: computeStreakVariance(habitEvents),
    routineStability: computeRoutineStability(taskEvents, habitEvents),

    // Energy & Wellbeing
    energyEfficiency: computeEnergyEfficiency(taskEvents, deepWorkEvents),
    burnoutRisk: computeBurnoutRisk(chatEvents, taskEvents),
    recoveryRate: computeRecoveryRate(deepWorkEvents, taskEvents),

    // Time Patterns
    peakProductivityHours: computePeakProductivityHours(taskEvents, deepWorkEvents),
    focusWindows: computeFocusWindows(focusSessions),
    distractionPatterns: computeDistractionPatterns(deepWorkEvents),

    // Behavioral Insights
    behavioralPatterns: detectBehavioralPatterns(recentEvents),

    lastUpdated: new Date(),
  };
}

function computeFocusScore(deepWorkEvents: DeepWorkEvent[], focusSessions: AnalyticsState['focusSessions']): number {
  if (focusSessions.length === 0) return 0;

  const recentSessions = focusSessions.slice(-10);
  const avgQuality = recentSessions.reduce((sum, s) => sum + (s.quality || 0), 0) / recentSessions.length;
  return Math.min(100, avgQuality * 10);
}

function computeFocusDecayRate(deepWorkEvents: DeepWorkEvent[]): number {
  const interruptedSessions = deepWorkEvents.filter(e => e.subtype === 'deep_work_interrupted');
  if (interruptedSessions.length === 0) return 0;

  return Math.min(50, interruptedSessions.length * 5);
}

function computeDeepWorkRatio(deepWorkEvents: DeepWorkEvent[], taskEvents: TaskEvent[]): number {
  const completedTasks = taskEvents.filter(e => e.subtype === 'task_completed').length;
  const deepWorkSessions = deepWorkEvents.filter(e =>
    e.subtype === 'deep_work_completed' && e.metrics.duration > 25
  ).length;

  if (completedTasks === 0) return 0;
  return Math.min(100, (deepWorkSessions / completedTasks) * 100);
}

function computeAverageFocusDuration(focusSessions: AnalyticsState['focusSessions']): number {
  const completedSessions = focusSessions.filter(s => s.endTime);
  if (completedSessions.length === 0) return 0;

  const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  return totalDuration / completedSessions.length;
}

function computePlanningAccuracy(taskEvents: TaskEvent[]): number {
  const completedTasks = taskEvents.filter(e => e.subtype === 'task_completed');
  if (completedTasks.length === 0) return 0;

  const accurateTasks = completedTasks.filter(e =>
    e.metrics.delay !== undefined && e.metrics.delay <= 15 // within 15 minutes
  );

  return Math.min(100, (accurateTasks.length / completedTasks.length) * 100);
}

function computeExecutionRatio(taskEvents: TaskEvent[]): number {
  const completedTasks = taskEvents.filter(e => e.subtype === 'task_completed');
  if (completedTasks.length === 0) return 0;

  const totalPlanned = completedTasks.reduce((sum, e) => sum + e.task.plannedDuration, 0);
  const totalActual = completedTasks.reduce((sum, e) => sum + (e.metrics.completionTime || e.task.plannedDuration), 0);

  if (totalActual === 0) return 1;
  return Math.min(2, totalPlanned / totalActual); // Ratio > 1 means faster than planned
}

function computeOverplanningIndex(taskEvents: TaskEvent[]): number {
  const plannedTasks = taskEvents.filter(e => e.subtype === 'task_created');
  const completedTasks = taskEvents.filter(e => e.subtype === 'task_completed');

  if (plannedTasks.length === 0) return 0;

  const completionRate = completedTasks.length / plannedTasks.length;
  return Math.min(100, (1 - completionRate) * 100);
}

function computeProcrastinationScore(taskEvents: TaskEvent[], chatEvents: ChatEvent[]): number {
  const delayedTasks = taskEvents.filter(e =>
    e.subtype === 'task_delayed' || e.subtype === 'task_overdue'
  ).length;

  const totalTasks = taskEvents.filter(e =>
    e.subtype === 'task_created' || e.subtype === 'task_started'
  ).length;

  if (totalTasks === 0) return 0;

  const procrastinationFromTasks = (delayedTasks / totalTasks) * 100;

  // Add chat-based procrastination detection
  const procrastinationChats = chatEvents.filter(e =>
    e.analysis.intent === 'venting' &&
    e.analysis.sentiment === 'frustrated' &&
    e.content.text.toLowerCase().includes('procrastinat')
  ).length;

  return Math.min(100, procrastinationFromTasks + (procrastinationChats * 10));
}

function computeHabitConsistency(habitEvents: HabitEvent[]): number {
  const completedHabits = habitEvents.filter(e => e.subtype === 'habit_completed');
  if (completedHabits.length === 0) return 0;

  const avgConsistency = completedHabits.reduce((sum, e) => sum + e.metrics.consistencyScore, 0) / completedHabits.length;
  return avgConsistency;
}

function computeStreakVariance(habitEvents: HabitEvent[]): number {
  const streakEvents = habitEvents.filter(e =>
    e.subtype === 'habit_streak_extended' || e.subtype === 'habit_streak_broken'
  );

  if (streakEvents.length < 2) return 0;

  const streaks: number[] = [];
  let currentStreak = 0;

  streakEvents.forEach(event => {
    if (event.subtype === 'habit_streak_extended') {
      currentStreak++;
    } else if (event.subtype === 'habit_streak_broken') {
      if (currentStreak > 0) {
        streaks.push(currentStreak);
        currentStreak = 0;
      }
    }
  });

  if (streaks.length === 0) return 0;

  const mean = streaks.reduce((sum, s) => sum + s, 0) / streaks.length;
  const variance = streaks.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / streaks.length;

  return Math.sqrt(variance);
}

function computeRoutineStability(taskEvents: TaskEvent[], habitEvents: HabitEvent[]): number {
  // Analyze time patterns for tasks and habits
  const allEvents = [...taskEvents, ...habitEvents];
  const timeSlots: Record<number, number> = {}; // hour -> count

  allEvents.forEach(event => {
    const hour = new Date(event.timestamp).getHours();
    timeSlots[hour] = (timeSlots[hour] || 0) + 1;
  });

  const hours = Object.keys(timeSlots).map(Number);
  if (hours.length < 2) return 0;

  // Calculate consistency of time slots
  const totalEvents = allEvents.length;
  const slotConsistency = hours.reduce((sum, hour) => {
    const probability = timeSlots[hour] / totalEvents;
    return sum + (probability * 100);
  }, 0) / hours.length;

  return Math.min(100, slotConsistency);
}

function computeEnergyEfficiency(taskEvents: TaskEvent[], deepWorkEvents: DeepWorkEvent[]): number {
  const completedTasks = taskEvents.filter(e => e.subtype === 'task_completed');
  if (completedTasks.length === 0) return 0;

  const totalEnergyUsed = completedTasks.reduce((sum, e) => {
    const energyValue = e.task.energy === 'high' ? 3 : e.task.energy === 'medium' ? 2 : 1;
    return sum + energyValue;
  }, 0);

  const efficiency = (completedTasks.length / totalEnergyUsed) * 10;
  return Math.min(100, efficiency * 10);
}

function computeBurnoutRisk(chatEvents: ChatEvent[], taskEvents: TaskEvent[]): number {
  let risk = 0;

  // Chat-based burnout signals
  const burnoutChats = chatEvents.filter(e =>
    e.analysis.sentiment === 'overwhelmed' ||
    e.analysis.sentiment === 'anxious' ||
    (e.analysis.intent === 'venting' && e.analysis.emotionalIntensity > 0.7)
  ).length;

  risk += burnoutChats * 10;

  // Task-based burnout signals
  const overdueTasks = taskEvents.filter(e => e.subtype === 'task_overdue').length;
  const abandonedTasks = taskEvents.filter(e => e.subtype === 'task_abandoned').length;

  risk += (overdueTasks + abandonedTasks) * 5;

  // High workload pattern
  const recentTasks = taskEvents.filter(e =>
    new Date(e.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  if (recentTasks.length > 8) {
    risk += 20;
  }

  return Math.min(100, risk);
}

function computeRecoveryRate(deepWorkEvents: DeepWorkEvent[], taskEvents: TaskEvent[]): number {
  const completedDeepWork = deepWorkEvents.filter(e => e.subtype === 'deep_work_completed');
  const interruptedDeepWork = deepWorkEvents.filter(e => e.subtype === 'deep_work_interrupted');

  if (completedDeepWork.length === 0) return 0;

  const completionRate = (completedDeepWork.length / (completedDeepWork.length + interruptedDeepWork.length)) * 100;

  // Check if user returns to tasks after interruptions
  const resumedTasks = taskEvents.filter(e =>
    e.subtype === 'task_started' &&
    taskEvents.some(t =>
      t.taskId === e.taskId &&
      t.subtype === 'task_paused' &&
      new Date(t.timestamp) < new Date(e.timestamp)
    )
  ).length;

  const pausedTasks = taskEvents.filter(e => e.subtype === 'task_paused').length;

  let resumptionRate = 0;
  if (pausedTasks > 0) {
    resumptionRate = (resumedTasks / pausedTasks) * 100;
  }

  return Math.min(100, (completionRate + resumptionRate) / 2);
}

function computePeakProductivityHours(taskEvents: TaskEvent[], deepWorkEvents: DeepWorkEvent[]): number[] {
  const productivityByHour: Record<number, number> = {};

  // Weight completed tasks higher
  taskEvents.forEach(event => {
    const hour = new Date(event.timestamp).getHours();
    const weight = event.subtype === 'task_completed' ? 2 : 1;
    productivityByHour[hour] = (productivityByHour[hour] || 0) + weight;
  });

  // Weight deep work sessions even higher
  deepWorkEvents.forEach(event => {
    if (event.subtype === 'deep_work_completed') {
      const hour = new Date(event.timestamp).getHours();
      productivityByHour[hour] = (productivityByHour[hour] || 0) + 3;
    }
  });

  // Get top 4 hours
  return Object.entries(productivityByHour)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([hour]) => parseInt(hour));
}

function computeFocusWindows(focusSessions: AnalyticsState['focusSessions']): Array<{ startHour: number, endHour: number, quality: number }> {
  const completedSessions = focusSessions.filter(s => s.endTime && s.duration >= 15);
  if (completedSessions.length === 0) return [];

  const windows: Array<{ startHour: number, endHour: number, quality: number }> = [];

  completedSessions.forEach(session => {
    const startHour = new Date(session.startTime).getHours();
    const endHour = new Date(new Date(session.startTime).getTime() + session.duration * 60000).getHours();

    // Only consider sessions that are in the same hour or adjacent
    if (endHour - startHour <= 2) {
      windows.push({
        startHour,
        endHour: Math.max(startHour + 1, endHour),
        quality: session.quality || 0.5,
      });
    }
  });

  return windows.slice(0, 3); // Return top 3 focus windows
}

function computeDistractionPatterns(deepWorkEvents: DeepWorkEvent[]): Array<{ time: number, source: string, duration: number }> {
  const interruptions = deepWorkEvents.filter(e => e.subtype === 'deep_work_interrupted');

  return interruptions.map(event => ({
    time: new Date(event.timestamp).getHours(),
    source: 'unknown', // Would come from actual tracking
    duration: 5, // Average interruption duration
  })).slice(0, 5); // Last 5 interruptions
}

function getLatestEventTime(events: Array<{ timestamp: Date }>, fallback = new Date()): Date {
  if (events.length === 0) {
    return fallback;
  }

  return events.reduce((latest, event) => {
    const timestamp = toDate(event.timestamp, latest);
    return timestamp.getTime() > latest.getTime() ? timestamp : latest;
  }, toDate(events[0].timestamp, fallback));
}

function detectBehavioralPatterns(events: AppEvent[]): Array<{ pattern: string, frequency: number, impact: 'positive' | 'negative' | 'neutral', lastSeen: Date }> {
  const patterns: Array<{ pattern: string, frequency: number, impact: 'positive' | 'negative' | 'neutral', lastSeen: Date }> = [];

  // Pattern 1: Overplanning in mornings
  const morningPlanningEvents = events.filter(e =>
    e.type === 'task_event' &&
    e.subtype === 'task_created' &&
    new Date(e.timestamp).getHours() >= 5 && new Date(e.timestamp).getHours() <= 10
  );
  const morningPlanning = morningPlanningEvents.length;

  if (morningPlanning > 5) {
    patterns.push({
      pattern: 'Morning overplanning',
      frequency: morningPlanning,
      impact: 'negative',
      lastSeen: getLatestEventTime(morningPlanningEvents),
    });
  }

  // Pattern 2: Afternoon productivity dip
  const afternoonTaskEvents = events.filter(e =>
    e.type === 'task_event' &&
    e.subtype === 'task_completed' &&
    new Date(e.timestamp).getHours() >= 13 && new Date(e.timestamp).getHours() <= 17
  );

  const morningTaskEvents = events.filter(e =>
    e.type === 'task_event' &&
    e.subtype === 'task_completed' &&
    new Date(e.timestamp).getHours() >= 8 && new Date(e.timestamp).getHours() <= 12
  );
  const afternoonTasks = afternoonTaskEvents.length;
  const morningTasks = morningTaskEvents.length;

  if (morningTasks >= 3 && afternoonTasks < morningTasks * 0.5) {
    patterns.push({
      pattern: 'Afternoon productivity dip',
      frequency: Math.round(morningTasks / Math.max(1, afternoonTasks)),
      impact: 'negative',
      lastSeen: getLatestEventTime([...morningTaskEvents, ...afternoonTaskEvents]),
    });
  }

  // Pattern 3: Consistent habit completion
  const habitCompletions = events.filter(e =>
    e.type === 'habit_event' &&
    e.subtype === 'habit_completed'
  );

  if (habitCompletions.length > 7) {
    patterns.push({
      pattern: 'Strong habit consistency',
      frequency: habitCompletions.length,
      impact: 'positive',
      lastSeen: getLatestEventTime(habitCompletions),
    });
  }

  // Pattern 4: Task switching
  const taskSwitchEvents = events.filter(e =>
    e.type === 'task_event' &&
    (e.subtype === 'task_paused' || e.subtype === 'task_started') &&
    events.some(e2 =>
      e2.type === 'task_event' &&
      e2.taskId !== e.taskId &&
      Math.abs(new Date(e2.timestamp).getTime() - new Date(e.timestamp).getTime()) < 600000 // 10 minutes
    )
  );
  const taskSwitches = taskSwitchEvents.length;

  if (taskSwitches > 3) {
    patterns.push({
      pattern: 'Frequent task switching',
      frequency: taskSwitches,
      impact: 'negative',
      lastSeen: getLatestEventTime(taskSwitchEvents),
    });
  }

  return patterns;
}

function generatePatternInsights(
  patterns: AnalyticsState['detectedPatterns'],
  events: AppEvent[]
): AnalyticsEvent[] {
  const insights: AnalyticsEvent[] = [];

  patterns.forEach(pattern => {
    if (pattern.frequency > 2) {
      const insight: AnalyticsEvent = {
        id: createEventId(),
        type: 'analytics_event',
        subtype: 'pattern_detected',
        insight: {
          title: pattern.pattern,
          description: `This pattern has occurred ${pattern.frequency} times`,
          confidence: Math.min(0.9, pattern.frequency / 10),
          impact: pattern.impact === 'neutral' ? 'low' : 'high',
          category: 'productivity',
          actionItems: getActionItemsForPattern(pattern.pattern),
        },
        patterns: {
          frequency: pattern.frequency,
          timePattern: 'varies',
        },
        metadata: {
          derivedFrom: [],
          firstObserved: pattern.lastSeen,
          lastObserved: pattern.lastSeen,
        },
        timestamp: new Date(),
        sessionId: createEventId(),
        source: 'system',
      };

      insights.push(insight);
    }
  });

  return insights;
}

function generateAnalyticsInsights(events: AppEvent[], metrics: UserMetrics): AnalyticsEvent[] {
  const insights: AnalyticsEvent[] = [];

  // Insight 1: Focus quality
  if (metrics.focusScore < 40) {
    insights.push({
      id: createEventId(),
      type: 'analytics_event',
      subtype: 'insight_generated',
      insight: {
        title: 'Low Focus Quality',
        description: 'Your focus sessions have lower quality than usual. Consider reducing distractions.',
        confidence: 0.8,
        impact: 'high',
        category: 'focus',
        actionItems: ['Use focus mode', 'Schedule breaks', 'Minimize notifications'],
      },
      patterns: {
        frequency: 1,
      },
      metadata: {
        derivedFrom: [],
        firstObserved: new Date(),
        lastObserved: new Date(),
      },
      timestamp: new Date(),
      sessionId: createEventId(),
      source: 'system',
    });
  }

  // Insight 2: Planning accuracy
  if (metrics.planningAccuracy > 80) {
    insights.push({
      id: createEventId(),
      type: 'analytics_event',
      subtype: 'insight_generated',
      insight: {
        title: 'Excellent Planning Accuracy',
        description: 'You\'re accurately estimating task durations. Keep up the good work!',
        confidence: 0.9,
        impact: 'high',
        category: 'planning',
        actionItems: ['Continue current planning approach', 'Share your method'],
      },
      patterns: {
        frequency: 1,
      },
      metadata: {
        derivedFrom: [],
        firstObserved: new Date(),
        lastObserved: new Date(),
      },
      timestamp: new Date(),
      sessionId: createEventId(),
      source: 'system',
    });
  }

  return insights;
}

function calculateSessionQuality(duration: number, interruptions: number): number {
  const baseQuality = Math.min(1, duration / 60); // 1 hour = perfect quality
  const interruptionPenalty = interruptions * 0.1;
  return Math.max(0.1, baseQuality - interruptionPenalty);
}

function getActionItemsForPattern(pattern: string): string[] {
  const actions: Record<string, string[]> = {
    'Morning overplanning': [
      'Limit morning planning to 3 main tasks',
      'Schedule planning for the night before',
      'Use the Eisenhower matrix for prioritization',
    ],
    'Afternoon productivity dip': [
      'Schedule light tasks for afternoon',
      'Take a proper lunch break',
      'Use the Pomodoro technique',
      'Consider a short walk after lunch',
    ],
    'Strong habit consistency': [
      'Celebrate your consistency streak',
      'Consider adding one more small habit',
      'Share your success with others',
    ],
    'Frequent task switching': [
      'Batch similar tasks together',
      'Use time blocking',
      'Turn off notifications during focus sessions',
      'Practice single-tasking for 25-minute intervals',
    ],
  };

  return actions[pattern] || ['Review this pattern and adjust accordingly'];
}

// Helper hooks
export const useCurrentMetrics = () => useAnalyticsStore((state) => state.currentMetrics);
export const useRecentInsights = () => useAnalyticsStore((state) => state.insights.slice(-5));
export const useDetectedPatterns = () => useAnalyticsStore((state) => state.detectedPatterns);
export const useFocusSessions = () => useAnalyticsStore((state) => state.focusSessions.slice(-10));
