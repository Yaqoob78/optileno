// frontend/src/services/api/planner.service.ts
import { api } from './client';  // the approved axios wrapper
import type { ApiResponse } from './client';
import type { Task, TaskPriority, TaskStatus, Goal, Habit } from '../../types/planner.types';
import type { DeepWorkSession } from '../../types/session.types';
import { realtimeClient } from '../realtime/socket-client';

export type { Task, DeepWorkSession, Goal, Habit };

const toDateOrNull = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const normalizeTaskStatus = (status: unknown): TaskStatus => {
  switch (status) {
    case 'pending':
      return 'todo';
    case 'completed':
      return 'done';
    case 'in_progress':
      return 'in-progress';
    case 'todo':
    case 'in-progress':
    case 'done':
    case 'planned':
    case 'overdue':
      return status;
    default:
      return 'planned';
  }
};

export const normalizePlannerTask = (task: any): Task => {
  const dueDate = toDateOrNull(task?.due_date ?? task?.dueDate);
  const createdAt = toDateOrNull(task?.created_at ?? task?.createdAt) ?? new Date();
  const updatedAt = toDateOrNull(task?.updated_at ?? task?.updatedAt) ?? createdAt;
  const completedAt = toDateOrNull(task?.completed_at ?? task?.completedAt);
  const estimatedDuration = Number(
    task?.estimated_duration_minutes ??
    task?.estimatedDuration ??
    task?.duration ??
    60,
  );
  const actualDuration = Number(
    task?.actual_duration_minutes ??
    task?.actual_minutes ??
    task?.actualDuration ??
    0,
  );

  return {
    ...task,
    id: String(task?.id ?? ''),
    status: normalizeTaskStatus(task?.status),
    dueDate,
    due_date: dueDate,
    estimatedDuration,
    estimated_duration_minutes: estimatedDuration,
    duration: estimatedDuration,
    actualDuration,
    actual_duration_minutes: actualDuration,
    createdAt,
    created_at: createdAt.toISOString(),
    updatedAt,
    updated_at: updatedAt.toISOString(),
    completedAt,
    completed_at: completedAt ? completedAt.toISOString() : null,
    goalId: task?.goal_id ?? task?.related_goal_id ?? task?.goalId ?? task?.relatedGoalId,
    originalId: String(task?.id ?? task?.originalId ?? ''),
    tags: Array.isArray(task?.tags) ? task.tags : [],
    description: task?.description ?? '',
    category: task?.category ?? 'work',
    priority: task?.priority ?? 'medium',
    meta: task?.meta ?? {},
  } as Task;
};

export const normalizePlannerGoal = (goal: any): Goal => {
  const createdAt = toDateOrNull(goal?.created_at ?? goal?.createdAt);
  const targetDate = goal?.target_date ?? goal?.targetDate ?? null;
  const progress = Number(goal?.current_progress ?? goal?.progress ?? 0);

  return {
    ...goal,
    id: String(goal?.id ?? ''),
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    category: goal?.category ?? 'personal',
    target_date: targetDate,
    targetDate,
    current_progress: progress,
    progress,
    milestones: Array.isArray(goal?.milestones) ? goal.milestones : [],
    created_at: createdAt ? createdAt.toISOString() : goal?.created_at ?? null,
    createdAt: createdAt ?? goal?.createdAt,
  } as Goal;
};

export const normalizePlannerHabit = (habit: any): Habit => {
  const schedule = typeof habit?.schedule === 'object' && habit?.schedule ? habit.schedule : {};
  const createdAt = toDateOrNull(habit?.createdAt ?? habit?.created_at) ?? new Date();
  const updatedAt = toDateOrNull(habit?.updatedAt ?? habit?.updated_at) ?? createdAt;
  const lastCompleted = toDateOrNull(
    habit?.lastCompleted ?? habit?.last_completed ?? schedule?.lastCompleted ?? schedule?.last_completed,
  );
  const currentStreak = Number(
    habit?.currentStreak ??
    habit?.current_streak ??
    habit?.streak ??
    schedule?.currentStreak ??
    schedule?.current_streak ??
    schedule?.streak ??
    0,
  );
  const longestStreak = Number(
    habit?.longestStreak ??
    habit?.longest_streak ??
    schedule?.longestStreak ??
    schedule?.longest_streak ??
    currentStreak,
  );

  return {
    ...habit,
    id: String(habit?.id ?? ''),
    name: habit?.name ?? habit?.title ?? '',
    title: habit?.title ?? habit?.name ?? '',
    description: habit?.description ?? '',
    frequency: habit?.frequency ?? schedule?.frequency ?? 'daily',
    category: habit?.category ?? schedule?.category ?? 'Wellness',
    targetCount: Number(habit?.targetCount ?? habit?.target_count ?? schedule?.target ?? 1),
    currentStreak,
    longestStreak,
    status: habit?.status ?? 'active',
    lastCompleted,
    last_completed: lastCompleted ? lastCompleted.toISOString() : null,
    createdAt,
    created_at: createdAt.toISOString(),
    updatedAt,
    updated_at: updatedAt.toISOString(),
    history: Array.isArray(habit?.history) ? habit.history : [],
    goal_id: habit?.goal_id ?? null,
  } as Habit;
};

export const normalizeDeepWorkSession = (session: any): DeepWorkSession => {
  const startedAt = toDateOrNull(session?.started_at ?? session?.startTime);
  const scheduledStartAt = toDateOrNull(session?.scheduled_start_at);
  const completedAt = toDateOrNull(session?.completed_at ?? session?.ended_at);
  const pausedAt = toDateOrNull(session?.paused_at);
  const createdAt = toDateOrNull(session?.created_at);

  return {
    ...session,
    id: String(session?.id ?? ''),
    startTime: startedAt?.toISOString(),
    started_at: startedAt?.toISOString(),
    scheduled_start_at: scheduledStartAt?.toISOString(),
    completed_at: completedAt?.toISOString(),
    ended_at: completedAt?.toISOString(),
    paused_at: pausedAt?.toISOString(),
    created_at: createdAt?.toISOString(),
    status: session?.status ?? 'active',
    focus_goal: session?.focus_goal ?? session?.focusGoal,
  } as DeepWorkSession;
};

// Create / Update payloads (match backend Pydantic)
export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  due_date?: string;
  due_local_date?: string;
  due_local_time?: string;
  timezone?: string;
  estimatedDurationMinutes?: number;
  estimated_duration_minutes?: number;
  relatedGoalId?: string;
  goal_id?: string | number | null;
  tags?: string[];
  category?: string;
  subtasks?: Array<{ title: string; completed: boolean }>;
  depends_on_task_id?: string | number | null;
  recurring?: boolean;
  recurrence_config?: {
    type: string;
    days_of_week?: number[];
  };
}

export interface TaskUpdate extends Partial<TaskCreate> {
  id: string;
}

export interface DeepWorkStart {
  plannedDurationMinutes?: number;
  planned_duration_minutes?: number;
  focusGoal?: string;
  focus_goal?: string;
  notes?: string;
  goalId?: string;
  goal_id?: string | number | null;
}

export interface DeepWorkScheduleRequest {
  days_of_week: number[];
  local_dates?: string[];
  start_time: string;
  duration_minutes: number;
  timezone: string;
  focus_goal?: string;
  notes?: string;
  goal_id?: string | number | null;
  recurring?: boolean;
}

export interface DeepWorkComplete {
  sessionId: string;
  actualDurationMinutes: number;
}

export interface GoalCreate {
  title: string;
  description?: string;
  category?: string;
  target_date?: string;
  milestones?: string[];
}

export interface HabitCreate {
  name: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  target?: number;
  category?: string;
  goalId?: string;
  goal_id?: string | number | null;
}


// ── Service ────────────────────────────────────────────────────────
class PlannerService {
  private basePath = '/plans'; // basePath is relative to client's baseURL (/api/v1)

  // ── Tasks ────────────────────────────────────────────────────────

  private mapTask(t: any): Task {
    if (!t) return t;
    return normalizePlannerTask(t);
  }

  private mapGoal(goal: any): Goal {
    if (!goal) return goal;
    return normalizePlannerGoal(goal);
  }

  private mapHabit(habit: any): Habit {
    if (!habit) return habit;
    return normalizePlannerHabit(habit);
  }

  private mapDeepWorkSession(session: any): DeepWorkSession {
    if (!session) return session;
    return normalizeDeepWorkSession(session);
  }

  async createTask(data: TaskCreate): Promise<ApiResponse<Task>> {
    const res = await api.post<Task>(`${this.basePath}/tasks`, data);
    if (res.success && res.data) res.data = this.mapTask(res.data);
    return res;
  }

  async getTasks(params?: {
    status?: string;
    day?: string;
    timezone?: string;
    dueFrom?: string;
    dueTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Task[]>> {
    const query = params ? {
      status: params.status,
      day: params.day,
      timezone: params.timezone,
      due_from: params.dueFrom,
      due_to: params.dueTo,
      limit: params.limit,
      offset: params.offset,
    } : undefined;
    const res = await api.get<Task[]>(`${this.basePath}/tasks`, { params: query });
    if (res.success && res.data) {
      res.data = res.data.map(t => this.mapTask(t));
    }
    return res;
  }

  async getTaskById(taskId: string): Promise<ApiResponse<Task>> {
    const res = await api.get<Task>(`${this.basePath}/tasks/${taskId}`);
    if (res.success && res.data) res.data = this.mapTask(res.data);
    return res;
  }

  async updateTask(taskId: string, updates: Partial<TaskCreate>): Promise<ApiResponse<Task>> {
    const res = await api.patch<Task>(`${this.basePath}/tasks/${taskId}`, updates);
    if (res.success && res.data) res.data = this.mapTask(res.data);
    return res;
  }

  async startTask(taskId: string): Promise<ApiResponse<Task>> {
    const res = await api.post<Task>(`${this.basePath}/tasks/${taskId}/start`, {});
    if (res.success && res.data) res.data = this.mapTask(res.data);
    return res;
  }

  async deleteTask(taskId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/tasks/${taskId}`);
  }

  // ── Deep Work Sessions ───────────────────────────────────────────

  async startDeepWork(data: DeepWorkStart): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.post<DeepWorkSession>(`${this.basePath}/deep-work/start`, data);
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async startScheduledDeepWork(sessionId: string): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.post<DeepWorkSession>(`${this.basePath}/deep-work/${sessionId}/start`, {});
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async completeDeepWork(data: DeepWorkComplete): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.post<DeepWorkSession>(`${this.basePath}/deep-work/${data.sessionId}/complete`, {
      actual_duration_minutes: data.actualDurationMinutes
    });
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async getActiveDeepWork(): Promise<ApiResponse<DeepWorkSession | null>> {
    const res = await api.get<DeepWorkSession | null>(`${this.basePath}/deep-work/active`);
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async pauseDeepWork(sessionId: string): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.post<DeepWorkSession>(`${this.basePath}/deep-work/${sessionId}/pause`, {});
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async resumeDeepWork(sessionId: string): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.post<DeepWorkSession>(`${this.basePath}/deep-work/${sessionId}/resume`, {});
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async cancelDeepWork(sessionId: string): Promise<ApiResponse<DeepWorkSession>> {
    const res = await api.delete<DeepWorkSession>(`${this.basePath}/deep-work/${sessionId}`);
    if (res.success && res.data) res.data = this.mapDeepWorkSession(res.data);
    return res;
  }

  async scheduleDeepWork(data: DeepWorkScheduleRequest): Promise<ApiResponse<DeepWorkSession[]>> {
    const res = await api.post<DeepWorkSession[]>(`${this.basePath}/deep-work/schedule`, data);
    if (res.success && res.data) {
      res.data = res.data.map((session) => this.mapDeepWorkSession(session));
    }
    return res;
  }

  async getScheduledDeepWork(params?: {
    includeMissed?: boolean;
    daysAhead?: number;
  }): Promise<ApiResponse<DeepWorkSession[]>> {
    const res = await api.get<DeepWorkSession[]>(`${this.basePath}/deep-work/schedule`, {
      params: {
        include_missed: params?.includeMissed ?? true,
        days_ahead: params?.daysAhead ?? 14,
      },
    });
    if (res.success && res.data) {
      res.data = res.data.map((session) => this.mapDeepWorkSession(session));
    }
    return res;
  }

  // ── Goals ────────────────────────────────────────────────────────

  async getGoals(): Promise<ApiResponse<Goal[]>> {
    const res = await api.get<Goal[]>(`${this.basePath}/goals`);
    if (res.success && res.data) {
      res.data = res.data.map((goal) => this.mapGoal(goal));
    }
    return res;
  }

  async getGoalTimeline(): Promise<ApiResponse<Goal[]>> {
    const res = await api.get<Goal[]>(`${this.basePath}/goals/timeline`);
    if (res.success && res.data) {
      res.data = res.data.map((goal) => this.mapGoal(goal));
    }
    return res;
  }

  async createGoal(data: GoalCreate): Promise<ApiResponse<Goal>> {
    const res = await api.post<Goal>(`${this.basePath}/goals`, data);
    if (res.success && res.data) res.data = this.mapGoal(res.data);
    return res;
  }

  async updateGoalProgress(goalId: string, progress: number): Promise<ApiResponse<{ message: string; progress: number }>> {
    return api.patch<{ message: string; progress: number }>(
      `${this.basePath}/goals/${goalId}/progress`,
      undefined,
      { params: { progress } }
    );
  }

  async updateGoalMilestone(
    goalId: string,
    milestoneIndex: number,
    completed: boolean
  ): Promise<ApiResponse<{ milestones: Array<{ title: string; completed: boolean }> }>> {
    // Milestone toggling lives on the dedicated goals router (like toggle-tracking below)
    return api.patch(`/goals/${goalId}/milestones/${milestoneIndex}`, { completed });
  }

  async deleteGoal(goalId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/goals/${goalId}`);
  }

  async toggleGoalTracking(goalId: string): Promise<ApiResponse<any>> {
    return api.post(`/goals/${goalId}/toggle-tracking`, {});
  }

  async breakdownGoal(goalId: string): Promise<ApiResponse<any>> {
    return api.post(`/goals/${goalId}/breakdown`, {});
  }

  // ── AI Goal Automation (NEW) ────────────────────────────────────

  async createGoalWithCascade(data: {
    title: string;
    description?: string;
    category?: string;
    timeframe?: 'day' | 'week' | 'month' | 'quarter';
    complexity?: 'low' | 'medium' | 'high';
    auto_create_tasks?: boolean;
    auto_create_habits?: boolean;
    propose_deep_work?: boolean;
  }): Promise<ApiResponse<{
    status: string;
    goal: Goal;
    tasks_created: any[];
    habits_suggested: any[];
    habits_created: any[];
    deep_work_proposed: boolean;
    message: string;
  }>> {
    return api.post(`${this.basePath}/ai/create-goal-with-cascade`, data);
  }

  // ── Dashboard ───────────────────────────────────────────────────

  async getDashboard(): Promise<ApiResponse<{
    daily_stats: {
      tasks_today: number;
      tasks_completed: number;
      habits_due: number;
      habits_completed: number;
      deep_work_active: boolean;
      goal_progress: number;
    };
    counts: {
      total_tasks: number;
      total_goals: number;
      total_habits: number;
    };
    productivity_score: number;
    active_deep_work: any;
  }>> {
    return api.get(`${this.basePath}/dashboard`);
  }

  // ── Habits ───────────────────────────────────────────────────────

  async getHabits(timezone?: string): Promise<ApiResponse<Habit[]>> {
    const res = await api.get<Habit[]>(`${this.basePath}/habits`, { params: timezone ? { timezone } : undefined });
    if (res.success && res.data) {
      res.data = res.data.map((habit) => this.mapHabit(habit));
    }
    return res;
  }

  async createHabit(data: HabitCreate): Promise<ApiResponse<Habit>> {
    const res = await api.post<Habit>(`${this.basePath}/habits`, {
      ...data,
      goal_id: data.goal_id ?? data.goalId ?? null,
    });
    if (res.success && res.data) res.data = this.mapHabit(res.data);
    return res;
  }

  async trackHabit(habitId: string, timezone?: string): Promise<ApiResponse<{ streak: number; habit_id: string }>> {
    return api.post<{ streak: number; habit_id: string }>(
      `${this.basePath}/habits/${habitId}/track`,
      {},
      { params: timezone ? { timezone } : undefined },
    );
  }

  async deleteHabit(habitId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/habits/${habitId}`);
  }

  // ── Real-time helpers (call these from usePlanner hook) ──────────




  onTaskCreated(callback: (task: Task) => void) {
    realtimeClient.on('planner:task:created', (data: any) => {
      // Data is { event, task, timestamp }
      if (data && data.task) {
        callback(this.mapTask(data.task));
      }
    });
  }

  onDeepWorkStarted(callback: (session: DeepWorkSession) => void) {
    realtimeClient.on('planner:deepwork:started', (data: any) => {
      if (data && data.session) {
        callback(this.mapDeepWorkSession(data.session));
      }
    });
  }

  onTaskUpdated(callback: (task: Task) => void) {
    realtimeClient.on('planner:task:updated', (data: any) => {
      if (data && data.task) {
        callback(this.mapTask(data.task));
      }
    });
  }

  onTaskDeleted(callback: (taskId: string) => void) {
    realtimeClient.on('planner:task:deleted', (data: any) => {
      if (data && data.task_id) {
        callback(data.task_id);
      }
    });
  }

  onHabitCreated(callback: (habit: Habit) => void) {
    realtimeClient.on('planner:habit:created', (data: any) => {
      if (data && data.habit) {
        callback(this.mapHabit(data.habit));
      }
    });
  }

  onPlanGenerated(callback: (plan: any) => void) {
    realtimeClient.on('planner:plan:generated', (data: any) => {
      if (data && data.plan) {
        callback(data.plan);
      }
    });
  }

  // NEW: Goal Event Listeners
  onGoalCreated(callback: (goal: Goal) => void) {
    realtimeClient.on('planner:goal:created', (data: any) => {
      if (data && data.goal) {
        callback(this.mapGoal(data.goal));
      }
    });
  }

  onGoalUpdated(callback: (goal: Goal) => void) {
    realtimeClient.on('planner:goal:updated', (data: any) => {
      if (data && data.goal) {
        callback(this.mapGoal(data.goal));
      }
    });
  }

  onGoalProgressChanged(callback: (data: { goalId: string, progress: number }) => void) {
    realtimeClient.on('planner:goal:progress_changed', (data: any) => {
      // Data: { goal_id, progress, ... }
      if (data && data.goal_id !== undefined) {
        callback({ goalId: String(data.goal_id), progress: data.progress });
      }
    });
  }

  // NEW: Habit Event Listeners
  onHabitCompleted(callback: (habit: Habit) => void) {
    realtimeClient.on('planner:habit:completed', (data: any) => {
      if (data && data.habit) {
        callback(this.mapHabit(data.habit));
      }
    });
  }
}


export const plannerApi = new PlannerService();
