import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Flame, TrendingUp, Plus, X, Trash2, Calendar, Award, Zap, Trophy } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import { useRealtime } from '../../hooks/useRealtime';
import '../../styles/components/planner/HabitTracker.css';
import type { Habit } from '../../types/planner.types';

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
  const { onHabitCreated, onHabitCompleted } = useRealtime();

  // Use habits from hook primarily
  const activeHabits = storeHabits.length > 0 ? storeHabits : (propsHabits || []);

  const [trackingHabits, setTrackingHabits] = useState<UIHabit[]>([]);
  const [showNewHabitModal, setShowNewHabitModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());
  const [newHabit, setNewHabit] = useState({
    name: '',
    description: '',
    category: 'Wellness',
    goalId: ''
  });

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
    const today = new Date().toISOString().split('T')[0];
    const last = h.lastCompleted instanceof Date
      ? h.lastCompleted.toISOString().split('T')[0]
      : (typeof h.lastCompleted === 'string' ? h.lastCompleted.split('T')[0] : '');

    const isCompletedToday = last === today;

    // Generate history based on real data if available
    const history: boolean[] = [];
    const historySet = new Set(h.history || []);

    // Fallback logic if history is empty but streak exists (migration support)
    const useStreakFallback = (h.history?.length || 0) === 0 && (h.currentStreak || 0) > 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

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
        console.error('Failed to track habit:', result.error);
      }
    } catch (e) {
      console.error('Failed to track habit:', e);
    } finally {
      // Remove from tracking-in-progress
      setTrackingInProgress(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this habit?')) {
      const result = await deleteHabit(id);
      if (!result.success) {
        alert(result.error || 'Failed to delete habit');
      }
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
        console.log('✓ Habit created successfully');
        setShowNewHabitModal(false);
        setNewHabit({ name: '', description: '', category: 'Wellness', goalId: '' });
      } else {
        alert(result.error || 'Failed to create habit');
      }
    } catch (error: any) {
      console.error('Error creating habit:', error);
      alert(error.message || 'Failed to create habit');
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

  // Helper to get day letter
  const getDayLetter = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString('en-US', { weekday: 'narrow' });
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
                      onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                      title="Delete habit"
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

      {showNewHabitModal && (
        <div className="modal-overlay" onClick={() => setShowNewHabitModal(false)}>
          <div className="modal-content habit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Plus size={18} />
                <h3>New Daily Habit</h3>
              </div>
              <button className="modal-close" onClick={() => setShowNewHabitModal(false)}><X size={20} /></button>
            </div>
            {/* Form content remains roughly the same but cleaner */}
            <div className="modal-body">
              <div className="form-group">
                <label>Habit Name</label>
                <input
                  value={newHabit.name}
                  onChange={e => setNewHabit({ ...newHabit, name: e.target.value })}
                  placeholder="e.g., Meditation, Reading..."
                  autoFocus
                  className="modern-input"
                />
              </div>
              <div className="form-group">
                <label>Motivation / Description</label>
                <textarea
                  value={newHabit.description}
                  onChange={e => setNewHabit({ ...newHabit, description: e.target.value })}
                  placeholder="Why do you want to build this habit?"
                  className="modern-textarea"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <div className="category-select-modern">
                  {['Wellness', 'Health', 'Learning', 'Productivity', 'Fitness'].map(cat => (
                    <button
                      key={cat}
                      className={`cat-btn ${newHabit.category === cat ? 'selected' : ''}`}
                      onClick={() => setNewHabit({ ...newHabit, category: cat })}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Link to Goal (Optional)</label>
                <select
                  value={newHabit.goalId || ''}
                  onChange={e => setNewHabit({ ...newHabit, goalId: e.target.value })}
                  className="modern-input"
                  style={{ width: '100%', padding: '10px', marginTop: '5px' }}
                >
                  <option value="">No Link</option>
                  {goals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowNewHabitModal(false)}>Cancel</button>
              <button
                className="modal-btn submit"
                onClick={handleCreateHabit}
                disabled={isSaving || !newHabit.name.trim()}
              >
                {isSaving ? 'Creating...' : 'Start Habit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}