/**
 * GoalProgress — Enhanced with AI Probability Analysis
 *
 * Now renders the GoalAnalyticsDashboard which shows:
 * - Up to 3 goals prioritized by deadline
 * - AI probability levels (Very High → Very Low)
 * - Task cards, habits, and deep work breakdown
 * - Max goal limit message
 * - Real-time updates via WebSocket
 */

import React, { useEffect } from 'react';
import { usePlanner } from '../../hooks/usePlanner';
import { useRealtime } from '../../hooks/useRealtime';
import GoalAnalyticsDashboard from './GoalAnalyticsDashboard';

export default function GoalProgress() {
  const {
    isLoading,
    fetchGoals,
    fetchTasks,
    fetchHabits,
  } = usePlanner();

  const {
    onGoalCreated,
    onGoalUpdated,
    onGoalProgressChanged,
    onTaskCreated,
    onTaskUpdated,
    onTaskDeleted,
    onHabitCreated,
    onHabitCompleted,
    onDeepWorkCompleted,
  } = useRealtime();

  // Real-time subscriptions to keep data fresh
  useEffect(() => {
    const unsubscribers = [
      onGoalCreated(() => fetchGoals()),
      onGoalUpdated(() => fetchGoals()),
      onGoalProgressChanged(() => fetchGoals()),
      onTaskCreated(() => fetchTasks()),
      onTaskUpdated(() => fetchTasks()),
      onTaskDeleted(() => fetchTasks()),
      onHabitCreated(() => fetchHabits()),
      onHabitCompleted(() => fetchHabits()),
      onDeepWorkCompleted(() => fetchTasks()),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [
    fetchGoals,
    fetchHabits,
    fetchTasks,
    onDeepWorkCompleted,
    onGoalCreated,
    onGoalProgressChanged,
    onGoalUpdated,
    onHabitCompleted,
    onHabitCreated,
    onTaskCreated,
    onTaskDeleted,
    onTaskUpdated,
  ]);

  // Render the enhanced AI-powered analytics dashboard
  return <GoalAnalyticsDashboard />;
}
