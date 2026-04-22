// frontend/src/stores/planner.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeepWorkSession } from '../services/api/planner.service';
import type { Task, Goal, Habit } from '../types/planner.types';
import { getDateKeyInTimezone } from '../utils/timezone';
import { useSettingsStore } from './useSettingsStore';

interface PlannerState {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  activeDeepWork: DeepWorkSession | null;
  dailyDeepWorkCount: number;
  lastDeepWorkDate: string | null; // To track daily reset
  isLoading: boolean;
  error: string | null;
  dataFetched: boolean; // Flag to prevent redundant initial fetches

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;

  setGoals: (goals: Goal[]) => void;
  addGoal: (goal: Goal) => void;
  removeGoal: (goalId: string) => void;

  setHabits: (habits: Habit[]) => void;
  addHabit: (habit: Habit) => void;
  toggleHabit: (habitId: string, completed: boolean) => void; // AI Alias
  removeHabit: (habitId: string) => void;

  startDeepWork: (duration: number | null) => void; // AI Alias
  incrementDeepWorkCount: () => void;

  // NEW: Missing actions for proper state management
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveDeepWork: (session: DeepWorkSession | null) => void;
  clearActiveDeepWork: () => void;
  setDataFetched: (fetched: boolean) => void;

  createPlan: (payload: any) => void; // AI Full Page Integration

  resetPlanner: () => void;

  // Real-time
  socketInitialized: boolean;
  initSocketListeners: () => void;
  fetchTasks: () => Promise<void>;
  fetchGoals: () => Promise<void>;
  fetchHabits: () => Promise<void>;
}

// We need to import plannerApi to use it in the store actions
import { plannerApi } from '../services/api/planner.service';

const toId = (value: unknown): string => String(value ?? '');

const mergeById = <T extends { id: unknown }>(existing: T[], incoming: T[]): T[] => {
  const map = new Map<string, T>();
  existing.forEach((item) => map.set(toId(item.id), item));
  incoming.forEach((item) => map.set(toId(item.id), item));
  return Array.from(map.values());
};

const uniqueById = <T extends { id: unknown }>(items: T[]): T[] => mergeById([], items);

const mergeDefinedFields = <T extends Record<string, any>>(existing: T, incoming: Partial<T>): T => {
  const merged = { ...existing };

  Object.entries(incoming).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      merged[key as keyof T] = value as T[keyof T];
    }
  });

  return merged;
};

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      tasks: [],
      goals: [],
      habits: [],
      activeDeepWork: null,
      dailyDeepWorkCount: 0,
      lastDeepWorkDate: null,
      isLoading: false,
      error: null,
      socketInitialized: false,
      dataFetched: false,

      setTasks: (tasks) =>
        set({
          tasks: uniqueById(tasks as Task[]),
        }),
      addTask: (task) => {
        let eventName: 'task_created' | 'task_updated' = 'task_created';
        let emittedTask = task;
        set((state) => {
          const taskId = toId(task.id);
          const existingIndex = state.tasks.findIndex((t) => toId(t.id) === taskId);
          if (existingIndex >= 0) {
            eventName = 'task_updated';
            const updated = [...state.tasks];
            emittedTask = mergeDefinedFields(updated[existingIndex], task);
            updated[existingIndex] = emittedTask;
            return { tasks: updated };
          }
          emittedTask = task;
          return { tasks: [task, ...state.tasks] };
        });
        window.dispatchEvent(new CustomEvent(eventName, { detail: emittedTask }));
      },

      updateTask: (taskId, updates) =>
        set((state) => {
          const targetId = toId(taskId);
          const updatedTasks = state.tasks.map((t) => (toId(t.id) === targetId ? { ...t, ...updates } : t));
          const updatedTask = updatedTasks.find((t) => toId(t.id) === targetId);

          if (updatedTask) {
            // Dispatch custom event for analytics
            window.dispatchEvent(new CustomEvent('task_updated', { detail: updatedTask }));
          }

          return { tasks: updatedTasks };
        }),

      removeTask: (taskId) => {
        const taskIdStr = String(taskId);
        set((state) => ({
          tasks: state.tasks.filter((t) => String(t.id) !== taskIdStr),
        }));
      },

      setGoals: (goals) =>
        set({
          goals: uniqueById(goals as Goal[]),
        }),
      addGoal: (goal) => {
        let eventName: 'goal_created' | 'goal_updated' = 'goal_created';
        let emittedGoal = goal;
        set((state) => {
          const goalId = toId(goal.id);
          const existingIndex = state.goals.findIndex((g) => toId(g.id) === goalId);
          if (existingIndex >= 0) {
            eventName = 'goal_updated';
            const updated = [...state.goals];
            emittedGoal = mergeDefinedFields(updated[existingIndex], goal);
            updated[existingIndex] = emittedGoal;
            return { goals: updated };
          }
          emittedGoal = goal;
          return { goals: [goal, ...state.goals] };
        });
        window.dispatchEvent(new CustomEvent(eventName, { detail: emittedGoal }));
      },
      removeGoal: (goalId) => {
        const goalIdStr = String(goalId);
        set((state) => ({
          goals: state.goals.filter((g) => String(g.id) !== goalIdStr),
        }));
      },

      setHabits: (habits) =>
        set({
          habits: uniqueById(habits as Habit[]),
        }),

      addHabit: (habit) => {
        let isNewHabit = true;
        let emittedHabit = habit;
        set((state) => {
          const habitId = toId(habit.id);
          const existingIndex = state.habits.findIndex((h) => toId(h.id) === habitId);
          if (existingIndex >= 0) {
            isNewHabit = false;
            const updated = [...state.habits];
            emittedHabit = mergeDefinedFields(updated[existingIndex], habit);
            updated[existingIndex] = emittedHabit;
            return { habits: updated };
          }
          emittedHabit = habit;
          return { habits: [habit, ...state.habits] };
        });
        if (isNewHabit) {
          window.dispatchEvent(new CustomEvent('habit_created', { detail: emittedHabit }));
        }
      },

      // AI-Service Compatible Habit Toggle
      toggleHabit: (habitId, completed) =>
        set((state) => {
          const timezone = useSettingsStore.getState().timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const todayKey = getDateKeyInTimezone(new Date(), timezone);
          const updatedHabits = state.habits.map((h) =>
            toId(h.id) === toId(habitId)
              ? (() => {
                const lastCompletedDate = h.lastCompleted ? new Date(h.lastCompleted) : null;
                const alreadyToday =
                  !!lastCompletedDate && getDateKeyInTimezone(lastCompletedDate, timezone) === todayKey;

                if (completed) {
                  if (alreadyToday) {
                    return h;
                  }
                  const nextStreak = Math.max(1, (h.currentStreak || 0) + 1);
                  return {
                    ...h,
                    currentStreak: nextStreak,
                    longestStreak: Math.max(h.longestStreak || 0, nextStreak),
                    lastCompleted: new Date(),
                  };
                }

                if (!alreadyToday) {
                  return h;
                }

                return {
                  ...h,
                  currentStreak: Math.max(0, (h.currentStreak || 0) - 1),
                  lastCompleted: null,
                };
              })()
              : h,
          );

          const updatedHabit = updatedHabits.find((h) => toId(h.id) === toId(habitId));

          if (updatedHabit) {
            // Dispatch custom event for analytics
            window.dispatchEvent(new CustomEvent('habit_completed', { detail: updatedHabit }));
          }

          return { habits: updatedHabits };
        }),

      removeHabit: (habitId) => {
        const habitIdStr = String(habitId);
        const removedHabit = get().habits.find(h => String(h.id) === habitIdStr);

        set((state) => ({
          habits: state.habits.filter((h) => String(h.id) !== habitIdStr),
        }));

        if (removedHabit) {
          // Dispatch custom event for analytics
          window.dispatchEvent(new CustomEvent('habit_removed', { detail: removedHabit }));
        }
      },

      // AI-Service Compatible Deep Work
      startDeepWork: (duration) => {
        const session: DeepWorkSession = {
          id: `dw_${Date.now()}`,
          startTime: new Date().toISOString(),
          duration: duration || 60,
          status: 'active',
          focusArea: 'quick_start'
        };
        set({ activeDeepWork: session });
      },

      incrementDeepWorkCount: () => {
        const timezone = useSettingsStore.getState().timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = getDateKeyInTimezone(new Date(), timezone);
        set((state) => {
          const lastDate = state.lastDeepWorkDate;
          if (lastDate !== today) {
            return { dailyDeepWorkCount: 1, lastDeepWorkDate: today };
          }
          return { dailyDeepWorkCount: state.dailyDeepWorkCount + 1 };
        });
      },

      // NEW: Loading state management
      setIsLoading: (loading) => set({ isLoading: loading }),

      // NEW: Error state management
      setError: (error) => set({ error }),

      // NEW: Direct deep work session setter
      setActiveDeepWork: (session) => set({ activeDeepWork: session }),

      // NEW: Clear deep work session
      clearActiveDeepWork: () => set({ activeDeepWork: null }),

      // NEW: Data fetch flag management
      setDataFetched: (fetched) => set({ dataFetched: fetched }),

      // OPTILENO INTEGRATION: This handles full auto-planning commands
      createPlan: (payload) => {
        set((state) => {
          const newTasks = payload.tasks ? [...state.tasks, ...payload.tasks] : state.tasks;
          const newHabits = payload.habits ? [...state.habits, ...payload.habits] : state.habits;
          const newGoals = payload.goals ? [...state.goals, ...payload.goals] : state.goals;

          const newState = {
            tasks: mergeById(state.tasks as Task[], newTasks as Task[]),
            habits: mergeById(state.habits as Habit[], newHabits as Habit[]),
            goals: mergeById(state.goals as Goal[], newGoals as Goal[]),
          };

          // Dispatch events for each created item
          if (payload.tasks) {
            payload.tasks.forEach((task: Task) => {
              window.dispatchEvent(new CustomEvent('task_created', { detail: task }));
            });
          }

          if (payload.habits) {
            payload.habits.forEach((habit: Habit) => {
              window.dispatchEvent(new CustomEvent('habit_created', { detail: habit }));
            });
          }

          if (payload.goals) {
            payload.goals.forEach((goal: Goal) => {
              window.dispatchEvent(new CustomEvent('goal_created', { detail: goal }));
            });
          }

          return newState;
        });
      },

      resetPlanner: () => set({
        tasks: [],
        goals: [],
        habits: [],
        activeDeepWork: null,
        isLoading: false,
        error: null,
        socketInitialized: false,
        dataFetched: false
      }),

      // Fetch methods to refresh data after AI creates items
      fetchTasks: async () => {
        set({ isLoading: true });
        try {
          const response = await plannerApi.getTasks();
          if (response.success && response.data) {
            set(() => ({
              tasks: uniqueById(response.data as Task[]),
              dataFetched: true
            }));
          }
        } catch (error) {
          console.error('Failed to fetch tasks:', error);
          set({ error: 'Failed to load tasks' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchGoals: async () => {
        set({ isLoading: true });
        try {
          const response = await plannerApi.getGoals();
          if (response.success && response.data) {
            set(() => ({
              goals: uniqueById(response.data as Goal[]),
              dataFetched: true
            }));
          }
        } catch (error) {
          console.error('Failed to fetch goals:', error);
          set({ error: 'Failed to load goals' });
        } finally {
          set({ isLoading: false });
        }
      },

      fetchHabits: async () => {
        set({ isLoading: true });
        try {
          const timezone = useSettingsStore.getState().timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          const response = await plannerApi.getHabits(timezone);
          if (response.success && response.data) {
            set(() => ({
              habits: uniqueById(response.data as Habit[]),
              dataFetched: true
            }));
          }
        } catch (error) {
          console.error('Failed to fetch habits:', error);
          set({ error: 'Failed to load habits' });
        } finally {
          set({ isLoading: false });
        }
      },

      initSocketListeners: () => {
        if (get().socketInitialized) return;

        console.log('🔌 Initializing Planner Socket Listeners');

        // Task Created
        plannerApi.onTaskCreated((task) => {
          console.log('✨ Socket Event: Task Created', task);
          get().addTask(task);
        });

        // Task Updated
        plannerApi.onTaskUpdated((task) => {
          console.log('✨ Socket Event: Task Updated', task);
          get().addTask(task);
        });

        // Task Deleted
        plannerApi.onTaskDeleted((taskId) => {
          console.log('✨ Socket Event: Task Deleted', taskId);
          get().removeTask(taskId);
        });

        // Habit Created
        plannerApi.onHabitCreated((habit) => {
          console.log('✨ Socket Event: Habit Created', habit);
          get().addHabit(habit);
        });

        // NEW: Habit Completed
        plannerApi.onHabitCompleted((habit) => {
          console.log('✨ Socket Event: Habit Completed', habit);
          get().addHabit(habit);
          window.dispatchEvent(new CustomEvent('habit_completed', { detail: habit }));
        });

        // NEW: Goal Events
        plannerApi.onGoalCreated((goal) => {
          console.log('✨ Socket Event: Goal Created', goal);
          get().addGoal(goal);
        });

        plannerApi.onGoalUpdated((goal) => {
          console.log('✨ Socket Event: Goal Updated', goal);
          get().addGoal(goal);
        });

        plannerApi.onGoalProgressChanged(({ goalId, progress }) => {
          console.log('✨ Socket Event: Goal Progress Changed', goalId, progress);
          let updatedGoal: Goal | null = null;
          set((state) => ({
            goals: state.goals.map((g) =>
              String(g.id) === String(goalId)
                ? (() => {
                    updatedGoal = {
                      ...g,
                      current_progress: progress,
                      progress,
                    };
                    return updatedGoal;
                  })()
                : g
            ),
          }));

          if (updatedGoal) {
            window.dispatchEvent(new CustomEvent('goal_updated', { detail: updatedGoal }));
          }
        });

        // Deep Work Started
        plannerApi.onDeepWorkStarted((session) => {
          console.log('✨ Socket Event: Deep Work Started', session);
          get().setActiveDeepWork(session);
        });

        set({ socketInitialized: true });
      }
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        goals: state.goals,
        habits: state.habits,
      }),
    }
  )
);

// Initialize socket listeners after store is created
usePlannerStore.getState().initSocketListeners();
