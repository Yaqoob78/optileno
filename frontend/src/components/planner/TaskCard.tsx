import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle, Clock, Zap, Tag, Edit3, Trash2, MoreVertical,
  ChevronDown, ChevronRight, Copy, AlertCircle, Briefcase,
  Users, Coffee, Dumbbell, BookOpen, Home, Target,
  Play, Pause, Timer, FileText, Hash, X
} from 'lucide-react';
import '../../styles/components/planner/TaskCard.css';

interface Subtask {
  id: number;
  title: string;
  completed: boolean;
}

interface Task {
  id: string | number;
  originalId?: string; // API ID for operations
  title: string;
  startTime?: string;
  duration: number;
  energy: 'low' | 'medium' | 'high';
  status: 'completed' | 'in-progress' | 'scheduled' | 'planned' | 'overdue' | 'failed' | 'pending' | 'todo';
  category: 'goal' | 'work' | 'meeting' | 'health' | 'learning' | 'routine' | 'personal';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  description?: string;
  subtasks?: Subtask[];
  notes?: string;
  goalTitle?: string;
  meta?: {
    started_at?: string;
    last_started_at?: string;
    retry_count?: number;
    [key: string]: any;
  };
}

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string | number) => void;
  onToggleStatus?: (taskId: string | number) => void;
  onDuplicate?: (task: Task) => void;
  onMarkComplete?: (taskId: string | number) => void;
  onStartTask?: (taskId: string | number) => void;
  onPauseTask?: (taskId: string | number) => void;
  onAutoUpdateStatus?: (taskId: string | number, status: string) => void;
  compact?: boolean;
  draggable?: boolean;
}

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onToggleStatus,
  onDuplicate,
  onMarkComplete,
  onStartTask,
  onPauseTask,
  onAutoUpdateStatus,
  compact = false,
  draggable = false
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // Normalize potentially inconsistent backend status
  const normalizedStatus = (task.status as string) === 'in_progress' ? 'in-progress' : task.status;
  const [currentStatus, setCurrentStatus] = useState(normalizedStatus);

  // Sync status if prop updates
  useEffect(() => {
    setCurrentStatus((task.status as string) === 'in_progress' ? 'in-progress' : task.status);
  }, [task.status]);

  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showMarkComplete, setShowMarkComplete] = useState(false);
  const [taskEndTime, setTaskEndTime] = useState<number>(0);
  const [overdueStarted, setOverdueStarted] = useState(false);
  const [overdueEndTime, setOverdueEndTime] = useState<number>(0);

  // Local override for start time to handle immediate "Start" click on overdue tasks
  const [localStartTime, setLocalStartTime] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const categoryIcons: Record<string, React.ReactNode> = {
    goal: <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />,
    work: <Briefcase size={14} />,
    meeting: <Users size={14} />,
    health: <Dumbbell size={14} />,
    learning: <BookOpen size={14} />,
    routine: <Target size={14} />,
    personal: <Home size={14} />
  };

  const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    completed: { color: 'status-completed', label: 'Completed', icon: <CheckCircle size={12} /> },
    'in-progress': { color: 'status-in-progress', label: 'In Progress', icon: <Play size={12} /> },
    'in_progress': { color: 'status-in-progress', label: 'In Progress', icon: <Play size={12} /> }, // Handle backend var
    scheduled: { color: 'status-scheduled', label: 'Scheduled', icon: <Clock size={12} /> },
    pending: { color: 'status-scheduled', label: 'Pending', icon: <Clock size={12} /> }, // Map pending to scheduled style
    planned: { color: 'status-planned', label: 'Planned', icon: <Target size={12} /> },
    overdue: { color: 'status-overdue', label: 'Overdue', icon: <AlertCircle size={12} /> },
    failed: { color: 'status-failed', label: 'Failed', icon: <X size={12} /> } // Added Failed status
  };

  const priorityConfig = {
    urgent: { color: 'priority-urgent', label: 'Urgent' },
    high: { color: 'priority-high', label: 'High' },
    medium: { color: 'priority-medium', label: 'Medium' },
    low: { color: 'priority-low', label: 'Low' }
  };

  const energyConfig = {
    high: { color: 'energy-high', label: 'High' },
    medium: { color: 'energy-medium', label: 'Medium' },
    low: { color: 'energy-low', label: 'Low' }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showActions && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  // Determine if it's a retry (started significantly after original schedule)
  const isRetry = (() => {
    if (!task.meta?.last_started_at && !localStartTime) return false;

    // Calculate original window end
    const effectiveDurationMinutes = Math.max(5, task.duration);
    const durationMs = effectiveDurationMinutes * 60 * 1000;

    let startTimeMs = 0;
    if (task.startTime) {
      const [h, m] = task.startTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      startTimeMs = d.getTime();
    } else {
      return false; // Can't determine retry without scheduled start
    }

    const window1EndMs = startTimeMs + durationMs + (15 * 60 * 1000);
    const lastStart = localStartTime || new Date(task.meta!.last_started_at!).getTime();

    return lastStart > window1EndMs;
  })();

  const calculateTimes = () => {
    const now = new Date();
    const currentTimeMs = now.getTime();

    // Enforce minimum duration of 5 minutes for calculations
    const effectiveDurationMinutes = Math.max(5, task.duration);
    const durationMs = effectiveDurationMinutes * 60 * 1000;

    let startTimeMs: number = 0;

    // Parse Scheduled Start Time
    if (task.startTime) {
      const [h, m] = task.startTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      startTimeMs = d.getTime();
    } else {
      // If no start time, assume now? Or handle as Todo?
      // User implied strict scheduling. If no time, treat as "Start Now" or "Todo".
      startTimeMs = currentTimeMs;
    }

    const scheduledEndTimeMs = startTimeMs + durationMs;
    const window1EndMs = scheduledEndTimeMs + (15 * 60 * 1000); // 15 min completion window

    let retryEndTimeMs = 0;
    let window2EndMs = 0;

    if (isRetry) {
      const lastStart = localStartTime || new Date(task.meta!.last_started_at!).getTime();
      retryEndTimeMs = lastStart + durationMs;
      window2EndMs = retryEndTimeMs + (10 * 60 * 1000); // 10 min completion window for retry
    }

    // ─── STATE MACHINE ─────────────────────────────

    // 1. FAILED
    if (currentStatus === 'failed') {
      setTimeRemaining('Failed');
      setShowMarkComplete(false);
      return;
    }

    // 2. COMPLETED
    if (currentStatus === 'completed') {
      setTimeRemaining('Completed');
      setShowMarkComplete(false);
      return;
    }

    // 3. RETRY FLOW
    if (isRetry) {
      // A. Retry In Progress
      if (currentTimeMs < retryEndTimeMs) {
        const diffMs = retryEndTimeMs - currentTimeMs;
        const h = Math.floor(diffMs / (1000 * 60 * 60));
        const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeRemaining(`Retry: ${h}h ${m}m ${s}s`);
        setShowMarkComplete(false); // Strict: no early complete

        // Ensure visual status
        if (currentStatus !== 'in-progress') setCurrentStatus('in-progress');
        if (!overdueStarted) setOverdueStarted(true); // Helper to trigger styles if needed
      }
      // B. Retry Completion Window (Window 2)
      else if (currentTimeMs < window2EndMs) {
        const diffMs = window2EndMs - currentTimeMs;
        const m = Math.floor(diffMs / (1000 * 60));
        const s = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeRemaining(`Mark Complete: ${m}m ${s}s`);
        setShowMarkComplete(true);
      }
      // C. Retry Failed
      else {
        setTimeRemaining('Failed');
        setShowMarkComplete(false);
        if ((currentStatus as string) !== 'failed') { // Cast to string to avoid TypeScript narrowing error
          setCurrentStatus('failed');
          if (onAutoUpdateStatus) onAutoUpdateStatus(task.originalId || String(task.id), 'failed');
        }
      }
      return;
    }

    // 4. NORMAL FLOW

    // A. Scheduled (Future)
    if (currentTimeMs < startTimeMs) {
      const diffMs = startTimeMs - currentTimeMs;
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`Starts in ${h}h ${m}m`);
      setShowMarkComplete(false);
      if (currentStatus !== 'scheduled' && currentStatus !== 'planned') {
        // Just visual update, don't force backend sync to avoid loops if backend disagrees
        // setCurrentStatus('scheduled');
      }
      return;
    }

    // B. In Progress (Auto-Start)
    if (currentTimeMs < scheduledEndTimeMs) {
      const diffMs = scheduledEndTimeMs - currentTimeMs;
      const h = Math.floor(diffMs / (1000 * 60 * 60));
      const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeRemaining(`${h}h ${m}m ${s}s left`);
      setShowMarkComplete(false); // Strict

      // Auto-update status if needed
      if (currentStatus !== 'in-progress') {
        setCurrentStatus('in-progress');
        // Optionally sync to backend: if (onAutoUpdateStatus) onAutoUpdateStatus(...)
      }
      return;
    }

    // C. Completion Window 1
    if (currentTimeMs < window1EndMs) {
      const diffMs = window1EndMs - currentTimeMs;
      const m = Math.floor(diffMs / (1000 * 60));
      const s = Math.floor((diffMs % (1000 * 60)) / 1000);
      setTimeRemaining(`Mark Complete: ${m}m ${s}s`);
      setShowMarkComplete(true);
      return;
    }

    // D. Overdue
    setTimeRemaining('Overdue');
    setShowMarkComplete(false); // Strict: missed window
    if (currentStatus !== 'overdue') {
      setCurrentStatus('overdue');
      if (onAutoUpdateStatus) onAutoUpdateStatus(task.originalId || String(task.id), 'overdue');
    }
  };

  useEffect(() => {
    calculateTimes();
    const interval = setInterval(calculateTimes, 1000); // 1-second update for strict timer
    return () => clearInterval(interval);
  }, [task.startTime, task.duration, currentStatus, task.meta, localStartTime]);

  const formatTime = (startTime?: string, duration?: number) => {
    if (!startTime || duration === undefined) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;

    const formatTime = (h: number, m: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHours = h % 12 || 12;
      return `${displayHours}:${m.toString().padStart(2, '0')} ${period}`;
    };

    return `${formatTime(hours, minutes)} - ${formatTime(endHours, endMinutes)}`;
  };

  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);

  const startTaskInternal = () => {
    setCurrentStatus('in-progress');
    setIsPaused(false);

    // Set local override for immediate UI feedback
    setLocalStartTime(Date.now());

    // We update local state immediately, but we must call API to record start time
    if (onStartTask) {
      const idToUse = task.originalId || String(task.id);
      onStartTask(idToUse);
    }
  };

  const handleStartTask = () => {
    // Logic: Start (or Retry)
    if (currentStatus === 'overdue') {
      setIsRetryModalOpen(true);
      return;
    }
    startTaskInternal();
  };

  const handleConfirmRetry = () => {
    setIsRetryModalOpen(false);
    setOverdueStarted(true);
    startTaskInternal();
  };

  const handlePauseTask = () => {
    setIsPaused(true);
    if (onPauseTask) {
      onPauseTask(task.id);
    }
  };

  const handleResumeTask = () => {
    setIsPaused(false);
    // Resume logic if needed
  };

  const handleMarkComplete = () => {
    setCurrentStatus('completed');
    setShowMarkComplete(false);
    setOverdueStarted(false);

    if (onMarkComplete) {
      const idToUse = task.originalId || String(task.id);
      onMarkComplete(idToUse);
    }
  };

  const getPrimaryActionButton = () => {
    if (currentStatus === 'completed' || currentStatus === 'failed') {
      return null;
    }

    // If in-progress or retrying...
    if (currentStatus === 'in-progress') {
      // Only show Mark Complete if strict window allows it
      if (showMarkComplete) {
        return (
          <button
            className="primary-action-btn mark-complete"
            onClick={handleMarkComplete}
            title="Mark task as complete"
          >
            <CheckCircle size={14} />
            <span>Complete</span>
          </button>
        );
      }
      // Otherwise, NO buttons (Strict mode)
      return null;
    }

    // If Overdue, show Start (Retry)
    if (currentStatus === 'overdue') {
      return (
        <button
          className="primary-action-btn start"
          onClick={handleStartTask}
          title="Retry Task"
        >
          <Play size={14} />
          <span>Retry</span>
        </button>
      );
    }

    // Scheduled/Planned: Return NULL (Auto-start only, no manual start)
    // Exception: If currentStatus is 'todo' or 'pending' without a strict start time? 
    // But we enforce Time Strictness.
    return null;
  };

  return (
    <div
      className={`task-card ${statusConfig[currentStatus]?.color || ''} ${compact ? 'compact' : ''} ${draggable ? 'draggable' : ''}`}
      draggable={draggable}
    >
      <div className="task-card-header">
        <div className="task-main-info">
          <div className={`status-indicator ${currentStatus === 'completed' ? 'completed' : ''}`}>
            {currentStatus === 'completed' ? (
              <CheckCircle size={18} />
            ) : (
              <div className="incomplete-indicator" />
            )}
          </div>

          <div className="task-title-section">
            <div className="title-row">
              <h4 className="task-title">{task.title}</h4>
              {currentStatus === 'overdue' && (
                <span className="overdue-badge">
                  <AlertCircle size={12} />
                  Overdue
                </span>
              )}
            </div>

            {!compact && task.description && (
              <p className="task-description">{task.description}</p>
            )}

            {timeRemaining && !compact && (
              <div className="time-status-indicator">
                <Timer size={12} />
                <span className="time-text">{timeRemaining}</span>
              </div>
            )}
          </div>
        </div>

        <div className="task-actions">
          <div className="action-buttons">
            {getPrimaryActionButton()}

            <button
              className="action-btn edit-btn"
              onClick={() => onEdit?.(task)}
              title="Edit task"
            >
              <Edit3 size={16} />
            </button>

            <div className="more-actions-dropdown" ref={dropdownRef}>
              <button
                className="action-btn more-btn"
                onClick={() => setShowActions(!showActions)}
                title="More actions"
              >
                <MoreVertical size={16} />
              </button>

              {showActions && (
                <div className="dropdown-menu">
                  <button onClick={() => onDuplicate?.(task)} className="dropdown-item">
                    <Copy size={14} /> Duplicate
                  </button>
                  <button onClick={() => onDelete?.(task.id)} className="dropdown-item delete">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>

            <button
              className="action-btn expand-btn"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="task-meta-grid">
        <div className="meta-item">
          <Clock size={14} />
          <span className="meta-label">Time</span>
          <span className="meta-value">{formatTime(task.startTime, task.duration)} • {task.duration}m</span>
        </div>

        <div className="meta-item">
          <div className={`energy-indicator ${energyConfig[task.energy]?.color || ''}`} />
          <span className="meta-label">Energy</span>
          <span className="meta-value">{energyConfig[task.energy]?.label || task.energy}</span>
        </div>

        <div className="meta-item">
          {task.goalTitle ? (
            <>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <span className="meta-label">Goal</span>
              <span className="meta-value goal-link" title={task.goalTitle}>
                {task.goalTitle.length > 18 ? task.goalTitle.substring(0, 16) + '...' : task.goalTitle}
              </span>
            </>
          ) : (
            <>
              {categoryIcons[task.category] || <Briefcase size={14} />}
              <span className="meta-label">Category</span>
              <span className="meta-value capitalize">{task.category}</span>
            </>
          )}
        </div>

        <div className="meta-item">
          <div className={`priority-badge ${priorityConfig[task.priority]?.color || ''}`}>
            <span className="priority-label">{priorityConfig[task.priority]?.label}</span>
          </div>
        </div>
      </div>

      {task.subtasks && task.subtasks.length > 0 && expanded && (
        <div className="subtasks-section">
          <div className="section-label">
            <span>Subtasks</span>
          </div>
          <div className="subtasks-tags">
            {task.subtasks.map(subtask => (
              <span key={subtask.id} className={`subtask-tag ${subtask.completed ? 'completed' : ''}`}>
                {subtask.completed ? <CheckCircle size={10} /> : '○'}
                <span>{subtask.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {expanded && task.notes && (
        <div className="notes-section">
          <div className="section-label">
            <FileText size={12} />
            <span>Notes</span>
          </div>
          <p className="notes-content">{task.notes}</p>
        </div>
      )}

      {/* Tags section handled if needed */}

      <div className="task-footer">
        <div className="task-id">
          <Hash size={12} />
          {task.id.toString().padStart(3, '0')}
        </div>
        <div className="task-status">
          <span className={`status-label ${statusConfig[currentStatus]?.color || ''}`}>
            {statusConfig[currentStatus]?.icon}
            {statusConfig[currentStatus]?.label || currentStatus}
          </span>
        </div>
      </div>

      {
        isRetryModalOpen && createPortal(
          <div className="task-retry-overlay" onClick={() => setIsRetryModalOpen(false)}>
            <div className="task-retry-modal" onClick={(e) => e.stopPropagation()}>
              <div className="retry-header">
                <div className="retry-icon-wrapper">
                  <AlertCircle size={24} />
                </div>
              </div>
              <h3>Retry Task?</h3>
              <p>You missed the scheduled window for <span className="highlight-text">"{task.title}"</span>.</p>
              <p className="retry-subtext">Restarting will begin a new timer with the original duration.</p>
              <div className="retry-actions">
                <button className="retry-btn cancel" onClick={() => setIsRetryModalOpen(false)}>Close</button>
                <button className="retry-btn confirm" onClick={handleConfirmRetry}>
                  <Play size={14} /> Retry Now
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div >
  );
}