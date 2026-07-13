import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Calendar,
  ChevronRight,
  Plus,
  Trash2,
  Info,
  X,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import { plannerApi } from '../../services/api/planner.service';
import '../../styles/components/planner/GoalTimeline.css';
import type { Goal } from '../../types/planner.types';
import { DatePicker } from '../ui/DatePicker';
import { GoalAnalytics } from './GoalAnalytics';
import { Modal } from '../common/Modal';

const MAX_MILESTONES = 8;
const MAX_MILESTONE_LENGTH = 80;

interface TimelineNotice {
  type: 'success' | 'error';
  text: string;
}

/** Days from today (local midnight) until the target date. Negative = overdue. */
const daysUntil = (targetDate: string): number => {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return NaN;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
};

/** Milestones arrive as strings (our modal) or objects (AI cascade) — normalize to labels. */
const milestoneLabels = (goal: Goal): string[] =>
  (Array.isArray(goal.milestones) ? goal.milestones : [])
    .map((m: any) => String(m?.title ?? m?.name ?? m ?? '').trim())
    .filter(Boolean);

const isCompleted = (goal: Goal) => Number(goal.current_progress || 0) >= 100;

export default function GoalTimeline() {
  const { goals, fetchGoals, deleteGoal, createGoal } = usePlanner();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<TimelineNotice | null>(null);

  // Track by id and derive the live object from the store, so websocket
  // updates and progress changes flow into the open details modal
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const selectedGoal = useMemo(
    () => goals.find((g) => String(g.id) === String(selectedGoalId)) ?? null,
    [goals, selectedGoalId]
  );

  const [goalPendingDelete, setGoalPendingDelete] = useState<Goal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Slider position while dragging; committed to the API on release
  const [draftProgress, setDraftProgress] = useState<number | null>(null);

  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: 'Personal',
    milestones: [] as string[],
    newMilestoneText: '',
  });

  // Active goals first (nearest deadline → undated), completed at the end
  const sortedGoals = useMemo(() => {
    const rank = (goal: Goal) => {
      if (isCompleted(goal)) return Number.MAX_SAFE_INTEGER;
      if (!goal.target_date) return Number.MAX_SAFE_INTEGER - 1;
      const days = daysUntil(goal.target_date);
      return Number.isNaN(days) ? Number.MAX_SAFE_INTEGER - 1 : days;
    };
    return [...goals].sort((a, b) => rank(a) - rank(b));
  }, [goals]);

  // If the open goal disappears (deleted elsewhere / realtime), close the modal
  useEffect(() => {
    if (selectedGoalId && !selectedGoal) {
      setSelectedGoalId(null);
    }
  }, [selectedGoalId, selectedGoal]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetForm = () => {
    setNewGoal({
      title: '',
      description: '',
      targetDate: '',
      category: 'Personal',
      milestones: [],
      newMilestoneText: '',
    });
    setFormError(null);
  };

  const handleAddGoalClick = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleAddMilestone = () => {
    const text = newGoal.newMilestoneText.trim().slice(0, MAX_MILESTONE_LENGTH);
    if (!text) return;
    if (newGoal.milestones.length >= MAX_MILESTONES) {
      setFormError(`Up to ${MAX_MILESTONES} milestones per goal.`);
      return;
    }
    if (newGoal.milestones.some((m) => m.toLowerCase() === text.toLowerCase())) {
      setFormError('That milestone is already in the list.');
      return;
    }
    setFormError(null);
    setNewGoal((prev) => ({
      ...prev,
      milestones: [...prev.milestones, text],
      newMilestoneText: '',
    }));
  };

  const handleRemoveMilestone = (index: number) => {
    setNewGoal((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index),
    }));
  };

  const handleSaveGoal = async () => {
    const title = newGoal.title.trim();
    if (!title) {
      setFormError('Give your goal a title.');
      return;
    }
    if (newGoal.targetDate && daysUntil(newGoal.targetDate) < 0) {
      setFormError('The target date is in the past — pick a future date.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const result = await createGoal({
        title,
        description: newGoal.description.trim(),
        category: newGoal.category,
        target_date: newGoal.targetDate || undefined,
        milestones: newGoal.milestones,
      });

      if (result.success) {
        setIsModalOpen(false);
        resetForm();
        setNotice({ type: 'success', text: `Goal "${title}" added.` });
      } else {
        setFormError(result.error || 'Failed to save goal. Please try again.');
      }
    } catch (error: any) {
      setFormError(error?.message || 'Failed to save goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!goalPendingDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await deleteGoal(goalPendingDelete.id);
      if (result.success) {
        if (String(selectedGoalId) === String(goalPendingDelete.id)) {
          setSelectedGoalId(null);
        }
        setNotice({ type: 'success', text: `Goal "${goalPendingDelete.title}" deleted.` });
        setGoalPendingDelete(null);
      } else {
        setNotice({ type: 'error', text: result.error || 'Failed to delete goal.' });
        setGoalPendingDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const commitProgress = async (goal: Goal, newProgress: number) => {
    try {
      const response = await plannerApi.updateGoalProgress(goal.id, newProgress);
      if (response.success) {
        await fetchGoals();
        if (newProgress >= 100 && Number(goal.current_progress || 0) < 100) {
          setNotice({ type: 'success', text: `"${goal.title}" completed — well done!` });
        }
      } else {
        setNotice({ type: 'error', text: response.error?.message || 'Could not update progress.' });
      }
    } catch {
      setNotice({ type: 'error', text: 'Could not update progress. Check your connection.' });
    }
  };

  const renderDeadline = (goal: Goal) => {
    if (isCompleted(goal)) {
      return (
        <span className="goal-status-chip is-complete">
          <CheckCircle2 size={12} />
          Completed
        </span>
      );
    }
    if (!goal.target_date) return null;

    const days = daysUntil(goal.target_date);
    if (Number.isNaN(days)) return null;

    if (days < 0) {
      return (
        <span className="goal-status-chip is-overdue">
          <AlertTriangle size={12} />
          Overdue by {Math.abs(days)}d
        </span>
      );
    }
    if (days === 0) {
      return (
        <span className="goal-status-chip is-urgent">
          <Calendar size={12} />
          Due today
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="goal-status-chip is-urgent">
          <Calendar size={12} />
          {days}d left
        </span>
      );
    }
    return (
      <div className="goal-deadline">
        <Calendar size={12} />
        <span>{new Date(goal.target_date).toLocaleDateString()}</span>
      </div>
    );
  };

  const selectedMilestones = selectedGoal ? milestoneLabels(selectedGoal) : [];
  const selectedProgress = draftProgress ?? selectedGoal?.current_progress ?? 0;

  return (
    <div className="goal-timeline">
      <div className="goal-header">
        <div className="goal-title">
          <div className="icon-wrapper">
            <Target size={20} />
          </div>
          <div>
            <h3>Goal Timeline</h3>
            <p className="subtitle">Set and achieve your objectives</p>
          </div>
        </div>
        <button className="add-goal-btn" onClick={handleAddGoalClick}>
          <Plus size={16} />
          <span>Add Goal</span>
        </button>
      </div>

      {notice && (
        <div className={`goal-timeline-notice is-${notice.type}`} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="goals-list">
        {sortedGoals.length === 0 ? (
          <div className="empty-goals">
            <p>No goals set yet. Aim high!</p>
          </div>
        ) : (
          sortedGoals.map((goal: Goal) => (
            <div key={goal.id} className={`goal-card ${isCompleted(goal) ? 'is-complete' : ''}`}>
              <div className="goal-main">
                <div className="goal-info">
                  <div className="goal-title-content">
                    <h4>{goal.title}</h4>
                    {goal.description && <Info size={12} className="goal-has-description" />}
                  </div>
                  <div className="goal-meta">
                    <span className="category-tag">{goal.category || 'General'}</span>
                    {renderDeadline(goal)}
                    {milestoneLabels(goal).length > 0 && (
                      <span className="goal-milestone-count">
                        {milestoneLabels(goal).length} milestones
                      </span>
                    )}
                  </div>
                </div>

                <div className="goal-progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Progress</span>
                    <span className="progress-percent">{goal.current_progress || 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${isCompleted(goal) ? 'is-complete' : ''}`}
                      style={{ width: `${Math.min(100, goal.current_progress || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="goal-actions">
                <button className="goal-action-btn" onClick={() => setSelectedGoalId(String(goal.id))}>
                  <span>Details</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  className="goal-action-btn delete"
                  aria-label={`Delete goal "${goal.title}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGoalPendingDelete(goal);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Goal ── */}
      <Modal
        isOpen={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
        title="Set New Goal"
        className="goal-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button
              className="app-modal-btn app-modal-btn-primary"
              onClick={handleSaveGoal}
              disabled={isSaving || !newGoal.title.trim()}
            >
              {isSaving ? 'Saving...' : 'Add Goal'}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div className="goal-form-error" role="alert">
              <AlertTriangle size={14} />
              <span>{formError}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Goal Title *</label>
            <input
              value={newGoal.title}
              onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              placeholder="e.g., Run a Marathon"
              autoFocus
              maxLength={120}
              className="goal-modal-input px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Target Date</label>
            <DatePicker
              value={newGoal.targetDate}
              onChange={(date) => setNewGoal({ ...newGoal, targetDate: date })}
              placeholder="Select target date"
              className="goal-modal-date-picker"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Category</label>
            <select
              value={newGoal.category}
              onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
              className="goal-modal-select px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
            >
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
              <option value="Learning">Learning</option>
              <option value="Health">Health</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              Milestones <span className="goal-label-hint">(optional, up to {MAX_MILESTONES})</span>
            </label>
            <div className="goal-milestone-input-row">
              <input
                value={newGoal.newMilestoneText}
                onChange={(e) => setNewGoal({ ...newGoal, newMilestoneText: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMilestone();
                  }
                }}
                placeholder="e.g., Finish 10k training block"
                maxLength={MAX_MILESTONE_LENGTH}
                className="goal-modal-input px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm flex-1"
              />
              <button
                type="button"
                className="goal-milestone-add-btn"
                onClick={handleAddMilestone}
                disabled={!newGoal.newMilestoneText.trim()}
                aria-label="Add milestone"
              >
                <Plus size={16} />
              </button>
            </div>
            {newGoal.milestones.length > 0 && (
              <ul className="goal-milestone-chips">
                {newGoal.milestones.map((milestone, index) => (
                  <li key={`${milestone}-${index}`} className="goal-milestone-chip">
                    <span>{milestone}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMilestone(index)}
                      aria-label={`Remove milestone "${milestone}"`}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {/* ── Goal Details ── */}
      <Modal
        isOpen={!!selectedGoal}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedGoalId(null);
            setDraftProgress(null);
          }
        }}
        title={selectedGoal?.title || 'Goal Details'}
        className="goal-modal-shell"
        maxWidth="md"
      >
        {selectedGoal && (
          <div className="goal-details-modal-content">
            <div className="goal-details-meta-row">
              <span className="category-tag">{selectedGoal.category || 'General'}</span>
              {renderDeadline(selectedGoal)}
            </div>

            <p className="goal-details-description">
              {selectedGoal.description || 'No description provided.'}
            </p>

            {selectedMilestones.length > 0 && (
              <div className="goal-details-milestones">
                <span className="goal-details-section-label">Milestones</span>
                <ul>
                  {selectedMilestones.map((milestone, index) => {
                    // A milestone counts as reached once progress passes its
                    // even share of the goal (milestone 2 of 4 → reached at 50%)
                    const threshold = Math.round(((index + 1) / selectedMilestones.length) * 100);
                    const reached = Number(selectedGoal.current_progress || 0) >= threshold;
                    return (
                      <li key={`${milestone}-${index}`} className={reached ? 'is-reached' : ''}>
                        {reached ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                        <span className="goal-milestone-text">{milestone}</span>
                        <span className="goal-milestone-threshold">{threshold}%</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Goal Intelligence & Analytics */}
            <div className="goal-details-analytics">
              <GoalAnalytics
                goal={selectedGoal}
                onUpdate={() => {
                  // selectedGoal is derived from the store; a refetch is all we need
                  fetchGoals();
                }}
              />
            </div>

            {selectedGoal.is_tracked ? (
              <p className="goal-details-tracked-note">
                Progress updates automatically from your linked tasks, habits, and deep work.
              </p>
            ) : (
              <div className="goal-details-progress">
                <label className="goal-details-progress-label">
                  <span>Update Progress</span>
                  <span className="goal-details-progress-value">{selectedProgress}%</span>
                </label>
                <input
                  type="range"
                  className="goal-details-progress-slider"
                  min="0"
                  max="100"
                  value={selectedProgress}
                  aria-label="Goal progress percentage"
                  onChange={(e) => setDraftProgress(parseInt(e.target.value))}
                  onPointerUp={() => {
                    if (draftProgress !== null) {
                      commitProgress(selectedGoal, draftProgress);
                      setDraftProgress(null);
                    }
                  }}
                  onBlur={() => {
                    if (draftProgress !== null) {
                      commitProgress(selectedGoal, draftProgress);
                      setDraftProgress(null);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation ── */}
      <Modal
        isOpen={!!goalPendingDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setGoalPendingDelete(null);
        }}
        title="Delete Goal"
        className="goal-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={() => setGoalPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn app-modal-btn-danger goal-delete-confirm-btn"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Goal'}
            </button>
          </div>
        }
      >
        <p className="goal-delete-confirm-text">
          Delete <strong>"{goalPendingDelete?.title}"</strong>? Linked tasks and habits stay in your
          planner, but the goal and its progress history can't be recovered.
        </p>
      </Modal>
    </div>
  );
}
