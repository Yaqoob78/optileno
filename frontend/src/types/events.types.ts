// ==============================
// CORE EVENT SYSTEM
// ==============================

// Base Event Interface
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  source: 'planner' | 'chat' | 'system';
  metadata: Record<string, any>;
}

// ==============================
// PLANNER EVENTS (From your components)
// ==============================

// Task Events
export interface TaskEvent extends BaseEvent {
  type: 'task_event';
  subtype: TaskEventType;
  taskId: string;
  task: {
    title: string;
    plannedDuration: number;
    actualDuration?: number;
    status: TaskStatus;
    category: TaskCategory;
    priority: TaskPriority;
    energy: EnergyLevel;
    tags: string[];
  };
  metrics: {
    delay?: number; // in minutes
    completionTime?: number; // in minutes
    plannedVsActualRatio?: number;
    startTimeOfDay?: number; // hour in 24h format
  };
}

export type TaskEventType =
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_paused'
  | 'task_resumed'
  | 'task_edited'
  | 'task_deleted'
  | 'task_duplicated'
  | 'task_delayed'
  | 'task_abandoned'
  | 'task_overdue'
  | 'task_priority_changed';

export type TaskStatus = 'planned' | 'scheduled' | 'in-progress' | 'completed' | 'overdue';
export type TaskCategory = 'work' | 'meeting' | 'break' | 'health' | 'learning' | 'routine' | 'personal';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type EnergyLevel = 'low' | 'medium' | 'high';

// Deep Work Events
export interface DeepWorkEvent extends BaseEvent {
  type: 'deep_work_event';
  subtype: DeepWorkEventType;
  sessionId: string;
  metrics: {
    duration: number; // in minutes
    interruptions: number;
    focusScore: number; // 1-10
    energyBefore: EnergyLevel;
    energyAfter: EnergyLevel;
    timeOfDay: number;
  };
  context: {
    taskId?: string;
    project?: string;
    environment?: string;
  };
}

export type DeepWorkEventType =
  | 'deep_work_started'
  | 'deep_work_completed'
  | 'deep_work_interrupted'
  | 'deep_work_extended'
  | 'deep_work_cancelled'
  | 'focus_zone_entered'
  | 'focus_zone_exited';

// Habit Events
export interface HabitEvent extends BaseEvent {
  type: 'habit_event';
  subtype: HabitEventType;
  habitId: string;
  habit: {
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    category: HabitCategory;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  metrics: {
    streakCount: number;
    streakMaintained: boolean;
    completionTime?: number; // in minutes
    timeOfDay: number;
    consistencyScore: number; // 0-100
  };
}

export type HabitEventType =
  | 'habit_completed'
  | 'habit_missed'
  | 'habit_skipped'
  | 'habit_streak_extended'
  | 'habit_streak_broken'
  | 'habit_created'
  | 'habit_edited'
  | 'habit_deleted';

export type HabitCategory = 'health' | 'productivity' | 'learning' | 'mindfulness' | 'social' | 'routine';

// Goal Events
export interface GoalEvent extends BaseEvent {
  type: 'goal_event';
  subtype: GoalEventType;
  goalId: string;
  goal: {
    title: string;
    targetDate?: Date;
    progress: number; // 0-100
    category: GoalCategory;
    priority: 'low' | 'medium' | 'high';
  };
  metrics: {
    progressChange: number;
    velocity: number; // progress per day
    timeToDeadline?: number; // days
    stagnationPeriod?: number; // days without progress
  };
}

export type GoalEventType =
  | 'goal_created'
  | 'goal_progressed'
  | 'goal_stalled'
  | 'goal_completed'
  | 'goal_abandoned'
  | 'goal_modified'
  | 'goal_deadline_changed';

export type GoalCategory = 'career' | 'health' | 'financial' | 'personal' | 'learning' | 'relationships';

// ==============================
// CHAT EVENTS (Psychological Data)
// ==============================

export interface ChatEvent extends BaseEvent {
  type: 'chat_event';
  subtype: ChatEventType;
  messageId: string;
  conversationId: string;
  analysis: {
    sentiment: ChatSentiment;
    intent: ChatIntent;
    confidence: number; // 0-1
    clarity: number; // 0-1
    urgency: number; // 0-1
    emotionalIntensity: number; // 0-1
  };
  content: {
    text: string;
    topics: string[];
    patterns: string[];
    references: string[];
  };
  metadata: {
    mode: ChatMode;
    responseLatency?: number;
    messageLength: number;
    wordComplexity: number;
  };
}

export type ChatEventType =
  | 'message_sent'
  | 'message_received'
  | 'conversation_started'
  | 'conversation_ended'
  | 'topic_changed'
  | 'sentiment_shift'
  | 'insight_generated'
  | 'advice_requested'
  | 'vent_detected'
  | 'planning_session_started';

export type ChatSentiment =
  | 'positive'
  | 'neutral'
  | 'frustrated'
  | 'anxious'
  | 'overwhelmed'
  | 'motivated'
  | 'confused'
  | 'reflective'
  | 'excited'
  | 'discouraged';

export type ChatIntent =
  | 'planning'
  | 'venting'
  | 'asking'
  | 'reflecting'
  | 'problem_solving'
  | 'seeking_validation'
  | 'accountability'
  | 'learning'
  | 'brainstorming'
  | 'decision_making';

export type ChatMode =
  | 'coach'
  | 'strategist'
  | 'analyst'
  | 'therapist'
  | 'creative'
  | 'mentor'
  | 'general';

// ==============================
// ANALYTICS EVENTS (Derived Insights)
// ==============================

export interface AnalyticsEvent extends BaseEvent {
  type: 'analytics_event';
  subtype: AnalyticsEventType;
  insight: {
    title: string;
    description: string;
    confidence: number; // 0-1
    impact: 'low' | 'medium' | 'high';
    category: InsightCategory;
    actionItems?: string[];
  };
  patterns: {
    frequency: number; // times observed
    timePattern?: string; // e.g., "every Monday"
    triggerPattern?: string; // what triggers this
    improvementSuggestion?: string;
  };
  metadata: {
    derivedFrom: string[]; // event IDs that led to this insight
    firstObserved: Date;
    lastObserved: Date;
    [key: string]: any;
  };
}

export type AnalyticsEventType =
  | 'pattern_detected'
  | 'insight_generated'
  | 'prediction_made'
  | 'recommendation_created'
  | 'anomaly_detected'
  | 'trend_identified'
  | 'behavior_change_detected'
  | 'performance_peak_detected'
  | 'bottleneck_identified'
  | 'opportunity_spotted';

export type InsightCategory =
  | 'focus'
  | 'consistency'
  | 'planning'
  | 'energy'
  | 'time_management'
  | 'habits'
  | 'goals'
  | 'wellbeing'
  | 'productivity'
  | 'learning';

// ==============================
// USER BEHAVIOR METRICS (Real-time Computed)
// ==============================

export interface UserMetrics {
  // Focus & Productivity
  focusScore: number; // 0-100
  productivityScore: number; // 0-100 (New field)
  focusDecayRate: number; // % per hour
  deepWorkRatio: number; // % of work time in deep work
  averageFocusDuration: number; // minutes

  // Planning & Execution
  planningAccuracy: number; // % of tasks completed as planned
  executionRatio: number; // planned vs actual time
  overplanningIndex: number; // tendency to overplan
  procrastinationScore: number; // 0-100

  // Consistency
  habitConsistency: number; // 0-100
  streakVariance: number; // how consistent are streaks
  routineStability: number; // schedule consistency

  // Energy & Wellbeing
  energyEfficiency: number; // tasks completed per energy unit
  burnoutRisk: number; // 0-100
  recoveryRate: number; // how quickly energy recovers

  // Time Patterns
  peakProductivityHours: number[]; // hours of day [0-23]
  focusWindows: Array<{
    startHour: number;
    endHour: number;
    quality: number; // 0-1
  }>;
  distractionPatterns: Array<{
    time: number;
    source: string;
    duration: number;
  }>;

  // Behavioral Insights
  behavioralPatterns: Array<{
    pattern: string;
    frequency: number;
    impact: 'positive' | 'negative' | 'neutral';
    suggestion?: string;
  }>;

  lastUpdated: Date;
}

// ==============================
// UNION TYPE FOR ALL EVENTS
// ==============================

export type AppEvent =
  | TaskEvent
  | DeepWorkEvent
  | HabitEvent
  | GoalEvent
  | ChatEvent
  | AnalyticsEvent;

// ==============================
// EVENT CREATOR HELPERS
// ==============================

export function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createBaseEvent(source: BaseEvent['source']): Omit<BaseEvent, 'id' | 'type'> {
  return {
    timestamp: new Date(),
    sessionId: getSessionId(),
    source,
    metadata: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    },
  };
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = createEventId();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

// ==============================
// EVENT FACTORIES (For each event type)
// ==============================

export const EventFactory = {
  // Task Events
  taskCreated(task: TaskEvent['task']): TaskEvent {
    const base = createBaseEvent('planner');
    return {
      ...base,
      id: createEventId(),
      type: 'task_event',
      subtype: 'task_created',
      taskId: createEventId(),
      task,
      metrics: {
        startTimeOfDay: new Date().getHours(),
      },
    };
  },

  taskStarted(taskId: string, task: TaskEvent['task']): TaskEvent {
    const base = createBaseEvent('planner');
    return {
      ...base,
      id: createEventId(),
      type: 'task_event',
      subtype: 'task_started',
      taskId,
      task,
      metrics: {
        startTimeOfDay: new Date().getHours(),
      },
    };
  },

  taskCompleted(taskId: string, task: TaskEvent['task'], plannedDuration: number, actualDuration: number): TaskEvent {
    const delay = Math.max(0, actualDuration - plannedDuration);
    const base = createBaseEvent('planner');

    return {
      ...base,
      id: createEventId(),
      type: 'task_event',
      subtype: 'task_completed',
      taskId,
      task,
      metrics: {
        delay,
        completionTime: actualDuration,
        plannedVsActualRatio: plannedDuration / actualDuration,
        startTimeOfDay: new Date().getHours(),
      },
    };
  },

  // Deep Work Events
  deepWorkStarted(duration: number, energy: EnergyLevel): DeepWorkEvent {
    const base = createBaseEvent('planner');
    return {
      ...base,
      id: createEventId(),
      type: 'deep_work_event',
      subtype: 'deep_work_started',
      sessionId: createEventId(),
      metrics: {
        duration,
        interruptions: 0,
        focusScore: 8, // Initial estimate
        energyBefore: energy,
        energyAfter: energy,
        timeOfDay: new Date().getHours(),
      },
      context: {},
    };
  },

  // Habit Events
  habitCompleted(habitId: string, habit: HabitEvent['habit'], streakCount: number): HabitEvent {
    const base = createBaseEvent('planner');
    return {
      ...base,
      id: createEventId(),
      type: 'habit_event',
      subtype: 'habit_completed',
      habitId,
      habit,
      metrics: {
        streakCount,
        streakMaintained: true,
        timeOfDay: new Date().getHours(),
        consistencyScore: calculateConsistencyScore(streakCount),
      },
    };
  },

  // Chat Events
  chatMessageSent(
    messageId: string,
    conversationId: string,
    text: string,
    mode: ChatMode,
    sentiment: ChatSentiment,
    intent: ChatIntent
  ): ChatEvent {
    const base = createBaseEvent('chat');
    return {
      ...base,
      id: createEventId(),
      type: 'chat_event',
      subtype: 'message_sent',
      messageId,
      conversationId,
      analysis: {
        sentiment,
        intent,
        confidence: 0.7,
        clarity: calculateClarity(text),
        urgency: calculateUrgency(text),
        emotionalIntensity: calculateEmotionalIntensity(text),
      },
      content: {
        text,
        topics: extractTopics(text),
        patterns: detectPatterns(text),
        references: extractReferences(text),
      },
      metadata: {
        ...base.metadata,
        mode,
        messageLength: text.length,
        wordComplexity: calculateWordComplexity(text),
        responseLatency: 0,
      },
    } as ChatEvent;
  },

  // Analytics Events
  patternDetected(
    title: string,
    description: string,
    confidence: number,
    category: InsightCategory
  ): AnalyticsEvent {
    const base = createBaseEvent('system');
    return {
      ...base,
      id: createEventId(),
      type: 'analytics_event',
      subtype: 'pattern_detected',
      insight: {
        title,
        description,
        confidence,
        impact: 'medium',
        category,
      },
      patterns: {
        frequency: 1,
      },
      metadata: {
        ...base.metadata,
        derivedFrom: [],
        firstObserved: new Date(),
        lastObserved: new Date(),
      },
    } as AnalyticsEvent;
  },
};

// ==============================
// HELPER FUNCTIONS
// ==============================

function calculateConsistencyScore(streakCount: number): number {
  if (streakCount <= 0) return 0;
  if (streakCount >= 30) return 100;
  return Math.min(100, (streakCount / 30) * 100);
}

function calculateClarity(text: string): number {
  const words = text.split(' ');
  if (words.length === 0) return 1;
  const complexWords = words.filter(w => w.length > 6);
  const clarity = 1 - (complexWords.length / words.length);
  return Math.max(0.1, Math.min(1, clarity));
}

function calculateUrgency(text: string): number {
  const urgencyWords = ['urgent', 'now', 'immediately', 'asap', 'deadline', 'emergency'];
  const words = text.toLowerCase().split(' ');
  const matches = words.filter(w => urgencyWords.includes(w));
  return Math.min(1, matches.length * 0.3);
}

function calculateEmotionalIntensity(text: string): number {
  const intensityWords = [
    'love', 'hate', 'angry', 'furious', 'excited', 'thrilled',
    'devastated', 'heartbroken', 'ecstatic', 'miserable'
  ];
  const words = text.toLowerCase().split(' ');
  const matches = words.filter(w => intensityWords.includes(w));
  return Math.min(1, matches.length * 0.2);
}

function calculateWordComplexity(text: string): number {
  const words = text.split(' ');
  if (words.length === 0) return 0;
  const avgLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  return Math.min(1, avgLength / 10);
}

function extractTopics(text: string): string[] {
  const commonTopics = [
    'work', 'productivity', 'focus', 'planning', 'goals', 'habits',
    'stress', 'time management', 'learning', 'health', 'routine',
    'motivation', 'procrastination', 'energy', 'balance'
  ];

  const words = text.toLowerCase().split(' ');
  return commonTopics.filter(topic =>
    words.some(word => word.includes(topic) || topic.includes(word))
  );
}

function detectPatterns(text: string): string[] {
  const patterns: string[] = [];

  // Check for repetitive patterns
  if (text.includes('always') || text.includes('never') || text.includes('every time')) {
    patterns.push('generalization');
  }

  if (text.includes('should') || text.includes('must') || text.includes('have to')) {
    patterns.push('obligation_language');
  }

  if (text.includes('but') && text.split('but').length > 2) {
    patterns.push('contrast_pattern');
  }

  if (text.includes('?') && text.split('?').length > 2) {
    patterns.push('questioning');
  }

  return patterns;
}

function extractReferences(text: string): string[] {
  const references: string[] = [];

  // Extract time references
  const timeRegex = /\b(\d{1,2}):(\d{2})\b|\b(\d+)\s*(hours?|minutes?|days?|weeks?|months?)\b/gi;
  const timeMatches = text.match(timeRegex);
  if (timeMatches) references.push(...timeMatches.map(m => `time:${m}`));

  // Extract task/project references
  const projectRegex = /\b(project|task|goal|deadline|meeting)\s+['"]([^'"]+)['"]/gi;
  const projectMatches = [...text.matchAll(projectRegex)];
  if (projectMatches.length) {
    references.push(...projectMatches.map(m => `project:${m[2]}`));
  }

  return references;
}