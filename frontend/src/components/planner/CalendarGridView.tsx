import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Zap,
  CheckCircle2,
  Circle,
  Brain,
  Target,
  Sparkles,
  Download,
  ExternalLink,
  Lock,
  Unlock,
  Shield,
  ShieldAlert,
  Info,
  ArrowRight,
  MoveRight,
} from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { getDateKeyInTimezone, formatLocalDateLabel, addDaysToLocalDateKey } from '../../utils/timezone';
import { downloadICSFile, getGoogleCalendarUrl, CalendarEventData } from '../../utils/calendarSync';
import './CalendarGridView.css';

interface CalendarGridViewProps {
  tasks: any[];
  deepWorkBlocks?: any[];
  currentTime: Date;
  onAddTaskAtTime?: (dateKey: string, timeHHMM: string) => void;
  onEditTask?: (task: any) => void;
  onCompleteTask?: (taskId: string) => void;
  onStartDeepWork?: (block: any) => void;
  onToggleLockTask?: (taskId: string, currentLocked: boolean) => void;
  onRescheduleTask?: (taskId: string, newTimeHHMM: string, newDateKey?: string) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

export default function CalendarGridView({
  tasks,
  deepWorkBlocks = [],
  currentTime,
  onAddTaskAtTime,
  onEditTask,
  onCompleteTask,
  onStartDeepWork,
  onToggleLockTask,
  onRescheduleTask,
}: CalendarGridViewProps) {
  const timezone = useSettingsStore((state) => state.timezone);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const [viewMode, setViewMode] = useState<'week' | 'day'>(isMobile ? 'day' : 'week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeRescheduleTaskId, setActiveRescheduleTaskId] = useState<string | null>(null);

  // Calculate 7 days for the active week starting Monday
  const fullWeekDays = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);

    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = getDateKeyInTimezone(d, timezone);
      const isToday = dateKey === getDateKeyInTimezone(new Date(), timezone);
      
      const dayTaskCount = tasks.filter((t) => {
        const dueKey = t.dueDate || t.due_date;
        if (!dueKey) return isToday;
        const parsedKey = typeof dueKey === 'string' && dueKey.includes('T')
          ? getDateKeyInTimezone(new Date(dueKey), timezone)
          : String(dueKey).substring(0, 10);
        return parsedKey === dateKey;
      }).length;

      days.push({
        date: d,
        dateKey,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday,
        taskCount: dayTaskCount,
      });
    }
    return days;
  }, [weekOffset, tasks, timezone]);

  // Current view days depending on week or day mode
  const currentWeekDays = useMemo(() => {
    if (viewMode === 'week') {
      return fullWeekDays;
    }
    return [fullWeekDays[selectedDayIndex] || fullWeekDays[0]];
  }, [viewMode, fullWeekDays, selectedDayIndex]);

  const currentRangeLabel = useMemo(() => {
    if (currentWeekDays.length === 0) return '';
    const first = currentWeekDays[0];
    const last = currentWeekDays[currentWeekDays.length - 1];
    if (viewMode === 'day') {
      return `${first.dayName}, ${first.monthName} ${first.dayNumber}`;
    }
    return `${first.monthName} ${first.dayNumber} – ${last.monthName} ${last.dayNumber}, ${first.date.getFullYear()}`;
  }, [currentWeekDays, viewMode]);

  // Current time position (percentage from 6:00 to 24:00)
  const currentTimePercentage = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    if (hours < 6 || hours > 23) return null;
    const totalMinutesFrom6 = (hours - 6) * 60 + minutes;
    const totalDayMinutes = 18 * 60; // 18 hours
    return (totalMinutesFrom6 / totalDayMinutes) * 100;
  }, [currentTime]);

  // Parse time string to minutes from 06:00
  const getMinutesFrom6 = (timeStr?: string): number => {
    if (!timeStr) return 9 * 60 - 6 * 60; // Default 09:00 -> 180 min
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const clampedH = Math.max(6, Math.min(23, h));
    return (clampedH - 6) * 60 + m;
  };

  // Helper to adjust time by delta minutes
  const shiftTimeStr = (timeStr: string, deltaMinutes: number): string => {
    const [hStr, mStr] = timeStr.split(':');
    let totalMins = (parseInt(hStr, 10) || 9) * 60 + (parseInt(mStr, 10) || 0) + deltaMinutes;
    totalMins = Math.max(6 * 60, Math.min(23 * 60 + 30, totalMins));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const handleExportICS = () => {
    const eventsToExport: CalendarEventData[] = [];

    tasks.forEach((t) => {
      const dueKey = t.dueDate || t.due_date;
      const timeStr = t.startTime || t.start_time || '09:00';
      const [h, m] = timeStr.split(':').map((v: string) => parseInt(v, 10) || 0);

      const d = dueKey ? new Date(dueKey) : new Date();
      if (Number.isNaN(d.getTime())) return;
      d.setHours(h, m, 0, 0);

      eventsToExport.push({
        title: t.title || 'Task',
        description: t.description || `Priority: ${t.priority || 'medium'} • Category: ${t.category || 'general'}${t.is_locked ? ' [LOCKED]' : ''}`,
        startDate: d,
        durationMinutes: t.duration || t.duration_minutes || 45,
      });
    });

    deepWorkBlocks.forEach((dw) => {
      const rawDate = dw.scheduledDate || dw.scheduled_date || dw.start_time;
      const timeStr = dw.startTime || (dw.start_time ? dw.start_time.substring(11, 16) : '09:00');
      const [h, m] = timeStr.split(':').map((v: string) => parseInt(v, 10) || 0);

      const d = rawDate ? new Date(rawDate) : new Date();
      if (Number.isNaN(d.getTime())) return;
      d.setHours(h, m, 0, 0);

      eventsToExport.push({
        title: `🛡️ Protected Deep Work: ${dw.goalTitle || 'Focus Session'}`,
        description: 'Protected focus block via Optileno',
        startDate: d,
        durationMinutes: dw.durationMinutes || dw.duration_minutes || 90,
      });
    });

    if (eventsToExport.length === 0) {
      alert('No scheduled tasks or deep work blocks to export.');
      return;
    }

    downloadICSFile(`optileno-calendar-${getDateKeyInTimezone(new Date(), timezone)}.ics`, eventsToExport);
  };

  return (
    <div className="cal-grid-wrapper">
      {/* Calendar Header Controls */}
      <div className="cal-grid-header">
        <div className="cal-nav-group">
          <button
            className="cal-btn-icon"
            onClick={() => setWeekOffset((p) => p - 1)}
            title="Previous Week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="cal-btn-today"
            onClick={() => {
              setWeekOffset(0);
              const todayIdx = fullWeekDays.findIndex((d) => d.isToday);
              if (todayIdx !== -1) setSelectedDayIndex(todayIdx);
            }}
          >
            Today
          </button>
          <button
            className="cal-btn-icon"
            onClick={() => setWeekOffset((p) => p + 1)}
            title="Next Week"
          >
            <ChevronRight size={18} />
          </button>
          <span className="cal-range-label">{currentRangeLabel}</span>
        </div>

        <div className="cal-header-actions-right">
          <button
            className="cal-sync-btn"
            onClick={handleExportICS}
            title="Export full schedule to Google Calendar / Outlook / Apple Calendar (.ics)"
          >
            <Download size={14} />
            <span>Sync / Export .ics</span>
          </button>

          <div className="cal-view-toggles">
            <button
              className={`cal-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
            <button
              className={`cal-toggle-btn ${viewMode === 'day' ? 'active' : ''}`}
              onClick={() => setViewMode('day')}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Mobile/Day-Mode Quick Jump Strip */}
      <div className="cal-mobile-days-strip">
        {fullWeekDays.map((day, idx) => {
          const isSelected = viewMode === 'day' && selectedDayIndex === idx;
          return (
            <button
              key={day.dateKey}
              type="button"
              className={`cal-strip-day-btn ${isSelected ? 'is-selected' : ''} ${day.isToday ? 'is-today' : ''}`}
              onClick={() => {
                setSelectedDayIndex(idx);
                setViewMode('day');
              }}
            >
              <span className="cal-strip-dayname">{day.dayName}</span>
              <span className="cal-strip-daynum">{day.dayNumber}</span>
              {day.taskCount > 0 && <span className="cal-strip-task-dot" />}
            </button>
          );
        })}
      </div>

      {/* Grid Container */}
      <div className="cal-grid-body">
        {/* Days Header Row */}
        <div className="cal-header-row">
          <div className="cal-time-col-header">Time</div>
          {currentWeekDays.map((day) => (
            <div
              key={day.dateKey}
              className={`cal-day-col-header ${day.isToday ? 'today-col' : ''}`}
            >
              <span className="cal-day-title">{day.dayName}</span>
              <span className={`cal-day-badge ${day.isToday ? 'active-badge' : ''}`}>
                {day.dayNumber}
              </span>
            </div>
          ))}
        </div>

        {/* Scrollable Time Slots & Event Columns */}
        <div className="cal-scroll-area">
          {/* Time Labels Sidebar */}
          <div className="cal-time-labels">
            {HOURS.map((hour) => {
              const formatted = hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
              return (
                <div key={hour} className="cal-time-slot-label">
                  <span>{formatted}</span>
                </div>
              );
            })}
          </div>

          {/* Grid Columns for Each Day */}
          <div className="cal-columns-container">
            {/* Background Hour Lines */}
            <div className="cal-bg-grid-lines">
              {HOURS.map((hour) => (
                <div key={hour} className="cal-hour-line" />
              ))}
            </div>

            {currentWeekDays.map((day) => {
              // Filter tasks for this day
              const dayTasks = tasks.filter((t) => {
                const dueKey = t.dueDate || t.due_date;
                if (!dueKey) return day.isToday;
                const parsedKey = typeof dueKey === 'string' && dueKey.includes('T')
                  ? getDateKeyInTimezone(new Date(dueKey), timezone)
                  : String(dueKey).substring(0, 10);
                return parsedKey === day.dateKey;
              });

              // Filter deep work blocks for this day
              const dayDeepWork = deepWorkBlocks.filter((dw) => {
                const rawDate = dw.scheduledDate || dw.scheduled_date || dw.start_time;
                if (!rawDate) return false;
                const parsedKey = typeof rawDate === 'string' && rawDate.includes('T')
                  ? getDateKeyInTimezone(new Date(rawDate), timezone)
                  : String(rawDate).substring(0, 10);
                return parsedKey === day.dateKey;
              });

              // Compute deep work time intervals to check for task overlaps
              const deepWorkIntervals = dayDeepWork.map((dw) => {
                const timeStr = dw.startTime || (dw.start_time ? dw.start_time.substring(11, 16) : '09:00');
                const startMins = getMinutesFrom6(timeStr);
                const duration = dw.durationMinutes || dw.duration_minutes || 90;
                return { start: startMins, end: startMins + duration };
              });

              return (
                <div
                  key={day.dateKey}
                  className={`cal-day-column ${day.isToday ? 'today-col-body' : ''}`}
                  onClick={(e) => {
                    if (e.target === e.currentTarget && onAddTaskAtTime) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickY = e.clientY - rect.top;
                      const ratio = clickY / rect.height;
                      const clickedHour = Math.floor(ratio * 18) + 6;
                      const formattedTime = `${String(clickedHour).padStart(2, '0')}:00`;
                      onAddTaskAtTime(day.dateKey, formattedTime);
                    }
                  }}
                >
                  {/* Current Time Indicator on Today's Column */}
                  {day.isToday && currentTimePercentage !== null && (
                    <div
                      className="cal-now-indicator"
                      style={{ top: `${currentTimePercentage}%` }}
                    >
                      <span className="cal-now-dot" />
                      <div className="cal-now-line" />
                    </div>
                  )}

                  {/* Render Protected Deep Work Blocks */}
                  {dayDeepWork.map((block, bIdx) => {
                    const timeStr = block.startTime || (block.start_time ? block.start_time.substring(11, 16) : '09:00');
                    const duration = block.durationMinutes || block.duration_minutes || 90;
                    const minsFrom6 = getMinutesFrom6(timeStr);
                    const topPct = (minsFrom6 / (18 * 60)) * 100;
                    const heightPct = Math.max((duration / (18 * 60)) * 100, 3.5);

                    return (
                      <div
                        key={block.id || `dw-${bIdx}`}
                        className="cal-event-block cal-deepwork-block is-protected"
                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onStartDeepWork) onStartDeepWork(block);
                        }}
                      >
                        <div className="cal-dw-badge">
                          <Shield size={12} className="shield-icon" />
                          <span>Protected Focus ({duration}m)</span>
                        </div>
                        <div className="cal-dw-title">{block.goalTitle || 'Deep Work Session'}</div>
                      </div>
                    );
                  })}

                  {/* Render Tasks Plotted in Grid */}
                  {dayTasks.map((task, tIdx) => {
                    const timeStr = task.startTime || task.start_time || '10:00';
                    const duration = task.duration || task.duration_minutes || 45;
                    const minsFrom6 = getMinutesFrom6(timeStr);
                    const topPct = (minsFrom6 / (18 * 60)) * 100;
                    const heightPct = Math.max((duration / (18 * 60)) * 100, 3.2);
                    const isDone = task.status === 'completed' || task.status === 'done';
                    const isLocked = Boolean(task.is_locked || task.meta?.is_locked);
                    const isRescheduleOpen = activeRescheduleTaskId === task.id;

                    // Check conflict against protected deep work blocks
                    const hasConflict = deepWorkIntervals.some(
                      (intv) => Math.max(minsFrom6, intv.start) < Math.min(minsFrom6 + duration, intv.end)
                    );

                    return (
                      <div
                        key={task.id || task._id || `task-${tIdx}`}
                        className={`cal-event-block cal-task-block ${isDone ? 'is-completed' : ''} ${isLocked ? 'is-locked' : ''} ${hasConflict ? 'has-focus-conflict' : ''} priority-${task.priority || 'medium'}`}
                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRescheduleTaskId(isRescheduleOpen ? null : task.id);
                        }}
                      >
                        <div className="cal-task-header">
                          <button
                            className="cal-check-btn"
                            title={isDone ? "Mark incomplete" : "Complete task"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onCompleteTask) onCompleteTask(task.id);
                            }}
                          >
                            {isDone ? <CheckCircle2 size={13} className="check-done" /> : <Circle size={13} />}
                          </button>
                          
                          <span className="cal-task-time">{timeStr}</span>

                          {/* 1-Click Lock Toggle Button */}
                          <button
                            type="button"
                            className={`cal-lock-btn ${isLocked ? 'is-locked' : ''}`}
                            title={isLocked ? "Locked to time slot (Auto-scheduler will never move)" : "Click to lock to this time slot"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onToggleLockTask) {
                                onToggleLockTask(task.id, isLocked);
                              }
                            }}
                          >
                            {isLocked ? <Lock size={11} className="lock-icon locked" /> : <Unlock size={11} className="lock-icon unlocked" />}
                          </button>

                          {task.energy === 'high' && <Zap size={11} className="energy-icon" />}

                          {/* Conflict Shield Indicator */}
                          {hasConflict && (
                            <span className="cal-conflict-pill" title="Conflicts with Protected Focus Block">
                              <ShieldAlert size={10} />
                            </span>
                          )}

                          {/* Reschedule Transparency Note */}
                          {task.reschedule_reason && (
                            <span className="cal-reschedule-pill" title={`Auto-Moved: ${task.reschedule_reason}`}>
                              <Info size={10} />
                            </span>
                          )}

                          <button
                            className="cal-gcal-link-btn"
                            title="Add to Google Calendar"
                            onClick={(e) => {
                              e.stopPropagation();
                              const dueKey = task.dueDate || task.due_date;
                              const [h, m] = timeStr.split(':').map((v: string) => parseInt(v, 10) || 0);
                              const d = dueKey ? new Date(dueKey) : new Date();
                              d.setHours(h, m, 0, 0);
                              const gcalUrl = getGoogleCalendarUrl({
                                title: task.title,
                                description: task.description,
                                startDate: d,
                                durationMinutes: duration,
                              });
                              window.open(gcalUrl, '_blank', 'noopener,noreferrer');
                            }}
                          >
                            <ExternalLink size={10} />
                          </button>
                        </div>

                        <div className="cal-task-title">{task.title}</div>

                        {/* Quick-Reschedule Touch Action Bar (Expandable) */}
                        {isRescheduleOpen && (
                          <div
                            className="cal-quick-reschedule-bar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="cal-reschedule-chip"
                              title="Shift 15m earlier"
                              onClick={() => {
                                const newTime = shiftTimeStr(timeStr, -15);
                                if (onRescheduleTask) onRescheduleTask(task.id, newTime);
                                setActiveRescheduleTaskId(null);
                              }}
                            >
                              -15m
                            </button>
                            <button
                              type="button"
                              className="cal-reschedule-chip"
                              title="Shift 15m later"
                              onClick={() => {
                                const newTime = shiftTimeStr(timeStr, 15);
                                if (onRescheduleTask) onRescheduleTask(task.id, newTime);
                                setActiveRescheduleTaskId(null);
                              }}
                            >
                              +15m
                            </button>
                            <button
                              type="button"
                              className="cal-reschedule-chip"
                              title="Shift 1 hour later"
                              onClick={() => {
                                const newTime = shiftTimeStr(timeStr, 60);
                                if (onRescheduleTask) onRescheduleTask(task.id, newTime);
                                setActiveRescheduleTaskId(null);
                              }}
                            >
                              +1h
                            </button>
                            <button
                              type="button"
                              className="cal-reschedule-chip cal-edit-chip"
                              title="Full Edit"
                              onClick={() => {
                                if (onEditTask) onEditTask(task);
                                setActiveRescheduleTaskId(null);
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

