import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '../stores/useUserStore';

interface ProductivityMetrics {
  score: number;
  period: number;
  breakdown: {
    taskCompletion: number;
    habitCompletion: number;
    goalProgress: number;
  };
  stats: {
    tasksTotal: number;
    tasksCompleted: number;
    habitsTotal: number;
    habitsCompleted: number;
    goalsTotal: number;
  };
}

interface AnalyticsData {
  productivity: ProductivityMetrics | null;
  taskMetrics: any;
  habitMetrics: any;
  goalMetrics: any;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * Hook for loading and managing analytics data from backend
 * Fetches real productivity metrics
 */
export const useAnalyticsLoader = (period: number = 1) => {
  const profile = useUserStore((state) => state.profile);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    productivity: null,
    taskMetrics: null,
    habitMetrics: null,
    goalMetrics: null,
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchAnalytics = useCallback(async () => {
    if (!profile.id) {
      setAnalytics((prev) => ({
        ...prev,
        isLoading: false,
        error: 'User not authenticated',
      }));
      return;
    }

    setAnalytics((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch productivity score
      const prodRes = await fetch(`/api/v1/analytics/productivity?days=${period}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!prodRes.ok) throw new Error('Failed to fetch productivity metrics');
      const prodData = await prodRes.json();

      // Fetch task metrics
      const taskRes = await fetch('/api/v1/analytics/tasks', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const taskData = taskRes.ok ? await taskRes.json() : null;

      // Fetch habit metrics
      const habitRes = await fetch('/api/v1/analytics/habits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const habitData = habitRes.ok ? await habitRes.json() : null;

      // Fetch goal metrics
      const goalRes = await fetch('/api/v1/analytics/goals', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const goalData = goalRes.ok ? await goalRes.json() : null;

      setAnalytics({
        productivity: prodData.success ? prodData : null,
        taskMetrics: taskData?.success ? taskData.metrics : null,
        habitMetrics: habitData?.success ? habitData.metrics : null,
        goalMetrics: goalData?.success ? goalData.metrics : null,
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      });

      console.log('✓ Analytics loaded:', {
        productivityScore: prodData.score,
        tasksCompleted: taskData?.metrics?.completed || 0,
        habitsCompleted: habitData?.metrics?.completed || 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAnalytics((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      console.error('✗ Analytics load failed:', message);
    }
  }, [profile.id, period]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Refresh every 20 seconds for continuous updates
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('📊 Auto-refreshing analytics...');
      fetchAnalytics();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  // Also listen for period changes
  useEffect(() => {
    fetchAnalytics();
  }, [period, fetchAnalytics]);

  return {
    ...analytics,
    refetch: fetchAnalytics,
  };
};
