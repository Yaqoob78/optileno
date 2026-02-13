// frontend/services/ai/ai.service.ts

import { usePlannerStore } from '../../stores/planner.store';
import type { Goal, Task, Habit } from '../../types/planner.types';
import { useAnalyticsStore } from '../../stores/analytics.store';
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useUserStore } from "../../stores/useUserStore";

/**
 * Unified AI response shape (from backend).
 * Frontend must not modify this contract.
 */
export interface AIUnifiedResponse {
  message: string;
  intent: string;
  actions: Array<{
    type: string;
    payload: Record<string, any>;
    status?: string;
    result?: any;
  }>;
  ui: Record<string, any>;
  data: Record<string, any>;
}

/**
 * AIService
 * -------------------
 * Executes AI actions returned by backend across all 5 modules.
 * This is the central hub for AI-driven planner automation.
 */
class AIService {
  handleAIResponse(response: AIUnifiedResponse): void {
    if (!response || !Array.isArray(response.actions)) {
      console.warn('Invalid AI response format');
      return;
    }

    // Accessing all relevant stores for full page integration
    const plannerStore = usePlannerStore.getState();
    const analyticsStore = useAnalyticsStore.getState();
    const settingsStore = useSettingsStore.getState();
    const userStore = useUserStore.getState();

    response.actions.forEach(({ type, payload, result }) => {
      switch (type) {
        // ─── PLANNER: GOAL ACTIONS (NEW - MAIN TARGET) ────────────────
        case 'PLANNER_CREATE_GOAL':
          // Handle goal creation with cascade
          if (result?.goal) {
            const goalPayload = result.goal;
            const goal: Goal = {
              id: goalPayload.id || `goal_${Date.now()}`,
              title: goalPayload.title || 'New Goal',
              description: goalPayload.description || '',
              category: goalPayload.category || 'personal',
              target_date: goalPayload.target_date || null,
              current_progress: goalPayload.current_progress || 0,
              milestones: goalPayload.milestones || [],
              ai_suggestions: goalPayload.ai_suggestions || [],
              created_at: goalPayload.created_at || new Date().toISOString(),
            };
            plannerStore.addGoal(goal);

            // If tasks were auto-generated, add them too
            if (result.tasks_created && Array.isArray(result.tasks_created)) {
              result.tasks_created.forEach((taskData: any) => {
                const task: Task = {
                  id: taskData.id || `task_${Date.now()}_${Math.random()}`,
                  title: taskData.title,
                  description: taskData.description || '',
                  status: 'pending',
                  priority: taskData.priority || 'medium',
                  category: taskData.category || 'general',
                  tags: taskData.tags || [],
                  dueDate: taskData.due_date ? new Date(taskData.due_date) : null,
                  estimatedDuration: taskData.estimated_minutes || 30,
                  actualDuration: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  completedAt: null,
                };
                plannerStore.addTask(task);
              });
            }

            // If habits were created, add them
            if (result.habits_created && Array.isArray(result.habits_created)) {
              const existingHabits = plannerStore.habits || [];
              const newHabits: Habit[] = result.habits_created.map((h: any) => ({
                id: h.id || `habit_${Date.now()}_${Math.random()}`,
                name: h.name,
                description: h.description || '',
                frequency: h.frequency || 'daily',
                targetCount: h.target || 1,
                currentStreak: 0,
                longestStreak: 0,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                lastCompleted: null,
                metadata: { category: 'general', trigger: '', reward: '', difficulty: 50 }
              }));
              plannerStore.setHabits([...existingHabits, ...newHabits]);
            }
          } else if (payload) {
            // Direct payload handling (if result is not provided)
            const goal: Goal = {
              id: payload.id || `goal_${Date.now()}`,
              title: payload.title || 'New Goal',
              description: payload.description || '',
              category: payload.category || 'personal',
              target_date: payload.targetDate || null,
              current_progress: 0,
              milestones: [],
              ai_suggestions: [],
              created_at: new Date().toISOString(),
            };
            plannerStore.addGoal(goal);
          }
          break;

        case 'PLANNER_ADD_GOAL':
          // Legacy action - same as CREATE_GOAL
          const legacyGoalPayload = payload as any;
          const legacyGoal: Goal = {
            id: legacyGoalPayload.id || `goal_${Date.now()}`,
            title: legacyGoalPayload.title || 'New Goal',
            description: legacyGoalPayload.description || '',
            category: legacyGoalPayload.category || 'personal',
            target_date: legacyGoalPayload.targetDate || null,
            current_progress: legacyGoalPayload.progress || 0,
            milestones: [],
            ai_suggestions: [],
            created_at: new Date().toISOString(),
          };
          plannerStore.addGoal(legacyGoal);
          break;

        // ─── PLANNER: TASK ACTIONS ────────────────────────────────────
        case 'PLANNER_CREATE_TASK':
          if (result?.task) {
            const taskData = result.task;
            const task: Task = {
              id: taskData.id || `task_${Date.now()}`,
              title: taskData.title,
              description: taskData.description || '',
              status: taskData.status || 'pending',
              priority: taskData.priority || 'medium',
              category: taskData.category || 'general',
              tags: taskData.tags || [],
              dueDate: taskData.due_date ? new Date(taskData.due_date) : null,
              estimatedDuration: taskData.estimated_minutes || 30,
              actualDuration: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              completedAt: null,
            };
            plannerStore.addTask(task);
          }
          break;

        case 'PLANNER_UPDATE_TASK':
          if (payload.task_id && payload.updates) {
            plannerStore.updateTask(payload.task_id, payload.updates);
          }
          break;

        case 'PLANNER_COMPLETE_TASK':
          if (result?.task_id || payload?.task_id) {
            const taskId = result?.task_id || payload.task_id;
            plannerStore.updateTask(taskId, { status: 'completed', completedAt: new Date() });
          }
          break;

        // ─── PLANNER: HABIT ACTIONS ───────────────────────────────────
        case 'PLANNER_TRACK_HABIT':
          if (payload.habit_id !== undefined && payload.status !== undefined) {
            plannerStore.toggleHabit(payload.habit_id, payload.status);
          } else if (result?.habit_id) {
            plannerStore.toggleHabit(result.habit_id, true);
          }
          break;

        case 'PLANNER_CREATE_HABIT':
          if (result || payload) {
            const habitData = result || payload;
            const existingHabits = plannerStore.habits || [];
            const newHabit: Habit = {
              id: habitData.id || `habit_${Date.now()}`,
              name: habitData.name,
              description: habitData.description || '',
              frequency: habitData.frequency || 'daily',
              targetCount: habitData.target || 1,
              currentStreak: 0,
              longestStreak: 0,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
              lastCompleted: null,
            };
            plannerStore.setHabits([...existingHabits, newHabit]);
          }
          break;

        // ─── PLANNER: DEEP WORK ACTIONS ───────────────────────────────
        case 'PLANNER_START_DEEP_WORK':
          plannerStore.startDeepWork(payload?.duration ?? null);
          plannerStore.incrementDeepWorkCount();
          break;

        case 'PLANNER_COMPLETE_DEEP_WORK':
          plannerStore.clearActiveDeepWork();
          break;

        // ─── PLANNER: PLAN ACTIONS ────────────────────────────────────
        case 'PLANNER_CREATE_PLAN':
          plannerStore.createPlan(payload);
          break;

        case 'PLANNER_GET_DASHBOARD':
          // Dashboard data is returned in result, update stores if needed
          if (result) {
            console.log('Dashboard data received:', result);
            // Could trigger a refresh or update specific stats
          }
          break;

        // ─── ANALYTICS ACTIONS ────────────────────────────────────────
        case 'ANALYTICS_LOG_EVENT':
          if (payload.event && payload.source) {
            analyticsStore.addEvent({
              id: `event_${Date.now()}`,
              type: 'analytics_event',
              subtype: 'behavior_change_detected',
              insight: {
                title: payload.event,
                description: `AI triggered event: ${payload.event}`,
                confidence: 0.8,
                impact: 'medium',
                category: 'productivity',
              },
              patterns: {
                frequency: 1,
              },
              metadata: {
                derivedFrom: [],
                firstObserved: new Date(),
                lastObserved: new Date(),
                ...payload.metadata,
              },
              timestamp: new Date(),
              sessionId: 'ai_session',
              source: 'system',
            });
          }
          break;

        case 'ANALYTICS_REFRESH':
          analyticsStore.syncWithBackend();
          break;

        case 'ANALYTICS_ANALYZE_PATTERNS':
          // Result contains analysis, could update analytics store
          if (result) {
            console.log('Pattern analysis received:', result);
          }
          break;

        // ─── SETTINGS & PROFILE ACTIONS ───────────────────────────────
        case 'SETTINGS_UPDATE':
          if (payload) {
            settingsStore.updateSettings(payload);
          }
          break;

        case 'USER_UPDATE_CONTEXT':
          if (payload) {
            if (typeof userStore.updateUserContext === 'function') {
              userStore.updateUserContext(payload);
            }
          }
          break;

        default:
          console.warn(`Unhandled AI action type: ${type}`);
      }
    });
  }

  /**
   * Process suggested habits from AI and prepare for user confirmation
   */
  getSuggestedHabitsFromResponse(response: AIUnifiedResponse): any[] {
    const goalAction = response.actions.find(a => a.type === 'PLANNER_CREATE_GOAL');
    if (goalAction?.result?.habits_suggested) {
      return goalAction.result.habits_suggested;
    }
    return [];
  }

  /**
   * Check if deep work was proposed
   */
  isDeepWorkProposed(response: AIUnifiedResponse): boolean {
    const goalAction = response.actions.find(a => a.type === 'PLANNER_CREATE_GOAL');
    return goalAction?.result?.deep_work_proposed === true;
  }
}

// Singleton
export const aiService = new AIService();

// Named export for convenience
export const handleAIResponse = aiService.handleAIResponse.bind(aiService);