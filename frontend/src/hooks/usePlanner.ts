// frontend/src/hooks/usePlanner.ts
import { useEffect, useState, useCallback } from 'react';
import { plannerApi, type Task, type DeepWorkSession, type TaskCreate, type DeepWorkStart, type Habit, type Goal } from '../services/api/planner.service';
import { usePlannerStore } from '../stores/planner.store';
import { useUser } from './useUser';

interface UsePlannerReturn {
  // State from store
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  activeDeepWork: DeepWorkSession | null;
  dailyDeepWorkCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTasks: (params?: { status?: string; dueFrom?: string; dueTo?: string }) => Promise<void>;
  fetchGoals: () => Promise<void>;
  fetchHabits: () => Promise<void>;
  createTask: (data: TaskCreate) => Promise<{ success: boolean; task?: Task; error?: string }>;
  updateTask: (taskId: string, updates: Partial<TaskCreate>) => Promise<{ success: boolean; error?: string }>;
  startTask: (taskId: string) => Promise<{ success: boolean; task?: Task; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
  createHabit: (data: { name: string; description?: string; category?: string; goalId?: string }) => Promise<{ success: boolean; habit?: Habit; error?: string }>;
  deleteHabit: (habitId: string) => Promise<{ success: boolean; error?: string }>;
  trackHabit: (habitId: string) => Promise<{ success: boolean; error?: string }>;
  createGoal: (data: { title: string; description?: string; category?: string; target_date?: string; milestones?: string[] }) => Promise<{ success: boolean; goal?: Goal; error?: string }>;
  deleteGoal: (goalId: string) => Promise<{ success: boolean; error?: string }>;
  startDeepWork: (data: DeepWorkStart) => Promise<{ success: boolean; session?: DeepWorkSession; error?: string }>;
  completeDeepWork: (actualMinutes: number) => Promise<{ success: boolean; error?: string }>;
  createGoalWithCascade: (data: {
    title: string;
    description?: string;
    category?: string;
    target_date?: string;
    milestones?: string[];
    timeframe?: 'day' | 'week' | 'month' | 'quarter';
    complexity?: 'low' | 'medium' | 'high';
    auto_create_tasks?: boolean;
    auto_create_habits?: boolean;
  }) => Promise<{ success: boolean; goal?: any; tasks_created?: any[]; habits_suggested?: any[]; error?: string }>;

  // Convenience
  isDeepWorkActive: boolean;
  hasTasksToday: boolean;
  forceRefresh: () => Promise<void>;
}

export const usePlanner = (): UsePlannerReturn => {
  const { userId } = useUser();
  const {
    tasks,
    goals,
    habits,
    activeDeepWork,
    dailyDeepWorkCount,
    isLoading,
    error,
    dataFetched,
    setTasks,
    setGoals,
    setHabits,
    addTask,
    incrementDeepWorkCount,
    updateTask: updateTaskInStore,
    startDeepWork: startDeepWorkInStore,
    setDataFetched,
  } = usePlannerStore();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // ── Data Fetching Actions ──────────────────────────────────────────

  const fetchTasks = useCallback(async (params?: { status?: string; dueFrom?: string; dueTo?: string }) => {
    if (!userId) return;
    try {
      const response = await plannerApi.getTasks(params);
      if (response.success && response.data) {
        setTasks(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
    }
  }, [userId, setTasks]);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    try {
      const resp = await plannerApi.getGoals();
      if (resp.success && resp.data) {
        setGoals(resp.data);
      }
    } catch (e) {
      console.error('Failed to fetch goals:', e);
    }
  }, [userId, setGoals]);

  const fetchHabits = useCallback(async () => {
    if (!userId) return;
    try {
      const resp = await plannerApi.getHabits();
      if (resp.success && resp.data) {
        setHabits(resp.data);
      }
    } catch (e) {
      console.error('Failed to fetch habits:', e);
    }
  }, [userId, setHabits]);

  // ── Unified initial data load ──────────────────────────────────────
  useEffect(() => {
    const loadAllData = async () => {
      if (!userId || dataFetched) {
        console.log('⏭️ Skipping fetch - already loaded or no userId');
        return;
      }

      console.log('📥 Starting initial data load...');
      setLocalLoading(true);
      setLocalError(null);

      try {
        await Promise.all([
          fetchTasks(),
          fetchHabits(),
          fetchGoals()
        ]);
        setDataFetched(true);
        console.log('✓ Initial data loaded and cached');
      } catch (err: any) {
        console.error('Planner sync error:', err);
        if (err.name !== 'CanceledError') {
          setLocalError('Failed to synchronize planner data');
        }
      } finally {
        setLocalLoading(false);
      }
    };

    loadAllData();
  }, [userId, dataFetched, fetchTasks, fetchHabits, fetchGoals, setDataFetched]);

  // ── Force refresh function ─────────────────────────────────────────
  const forceRefresh = useCallback(async () => {
    if (!userId) return;

    console.log('🔄 Force refreshing planner data...');
    setLocalLoading(true);
    setLocalError(null);

    try {
      await Promise.all([
        fetchTasks(),
        fetchHabits(),
        fetchGoals()
      ]);
      console.log('✓ Force refresh completed');
    } catch (err: any) {
      console.error('Force refresh error:', err);
      setLocalError('Failed to refresh planner data');
    } finally {
      setLocalLoading(false);
    }
  }, [userId, fetchTasks, fetchHabits, fetchGoals]);

  // ── Check for active deep work on mount ───────────────────────────
  useEffect(() => {
    const checkActiveSession = async () => {
      if (!userId) return;
      try {
        const res = await plannerApi.getActiveDeepWork();
        if (res.success && res.data) {
          startDeepWorkInStore(res.data.duration || 60);
        }
      } catch {
        // Silent fail
      }
    };
    checkActiveSession();
  }, [userId, startDeepWorkInStore]);

  // ── Task actions ──────────────────────────────────────────────────
  const createTask = useCallback(async (data: TaskCreate) => {
    try {
      const res = await plannerApi.createTask(data);
      if (res.success && res.data) {
        // The API returns a Task object, but the store expects a Task type.
        // Ensure res.data matches Task type (has id, etc.)
        addTask(res.data as Task);
        return { success: true, task: res.data as Task };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [addTask]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<TaskCreate>) => {
    try {
      const res = await plannerApi.updateTask(taskId, updates);
      if (res.success && res.data) {
        updateTaskInStore(taskId, res.data as Task);
        return { success: true };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [updateTaskInStore]);

  const startTask = useCallback(async (taskId: string) => {
    try {
      const res = await plannerApi.startTask(taskId);
      if (res.success && res.data) {
        updateTaskInStore(taskId, res.data as Task);
        return { success: true, task: res.data as Task };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [updateTaskInStore]);

  const deleteTask = useCallback(async (taskId: string | number) => {
    try {
      // Ensure taskId is a string
      const idStr = String(taskId);
      console.log('🗑️ Deleting task with ID:', idStr);

      const res = await plannerApi.deleteTask(idStr);
      console.log('Delete response:', res);

      if (res.success) {
        // Remove from store using the removeTask action
        const plannerStore = usePlannerStore.getState();
        plannerStore.removeTask(idStr);
        console.log('✓ Task deleted from store');
        return { success: true };
      }
      console.error('Delete failed:', res.error);
      return { success: false, error: res.error?.message || 'Failed to delete task' };
    } catch (err: any) {
      console.error('Delete error:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // ── Deep Work actions ─────────────────────────────────────────────
  const startDeepWork = useCallback(async (data: DeepWorkStart) => {
    try {
      const res = await plannerApi.startDeepWork(data);
      if (res.success && res.data) {
        startDeepWorkInStore(res.data.duration || 60);
        return { success: true, session: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [startDeepWorkInStore]);

  const completeDeepWork = useCallback(async (actualMinutes: number) => {
    if (!activeDeepWork?.id) return { success: false, error: 'No active session' };

    try {
      const res = await plannerApi.completeDeepWork({
        sessionId: activeDeepWork.id,
        actualDurationMinutes: actualMinutes,
      });
      if (res.success && res.data) {
        startDeepWorkInStore(0);
        incrementDeepWorkCount();
        return { success: true };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [activeDeepWork, startDeepWorkInStore, incrementDeepWorkCount]);

  // ── Derived values ────────────────────────────────────────────────
  const isDeepWorkActive = !!activeDeepWork && activeDeepWork.status === 'active';

  const hasTasksToday = tasks.some((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });

  // ── AI Goal Automation ─────────────────────────────────────────────
  const createGoalWithCascade = useCallback(async (data: {
    title: string;
    description?: string;
    category?: string;
    target_date?: string;
    milestones?: string[];
    timeframe?: 'day' | 'week' | 'month' | 'quarter';
    complexity?: 'low' | 'medium' | 'high';
    auto_create_tasks?: boolean;
    auto_create_habits?: boolean;
  }) => {
    try {
      const resp = await plannerApi.createGoalWithCascade(data);
      if (resp.success && resp.data) {
        if (resp.data.goal) {
          const plannerStore = usePlannerStore.getState();
          plannerStore.addGoal(resp.data.goal);

          if (resp.data.tasks_created) {
            resp.data.tasks_created.forEach(task => plannerStore.addTask(task));
          }
        }

        return {
          success: true,
          goal: resp.data.goal,
          tasks_created: resp.data.tasks_created,
          habits_suggested: resp.data.habits_suggested,
        };
      }
      return { success: false, error: resp.error?.message || 'Failed to create goal' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [habits, setHabits]);

  const trackHabit = useCallback(async (habitId: string) => {
    const plannerStore = usePlannerStore.getState();
    const habit = plannerStore.habits.find(h => String(h.id) === String(habitId));

    if (!habit) return { success: false, error: 'Habit not found' };

    const today = new Date().toISOString().split('T')[0];
    const last = habit.lastCompleted instanceof Date
      ? habit.lastCompleted.toISOString().split('T')[0]
      : (typeof habit.lastCompleted === 'string' ? habit.lastCompleted.split('T')[0] : '');

    const isCompletedToday = last === today;
    const newCompleted = !isCompletedToday;

    // Optimistic Update
    plannerStore.toggleHabit(habitId, newCompleted);

    try {
      const res = await plannerApi.trackHabit(habitId);
      if (res.success) {
        return { success: true };
      }
      // Revert
      plannerStore.toggleHabit(habitId, !newCompleted);
      return { success: false, error: res.error?.message || 'Failed to track habit' };
    } catch (err: any) {
      plannerStore.toggleHabit(habitId, !newCompleted);
      return { success: false, error: err.message };
    }
  }, []);

  const createHabit = useCallback(async (data: { name: string; description?: string; category?: string; goalId?: string }) => {
    if (!userId) return { success: false, error: 'User not logged in' };

    try {
      const response = await plannerApi.createHabit(data);
      if (response.success && response.data) {
        // Add the new habit to the store
        const plannerStore = usePlannerStore.getState();
        plannerStore.addHabit(response.data as Habit);
        return { success: true, habit: response.data as Habit };
      } else {
        return { success: false, error: response.error || 'Failed to create habit' };
      }
    } catch (error: any) {
      console.error('Create habit error:', error);
      return { success: false, error: error.message || 'Failed to create habit' };
    }
  }, [userId]);

  const deleteHabit = useCallback(async (habitId: string) => {
    try {
      const res = await plannerApi.deleteHabit(habitId);
      if (res.success) {
        const plannerStore = usePlannerStore.getState();
        plannerStore.removeHabit(habitId);
        console.log('✓ Habit deleted from store');
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Failed to delete habit' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  // ── Goal actions ───────────────────────────────────────────────────
  const createGoal = useCallback(async (data: { title: string; description?: string; category?: string; target_date?: string; milestones?: string[] }) => {
    try {
      const resp = await plannerApi.createGoal(data);
      if (resp.success && resp.data) {
        const plannerStore = usePlannerStore.getState();
        plannerStore.addGoal(resp.data);
        console.log('✓ Goal added to store');
        return { success: true, goal: resp.data };
      }
      return { success: false, error: resp.error?.message || 'Failed to create goal' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const deleteGoal = useCallback(async (goalId: string) => {
    try {
      const res = await plannerApi.deleteGoal(goalId);
      if (res.success) {
        const plannerStore = usePlannerStore.getState();
        plannerStore.removeGoal(goalId);
        console.log('✓ Goal deleted from store');
        return { success: true };
      }
      return { success: false, error: res.error?.message || 'Failed to delete goal' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    tasks,
    goals,
    habits,
    activeDeepWork,
    dailyDeepWorkCount,
    isLoading: isLoading || localLoading,
    error: error || localError,

    fetchTasks,
    fetchGoals,
    fetchHabits,
    createTask,
    updateTask,
    startTask,
    deleteTask,
    createHabit,
    trackHabit,
    deleteHabit,
    createGoal,
    deleteGoal,
    startDeepWork,
    completeDeepWork,
    createGoalWithCascade,
    forceRefresh,

    isDeepWorkActive,
    hasTasksToday,
  };
};