import React, { useState, useEffect } from 'react';
import { Target, Calendar, TrendingUp, ChevronRight, X, Plus, Clock, Edit2, Trash2, Info, Square, Loader2 } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import '../../styles/components/planner/GoalTimeline.css';
import type { Goal } from '../../types/planner.types';
import { DatePicker } from '../ui/DatePicker';
import { GoalAnalytics } from './GoalAnalytics';
import { Modal } from '../common/Modal';

export default function GoalTimeline() {
  const { goals, fetchGoals, deleteGoal, createGoal } = usePlanner();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local form state
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetDate: '',
    category: 'Personal',
    milestones: [] as string[],
    newMilestoneText: ''
  });

  const handleAddGoalClick = () => {
    setIsModalOpen(true);
    setIsEditing(false);
    setNewGoal({
      title: '',
      description: '',
      targetDate: '',
      category: 'Personal',
      milestones: [],
      newMilestoneText: ''
    });
  };

  const handleDeleteGoalClick = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      const result = await deleteGoal(id);
      if (!result.success) {
        alert(result.error || 'Failed to delete goal');
      }
    }
  };

  const handleSaveGoal = async () => {
    if (!newGoal.title.trim()) return;
    setIsSaving(true);
    try {
      const result = await createGoal({
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.category,
        target_date: newGoal.targetDate || undefined,
        milestones: newGoal.milestones
      });

      if (result.success) {
        console.log('✓ Goal created successfully');
        // Close modal first
        setIsModalOpen(false);
        // Reset form
        setNewGoal({
          title: '',
          description: '',
          targetDate: '',
          category: 'Personal',
          milestones: [],
          newMilestoneText: ''
        });
        // Don't call fetchGoals() - createGoalWithCascade already updates the store
      } else {
        alert(result.error || 'Failed to save goal');
      }
    } catch (error) {
      console.error('Failed to save goal:', error);
      alert('Failed to save goal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShowDetails = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsDetailsOpen(true);
  };

  const updateProgress = async (goal: Goal, newProgress: number) => {
    try {
      const { plannerApi } = await import('../../services/api/planner.service');
      const response = await plannerApi.updateGoalProgress(goal.id, newProgress);
      if (response.success) {
        fetchGoals();
        if (selectedGoal && selectedGoal.id === goal.id) {
          setSelectedGoal({ ...selectedGoal, current_progress: newProgress });
        }
      }
    } catch (e) {
      console.error("Failed to update progress", e);
    }
  };

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

      <div className="goals-list">
        {goals.length === 0 ? (
          <div className="empty-goals">
            <p>No goals set yet. Aim high!</p>
          </div>
        ) : (
          goals.map((goal: Goal) => (
            <div key={goal.id} className="goal-card">
              <div className="goal-main">
                <div className="goal-info">
                  <div className="goal-title-content">
                    <h4>{goal.title}</h4>
                    {goal.description && <Info size={12} className="goal-has-description" />}
                  </div>
                  <div className="goal-meta">
                    <span className="category-tag">{goal.category || 'General'}</span>
                    {goal.target_date && (
                      <div className="goal-deadline">
                        <Calendar size={12} />
                        <span>{new Date(goal.target_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="goal-progress-section">
                  <div className="progress-header">
                    <span className="progress-label">Progress</span>
                    <span className="progress-percent">{goal.current_progress || 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${goal.current_progress || 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="goal-actions">
                <button className="goal-action-btn" onClick={() => handleShowDetails(goal)}>
                  <span>Details</span>
                  <ChevronRight size={14} />
                </button>
                <button className="goal-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteGoalClick(goal.id); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Set New Goal"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button className="app-modal-btn app-modal-btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Goal Title *</label>
            <input
              value={newGoal.title}
              onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
              placeholder="e.g., Run a Marathon"
              autoFocus
              className="px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Target Date</label>
            <DatePicker
              value={newGoal.targetDate}
              onChange={(date) => setNewGoal({ ...newGoal, targetDate: date })}
              placeholder="Select target date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">Category</label>
            <select
              value={newGoal.category}
              onChange={e => setNewGoal({ ...newGoal, category: e.target.value })}
              className="px-4 py-2.5 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] backdrop-blur-sm"
            >
              <option value="Personal">Personal</option>
              <option value="Work">Work</option>
              <option value="Learning">Learning</option>
              <option value="Health">Health</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDetailsOpen && !!selectedGoal}
        onOpenChange={setIsDetailsOpen}
        title={selectedGoal?.title || 'Goal Details'}
        maxWidth="md"
      >
        {selectedGoal && (
          <div className="goal-details-modal-content">
            <p className="goal-details-description">
              {selectedGoal.description || 'No description provided.'}
            </p>

            {/* Goal Intelligence & Analytics */}
            <div className="goal-details-analytics">
              <GoalAnalytics
                goal={selectedGoal}
                onUpdate={(updatedGoal) => {
                  setSelectedGoal(updatedGoal);
                  fetchGoals(); // Refresh list to show status on card if needed
                }}
              />
            </div>

            <div className="goal-details-progress">
              <label className="goal-details-progress-label">
                <span>Update Progress</span>
                <span className="goal-details-progress-value">{selectedGoal.current_progress || 0}%</span>
              </label>
              <input
                type="range"
                className="goal-details-progress-slider"
                min="0"
                max="100"
                value={selectedGoal.current_progress || 0}
                onChange={e => updateProgress(selectedGoal, parseInt(e.target.value))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
