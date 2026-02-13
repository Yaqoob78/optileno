// frontend/src/services/api/planner.service.ts
import { api } from './client';  // the approved axios wrapper
import type { ApiResponse } from './client';
import type { Task, TaskPriority, TaskStatus, Goal, Habit } from '../../types/planner.types';
import type { DeepWorkSession } from '../../types/session.types';
import { realtimeClient } from '../realtime/socket-client';

export type { Task, DeepWorkSession, Goal, Habit };

// Create / Update payloads (match backend Pydantic)
export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string;
  due_date?: string;
  estimatedDurationMinutes?: number;
  estimated_duration_minutes?: number;
  relatedGoalId?: string;
  goal_id?: string | number | null;
  tags?: string[];
  category?: string;
}

export interface TaskUpdate extends Partial<TaskCreate> {
  id: string;
}

export interface DeepWorkStart {
  plannedDurationMinutes: number;
  focusGoal?: string;
  notes?: string;
  goalId?: string;
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
}


// ── Service ────────────────────────────────────────────────────────
class PlannerService {
  private basePath = '/plans'; // basePath is relative to client's baseURL (/api/v1)

  // ── Tasks ────────────────────────────────────────────────────────

  async createTask(data: TaskCreate): Promise<ApiResponse<Task>> {
    return api.post<Task>(`${this.basePath}/tasks`, data);
  }

  async getTasks(params?: {
    status?: string;
    dueFrom?: string;
    dueTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Task[]>> {
    return api.get<Task[]>(`${this.basePath}/tasks`, { params });
  }

  async getTaskById(taskId: string): Promise<ApiResponse<Task>> {
    return api.get<Task>(`${this.basePath}/tasks/${taskId}`);
  }

  async updateTask(taskId: string, updates: Partial<TaskCreate>): Promise<ApiResponse<Task>> {
    return api.patch<Task>(`${this.basePath}/tasks/${taskId}`, updates);
  }

  async startTask(taskId: string): Promise<ApiResponse<Task>> {
    return api.post<Task>(`${this.basePath}/tasks/${taskId}/start`, {});
  }

  async deleteTask(taskId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/tasks/${taskId}`);
  }

  // ── Deep Work Sessions ───────────────────────────────────────────

  async startDeepWork(data: DeepWorkStart): Promise<ApiResponse<DeepWorkSession>> {
    return api.post<DeepWorkSession>(`${this.basePath}/deep-work/start`, data);
  }

  async completeDeepWork(data: DeepWorkComplete): Promise<ApiResponse<DeepWorkSession>> {
    return api.post<DeepWorkSession>(`${this.basePath}/deep-work/complete`, data);
  }

  async getActiveDeepWork(): Promise<ApiResponse<DeepWorkSession | null>> {
    return api.get<DeepWorkSession | null>(`${this.basePath}/deep-work/active`);
  }

  // ── Goals ────────────────────────────────────────────────────────

  async getGoals(): Promise<ApiResponse<Goal[]>> {
    return api.get<Goal[]>(`${this.basePath}/goals`);
  }

  async getGoalTimeline(): Promise<ApiResponse<Goal[]>> {
    return api.get<Goal[]>(`${this.basePath}/goals/timeline`);
  }

  async createGoal(data: GoalCreate): Promise<ApiResponse<Goal>> {
    return api.post<Goal>(`${this.basePath}/goals`, data);
  }

  async updateGoalProgress(goalId: string, progress: number): Promise<ApiResponse<{ message: string; progress: number }>> {
    return api.patch<{ message: string; progress: number }>(`${this.basePath}/goals/${goalId}/progress`, { progress });
  }

  async deleteGoal(goalId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/goals/${goalId}`);
  }

  async toggleGoalTracking(goalId: string): Promise<ApiResponse<any>> {
    return api.post(`${this.basePath}/goals/${goalId}/toggle-tracking`, {});
  }

  async breakdownGoal(goalId: string): Promise<ApiResponse<any>> {
    return api.post(`${this.basePath}/goals/${goalId}/breakdown`, {});
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

  async getHabits(): Promise<ApiResponse<Habit[]>> {
    return api.get<Habit[]>(`${this.basePath}/habits`);
  }

  async createHabit(data: HabitCreate): Promise<ApiResponse<Habit>> {
    return api.post<Habit>(`${this.basePath}/habits`, data);
  }

  async trackHabit(habitId: string): Promise<ApiResponse<{ streak: number; habit_id: string }>> {
    return api.post<{ streak: number; habit_id: string }>(`${this.basePath}/habits/${habitId}/track`, {});
  }

  async deleteHabit(habitId: string): Promise<ApiResponse<null>> {
    return api.delete(`${this.basePath}/habits/${habitId}`);
  }

  // ── Real-time helpers (call these from usePlanner hook) ──────────




  onTaskCreated(callback: (task: Task) => void) {
    realtimeClient.on('planner:task:created', (data: any) => {
      // Data is { event, task, timestamp }
      if (data && data.task) {
        callback(data.task);
      }
    });
  }

  onDeepWorkStarted(callback: (session: DeepWorkSession) => void) {
    realtimeClient.on('planner:deepwork:started', (data: any) => {
      if (data && data.session) {
        callback(data.session);
      }
    });
  }

  onTaskUpdated(callback: (task: Task) => void) {
    realtimeClient.on('planner:task:updated', (data: any) => {
      if (data && data.task) {
        callback(data.task);
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
        callback(data.habit);
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
}


export const plannerApi = new PlannerService();