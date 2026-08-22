import React, { useState, useEffect } from 'react';
import { CheckCircle, Flame, Plus, X, Award, Zap, Trophy, AlertTriangle } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import { useRealtime } from '../../hooks/useRealtime';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { getDateKeyInTimezone } from '../../utils/timezone';
import '../../styles/components/planner/HabitTracker.css';
import type { Habit } from '../../types/planner.types';
import { Modal } from '../common/Modal';

interface UIHabit extends Omit<Habit, 'frequency'> {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  completedToday: boolean;
  category: string;
  recentHistory: boolean[]; // Last 7 days, 0 is today
}

interface HabitTrackerProps {
  habits?: Habit[];
}

export default function HabitTracker({ habits: propsHabits }: HabitTrackerProps) {
  const { habits: storeHabits, createHabit, fetchHabits, deleteHabit, trackHabit, goals } = usePlanner();
  const isUltra = useUserStore((state) => state.isUltra);
  const timezone = useSettingsStore((state) => state.timezone);
  const { onHabitCreated, onHabitCompleted } = useRealtime();

  // Use habits from hook primarily
  const activeHabits = storeHabits.length > 0 ? storeHabits : (propsHabits || []);

  const [trackingHabits, setTrackingHabits] = useState<UIHabit[]>([]);
  const [showNewHabitModal, setShowNewHabitModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [habitPendingDelete, setHabitPendingDelete] = useState<UIHabit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '',
    description: '',
    category: 'Wellness',
    goalId: ''
  });

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Listen for real-time habit updates
  useEffect(() => {
    const unsub1 = onHabitCreated(() => {
      fetchHabits();
    });

    const unsub2 = onHabitCompleted(() => {
      fetchHabits();
    });

    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, [onHabitCreated, onHabitCompleted, fetchHabits]);

  // Adapter to enhance habit data for UI
  const adaptHabit = (h: Habit): UIHabit => {
    const today = getDateKeyInTimezone(new Date(), timezone);
    const last = h.lastCompleted instanceof Date
      ? getDateKeyInTimezone(h.lastCompleted, timezone)
      : (typeof h.lastCompleted === 'string'
        ? getDateKeyInTimezone(new Date(h.lastCompleted), timezone)
        : '');

    const isCompletedToday = last === today;

    // Generate history based on real data if available
    const history: boolean[] = [];
    const historySet = new Set(h.history || []);

    // Fallback logic if history is empty but streak exists (migration support)
    const useStreakFallback = (h.history?.length || 0) === 0 && (h.currentStreak || 0) > 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getDateKeyInTimezone(d, timezone);

      if (useStreakFallback) {
        // Legacy behavior: infer from streak
        if (i === 0) history.push(isCompletedToday);
        else {
          const effectiveStreak = isCompletedToday ? (h.currentStreak || 0) - 1 : (h.currentStreak || 0);
          history.push(i <= effectiveStreak);
        }
      } else {
        // New precise behavior: check history set
        history.push(historySet.has(dateStr));
      }
    }

    return {
      ...h,
      frequency: (h.frequency as any) || 'daily',
      completedToday: isCompletedToday,
      category: h.category || 'Wellness',
      recentHistory: history,
      // Pass through raw history for updates
      history: h.history
    };
  };

  useEffect(() => {
    setTrackingHabits(activeHabits.map(adaptHabit));
  }, [activeHabits]);

  const toggleHabitCompletion = async (id: string) => {
    // Prevent double-click
    if (trackingInProgress.has(id)) return;

    // Mark as tracking in progress
    setTrackingInProgress(prev => new Set(prev).add(id));

    try {
      const result = await trackHabit(id);
      if (!result.success) {
        setNotice({ type: 'error', text: result.error || 'Could not save that check-in. Try again.' });
      }
    } catch (e: any) {
      setNotice({ type: 'error', text: e?.message || 'Could not save that check-in. Try again.' });
    } finally {
      // Remove from tracking-in-progress
      setTrackingInProgress(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!habitPendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteHabit(habitPendingDelete.id);
      if (result.success) {
        setNotice({ type: 'success', text: `Habit "${habitPendingDelete.name}" deleted.` });
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to delete habit.' });
      }
      setHabitPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateHabit = async () => {
    if (!newHabit.name.trim()) return;
    setIsSaving(true);
    try {
      // Convert name to title for API compatibility
      const habitData = {
        name: newHabit.name,
        title: newHabit.name, // Add title field for backend compatibility
        description: newHabit.description,
        category: newHabit.category,
        goalId: newHabit.goalId
      };

      const result = await createHabit(habitData);
      if (result.success) {
        setShowNewHabitModal(false);
        setNewHabit({ name: '', description: '', category: 'Wellness', goalId: '' });
        setFormError(null);
        setNotice({ type: 'success', text: `Habit "${habitData.name}" started. Day one begins now.` });
      } else {
        setFormError(result.error || 'Failed to create habit. Please try again.');
      }
    } catch (error: any) {
      setFormError(error.message || 'Failed to create habit. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const calculateConsistency = () => {
    if (activeHabits.length === 0) return { level: 'No Data', percentage: 0, color: '#94a3b8' };
    const totalStreak = activeHabits.reduce((acc, h) => acc + (h.currentStreak || 0), 0);
    const avg = totalStreak / activeHabits.length;
    const percentage = Math.min(100, avg * 10); // Scale factor

    if (avg >= 7) return { level: 'Unstoppable', percentage, color: '#ec4899' }; // Pink
    if (avg >= 4) return { level: 'Consistent', percentage, color: '#8b5cf6' }; // Violet
    if (avg >= 2) return { level: 'Building', percentage, color: '#3b82f6' }; // Blue
    return { level: 'Starting', percentage, color: '#10b981' }; // Green
  };

  const consistency = calculateConsistency();

  // Day letter for the history strip. Must use the app's configured timezone —
  // the same one the dots are computed in — or the labels drift off by one
  // when OS timezone differs from the app setting.
  const getDayLetter = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: timezone });
  };

  return (
    <div className="habit-tracker">
      <div className="habit-header">
        <div className="habit-title">
          <div className="icon-wrapper flame-icon">
            <Flame size={20} className="flame-animation" />
          </div>
          <div>
            <h3>Habit Tracker</h3>
            <p className="subtitle">Daily consistency builder</p>
          </div>
        </div>

        <div className="consistency-display">
          <div className="consistency-header">
            <Zap size={14} fill={consistency.color} color={consistency.color} />
            <span style={{ color: consistency.color }}>{consistency.level}</span>
          </div>
          <div className="consistency-bar">
            <div
              className="consistency-fill"
              style={{
                width: `${consistency.percentage}%`,
                backgroundColor: consistency.color,
                boxShadow: `0 0 10px ${consistency.color}40`
              }}
            />
          </div>
        </div>
      </div>

      {notice && (
        <div className={`habit-tracker-notice is-${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="habits-container">
        {trackingHabits.length === 0 ? (
          <div className="empty-habits">
            <Award size={48} className="text-secondary opacity-20 mb-3" />
            <p>No habits yet. Start your streak today!</p>
          </div>
        ) : (
          <div className="habits-grid">
            {trackingHabits.map((habit) => (
              <div key={habit.id} className={`habit-card ${habit.completedToday ? 'completed' : ''}`}>
                <div className="habit-main">
                  <div className="habit-top-row">
                    <span className={`category-badge category-${habit.category.toLowerCase()}`}>
                      {habit.category}
                    </span>
                    <button
                      className="delete-icon-btn"
                      onClick={(e) => { e.stopPropagation(); setHabitPendingDelete(habit); }}
                      title="Delete habit"
                      aria-label={`Delete habit "${habit.name}"`}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="habit-info">
                    <h4>{habit.name}</h4>
                    <p>{habit.description}</p>
                  </div>

                  {/* 7-Day History Dots */}
                  <div className="habit-history">
                    <div className="history-dots">
                      {[6, 5, 4, 3, 2, 1, 0].map((daysAgo) => (
                        <div key={daysAgo} className="history-item">
                          <div className="day-label">{getDayLetter(daysAgo)}</div>
                          <div className={`history-dot ${habit.recentHistory[daysAgo] ? 'filled' : ''}`} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="habit-footer">
                    <div className="streak-info">
                      <div className="streak-badge">
                        <Flame size={14} className={habit.currentStreak > 0 ? "text-orange-500 fill-orange-500" : "text-slate-400"} />
                        <span>{habit.currentStreak} day streak</span>
                      </div>
                      {(habit.longestStreak > 0) && (
                        <div className="best-streak-badge">
                          <Trophy size={12} />
                          <span>Best: {habit.longestStreak}</span>
                        </div>
                      )}
                    </div>

                    <button
                      className={`check-btn ${habit.completedToday ? 'checked' : ''}`}
                      onClick={() => toggleHabitCompletion(habit.id)}
                      disabled={trackingInProgress.has(habit.id)}
                    >
                      {trackingInProgress.has(habit.id) ? (
                        <div className="tracking-spinner" />
                      ) : habit.completedToday ? (
                        <CheckCircle size={18} />
                      ) : (
                        <div className="circle-outline" />
                      )}
                      <span>
                        {trackingInProgress.has(habit.id)
                          ? 'Saving...'
                          : habit.completedToday
                            ? 'Done'
                            : 'Mark Done'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="habit-controls">
        <button className="new-habit-btn" onClick={() => setShowNewHabitModal(true)}>
          <Plus size={16} />
          <span>Add New Habit</span>
        </button>
      </div>

      <Modal
        isOpen={showNewHabitModal}
        onOpenChange={setShowNewHabitModal}
        title="New Daily Habit"
        className="habit-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setShowNewHabitModal(false)}>Cancel</button>
            <button
              className="app-modal-btn app-modal-btn-primary"
              onClick={handleCreateHabit}
              disabled={isSaving || !newHabit.name.trim()}
            >
              {isSaving ? 'Creating...' : 'Start Habit'}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="habit-form-error" role="alert">
              <AlertTriangle size={14} />
              <span>{formError}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Habit Name</label>
            <input
              value={newHabit.name}
              onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
              placeholder="e.g., Meditation, Reading..."
              autoFocus
              className="habit-modal-input px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Motivation / Description</label>
            <textarea
              value={newHabit.description}
              onChange={e => setNewHabit({ ...newHabit, description: e.target.value })}
              placeholder="Why do you want to build this habit?"
              className="habit-modal-textarea px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm min-h-[100px] resize-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Category</label>
            <div className="flex flex-wrap gap-2">
              {['Wellness', 'Health', 'Learning', 'Productivity', 'Fitness'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`habit-modal-category-btn ${newHabit.category === cat ? 'is-selected' : ''}`}
                  onClick={() => setNewHabit({ ...newHabit, category: cat })}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {isUltra && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Link to Goal (Optional)</label>
              <select
                value={newHabit.goalId || ''}
                onChange={e => setNewHabit({ ...newHabit, goalId: e.target.value })}
                className="habit-modal-goal-select px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
              >
                <option value="">No Link</option>
                {goals.map(g => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!habitPendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setHabitPendingDelete(null);
        }}
        title="Delete Habit"
        className="habit-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={() => setHabitPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn app-modal-btn-danger"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Habit'}
            </button>
          </div>
        }
      >
        <p className="habit-delete-confirm-text">
          Delete <strong>"{habitPendingDelete?.name}"</strong>?
          {habitPendingDelete && habitPendingDelete.currentStreak > 0 && (
            <> Your {habitPendingDelete.currentStreak}-day streak will be lost.</>
          )}{' '}
          This can't be undone.
        </p>
      </Modal>
    </div>
  );
}
