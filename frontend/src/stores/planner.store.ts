// frontend/src/stores/planner.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeepWorkSession } from '../services/api/planner.service';
import type { Task, Goal, Habit } from '../types/planner.types';

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
}

// We need to import plannerApi to use it in the store actions
import { plannerApi } from '../services/api/planner.service';

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

      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => {
        set((state) => ({ tasks: [...state.tasks, task] }));
        // Dispatch custom event for analytics
        window.dispatchEvent(new CustomEvent('task_created', { detail: task }));
      },

      updateTask: (taskId, updates) =>
        set((state) => {
          const updatedTasks = state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
          const updatedTask = updatedTasks.find(t => t.id === taskId);

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

      setGoals: (goals) => set({ goals }),
      addGoal: (goal) => {
        set((state) => ({ goals: [...state.goals, goal] }));
        // Dispatch custom event for analytics
        window.dispatchEvent(new CustomEvent('goal_created', { detail: goal }));
      },
      removeGoal: (goalId) => {
        const goalIdStr = String(goalId);
        set((state) => ({
          goals: state.goals.filter((g) => String(g.id) !== goalIdStr),
        }));
      },

      setHabits: (habits) => set({ habits }),

      addHabit: (habit) => {
        set((state) => ({ habits: [...state.habits, habit] }));
        // Dispatch custom event for analytics
        window.dispatchEvent(new CustomEvent('habit_created', { detail: habit }));
      },

      // AI-Service Compatible Habit Toggle
      toggleHabit: (habitId, completed) =>
        set((state) => {
          const updatedHabits = state.habits.map((h) =>
            h.id === habitId
              ? {
                ...h,
                currentStreak: completed ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1),
                // If uncompleting, clear lastCompleted so it doesn't count as today
                lastCompleted: completed ? new Date() : (new Date(0)),
              }
              : h
          );

          const updatedHabit = updatedHabits.find(h => h.id === habitId);

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
          duration: 0,
          status: 'active',
          focusArea: 'quick_start'
        };
        set({ activeDeepWork: session });
      },

      incrementDeepWorkCount: () => {
        const today = new Date().toISOString().split('T')[0];
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
            tasks: newTasks,
            habits: newHabits,
            goals: newGoals,
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
            set({ tasks: response.data, dataFetched: true });
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
            set({ goals: response.data, dataFetched: true });
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
          const response = await plannerApi.getHabits();
          if (response.success && response.data) {
            set({ habits: response.data, dataFetched: true });
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
          // We need to handle the update
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
          }));
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