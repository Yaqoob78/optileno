import { useEffect, useState, useCallback } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { api } from '../services/api/client';

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
      const range = period >= 30 ? 'monthly' : period >= 7 ? 'weekly' : 'daily';
      const [prodRes, focusRes, moodRes] = await Promise.all([
        api.get<any>(`/analytics/productivity/score/${range === 'daily' ? 'today' : range}`),
        api.get<any>(`/analytics/focus/score/${range === 'daily' ? 'today' : range}`),
        api.get<any>('/analytics/mood/current'),
      ]);

      if (!prodRes.success || !prodRes.data) throw new Error(prodRes.error?.message || 'Failed to fetch productivity metrics');
      const prodData = prodRes.data;
      const taskData = focusRes.success ? focusRes.data : null;
      const habitData = moodRes.success ? moodRes.data : null;
      const goalData = null;

      setAnalytics({
        productivity: prodData || null,
        taskMetrics: taskData || null,
        habitMetrics: habitData || null,
        goalMetrics: goalData,
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
