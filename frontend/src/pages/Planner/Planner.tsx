// frontend/src/pages/Planner/Planner.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Maximize2, Minimize2, Plus, X, Clock, Timer, Zap, TrendingUp, CheckCircle2, List, PenTool, Loader2 } from 'lucide-react';
import { clsx } from "clsx";

import { useTheme } from '../../hooks/useTheme';
import { usePlanner } from '../../hooks/usePlanner';
import { useRealtime } from '../../hooks/useRealtime';
import { useNavStatePreservation } from '../../hooks/useNavStatePreservation';
import { useUserStore } from '../../stores/useUserStore';
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { Lock } from 'lucide-react';
import { LockedFeature } from '../../components/common/LockedFeature';

import DeepWorkBlock from '../../components/planner/DeepWorkBlock';
import GoalTimeline from '../../components/planner/GoalTimeline';
import HabitTracker from '../../components/planner/HabitTracker';
import TaskCard from '../../components/planner/TaskCard';
import PlannerDashboard from '../../components/planner/Plannerdashboard';

import '../../styles/pages/planner.css';

interface EditForm {
  id?: string;
  title: string;
  description?: string;
  startTime?: string;               // "HH:mm"
  duration?: number;
  energy?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in-progress' | 'completed' | 'planned' | 'overdue' | 'failed';
  category?: 'goal' | 'work' | 'meeting' | 'health' | 'learning' | 'routine' | 'personal';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  notes?: string;
  dueDate?: string;
  goalId?: string;
}



export default function PlannerPage() {
  // Ensure state persists when navigating to this page
  useNavStatePreservation();

  const { theme } = useTheme();
  const _isUltra = useUserStore((state) => state.isUltra);
  const user = useUserStore((state) => state.profile);
  // Force Ultra for owner
  const isUltra = user?.email === 'khan011504@gmail.com' ? true : _isUltra;

  const [currentTime, setCurrentTime] = useState(new Date());
  const [maximizedView, setMaximizedView] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('todo');
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // ── NEW STATES FOR FIXING ISSUES ─────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // ─────────────────────────────────────────────────────────────

  // ── Planner data & actions ────────────────────────────────────────
  const {
    tasks,
    goals,
    habits,
    activeDeepWork,
    dailyDeepWorkCount,
    isLoading,
    error,
    fetchTasks,
    fetchGoals,
    fetchHabits,
    createTask,
    updateTask,
    startTask,
    deleteTask,
    startDeepWork,
    completeDeepWork,
    isDeepWorkActive,
    forceRefresh
  } = usePlanner();

  // ── Real-time integration ─────────────────────────────────────────
  const { onTaskCreated, onTaskUpdated, onTaskDeleted } = useRealtime();

  // ── Edit modal state ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isNewTask, setIsNewTask] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const editModalRef = useRef<HTMLDivElement>(null);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-time connection
  useEffect(() => {
    if (!user?.id) return;

    // Only subscribe to events; don't refetch on every event
    // Local state updates are already handled in the hooks
    const unsubscribe1 = onTaskCreated((data) => {
      // Backend broadcasts tasks, so we could insert it here if payload matches
      if (data && typeof data === 'object') fetchTasks(); // Fallback to fetch for now
    });

    const unsubscribe2 = onTaskUpdated(() => {
      fetchTasks();
    });

    const unsubscribe3 = onTaskDeleted(() => {
      fetchTasks();
    });

    return () => {
      unsubscribe1?.();
      unsubscribe2?.();
      unsubscribe3?.();
    };
  }, [user?.id, onTaskCreated, onTaskUpdated, onTaskDeleted, fetchTasks]);

  // Separate effect for Goal/Habit listeners to avoid complex deps
  const { onGoalCreated, onGoalUpdated, onGoalProgressChanged, onHabitCreated, onHabitCompleted } = useRealtime();

  useEffect(() => {
    if (!user?.id) return;

    const unsub1 = onGoalCreated(() => {
      fetchGoals();
    });

    const unsub2 = onGoalUpdated(() => fetchGoals());
    const unsub3 = onGoalProgressChanged(() => fetchGoals());

    // Add habit creation listener
    const unsub4 = onHabitCreated(() => {
      fetchHabits();
    });

    // Add habit completion listener
    const unsub5 = onHabitCompleted(() => {
      fetchHabits();
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    }
  }, [onGoalCreated, onGoalUpdated, onGoalProgressChanged, onHabitCreated, onHabitCompleted, fetchGoals, fetchHabits, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isEditing && editModalRef.current) {
      editModalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isEditing]);

  // ── Smart Energy Logic ──────────────────────────────────────────
  const [isEnergyTouched, setIsEnergyTouched] = useState(false);

  const estimateEnergyLevel = (title: string, category?: string): 'low' | 'medium' | 'high' => {
    const lowerTitle = title.toLowerCase();

    // High Energy Keywords
    if (/gym|workout|run|sprint|focus|deep work|study|code|program|design|write|create|project|meeting with|interview|exam/.test(lowerTitle)) return 'high';

    // Category based checks
    if (category === 'health' || category === 'learning') {
      // Check if it's explicitly low energy task in high energy category
      if (/read|watch|listen|check|review/.test(lowerTitle)) return 'medium';
      return 'high';
    }
    if (category === 'work') {
      if (/email|admin|message|check|review|call|update/.test(lowerTitle)) return 'medium';
      return 'high';
    }

    // Low Energy Keywords
    if (/email|call|admin|clean|tidy|message|check|review|read|listen|meditate|nap|relax|chill|buy|shop|grocery|laundry|dishes|errand/.test(lowerTitle)) return 'low';

    // Default based on category
    if (category === 'routine' || category === 'personal') return 'low';

    return 'medium';
  };

  // ── Task CRUD handlers ────────────────────────────────────────────
  const handleAddTask = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    setIsEnergyTouched(false); // Enable auto-estimation for new tasks

    setEditForm({
      title: '',
      startTime: `${hours}:${minutes}`,
      duration: 60,
      energy: 'medium',
      status: 'planned',
      category: undefined,
      priority: undefined,
      tags: [],
      description: '',
      notes: '',
      dueDate: new Date().toISOString(),
    });
    setIsNewTask(true);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleCreateTask = async (data: any) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await createTask({
        title: data.title,
        description: data.description,
        priority: data.priority || 'medium',
        status: 'todo',
        estimated_duration_minutes: data.duration,
        tags: data.tags,
        category: data.category,
        goal_id: data.goalId,
      } as any);
      if (result.success) {
        setIsNewTaskOpen(false);
        setIsEditing(false);
        setEditForm(null);
        // Refresh tasks list
        await fetchTasks();
      } else {
        setSaveError(result.error || 'Failed to create task');
      }
    } catch (error: any) {
      setSaveError(error.message || 'Failed to create task');
    } finally {
      setIsSaving(false);
    }
  }

  const handleEditTask = (task: any) => {
    setIsEnergyTouched(true); // Don't auto-estimate for existing tasks
    setEditForm({
      id: task.id,
      title: task.title,
      description: task.description,
      startTime: task.startTime || (task.dueDate ? new Date(task.dueDate).toTimeString().slice(0, 5) : undefined),
      duration: task.duration || task.estimatedDurationMinutes,
      energy: task.energy || 'medium',
      status: task.status,
      category: task.category || 'work',
      priority: task.priority,
      tags: task.tags,
      notes: task.notes,
      dueDate: task.dueDate || task.due_date,
      goalId: task.related_goal_id // Map backend field
    });
    setIsNewTask(false);
    setIsEditing(true);
    setSaveError(null);
  };

  // ── FIXED VERSION OF handleSaveEdit ──────────────────────────────
  const handleSaveEdit = async () => {
    if (!editForm || !editForm.title.trim()) {
      setSaveError('Task title is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Format the due date correctly
      // Handle startTime properly - Default to current time if missing
      let finalDueDate;
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      const [hours, minutes] = (editForm.startTime || `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`).split(':').map(Number);

      // Validate hours and minutes
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        setSaveError('Invalid time format. Please use HH:MM format (00:00 to 23:59)');
        return;
      }

      if (editForm.dueDate) {
        // Use the original date but update the time
        let d = new Date(editForm.dueDate);
        if (isNaN(d.getTime())) {
          d = new Date(); // Fallback if invalid
        }
        // Create ISO string manually to avoid timezone conversion
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        // Preserve seconds if possible
        const secondsStr = String(d.getSeconds()).padStart(2, '0');

        // Use local timezone format instead of UTC
        finalDueDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}:${secondsStr}`;
      } else {
        // Fallback to today
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');
        const secondsStr = String(d.getSeconds()).padStart(2, '0');
        // Use local timezone format instead of UTC
        finalDueDate = `${year}-${month}-${day}T${hoursStr}:${minutesStr}:${secondsStr}`;
      }

      // Keep priority as-is — backend accepts 'urgent'
      const apiPriority = editForm.priority || 'medium';

      // Status map - ensure proper mapping
      let apiStatus: string = editForm.status || 'planned';

      // Map UI status to API status
      const statusMap: Record<string, string> = {
        'pending': 'todo',
        'completed': 'done',
        'in-progress': 'in-progress',
        'planned': 'planned',
        'overdue': 'overdue',
        'todo': 'todo',
        'done': 'done'
      };

      if (statusMap[apiStatus]) {
        apiStatus = statusMap[apiStatus];
      }

      const payload: any = {
        title: editForm.title,
        description: editForm.description || '',
        priority: apiPriority,
        status: apiStatus,
        due_date: finalDueDate,
        estimated_duration_minutes: editForm.duration || 60,
        tags: editForm.tags || [],
        category: editForm.category,
        goal_id: editForm.category === 'goal' ? editForm.goalId : null
      };


      if (isNewTask) {
        const result = await createTask(payload);

        if (!result.success) {
          console.error('Create Task Failed Result:', result);
          setSaveError(`Failed to create task: ${result.error || 'Unknown error'}`);
          return;
        }

      } else if (editForm.id) {
        const result = await updateTask(editForm.id, payload);

        if (!result.success) {
          console.error('Update Task Failed Result:', result);
          setSaveError(`Failed to update task: ${result.error || 'Unknown error'}`);
          return;
        }
      }

      // Close modal after successful save
      setIsEditing(false);
      setIsNewTask(false);
      setEditForm(null);

      // Refresh tasks with delay to ensure DB sync
      setTimeout(() => {
        fetchTasks();
      }, 300);

    } catch (error: any) {
      console.error('Error saving task:', error);
      setSaveError(`Error saving task: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setIsNewTask(false);
    setEditForm(null);
    setSaveError(null);
  };

  // ── Quick actions for TaskCard ────────────────────────────────────
  const handleStartTask = (taskId: string) => {
    startTask(taskId);
  };

  const handleCompleteTask = (taskId: string) => {
    updateTask(taskId, { status: 'completed' });
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'todo') return t.status === 'pending';
    if (filterStatus === 'in-progress') return t.status === 'in-progress';
    if (filterStatus === 'done') return t.status === 'completed';
    return true;
  });

  // ── Transform API tasks to TaskCard format ────────────────────────
  const transformTaskForCard = (task: any) => {
    // Debug log to inspect incoming task data
    console.log("TaskCard Transform Input:", task);

    // Handle both snake_case (backend) and camelCase (frontend)
    const dueDateVal = task.dueDate || task.due_date;

    // Explicitly check for 0 or null before falling back
    let rawDuration = task.estimated_duration_minutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.estimatedDurationMinutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.estimated_minutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.duration;

    // If rawDuration is 0, keep it (though min is usually 5). If undefined/null, use 60.
    const durationVal = (rawDuration !== undefined && rawDuration !== null) ? rawDuration : 60;

    // Parse start time from dueDate or use default
    let startTime: string | undefined = undefined;
    if (dueDateVal) {
      try {
        const date = new Date(dueDateVal);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        startTime = `${hours}:${minutes}`;
      } catch (e) {
        console.warn('Invalid date format:', dueDateVal);
      }
    }

    // Ensure all required fields exist with defaults
    const transformedTask = {
      ...task, // Spread original task FIRST to prevent overwriting our normalized values
      id: task.id || task._id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Robust fallback
      originalId: String(task.id || task._id), // Keep original string ID for API calls
      title: task.title || 'New Task',
      startTime: startTime,
      duration: durationVal,
      energy: (task.energy || 'medium') as 'low' | 'medium' | 'high',
      category: (task.category || 'work') as 'work' | 'meeting' | 'break' | 'health' | 'learning' | 'routine' | 'personal',
      priority: (task.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      status: (task.status || 'planned') as 'completed' | 'in-progress' | 'scheduled' | 'planned' | 'overdue' | 'failed' | 'pending' | 'todo',
      tags: Array.isArray(task.tags) ? task.tags : [],
      description: task.description || '',
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      notes: task.notes || ''
    };

    // Debug log for originalId preservation
    if (transformedTask.originalId !== String(task.id || task._id)) {
      console.warn('⚠️ originalId may have been overwritten:', {
        intended: String(task.id || task._id),
        actual: transformedTask.originalId
      });
    }

    return transformedTask;
  };

  return (
    <ErrorBoundary componentName="Planner">
      <div className="planner-page" data-theme={theme}>
        {/* Header */}
        <div className="planner-header">
          <div className="header-left">
            <div className="header-icon animated-calendar">
              <Calendar size={24} className="calendar-icon" />
            </div>
            <div className="header-text">
              <h1>Productivity Planner</h1>
              <p className="header-subtitle">Plan, track, and achieve your daily goals</p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="maximize-btn"
              onClick={() => setMaximizedView(!maximizedView)}
              title={maximizedView ? "Show side panel" : "Maximize tasks"}
            >
              {maximizedView ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
            </button>
            <button
              className="refresh-btn"
              onClick={forceRefresh}
              title="Refresh all data"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Timer size={16} />}
            </button>
            <button className="add-task-btn" onClick={handleAddTask}>
              <Plus size={18} />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Edit Modal - FIXED VERSION */}
        {isEditing && editForm && (
          <div className="modal-overlay" onClick={handleCancelEdit}>
            <div
              className="modal-content task-modal"
              ref={editModalRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title">
                  <div className="modal-icon">
                    <PenTool size={18} />
                  </div>
                  <h3>{isNewTask ? 'Create New Task' : 'Edit Task'}</h3>
                </div>
                <button
                  className="modal-close"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {saveError && <div className="modal-error-notice">{saveError}</div>}

                <div className="form-group">
                  <label htmlFor="task-title">
                    <span className="label-icon">📝</span>
                    Task Title *
                  </label>
                  <input
                    id="task-title"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditForm((prev) => {
                        if (!prev) return null;
                        const updates: any = { title: val };
                        if (!isEnergyTouched) {
                          updates.energy = estimateEnergyLevel(val, prev.category);
                        }
                        return { ...prev, ...updates };
                      });
                    }}
                    placeholder="e.g., Morning Deep Work"
                    className="task-input"
                    autoFocus
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="task-description">
                    <span className="label-icon">📄</span>
                    Description
                  </label>
                  <textarea
                    id="task-description"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="What needs to be done?"
                    rows={2}
                    className="task-textarea"
                    disabled={isSaving}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="task-time">
                      <span className="label-icon">⏰</span>
                      Start Time
                    </label>
                    <input
                      id="task-time"
                      type="time"
                      value={editForm.startTime || ''}
                      onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                      className="task-input"
                      disabled={isSaving}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="task-duration">
                      <span className="label-icon">⏱️</span>
                      Duration (min)
                    </label>
                    <input
                      id="task-duration"
                      type="number"
                      value={editForm.duration ?? 60}
                      onChange={(e) => setEditForm({ ...editForm, duration: Number(e.target.value) || 60 })}
                      min={5}
                      step={5}
                      className="task-input"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="task-category">
                      <span className="label-icon">🏷️</span>
                      Category
                    </label>
                    <select
                      id="task-category"
                      value={editForm.category || ''}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setEditForm((prev) => {
                          if (!prev) return null;
                          const updates: any = { category: val };
                          if (!isEnergyTouched) {
                            updates.energy = estimateEnergyLevel(prev.title, val);
                          }
                          return { ...prev, ...updates };
                        });
                      }}
                      className="task-select"
                      disabled={isSaving}
                    >
                      <option value="" disabled>-- Select Category --</option>
                      <option value="goal">🎯 Goal</option>
                      <option value="work">Work</option>
                      <option value="meeting">Meeting</option>
                      <option value="health">Health</option>
                      <option value="learning">Learning</option>
                      <option value="routine">Routine</option>
                      <option value="personal">Personal</option>
                    </select>
                  </div>

                  {editForm.category === 'goal' && (
                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                      <label htmlFor="task-goal-select">
                        <span className="label-icon">🎯</span>
                        Select Goal
                      </label>
                      <select
                        id="task-goal-select"
                        value={editForm.goalId || ''}
                        onChange={(e) => setEditForm({ ...editForm, goalId: e.target.value })}
                        className="task-select"
                        disabled={isSaving}
                      >
                        <option value="">-- Choose a Goal --</option>
                        {goals.filter(g => g.status !== 'completed').map(goal => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="task-priority">
                        <span className="label-icon">⚡</span>
                        Priority
                      </label>
                      <select
                        id="task-priority"
                        value={editForm.priority || 'medium'}
                        onChange={(e) => setEditForm(prev => prev ? { ...prev, priority: e.target.value as any } : null)}
                        className="task-select"
                        disabled={isSaving}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="task-energy">
                        <span className="label-icon">🔋</span>
                        Energy
                      </label>
                      <select
                        id="task-energy"
                        value={editForm.energy || 'medium'}
                        onChange={(e) => {
                          setIsEnergyTouched(true);
                          setEditForm(prev => prev ? { ...prev, energy: e.target.value as any } : null);
                        }}
                        className="task-select"
                        disabled={isSaving}
                      >
                        <option value="high">High ⚡</option>
                        <option value="medium">Medium 😐</option>
                        <option value="low">Low 🍵</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="task-tags">
                    <span className="label-icon">#</span>
                    Tags (comma separated)
                  </label>
                  <input
                    id="task-tags"
                    type="text"
                    value={editForm.tags?.join(', ') || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean),
                      })
                    }
                    placeholder="work, urgent, internal"
                    className="task-input"
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="modal-btn cancel"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className={`modal-btn submit ${!editForm.title.trim() || isSaving ? 'disabled' : ''}`}
                  onClick={handleSaveEdit}
                  disabled={!editForm.title.trim() || isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{isNewTask ? 'Add Task' : 'Save Changes'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className={`planner-main-grid ${maximizedView ? 'maximized' : ''}`}>
          {/* Tasks Section */}
          <div className="tasks-section">
            <div className="section-header">
              <div className="section-title">
                <List size={20} />
                <div>
                  <h2>Today's Tasks</h2>
                  <p className="section-subtitle">Manage your daily schedule</p>
                </div>
              </div>
              <div className="section-stats">
                <span className="task-count">{totalTasks} total</span>
                <span className="completed-count">{completedTasks} completed</span>
              </div>
            </div>

            {isLoading ? (
              <div className="loading-state">
                <Loader2 className="animate-spin" size={32} />
                <p>Loading your planner...</p>
              </div>
            ) : error ? (
              <div className="error-state">
                <p>{error}</p>
                <button onClick={() => fetchTasks()}>Try again</button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="empty-tasks">
                <List size={48} />
                <h3>No tasks scheduled yet</h3>
                <p>Get started by adding your first task</p>
                <button className="add-first-task-btn" onClick={handleAddTask}>
                  <Plus size={16} /> Add Task
                </button>
              </div>
            ) : (
              <div className="tasks-container">
                {(() => {
                  const uniqueTasks: any[] = [];
                  const seenIds = new Set();
                  tasks.forEach((task: any) => {
                    const id = task.id || task._id;
                    if (id) {
                      if (seenIds.has(id)) return;
                      seenIds.add(id);
                    }
                    uniqueTasks.push(task);
                  });
                  return uniqueTasks.map((task) => (
                    <TaskCard
                      key={task.id || task._id || `task-${Math.random()}`}
                      task={transformTaskForCard(task)}
                      onEdit={() => handleEditTask(task)}
                      onDelete={() => deleteTask(task.originalId || task.id)}
                      onStartTask={() => handleStartTask(task.originalId || task.id)}
                      onMarkComplete={() => handleCompleteTask(task.originalId || task.id)}
                      onAutoUpdateStatus={(id, status) => updateTask(String(id), { status: status as any })}
                    />
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Right Panel (when not maximized) */}
          {!maximizedView && (
            <div className="right-panel">
              {isUltra ? (
                <>
                  <DeepWorkBlock currentTime={currentTime} />
                  {/* Leno indicator */}
                  {activeDeepWork && activeDeepWork.status === 'active' && (
                    <div className="ai-status-block">
                      <div className="ai-active-notice">
                        Deep Work Session Active
                        <br />
                        Started: {new Date(activeDeepWork.startTime).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                  <div className="panel-divider" />
                  <GoalTimeline />
                </>
              ) : (
                <div className="right-panel-locked" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ flex: 1 }}><LockedFeature title="Deep Work" className="h-full" /></div>
                  <div style={{ flex: 1 }}><LockedFeature title="Goal Timeline" className="h-full" /></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="planner-bottom-grid">
          <HabitTracker habits={habits} />
          <PlannerDashboard
            totalTasks={totalTasks}
            completedTasks={completedTasks}
            tasksOverdue={tasks.filter(t => (t.status as any) === 'overdue').length}
            tasksLeft={tasks.filter(t => t.status === 'pending' || (t.status as any) === 'todo' || t.status === 'in-progress').length}
            totalHabits={habits.filter(h => h.status !== 'archived').length}
            completedHabits={habits.filter(h => {
              if (h.status === 'archived') return false;
              if (!h.lastCompleted) return false;
              const d = new Date(h.lastCompleted);
              const now = new Date();
              return d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
            }).length}
            deepWorkSessions={dailyDeepWorkCount}
            continuousHabits={habits.filter(h => h.currentStreak > 3).length}
            totalGoals={goals.length}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}