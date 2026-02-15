/**
 * GoalProgress
 *
 * Backend-first goal analytics wrapper.
 * Listens to realtime planner events and triggers backend goal progress refreshes.
 */

import React, { useEffect, useState } from 'react';
import { useRealtime } from '../../hooks/useRealtime';
import GoalAnalyticsDashboard from './GoalAnalyticsDashboard';

interface GoalProgressProps {
  timeRange?: 'daily' | 'weekly' | 'monthly';
}

export default function GoalProgress({ timeRange = 'weekly' }: GoalProgressProps) {
  const [refreshKey, setRefreshKey] = useState(0);
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

  useEffect(() => {
    const tick = () => setRefreshKey((prev) => prev + 1);
    const unsubscribers = [
      onGoalCreated(tick),
      onGoalUpdated(tick),
      onGoalProgressChanged(tick),
      onTaskCreated(tick),
      onTaskUpdated(tick),
      onTaskDeleted(tick),
      onHabitCreated(tick),
      onHabitCompleted(tick),
      onDeepWorkCompleted(tick),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [
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

  return <GoalAnalyticsDashboard timeRange={timeRange} refreshKey={refreshKey} />;
}
