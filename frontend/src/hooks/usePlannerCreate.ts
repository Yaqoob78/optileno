import { useCallback, useState } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { usePlannerStore } from '../stores/planner.store';
import { plannerApi } from '../services/api/planner.service';

interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  duration?: number;
  category?: string;
  tags?: string[];
  energy?: 'low' | 'medium' | 'high';
  createdByAI?: boolean;
}

interface CreateGoalPayload {
  title: string;
  description?: string;
  targetDate?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface CreateHabitPayload {
  title: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  category?: string;
  tags?: string[];
}

/**
 * Hook for creating tasks, goals, and habits
 * Integrates with backend API and updates local state
 */
export const usePlannerCreate = () => {
  const profile = useUserStore((state) => state.profile);
  const { addTask, addGoal, addHabit } = usePlannerStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTask = useCallback(async (payload: CreateTaskPayload) => {
    if (!profile.id) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await plannerApi.createTask({
        title: payload.title,
        description: payload.description || '',
        priority: payload.priority || 'medium',
        estimated_duration_minutes: payload.duration || 60,
        category: payload.category || 'work',
        tags: payload.tags || [],
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create task');
      }

      addTask(response.data as any);
      return { success: true, data: response.data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [profile.id, addTask]);

  const createGoal = useCallback(async (payload: CreateGoalPayload) => {
    if (!profile.id) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await plannerApi.createGoal({
        title: payload.title,
        description: payload.description || '',
        target_date: payload.targetDate,
        category: payload.category || 'personal',
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create goal');
      }

      addGoal(response.data as any);
      return { success: true, data: response.data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [profile.id, addGoal]);

  const createHabit = useCallback(async (payload: CreateHabitPayload) => {
    if (!profile.id) {
      setError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await plannerApi.createHabit({
        name: payload.title,
        description: payload.description || '',
        frequency: payload.frequency || 'daily',
        category: payload.category || 'personal',
      });

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to create habit');
      }

      addHabit(response.data as any);
      return { success: true, data: response.data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [profile.id, addHabit]);

  return {
    createTask,
    createGoal,
    createHabit,
    isLoading,
    error,
  };
};
