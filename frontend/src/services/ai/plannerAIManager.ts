// frontend/src/services/ai/plannerAIManager.ts
/**
 * Planner AI Manager
 * Enables AI agent to autonomously manage planner features:
 * - Add tasks with specific properties
 * - Create goals with milestones
 * - Add and track habits
 * - Update task status
 * - Complete habits and goals
 */

import { plannerApi } from '../api/planner.service';

export interface AITaskData {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'goal' | 'work' | 'meeting' | 'break' | 'health' | 'learning' | 'routine' | 'personal';
  dueDate?: string; // ISO string
  estimatedDurationMinutes?: number;
  tags?: string[];
  status?: 'pending' | 'in-progress' | 'completed';
  energy?: 'low' | 'medium' | 'high';
}

export interface AIGoalData {
  title: string;
  description?: string;
  targetDate?: string; // ISO string
  category?: string;
  milestones?: string[];
  targetProgress?: number;
}

export interface AIHabitData {
  name: string;
  description?: string;
  category?: 'Wellness' | 'Health' | 'Learning' | 'Productivity';
  frequency?: 'daily' | 'weekly' | 'monthly';
}

export class PlannerAIManager {
  /**
   * Create a new task
   * @param taskData Task configuration
   * @returns Created task with ID
   */
  static async createTask(taskData: AITaskData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Parse dueDate if provided, otherwise use current time
      let dueDate = taskData.dueDate;
      if (!dueDate) {
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        dueDate = `${today}T${hours}:${minutes}:00.000Z`;
      }

      // Keep priority as-is — backend accepts 'urgent'
      const priority = taskData.priority || 'medium';

      const payload = {
        title: taskData.title,
        description: taskData.description || '',
        priority,
        status: taskData.status || 'pending',
        due_date: dueDate,
        estimated_duration_minutes: taskData.estimatedDurationMinutes || 60,
        tags: taskData.tags || [],
        category: taskData.category,
        energy: taskData.energy || 'medium',
      };

      console.log('[PlannerAI] Creating task:', payload);

      const response = await plannerApi.createTask(payload as any);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create task');
      }
      const result = response.data;
      console.log('[PlannerAI] Task created successfully:', result);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to create task:', error);
      return {
        success: false,
        error: error.message || 'Failed to create task'
      };
    }
  }

  /**
   * Update task status
   * @param taskId Task ID to update
   * @param status New status
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in-progress' | 'completed' | 'planned'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[PlannerAI] Updating task ${taskId} to status: ${status}`);

      const response = await plannerApi.updateTask(taskId, { status } as any);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update task');
      }

      console.log(`[PlannerAI] Task ${taskId} updated successfully`);
      return { success: true };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to update task:', error);
      return {
        success: false,
        error: error.message || 'Failed to update task'
      };
    }
  }

  /**
   * Create a new goal
   * @param goalData Goal configuration
   */
  static async createGoal(goalData: AIGoalData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const payload = {
        title: goalData.title,
        description: goalData.description || '',
        category: goalData.category || 'Personal',
        target_date: goalData.targetDate || undefined,
        milestones: goalData.milestones || [],
        target_progress: goalData.targetProgress || 100,
      };

      console.log('[PlannerAI] Creating goal:', payload);

      const response = await plannerApi.createGoal(payload as any);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create goal');
      }
      const result = response.data;
      console.log('[PlannerAI] Goal created successfully:', result);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to create goal:', error);
      return {
        success: false,
        error: error.message || 'Failed to create goal'
      };
    }
  }

  /**
   * Update goal progress
   * @param goalId Goal ID
   * @param progress Progress percentage (0-100)
   */
  static async updateGoalProgress(goalId: string, progress: number): Promise<{ success: boolean; error?: string }> {
    try {
      const clampedProgress = Math.min(100, Math.max(0, progress));
      console.log(`[PlannerAI] Updating goal ${goalId} progress to: ${clampedProgress}%`);

      const response = await plannerApi.updateGoalProgress(goalId, clampedProgress);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update goal progress');
      }

      console.log(`[PlannerAI] Goal ${goalId} progress updated successfully`);
      return { success: true };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to update goal progress:', error);
      return {
        success: false,
        error: error.message || 'Failed to update goal progress'
      };
    }
  }

  /**
   * Create a new habit
   * @param habitData Habit configuration
   */
  static async createHabit(habitData: AIHabitData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const payload = {
        name: habitData.name,
        description: habitData.description || '',
        category: habitData.category || 'Wellness',
        frequency: habitData.frequency || 'daily',
      };

      console.log('[PlannerAI] Creating habit:', payload);

      const response = await plannerApi.createHabit(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create habit');
      }
      const result = response.data;
      console.log('[PlannerAI] Habit created successfully:', result);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to create habit:', error);
      return {
        success: false,
        error: error.message || 'Failed to create habit'
      };
    }
  }

  /**
   * Track a habit completion for today
   * @param habitId Habit ID
   */
  static async completeHabit(habitId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[PlannerAI] Completing habit: ${habitId}`);

      const response = await plannerApi.trackHabit(habitId);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to complete habit');
      }

      console.log(`[PlannerAI] Habit ${habitId} completed successfully`);
      return { success: true };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to complete habit:', error);
      return {
        success: false,
        error: error.message || 'Failed to complete habit'
      };
    }
  }

  /**
   * Batch create multiple tasks
   * @param tasks Array of tasks to create
   */
  static async createMultipleTasks(tasks: AITaskData[]): Promise<{
    success: boolean;
    created: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: true,
      created: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const task of tasks) {
      const result = await this.createTask(task);
      if (result.success) {
        results.created++;
      } else {
        results.failed++;
        results.errors.push(`${task.title}: ${result.error}`);
        results.success = false;
      }
    }

    console.log('[PlannerAI] Batch operation complete:', results);
    return results;
  }

  /**
   * Get all tasks
   */
  static async getTasks(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const response = await plannerApi.getTasks();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch tasks');
      }
      const result = response.data || [];
      return {
        success: true,
        data: Array.isArray(result) ? result : (result as any)?.data || []
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to fetch tasks:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch tasks'
      };
    }
  }

  /**
   * Get all goals
   */
  static async getGoals(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const response = await plannerApi.getGoals();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch goals');
      }
      const result = response.data || [];
      return {
        success: true,
        data: Array.isArray(result) ? result : (result as any)?.data || []
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to fetch goals:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch goals'
      };
    }
  }

  /**
   * Get all habits
   */
  static async getHabits(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const response = await plannerApi.getHabits();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch habits');
      }
      const result = response.data || [];
      return {
        success: true,
        data: Array.isArray(result) ? result : (result as any)?.data || []
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to fetch habits:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch habits'
      };
    }
  }

  /**
   * AI Agent Tool: Create a comprehensive daily plan
   * @param dayDescription Description of the day (e.g., "Busy day with meetings")
   */
  static async generateDailyPlan(dayDescription: string): Promise<{
    success: boolean;
    plan?: { tasks: AITaskData[]; habits: AIHabitData[] };
    error?: string;
  }> {
    try {
      console.log('[PlannerAI] Generating daily plan for:', dayDescription);

      // AI would call this with natural language input
      // For now, we'll create a sample plan
      // In production, this would call an AI endpoint

      // This could be integrated with the AI Agent
      return {
        success: true,
        plan: {
          tasks: [],
          habits: []
        }
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to generate daily plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate daily plan'
      };
    }
  }

  /**
   * Get planner statistics
   */
  static async getPlannerStats(): Promise<{
    success: boolean;
    stats?: {
      totalTasks: number;
      completedTasks: number;
      pendingTasks: number;
      totalGoals: number;
      totalHabits: number;
      completedHabitsToday: number;
      productivityScore: number;
    };
    error?: string;
  }> {
    try {
      const response = await plannerApi.getDashboard();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch stats');
      }
      const stats = response.data;

      return {
        success: true,
        stats: {
          totalTasks: stats.counts?.total_tasks || 0,
          completedTasks: stats.daily_stats?.tasks_completed || 0,
          pendingTasks: stats.counts?.total_tasks - (stats.daily_stats?.tasks_completed || 0) || 0,
          totalGoals: stats.counts?.total_goals || 0,
          totalHabits: stats.counts?.total_habits || 0,
          completedHabitsToday: stats.daily_stats?.habits_completed || 0,
          productivityScore: stats.productivity_score || 0,
        }
      };
    } catch (error: any) {
      console.error('[PlannerAI] Failed to fetch stats:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch stats'
      };
    }
  }
}

// Export singleton instance
export const plannerAI = PlannerAIManager;
