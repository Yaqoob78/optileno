import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Target, Calendar, TrendingUp, ChevronRight, X, Plus, Clock, Edit2, Trash2, Info, Square, Loader2 } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import '../../styles/components/planner/GoalTimeline.css';
import type { Goal } from '../../types/planner.types';
import { DatePicker } from '../ui/DatePicker';
import { GoalAnalytics } from './GoalAnalytics';

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

      {isModalOpen && createPortal(
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content goal-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                <Target size={18} />
                <h3>Set New Goal</h3>
              </div>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Goal Title *</label>
                <input
                  value={newGoal.title}
                  onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                  placeholder="e.g., Run a Marathon"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Target Date</label>
                <DatePicker
                  value={newGoal.targetDate}
                  onChange={(date) => setNewGoal({ ...newGoal, targetDate: date })}
                  placeholder="Select target date"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={newGoal.category}
                  onChange={e => setNewGoal({ ...newGoal, category: e.target.value })}
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Learning">Learning</option>
                  <option value="Health">Health</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button
                className="modal-btn submit"
                onClick={handleSaveGoal}
                disabled={isSaving || !newGoal.title.trim()}
              >
                {isSaving ? 'Saving...' : 'Add Goal'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isDetailsOpen && selectedGoal && createPortal(
        <div className="modal-overlay" onClick={() => setIsDetailsOpen(false)}>
          <div className="modal-content goal-modal details-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedGoal.title}</h3>
              <button className="modal-close" onClick={() => setIsDetailsOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p className="description">{selectedGoal.description || 'No description provided.'}</p>

              {/* Goal Intelligence & Analytics */}
              <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                <GoalAnalytics
                  goal={selectedGoal}
                  onUpdate={(updatedGoal) => {
                    setSelectedGoal(updatedGoal);
                    fetchGoals(); // Refresh list to show status on card if needed
                  }}
                />
              </div>

              <div className="progress-update">
                <label>Update Progress: {selectedGoal.current_progress}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedGoal.current_progress || 0}
                  onChange={e => updateProgress(selectedGoal, parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}