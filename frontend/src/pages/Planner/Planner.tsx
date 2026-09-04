// frontend/src/pages/Planner/Planner.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Maximize2, Minimize2, Plus, Timer, CheckCircle2, List, Loader2, Repeat, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';

import { useTheme } from '../../hooks/useTheme';
import { usePlanner } from '../../hooks/usePlanner';
import { useNavStatePreservation } from '../../hooks/useNavStatePreservation';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { LockedFeature } from '../../components/common/LockedFeature';
import { OnboardingFlow } from '../../components/planner/OnboardingFlow';
import {
  addDaysToLocalDateKey,
  formatLocalDateLabel,
  getDateKeyInTimezone,
  getNextLocalDateForWeekday,
  getTimeHHMMInTimezone,
  getWeekdayIndexInTimezone,
} from '../../utils/timezone';

import DeepWorkBlock from '../../components/planner/DeepWorkBlock';
import GoalTimeline from '../../components/planner/GoalTimeline';
import HabitTracker from '../../components/planner/HabitTracker';
import TaskCard from '../../components/planner/TaskCard';
import PlannerDashboard from '../../components/planner/Plannerdashboard';
import CalendarGridView from '../../components/planner/CalendarGridView';
import { QuickAddBar } from '../../components/planner/QuickAddBar';
import { Modal } from '../../components/common/Modal';
import { normalizeTaskStatus } from '../../services/api/planner.service';
import type { ParsedQuickAdd } from '../../utils/quickAddParser';

import '../../styles/pages/planner.css';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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
  scheduledDay?: number;            // 0=Sun..6=Sat
  subtasks?: { title: string; completed: boolean }[];
  depends_on_task_id?: string;
  recurring?: boolean;
  recurrence_config?: { type: string; days_of_week?: number[] };
}



export default function PlannerPage() {
  // Ensure state persists when navigating to this page
  useNavStatePreservation();

  const { theme } = useTheme();
  const isUltra = useUserStore((state) => state.isUltra);
  const timezone = useSettingsStore((state) => state.timezone);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [maximizedView, setMaximizedView] = useState(false);
  const [viewType, setViewType] = useState<'list' | 'calendar'>('list');

  // ── NEW STATES FOR FIXING ISSUES ─────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [plannerNotice, setPlannerNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
  // ─────────────────────────────────────────────────────────────

  // ── Planner data & actions ────────────────────────────────────────
  const {
    tasks,
    goals,
    habits,
    dailyDeepWorkCount,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    startTask,
    deleteTask,
    createHabit,
    forceRefresh
  } = usePlanner();

  // ── Edit modal state ──────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isNewTask, setIsNewTask] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const editModalRef = useRef<HTMLDivElement>(null);

  // ── Recurrence Modal state ────────────────────────────────────────
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [taskToRepeat, setTaskToRepeat] = useState<any>(null);
  const [repeatConfig, setRepeatConfig] = useState({ type: 'daily' });
  const [isCreatingRecurrence, setIsCreatingRecurrence] = useState(false);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isEditing && editModalRef.current) {
      editModalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isEditing]);

  useEffect(() => {
    if (!plannerNotice) return;
    const timer = window.setTimeout(() => setPlannerNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [plannerNotice]);

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
  // Backend may return naive ISO strings (without timezone suffix).
  // We normalize those as UTC to preserve exact selected time in UI.
  const parseTaskDate = (value?: string | Date | null): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    const hasTimePart = raw.includes('T');
    const hasZoneSuffix = /([zZ]|[+\-]\d{2}:\d{2})$/.test(raw);
    const normalized = hasTimePart && !hasZoneSuffix ? `${raw}Z` : raw;

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  };

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
      dueDate: getDateKeyInTimezone(now, timezone),
      scheduledDay: getWeekdayIndexInTimezone(now, timezone),
      subtasks: [],
      recurring: false,
    });
    setIsNewTask(true);
    setShowMoreOptions(false);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleAddTaskAtTime = (dateKey: string, timeHHMM: string) => {
    setIsEnergyTouched(false);
    const parsedDate = new Date(dateKey);
    const scheduledDay = !Number.isNaN(parsedDate.getTime()) ? getWeekdayIndexInTimezone(parsedDate, timezone) : getWeekdayIndexInTimezone(new Date(), timezone);

    setEditForm({
      title: '',
      startTime: timeHHMM,
      duration: 60,
      energy: 'medium',
      status: 'planned',
      category: undefined,
      priority: undefined,
      tags: [],
      description: '',
      notes: '',
      dueDate: dateKey,
      scheduledDay,
      subtasks: [],
      recurring: false,
    });
    setIsNewTask(true);
    setShowMoreOptions(false);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleExpandQuickAdd = (parsed: ParsedQuickAdd) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    setIsEnergyTouched(!!parsed.energy);

    const baseDueDate = parsed.dueDate ? new Date(parsed.dueDate) : now;
    const scheduledDay = !Number.isNaN(baseDueDate.getTime())
      ? getWeekdayIndexInTimezone(baseDueDate, timezone)
      : getWeekdayIndexInTimezone(now, timezone);

    setEditForm({
      title: parsed.cleanTitle || '',
      startTime: parsed.dueTime || `${hours}:${minutes}`,
      duration: parsed.duration || 60,
      energy: parsed.energy || estimateEnergyLevel(parsed.cleanTitle || '', parsed.category),
      status: 'planned',
      category: (parsed.category as any) || undefined,
      priority: parsed.priority || 'medium',
      tags: parsed.tags || [],
      description: '',
      notes: '',
      dueDate: parsed.dueDate || getDateKeyInTimezone(now, timezone),
      scheduledDay,
      subtasks: [],
      recurring: false,
    });
    setIsNewTask(true);
    setShowMoreOptions(false);
    setIsEditing(true);
    setSaveError(null);
  };

  const handleDuplicateTask = async (task: any) => {
    const baseDueDate = parseTaskDate(task.dueDate || task.due_date);
    const dueLocalDate = baseDueDate
      ? getDateKeyInTimezone(baseDueDate, timezone)
      : getDateKeyInTimezone(new Date(), timezone);
    const dueLocalTime = task.startTime
      || (baseDueDate ? getTimeHHMMInTimezone(baseDueDate, timezone) : '09:00');

    try {
      const result = await createTask({
        title: task.title,
        description: task.description || '',
        priority: task.priority || 'medium',
        status: 'todo',
        due_local_date: dueLocalDate,
        due_local_time: dueLocalTime,
        timezone,
        estimated_duration_minutes: task.duration || 60,
        tags: task.tags || [],
        category: task.category || 'work',
        goal_id: isUltra ? (task.related_goal_id || task.goal_id || task.goalId || null) : null,
      } as any);

      setPlannerNotice(
        result.success
          ? { type: 'success', text: `Duplicated "${task.title}".` }
          : { type: 'error', text: result.error || 'Failed to duplicate task.' }
      );
    } catch (error: any) {
      setPlannerNotice({ type: 'error', text: error?.message || 'Failed to duplicate task.' });
    }
  };

  const handleEditTask = (task: any) => {
    setIsEnergyTouched(true); // Don't auto-estimate for existing tasks
    const dueDateVal = task.dueDate || task.due_date;
    const parsedDueDate = parseTaskDate(dueDateVal);
    // Extract the  scheduled day from the existing dueDate
    let scheduledDay: number | undefined = undefined;
    if (parsedDueDate) {
      scheduledDay = getWeekdayIndexInTimezone(parsedDueDate, timezone);
    }
    setEditForm({
      id: task.id,
      title: task.title,
      description: task.description,
      startTime: task.startTime || (parsedDueDate ? getTimeHHMMInTimezone(parsedDueDate, timezone) : undefined),
      duration: task.duration || task.estimatedDurationMinutes,
      energy: task.energy || 'medium',
      status: task.status,
      category: task.category || 'work',
      priority: task.priority,
      tags: task.tags,
      notes: task.notes,
      dueDate: parsedDueDate ? getDateKeyInTimezone(parsedDueDate, timezone) : undefined,
      goalId: task.related_goal_id, // Map backend field
      scheduledDay: scheduledDay,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      depends_on_task_id: task.depends_on_task_id ? String(task.depends_on_task_id) : undefined,
      recurring: Boolean(task.is_recurring ?? task.recurring),
      recurrence_config: task.recurrence_config,
    });
    setIsNewTask(false);
    const hasAdvanced = Boolean(task.description || (task.subtasks && task.subtasks.length > 0) || task.depends_on_task_id || task.related_goal_id || (task.tags && task.tags.length > 0));
    setShowMoreOptions(hasAdvanced);
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
      let localDateForPayload: string;
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      const [hours, minutes] = (editForm.startTime || `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`).split(':').map(Number);

      // Validate hours and minutes
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        setSaveError('Invalid time format. Please use HH:MM format (00:00 to 23:59)');
        return;
      }

      // Preserve explicitly selected day first; day-pill selection already updates dueDate.
      if (editForm.dueDate) {
        localDateForPayload = editForm.dueDate;
      } else if (editForm.scheduledDay != null) {
        localDateForPayload = getNextLocalDateForWeekday(timezone, editForm.scheduledDay);
      } else {
        localDateForPayload = getDateKeyInTimezone(new Date(), timezone);
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
        due_local_date: localDateForPayload,
        due_local_time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        timezone,
        estimated_duration_minutes: editForm.duration || 60,
        tags: editForm.tags || [],
        category: editForm.category,
        goal_id: isUltra && editForm.category === 'goal' ? editForm.goalId : null,
        subtasks: editForm.subtasks || [],
        depends_on_task_id: editForm.depends_on_task_id || null,
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
    updateTask(taskId, { status: 'done' });
  };

  const handleOpenRepeatModal = (task: any) => {
    if (!isUltra) {
      setPlannerNotice({
        type: 'info',
        text: 'Task recurrence is available on the Ultra plan.',
      });
      return;
    }
    setTaskToRepeat(task);
    setIsRepeatModalOpen(true);
    setRecurrenceError(null);
  };

  const handleCreateRecurrence = async () => {
    if (!taskToRepeat) return;
    setIsCreatingRecurrence(true);
    setRecurrenceError(null);
    try {
      const baseDueDate = parseTaskDate(taskToRepeat.dueDate || taskToRepeat.due_date);
      const baseLocalDateKey = baseDueDate
        ? getDateKeyInTimezone(baseDueDate, timezone)
        : getDateKeyInTimezone(new Date(), timezone);
      const baseLocalTime = taskToRepeat.startTime
        || (baseDueDate ? getTimeHHMMInTimezone(baseDueDate, timezone) : '09:00');

      const { type } = repeatConfig;
      const linkedGoalId = isUltra
        ? (taskToRepeat.related_goal_id || taskToRepeat.goal_id || taskToRepeat.goalId || null)
        : null;

      const jsWeekday = baseDueDate ? baseDueDate.getDay() : new Date().getDay();

      const rConfig = type === 'weekly'
        ? { type: 'weekly', days_of_week: [jsWeekday] }
        : { type: 'daily' };

      const payload = {
        title: taskToRepeat.title,
        description: taskToRepeat.description || '',
        priority: taskToRepeat.priority || 'medium',
        status: 'todo',
        due_local_date: baseLocalDateKey,
        due_local_time: baseLocalTime,
        timezone,
        estimated_duration_minutes: taskToRepeat.duration || 60,
        tags: taskToRepeat.tags || [],
        category: taskToRepeat.category || 'work',
        goal_id: linkedGoalId,
        recurring: true,
        recurrence_config: rConfig
      };

      const result = await createTask(payload as any);

      if (result.success) {
        setIsRepeatModalOpen(false);
        setTaskToRepeat(null);
        setPlannerNotice({
          type: 'success',
          text: `Recurring ${type} schedule created for "${taskToRepeat.title}".`,
        });
        await forceRefresh();
      } else {
        setRecurrenceError(result.error || 'Failed to apply recurrence.');
      }
    } catch (e: any) {
      setRecurrenceError(e.message || "Failed to create recurrences");
    } finally {
      setIsCreatingRecurrence(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === 'done').length;
  // ── Transform API tasks to TaskCard format ────────────────────────
  const transformTaskForCard = (task: any) => {
    const dueDateVal = task.dueDate || task.due_date;
    const parsedDueDate = parseTaskDate(dueDateVal);

    let rawDuration = task.estimated_duration_minutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.estimatedDurationMinutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.estimated_minutes;
    if (rawDuration === undefined || rawDuration === null) rawDuration = task.duration;
    const durationVal = (rawDuration !== undefined && rawDuration !== null) ? rawDuration : 60;

    const startTime = parsedDueDate ? getTimeHHMMInTimezone(parsedDueDate, timezone) : undefined;

    const normalizedStatus = (() => {
      const rawStatus = String(task.status || 'planned');
      if (rawStatus === 'done' || rawStatus === 'completed') return 'completed';
      if (rawStatus === 'pending' || rawStatus === 'todo') return 'scheduled';
      if (rawStatus === 'in_progress') return 'in-progress';
      return rawStatus;
    })();

    return {
      ...task,
      id: task.id || task._id || `temp-${crypto.randomUUID()}`,
      originalId: String(task.id || task._id),
      title: task.title || 'New Task',
      startTime,
      dueDate: parsedDueDate ? parsedDueDate.toISOString() : null,
      duration: durationVal,
      energy: (task.energy || 'medium') as 'low' | 'medium' | 'high',
      category: (task.category || 'work') as 'work' | 'meeting' | 'break' | 'health' | 'learning' | 'routine' | 'personal',
      priority: (task.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
      status: normalizedStatus as 'completed' | 'in-progress' | 'scheduled' | 'planned' | 'overdue' | 'failed' | 'pending' | 'todo',
      tags: Array.isArray(task.tags) ? task.tags : [],
      description: task.description || '',
      is_locked: Boolean(task.is_locked || task.meta?.is_locked),
      is_protected: Boolean(task.is_protected || task.meta?.is_protected),
      reschedule_reason: task.reschedule_reason || task.meta?.reschedule_reason,
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      notes: task.notes || ''
    };
  };

  const handleToggleLockTask = async (taskId: string, currentLocked: boolean) => {
    const newLocked = !currentLocked;
    try {
      await updateTask(taskId, { is_locked: newLocked });
      setPlannerNotice({
        type: 'info',
        text: newLocked ? '🔒 Task locked to time slot. Auto-scheduler will preserve this time.' : '🔓 Task unlocked for auto-scheduling.',
      });
      await forceRefresh();
    } catch (err: any) {
      console.error('Failed to toggle task lock', err);
    }
  };

  const handleRescheduleTask = async (taskId: string, newTimeHHMM: string, newDateKey?: string) => {
    try {
      const task = tasks.find((t) => String(t.id) === String(taskId) || String(t.originalId) === String(taskId));
      const targetDateKey = newDateKey || (task?.dueDate ? String(task.dueDate).substring(0, 10) : getDateKeyInTimezone(new Date(), timezone));
      const dueIso = `${targetDateKey}T${newTimeHHMM}:00`;
      await updateTask(taskId, { due_date: dueIso, reschedule_reason: `Quick adjusted to ${newTimeHHMM}` });
      setPlannerNotice({
        type: 'info',
        text: `Task rescheduled to ${newTimeHHMM}.`,
      });
      await forceRefresh();
    } catch (err: any) {
      console.error('Failed to reschedule task', err);
    }
  };

  const handleRefreshPlanner = async () => {
    setPlannerNotice(null);
    try {
      await forceRefresh();
    } catch (refreshError: any) {
      setPlannerNotice({
        type: 'error',
        text: refreshError?.message || 'Planner refresh failed. Please try again.',
      });
    }
  };

  return (
    <ErrorBoundary componentName="Planner">
      <OnboardingFlow />
      <div className="planner-page" data-theme={theme}>
        {plannerNotice && (
          <div className={`planner-page-notice is-${plannerNotice.type}`}>
            <span>{plannerNotice.text}</span>
          </div>
        )}

        {/* Header */}
        <div className="planner-header">
          <div className="header-left">
            <div className="header-icon animated-calendar">
              <CalendarIcon size={24} className="calendar-icon" />
            </div>
            <div className="header-text">
              <h1>Productivity Planner</h1>
              <p className="header-subtitle">Plan, track, and achieve your daily goals</p>
            </div>
          </div>

          <div className="header-actions">
            <div className="planner-view-switch" style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
              <button
                type="button"
                className={`view-toggle-btn ${viewType === 'list' ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', background: viewType === 'list' ? 'var(--primary)' : 'transparent', color: viewType === 'list' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewType('list')}
              >
                <List size={14} />
                List
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewType === 'calendar' ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer', background: viewType === 'calendar' ? 'var(--primary)' : 'transparent', color: viewType === 'calendar' ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setViewType('calendar')}
              >
                <CalendarIcon size={14} />
                Calendar
              </button>
            </div>
            <button
              className="maximize-btn"
              onClick={() => setMaximizedView(!maximizedView)}
              title={maximizedView ? "Show side panel" : "Maximize tasks"}
            >
              {maximizedView ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
            </button>
            <button
              className="refresh-btn"
              onClick={() => void handleRefreshPlanner()}
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
        <Modal
          isOpen={isEditing && !!editForm}
          onOpenChange={(open) => { if (!open) handleCancelEdit(); }}
          title={isNewTask ? 'Create New Task' : 'Edit Task'}
          className="planner-task-modal-shell"
          maxWidth="sm"
          footer={
            <div className="flex gap-3 justify-end">
              <button
                className="app-modal-btn app-modal-btn-secondary"
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className={`app-modal-btn app-modal-btn-primary ${!editForm?.title.trim() || isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleSaveEdit}
                disabled={!editForm?.title.trim() || isSaving}
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
          }
        >
          {editForm && (
            <div className="planner-task-modal flex flex-col gap-4 pt-1">
              {saveError && <div className="planner-form-error">{saveError}</div>}

              {/* ── Task Title (Hero) ── */}
              <div className="planner-task-form-group">
                <label htmlFor="task-title" className="planner-field-label">
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
                  placeholder="What needs to be done?"
                  className="planner-modal-title-input"
                  autoFocus
                  disabled={isSaving}
                />
              </div>

              {/* ── Schedule Day Picker ── */}
              <div className="planner-task-form-group">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="planner-field-label">Schedule Day</label>
                  <span className="planner-task-day-label-active">
                    {(() => {
                      const dayYmd = getNextLocalDateForWeekday(timezone, editForm.scheduledDay ?? getWeekdayIndexInTimezone(new Date(), timezone));
                      const todayYmd = getDateKeyInTimezone(new Date(), timezone);
                      if (dayYmd === todayYmd) return 'Today';
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      if (dayYmd === getDateKeyInTimezone(tomorrow, timezone)) return 'Tomorrow';
                      return formatLocalDateLabel(dayYmd, timezone);
                    })()}
                  </span>
                </div>
                <div className="planner-task-day-picker-row">
                  {DAY_LABELS.map((label, idx) => {
                    const isSelected = editForm.scheduledDay === idx;
                    const isToday = getWeekdayIndexInTimezone(new Date(), timezone) === idx;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`planner-task-day-pill${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                        disabled={isSaving}
                        onClick={() => {
                          setEditForm(prev => prev ? {
                            ...prev,
                            scheduledDay: idx,
                            dueDate: getNextLocalDateForWeekday(timezone, idx),
                          } : null);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Time & Duration Row ── */}
              <div className="planner-task-form-row">
                <div className="planner-task-form-group flex-1">
                  <label htmlFor="task-time" className="planner-field-label">Start Time</label>
                  <input
                    id="task-time"
                    type="time"
                    value={editForm.startTime || ''}
                    onChange={(e) => {
                      const newTime = e.target.value;
                      setEditForm(prev => {
                        if (!prev) return null;
                        let updatedDueDate = prev.dueDate;
                        if (prev.scheduledDay != null) {
                          updatedDueDate = getNextLocalDateForWeekday(timezone, prev.scheduledDay);
                        }
                        return { ...prev, startTime: newTime, dueDate: updatedDueDate };
                      });
                    }}
                    className="planner-modal-time-input"
                    disabled={isSaving}
                  />
                </div>

                <div className="planner-task-form-group flex-1">
                  <label htmlFor="task-duration" className="planner-field-label">Duration</label>
                  <div className="duration-quick-row">
                    {[15, 30, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        className={`duration-quick-chip ${(editForm.duration || 60) === mins ? 'is-selected' : ''}`}
                        onClick={() => setEditForm(prev => prev ? { ...prev, duration: mins } : null)}
                        disabled={isSaving}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Priority Segmented Control (Zero Decision Fatigue) ── */}
              <div className="planner-task-form-group">
                <label className="planner-field-label">Priority</label>
                <div className="planner-segmented-group">
                  {[
                    { id: 'low', label: '🟢 Low', color: 'prio-low' },
                    { id: 'medium', label: '🔵 Medium', color: 'prio-medium' },
                    { id: 'high', label: '🟠 High', color: 'prio-high' },
                    { id: 'urgent', label: '🔴 Urgent', color: 'prio-urgent' },
                  ].map((p) => {
                    const isSelected = (editForm.priority || 'medium') === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`planner-seg-btn ${p.color} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setEditForm(prev => prev ? { ...prev, priority: p.id as any } : null)}
                        disabled={isSaving}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Category Chips (1-Click Selection) ── */}
              <div className="planner-task-form-group">
                <label className="planner-field-label">Category</label>
                <div className="planner-category-chips-row">
                  {[
                    { id: 'work', label: '💼 Work' },
                    { id: 'meeting', label: '🤝 Meeting' },
                    { id: 'health', label: '🏃 Health' },
                    { id: 'learning', label: '📚 Learning' },
                    { id: 'routine', label: '🔄 Routine' },
                    { id: 'personal', label: '👤 Personal' },
                    ...(isUltra ? [{ id: 'goal', label: '🎯 Goal' }] : []),
                  ].map((cat) => {
                    const isSelected = editForm.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`planner-category-pill ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setEditForm(prev => {
                            if (!prev) return null;
                            const updates: any = { category: cat.id };
                            if (!isEnergyTouched) {
                              updates.energy = estimateEnergyLevel(prev.title, cat.id);
                            }
                            return { ...prev, ...updates };
                          });
                        }}
                        disabled={isSaving}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Energy Level Segmented Control ── */}
              <div className="planner-task-form-group">
                <label className="planner-field-label">Energy Level</label>
                <div className="planner-segmented-group">
                  {[
                    { id: 'low', label: '🌙 Low Energy' },
                    { id: 'medium', label: '🔋 Medium Energy' },
                    { id: 'high', label: '⚡ High Energy' },
                  ].map((en) => {
                    const isSelected = (editForm.energy || 'medium') === en.id;
                    return (
                      <button
                        key={en.id}
                        type="button"
                        className={`planner-seg-btn energy-${en.id} ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => {
                          setIsEnergyTouched(true);
                          setEditForm(prev => prev ? { ...prev, energy: en.id as any } : null);
                        }}
                        disabled={isSaving}
                      >
                        {en.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Collapsible "More Options" Section (Zero Decision Fatigue) ── */}
              <div className="planner-more-options-wrapper">
                <button
                  type="button"
                  className="planner-more-options-toggle"
                  onClick={() => setShowMoreOptions(prev => !prev)}
                >
                  <Sparkles size={14} className="text-amber-500" />
                  <span>{showMoreOptions ? 'Hide Advanced Options' : 'More Options (Notes, Subtasks, Blockers)'}</span>
                  {showMoreOptions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showMoreOptions && (
                  <div className="planner-more-options-content flex flex-col gap-4 pt-3">
                    {/* Description */}
                    <div className="planner-task-form-group">
                      <label htmlFor="task-description" className="planner-field-label">
                        Notes / Description
                      </label>
                      <textarea
                        id="task-description"
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Key context, links, or notes..."
                        rows={2}
                        className="planner-modal-textarea"
                        disabled={isSaving}
                      />
                    </div>

                    {/* Goal Link if category === 'goal' or isUltra */}
                    {isUltra && (
                      <div className="planner-task-form-group">
                        <label htmlFor="task-goal-select" className="planner-field-label">
                          Link to Goal (Optional)
                        </label>
                        <select
                          id="task-goal-select"
                          value={editForm.goalId || ''}
                          onChange={(e) => setEditForm({ ...editForm, goalId: e.target.value })}
                          className="planner-modal-select"
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

                    {/* Blockers */}
                    <div className="planner-task-form-group">
                      <label className="planner-field-label">Depends On (Blocker)</label>
                      <select
                        value={editForm.depends_on_task_id || ''}
                        onChange={(e) => setEditForm({ ...editForm, depends_on_task_id: e.target.value || undefined })}
                        className="planner-modal-select"
                        disabled={isSaving}
                      >
                        <option value="">-- No Blockers --</option>
                        {tasks.filter(t => t.id !== editForm.id && String(t.status) !== 'done' && String(t.status) !== 'completed').map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Tags */}
                    <div className="planner-task-form-group">
                      <label htmlFor="task-tags" className="planner-field-label">
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
                        placeholder="e.g. client, urgent, v2"
                        className="planner-modal-input"
                        disabled={isSaving}
                      />
                    </div>

                    {/* Subtasks */}
                    <div className="planner-task-form-group">
                      <div className="flex items-center justify-between mb-2">
                        <label className="planner-field-label">Subtasks</label>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, subtasks: [...(editForm.subtasks || []), { title: '', completed: false }] })}
                          className="planner-add-subtask-btn"
                          disabled={isSaving}
                        >
                          <Plus size={12} />
                          <span>Add Subtask</span>
                        </button>
                      </div>
                      <div className="planner-subtasks-list">
                        {(editForm.subtasks || []).map((subtask, idx) => (
                          <div key={idx} className="planner-subtask-row">
                            <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={(e) => {
                                const newSub = [...(editForm.subtasks || [])];
                                newSub[idx].completed = e.target.checked;
                                setEditForm({ ...editForm, subtasks: newSub });
                              }}
                              className="planner-subtask-checkbox"
                              disabled={isSaving}
                            />
                            <input
                              type="text"
                              value={subtask.title}
                              placeholder="Subtask title"
                              disabled={isSaving}
                              onChange={(e) => {
                                const newSub = [...(editForm.subtasks || [])];
                                newSub[idx].title = e.target.value;
                                setEditForm({ ...editForm, subtasks: newSub });
                              }}
                              className="planner-subtask-input"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSub = [...(editForm.subtasks || [])];
                                newSub.splice(idx, 1);
                                setEditForm({ ...editForm, subtasks: newSub });
                              }}
                              className="planner-subtask-delete-btn"
                              title="Remove subtask"
                              disabled={isSaving}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* Main content */}
        {viewType === 'calendar' ? (
          <CalendarGridView
            tasks={tasks}
            currentTime={currentTime}
            onAddTaskAtTime={handleAddTaskAtTime}
            onEditTask={(t) => handleEditTask(t)}
            onCompleteTask={(id) => handleCompleteTask(id.toString())}
            onToggleLockTask={handleToggleLockTask}
            onRescheduleTask={handleRescheduleTask}
          />
        ) : (
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

              {/* Quick Add Bar */}
              <QuickAddBar
                initialMode="task"
                timezone={timezone}
                onTaskCreated={async (payload) => {
                  const res = await createTask(payload);
                  if (res.success) {
                    await forceRefresh();
                  }
                  return res;
                }}
                onHabitCreated={async (payload) => {
                  const res = await createHabit(payload);
                  if (res.success) {
                    await forceRefresh();
                  }
                  return res;
                }}
                onExpandToModal={handleExpandQuickAdd}
              />

              {isLoading ? (
                <div className="loading-state">
                  <Loader2 className="animate-spin" size={32} />
                  <p>Loading your planner...</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <p>{error}</p>
                  <button onClick={() => void handleRefreshPlanner()}>Try again</button>
                </div>
              ) : tasks.length === 0 ? (
                <div className="empty-tasks">
                  <List size={48} />
                  <h3>No tasks scheduled yet</h3>
                  <p>Get started by typing in quick-add above or use detailed form</p>
                  <button className="add-first-task-btn" onClick={handleAddTask}>
                    <Plus size={16} /> Detailed Form
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

                    // Chronological order: what's due next sits at the top, later work
                    // below it, undated tasks after that, and finished work last.
                    const rank = (task: any) =>
                      normalizeTaskStatus(task.status) === 'done' ? 2 : 0;

                    const sortedTasks = [...uniqueTasks].sort((a, b) => {
                      const rankDiff = rank(a) - rank(b);
                      if (rankDiff !== 0) return rankDiff;

                      const aDate = parseTaskDate(a.dueDate || a.due_date);
                      const bDate = parseTaskDate(b.dueDate || b.due_date);
                      if (aDate && bDate) return aDate.getTime() - bDate.getTime();
                      if (aDate) return -1;
                      if (bDate) return 1;
                      return String(a.title || '').localeCompare(String(b.title || ''));
                    });

                    return sortedTasks.map((task) => (
                      <TaskCard
                        key={task.id || task._id || `task-${crypto.randomUUID()}`}
                        task={transformTaskForCard(task)}
                        onEdit={(t) => handleEditTask(t)}
                        onDelete={(id) => deleteTask(id.toString())}
                        onStartTask={(id) => handleStartTask(id.toString())}
                        onMarkComplete={(id) => handleCompleteTask(id.toString())}
                        onRepeat={(t) => handleOpenRepeatModal(t)}
                        onDuplicate={(t) => void handleDuplicateTask(t)}
                        onAutoUpdateStatus={(id, status) => updateTask(String(id), { status: status as any })}
                        onUpdateTask={(id, updates) => updateTask(String(id), updates)}
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
        )}

        {/* Bottom section */}
        <div className="planner-bottom-grid">
          <HabitTracker habits={habits} />
          <PlannerDashboard
            totalTasks={totalTasks}
            completedTasks={completedTasks}
            tasksOverdue={tasks.filter(t => (t.status as any) === 'overdue').length}
            tasksLeft={tasks.filter(t => t.status === 'todo' || t.status === 'in-progress').length}
            totalHabits={habits.filter(h => h.status !== 'archived').length}
            completedHabits={habits.filter(h => {
              if (h.status === 'archived') return false;
              if (!h.lastCompleted) return false;
              const d = new Date(h.lastCompleted);
              return getDateKeyInTimezone(d, timezone) === getDateKeyInTimezone(new Date(), timezone);
            }).length}
            continuousHabits={habits.filter(h => h.currentStreak > 3).length}
            totalGoals={goals.length}
          />
        </div>
      </div>

      {/* Recurrence Modal */}
      <Modal
        isOpen={isRepeatModalOpen}
        onOpenChange={setIsRepeatModalOpen}
        title="Set Recurrence"
        className="planner-task-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end items-center">
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={() => setIsRepeatModalOpen(false)}
              disabled={isCreatingRecurrence}
            >
              Cancel
            </button>
            <button
              className={`app-modal-btn app-modal-btn-primary ${isCreatingRecurrence ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleCreateRecurrence}
              disabled={isCreatingRecurrence}
            >
              {isCreatingRecurrence ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <>
                  <Repeat size={16} />
                  <span>Create Tasks</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-2">
          {recurrenceError && <div className="text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-sm">{recurrenceError}</div>}
          <div className="text-[var(--text-secondary)] text-sm leading-relaxed mb-2">
            Schedule iterative copies of <strong>"{taskToRepeat?.title}"</strong> into your planner.
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">Recurrence Schedule</label>
            <select
              value={repeatConfig.type}
              onChange={(e) => setRepeatConfig(p => ({ ...p, type: e.target.value }))}
              className="planner-modal-select planner-modal-select-recurrence p-3 bg-black/10 dark:bg-black/20 border border-[var(--border-primary)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-all w-full"
              disabled={isCreatingRecurrence}
            >
              <option value="daily">Daily Loop</option>
              <option value="weekly">Weekly Loop</option>
            </select>
          </div>

          <p className="text-xs text-[var(--text-tertiary)] mt-2">
            The task repeats on this schedule until you turn recurrence off from the task menu.
          </p>
        </div>
      </Modal>

    </ErrorBoundary>
  );
}
