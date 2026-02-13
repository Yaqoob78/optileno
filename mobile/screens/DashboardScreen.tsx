// mobile/screens/DashboardScreen.tsx
/**
 * Dashboard Screen
 * Home screen showing overview, quick actions, and recent activity
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { RealtimeService } from '../services/RealtimeService';

export default function DashboardScreen() {
  const { colors, spacing } = useAppTheme();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    deepWorkMinutes: 0,
    focusScore: 0,
    streakDays: 0,
  });

  useEffect(() => {
    // Setup real-time listeners
    RealtimeService.on('task:completed', (data) => {
      setStats((prev: any) => ({
        ...prev,
        tasksCompleted: prev.tasksCompleted + 1,
      }));
    });

    RealtimeService.on('deep-work:completed', (data) => {
      setStats((prev: any) => ({
        ...prev,
        deepWorkMinutes: prev.deepWorkMinutes + (data.duration || 0),
      }));
    });

    return () => {
      RealtimeService.off('task:completed', () => {});
      RealtimeService.off('deep-work:completed', () => {});
    };
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: spacing.md,
    },
    header: {
      marginBottom: spacing.lg,
    },
    greeting: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    date: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    statValue: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: spacing.md,
    },
    quickActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionButtonPrimary: {
      backgroundColor: colors.primary,
    },
    actionButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      marginTop: spacing.xs,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back! 👋</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.tasksCompleted}</Text>
            <Text style={styles.statLabel}>Tasks Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.deepWorkMinutes}</Text>
            <Text style={styles.statLabel}>Deep Work (min)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.focusScore}%</Text>
            <Text style={styles.statLabel}>Focus Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.streakDays}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]}>
              <Text style={styles.actionButtonText}>+ Add Task</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>🎯 Deep Work</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
