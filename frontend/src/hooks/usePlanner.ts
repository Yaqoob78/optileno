// frontend/src/hooks/usePlanner.ts
import { useEffect, useState, useCallback } from 'react';
import { plannerApi, type Task, type DeepWorkSession, type TaskCreate, type DeepWorkStart, type Habit, type Goal } from '../services/api/planner.service';
import { usePlannerStore } from '../stores/planner.store';
import { useUser } from './useUser';
import { useSettingsStore } from '../stores/useSettingsStore';
import { getDateKeyInTimezone } from '../utils/timezone';

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
  fetchTasks: (params?: { status?: string; day?: string; timezone?: string; dueFrom?: string; dueTo?: string }) => Promise<void>;
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
  scheduleDeepWork: (data: {
    days_of_week: number[];
    start_time: string;
    duration_minutes: number;
    timezone: string;
    focus_goal?: string;
    notes?: string;
    goal_id?: string | number | null;
  }) => Promise<{ success: boolean; sessions?: DeepWorkSession[]; error?: string }>;
  fetchScheduledDeepWork: (params?: { includeMissed?: boolean; daysAhead?: number }) => Promise<{ success: boolean; sessions?: DeepWorkSession[]; error?: string }>;
  startScheduledDeepWork: (sessionId: string) => Promise<{ success: boolean; session?: DeepWorkSession; error?: string }>;
  completeDeepWork: (actualMinutes: number) => Promise<{ success: boolean; error?: string }>;
  pauseDeepWork: () => Promise<{ success: boolean; session?: DeepWorkSession; error?: string }>;
  resumeDeepWork: () => Promise<{ success: boolean; session?: DeepWorkSession; error?: string }>;
  cancelDeepWork: () => Promise<{ success: boolean; error?: string }>;
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
    propose_deep_work?: boolean;
  }) => Promise<{ success: boolean; goal?: any; tasks_created?: any[]; habits_suggested?: any[]; error?: string }>;

  // Convenience
  isDeepWorkActive: boolean;
  hasTasksToday: boolean;
  forceRefresh: () => Promise<void>;
}

export const usePlanner = (): UsePlannerReturn => {
  const { userId } = useUser();
  const timezone = useSettingsStore((state) => state.timezone);
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
    addHabit,
    removeTask: removeTaskFromStore,
    incrementDeepWorkCount,
    updateTask: updateTaskInStore,
    setActiveDeepWork,
    clearActiveDeepWork,
    setDataFetched,
  } = usePlannerStore();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // ── Data Fetching Actions ──────────────────────────────────────────

  const fetchTasks = useCallback(async (params?: { status?: string; day?: string; timezone?: string; dueFrom?: string; dueTo?: string }) => {
    if (!userId) return;
    try {
      const effectiveTimezone = params?.timezone || timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await plannerApi.getTasks({
        ...params,
        timezone: effectiveTimezone,
      });
      if (response.success && response.data) {
        setTasks(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch tasks:', err);
    }
  }, [userId, setTasks, timezone]);

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
      const resp = await plannerApi.getHabits(timezone);
      if (resp.success && resp.data) {
        setHabits(resp.data);
      }
    } catch (e) {
      console.error('Failed to fetch habits:', e);
    }
  }, [userId, setHabits, timezone]);

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
          setActiveDeepWork(res.data);
        }
      } catch {
        // Silent fail
      }
    };
    checkActiveSession();
  }, [userId, setActiveDeepWork]);

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
    const plannerStore = usePlannerStore.getState();
    const existingTask = plannerStore.tasks.find((task) => String(task.id) === String(taskId));
    const optimisticUpdates: any = { ...updates };
    if (updates.estimated_duration_minutes !== undefined) {
      optimisticUpdates.estimatedDurationMinutes = updates.estimated_duration_minutes;
    }
    if ((updates as any).due_local_date && (updates as any).due_local_time) {
      optimisticUpdates.dueDate = `${(updates as any).due_local_date}T${(updates as any).due_local_time}:00`;
      optimisticUpdates.due_date = optimisticUpdates.dueDate;
    }
    if (existingTask) {
      updateTaskInStore(taskId, optimisticUpdates as Task);
    }

    try {
      const res = await plannerApi.updateTask(taskId, updates);
      if (res.success && res.data) {
        updateTaskInStore(String((res.data as any).id ?? taskId), res.data as Task);
        return { success: true };
      }
      if (existingTask) {
        updateTaskInStore(taskId, existingTask as Task);
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      if (existingTask) {
        updateTaskInStore(taskId, existingTask as Task);
      }
      return { success: false, error: err.message };
    }
  }, [updateTaskInStore]);

  const startTask = useCallback(async (taskId: string) => {
    const plannerStore = usePlannerStore.getState();
    const existingTask = plannerStore.tasks.find((task) => String(task.id) === String(taskId));
    if (existingTask) {
      updateTaskInStore(taskId, { ...(existingTask as any), status: 'in-progress' } as Task);
    }

    try {
      const res = await plannerApi.startTask(taskId);
      if (res.success && res.data) {
        updateTaskInStore(String((res.data as any).id ?? taskId), res.data as Task);
        return { success: true, task: res.data as Task };
      }
      if (existingTask) {
        updateTaskInStore(taskId, existingTask as Task);
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      if (existingTask) {
        updateTaskInStore(taskId, existingTask as Task);
      }
      return { success: false, error: err.message };
    }
  }, [updateTaskInStore]);

  const deleteTask = useCallback(async (taskId: string | number) => {
    const idStr = String(taskId);
    const plannerStore = usePlannerStore.getState();
    const existingTask = plannerStore.tasks.find((task) => String(task.id) === idStr);
    removeTaskFromStore(idStr);

    try {
      console.log('Deleting task with ID:', idStr);

      const res = await plannerApi.deleteTask(idStr);
      console.log('Delete response:', res);

      if (res.success) {
        console.log('Task deleted from store');
        return { success: true };
      }
      if (existingTask) {
        addTask(existingTask as Task);
      }
      console.error('Delete failed:', res.error);
      return { success: false, error: res.error?.message || 'Failed to delete task' };
    } catch (err: any) {
      if (existingTask) {
        addTask(existingTask as Task);
      }
      console.error('Delete error:', err);
      return { success: false, error: err.message };
    }
  }, [addTask, removeTaskFromStore]);

  // ── Deep Work actions ─────────────────────────────────────────────
  const startDeepWork = useCallback(async (data: DeepWorkStart) => {
    try {
      const res = await plannerApi.startDeepWork({
        planned_duration_minutes: data.plannedDurationMinutes,
        focus_goal: data.focusGoal,
        notes: data.notes,
        goal_id: data.goalId,
      });
      if (res.success && res.data) {
        setActiveDeepWork(res.data);
        return { success: true, session: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [setActiveDeepWork]);

  const scheduleDeepWork = useCallback(async (data: {
    days_of_week: number[];
    start_time: string;
    duration_minutes: number;
    timezone: string;
    focus_goal?: string;
    notes?: string;
    goal_id?: string | number | null;
  }) => {
    try {
      const res = await plannerApi.scheduleDeepWork(data);
      if (res.success && res.data) {
        return { success: true, sessions: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const fetchScheduledDeepWork = useCallback(async (params?: { includeMissed?: boolean; daysAhead?: number }) => {
    try {
      const res = await plannerApi.getScheduledDeepWork(params);
      if (res.success && res.data) {
        return { success: true, sessions: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const startScheduledDeepWork = useCallback(async (sessionId: string) => {
    try {
      const res = await plannerApi.startScheduledDeepWork(sessionId);
      if (res.success && res.data) {
        setActiveDeepWork(res.data);
        return { success: true, session: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [setActiveDeepWork]);

  const completeDeepWork = useCallback(async (actualMinutes: number) => {
    if (!activeDeepWork?.id) return { success: false, error: 'No active session' };

    try {
      const res = await plannerApi.completeDeepWork({
        sessionId: activeDeepWork.id,
        actualDurationMinutes: actualMinutes,
      });
      if (res.success && res.data) {
        clearActiveDeepWork();
        incrementDeepWorkCount();
        return { success: true };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [activeDeepWork, clearActiveDeepWork, incrementDeepWorkCount]);

  const pauseDeepWork = useCallback(async () => {
    if (!activeDeepWork?.id) return { success: false, error: 'No active session' };
    try {
      const res = await plannerApi.pauseDeepWork(activeDeepWork.id);
      if (res.success && res.data) {
        setActiveDeepWork(res.data);
        return { success: true, session: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [activeDeepWork, setActiveDeepWork]);

  const resumeDeepWork = useCallback(async () => {
    if (!activeDeepWork?.id) return { success: false, error: 'No active session' };
    try {
      const res = await plannerApi.resumeDeepWork(activeDeepWork.id);
      if (res.success && res.data) {
        setActiveDeepWork(res.data);
        return { success: true, session: res.data };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [activeDeepWork, setActiveDeepWork]);

  const cancelDeepWork = useCallback(async () => {
    if (!activeDeepWork?.id) return { success: false, error: 'No active session' };
    try {
      const res = await plannerApi.cancelDeepWork(activeDeepWork.id);
      if (res.success) {
        clearActiveDeepWork();
        return { success: true };
      }
      return { success: false, error: res.error?.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, [activeDeepWork, clearActiveDeepWork]);

  // ── Derived values ────────────────────────────────────────────────
  const isDeepWorkActive = !!activeDeepWork && activeDeepWork.status === 'active';

  const hasTasksToday = tasks.some((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return getDateKeyInTimezone(due, timezone) === getDateKeyInTimezone(new Date(), timezone);
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
    propose_deep_work?: boolean;
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

    const today = getDateKeyInTimezone(new Date(), timezone);
    const last = habit.lastCompleted instanceof Date
      ? getDateKeyInTimezone(habit.lastCompleted, timezone)
      : (typeof habit.lastCompleted === 'string'
        ? getDateKeyInTimezone(new Date(habit.lastCompleted), timezone)
        : '');

    const isCompletedToday = last === today;
    if (isCompletedToday) {
      return { success: true };
    }

    // Optimistic Update
    plannerStore.toggleHabit(habitId, true);

    try {
      const res = await plannerApi.trackHabit(habitId, timezone);
      if (res.success) {
        return { success: true };
      }
      // Revert
      plannerStore.toggleHabit(habitId, false);
      return { success: false, error: res.error?.message || 'Failed to track habit' };
    } catch (err: any) {
      plannerStore.toggleHabit(habitId, false);
      return { success: false, error: err.message };
    }
  }, [timezone]);

  const createHabit = useCallback(async (data: { name: string; description?: string; category?: string; goalId?: string }) => {
    if (!userId) return { success: false, error: 'User not logged in' };

    try {
      const response = await plannerApi.createHabit({
        ...data,
        goal_id: data.goalId || null,
      } as any);
      if (response.success && response.data) {
        addHabit(response.data as Habit);
        return { success: true, habit: response.data as Habit };
      } else {
        return { success: false, error: response.error || 'Failed to create habit' };
      }
    } catch (error: any) {
      console.error('Create habit error:', error);
      return { success: false, error: error.message || 'Failed to create habit' };
    }
  }, [addHabit, userId]);

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
    scheduleDeepWork,
    fetchScheduledDeepWork,
    startScheduledDeepWork,
    completeDeepWork,
    pauseDeepWork,
    resumeDeepWork,
    cancelDeepWork,
    createGoalWithCascade,
    forceRefresh,

    isDeepWorkActive,
    hasTasksToday,
  };
};
