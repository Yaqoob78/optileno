// types/planner.types.ts

// Task types
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked' | 'failed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskMetadata {
  energyRequired: 'low' | 'medium' | 'high';
  focusRequired: number; // 0-100
  dependencies: string[]; // task ids
  context: string; // work, personal, health, etc.
  estimatedDifficulty?: number; // 0-100
  prerequisites?: string[];
  blockers?: string[];
}

export interface Task {
  id: string;
  originalId?: string; // API ID for operations (may differ from display id)
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  tags: string[];
  dueDate: Date | null;
  estimatedDuration: number; // minutes
  actualDuration: number; // minutes
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  metadata?: TaskMetadata;
  goalId?: string;
  goalTitle?: string;
  meta?: any;
}

// Goal types
export type GoalType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed';

export interface GoalMetadata {
  motivation: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  importance: number; // 0-100
  urgency: number; // 0-100
  successCriteria?: string[];
  risks?: string[];
  resources?: string[];
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category?: string;
  target_date?: string; // ISO string from backend
  current_progress: number;
  milestones?: Array<any>;
  ai_suggestions?: any; // Dictionary/Object from backend
  is_tracked?: boolean; // Goal Intelligence
  probability_status?: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High' | 'Extremely High';

  // New AI Analytics fields
  ai_probability?: number;
  ai_insights?: string[];
  dynamics?: {
    momentum_boost: number;
    inactivity_decay: number;
  };

  created_at?: string;
  status?: GoalStatus;
}

// Habit types
export type HabitFrequency = 'daily' | 'weekly' | 'monthly';

export type HabitStatus = 'active' | 'paused' | 'archived';

export interface HabitMetadata {
  trigger: string; // When/where this habit happens
  reward: string; // Reward for completing
  difficulty: number; // 0-100
  category: string;
  environment?: string;
  timeOfDay?: string;
  reminders?: string[];
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  category?: string;
  frequency: HabitFrequency;
  targetCount: number;
  currentStreak: number;
  longestStreak: number;
  status: HabitStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastCompleted: Date | string | null;
  history?: string[]; // Array of ISO date strings (YYYY-MM-DD)
  metadata?: HabitMetadata;
}

// Deep Work Block types
export type DeepWorkBlockStatus = 'scheduled' | 'in-progress' | 'completed' | 'skipped';

export interface DeepWorkBlockMetadata {
  environment: string;
  tools: string[];
  music: string;
  energyLevel: 'low' | 'medium' | 'high';
  distractions?: string[];
  successFactors?: string[];
}

export interface DeepWorkBlock {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  taskIds: string[];
  status: DeepWorkBlockStatus;
  focusScore: number; // 0-100
  interruptions: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: DeepWorkBlockMetadata;
}

// Schedule types
export interface Schedule {
  id: string;
  date: string; // YYYY-MM-DD
  tasks: Task[];
  blocks: DeepWorkBlock[];
  goals: string[]; // goal ids
  rating: number; // 0-5
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    energyLevel?: 'low' | 'medium' | 'high';
    productivityScore?: number;
    completionRate?: number;
    challenges?: string[];
    successes?: string[];
  };
}

// Planner statistics types
export interface PlannerStats {
  overview: {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    completionRate: number;
    averageFocusScore: number;
    totalDeepWorkHours: number;
  };
  trends: {
    tasksCompletedByDay: Array<{
      date: string;
      count: number;
    }>;
    productivityByHour: Array<{
      hour: number;
      score: number;
    }>;
    goalProgress: Array<{
      goal: string;
      progress: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };
  insights: Array<{
    type: 'achievement' | 'warning' | 'suggestion';
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

// AI Optimization types
export interface AIOptimizationRequest {
  constraints: {
    availableHours: Array<{
      day: string;
      start: string;
      end: string;
    }>;
    focusLevels: Array<{
      time: string;
      level: 'low' | 'medium' | 'high';
    }>;
    priorities: string[];
  };
  tasks: Task[];
  goals: string[];
}

export interface AIOptimizationResponse {
  optimizedSchedule: {
    date: string;
    tasks: Array<{
      id: string;
      title: string;
      scheduledTime: string;
      duration: number;
      priority: string;
      estimatedFocusRequired: number;
    }>;
    blocks: Array<{
      title: string;
      startTime: string;
      endTime: string;
      tasks: string[];
      estimatedFocusScore: number;
    }>;
    breaks: Array<{
      time: string;
      duration: number;
      type: 'short' | 'long' | 'recreational';
    }>;
  };
  metrics: {
    estimatedProductivity: number;
    focusUtilization: number;
    timeEfficiency: number;
    balanceScore: number;
  };
  recommendations: string[];
}

// Sync types
export interface PlannerSyncOperation {
  operation: 'create' | 'update' | 'delete';
  type: 'task' | 'goal' | 'habit' | 'block';
  data: any;
  id?: string;
}

export interface PlannerSyncResult {
  syncedAt: Date;
  operations: Array<{
    operation: string;
    type: string;
    id: string;
    success: boolean;
    error?: string;
  }>;
  conflicts: Array<{
    localId: string;
    serverId: string;
    localData: any;
    serverData: any;
    resolution?: 'local' | 'server' | 'merge';
  }>;
}

// Calendar integration types
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  calendar: string;
  source: 'google' | 'outlook' | 'apple' | 'other';
  metadata?: {
    description?: string;
    location?: string;
    attendees?: string[];
    recurrence?: any;
  };
}

// Export/Import types
export type PlannerExportFormat = 'json' | 'csv' | 'ics';

export interface PlannerExport {
  url: string;
  expiresAt: Date;
  format: PlannerExportFormat;
  size: number;
}

// Bulk operation types
export interface BulkOperation {
  items: Array<{
    type: 'task' | 'goal' | 'habit' | 'block';
    id: string;
  }>;
  action: 'delete' | 'updateStatus';
  status?: string;
}