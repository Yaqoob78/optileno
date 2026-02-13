import { useCallback, useState } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { usePlannerStore } from '../stores/planner.store';

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
  const { addTask, addGoal, setHabits } = usePlannerStore();
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
      const response = await fetch('/api/v1/plans/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || '',
          priority: payload.priority || 'medium',
          estimated_duration_minutes: payload.duration || 60,
          category: payload.category || 'work',
          tags: payload.tags || [],
          energy_level: payload.energy || 'medium',
          created_by_ai: payload.createdByAI || false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create task');
      }

      const data = await response.json();

      // Update local store with complete task object
      const newTask = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        priority: data.priority || 'medium',
        status: data.status || 'pending',
        estimatedDuration: data.estimated_duration_minutes || 60,
        actualDuration: data.actual_duration_minutes || 0,
        dueDate: data.due_date ? new Date(data.due_date) : null,
        category: data.category || 'work',
        tags: data.tags || [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : null,
      };
      addTask(newTask);

      console.log('✓ Task created and added to store:', data.title);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('✗ Task creation failed:', message);
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
      const response = await fetch('/api/v1/goals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || '',
          target_date: payload.targetDate,
          category: payload.category || 'personal',
          priority: payload.priority || 'medium',
          tags: payload.tags || [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create goal');
      }

      const data = await response.json();

      // Update local store with complete goal object
      const newGoal = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        targetDate: data.target_date,
        target_date: data.target_date,
        category: data.category || 'personal',
        priority: data.priority || 'medium',
        progress: 0,
        current_progress: 0,
        milestones: data.milestones || [],
        createdAt: new Date(data.created_at),
      };
      addGoal(newGoal);

      console.log('✓ Goal created and added to store:', data.title);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('✗ Goal creation failed:', message);
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
      const response = await fetch('/api/v1/habits/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          title: payload.title,
          description: payload.description || '',
          frequency: payload.frequency || 'daily',
          category: payload.category || 'personal',
          tags: payload.tags || [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to create habit');
      }

      const data = await response.json();

      // Update local store with complete habit object
      const newHabit = {
        id: data.id,
        name: data.title || data.name,
        description: data.description || '',
        frequency: data.frequency || 'daily',
        category: data.category || 'personal',
        tags: data.tags || [],
        targetCount: data.target_count || 1,
        currentStreak: 0,
        longestStreak: 0,
        status: data.status || 'active',
        lastCompleted: null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
      // Append new habit to existing ones instead of replacing
      const currentHabits = usePlannerStore.getState().habits;
      setHabits([...currentHabits, newHabit]);

      console.log('✓ Habit created and added to store:', data.title);
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('✗ Habit creation failed:', message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [profile.id, setHabits]);

  return {
    createTask,
    createGoal,
    createHabit,
    isLoading,
    error,
  };
};
