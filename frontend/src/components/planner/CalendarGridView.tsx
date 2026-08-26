import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Zap, CheckCircle2, Circle, Brain, Target, Sparkles, Download, ExternalLink } from 'lucide-react';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { getDateKeyInTimezone, formatLocalDateLabel, addDaysToLocalDateKey } from '../../utils/timezone';
import { downloadICSFile, getGoogleCalendarUrl, CalendarEventData } from '../../utils/calendarSync';
import './CalendarGridView.css';

interface TaskItem {
  id: string;
  title: string;
  startTime?: string;
  duration?: number;
  dueDate?: string;
  due_date?: string;
  status: string;
  priority?: string;
  category?: string;
  energy?: string;
}

interface DeepWorkItem {
  id?: string;
  startTime?: string;
  start_time?: string;
  durationMinutes?: number;
  duration_minutes?: number;
  scheduledDate?: string;
  scheduled_date?: string;
  goalTitle?: string;
  status?: string;
}

interface CalendarGridViewProps {
  tasks: any[];
  deepWorkBlocks?: any[];
  currentTime: Date;
  onAddTaskAtTime?: (dateKey: string, timeHHMM: string) => void;
  onEditTask?: (task: any) => void;
  onCompleteTask?: (taskId: string) => void;
  onStartDeepWork?: (block: any) => void;
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
}: CalendarGridViewProps) {
  const timezone = useSettingsStore((state) => state.timezone);
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const [viewMode, setViewMode] = useState<'week' | 'day'>(isMobile ? 'day' : 'week');
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate current week days starting from Monday (or Sunday)
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);

    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon ...
    const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    const days = [];
    const count = viewMode === 'week' ? 7 : 1;
    const baseDate = viewMode === 'week' ? monday : new Date(new Date().setDate(new Date().getDate() + weekOffset));

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateKey = getDateKeyInTimezone(d, timezone);
      const isToday = dateKey === getDateKeyInTimezone(new Date(), timezone);
      days.push({
        date: d,
        dateKey,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: d.getDate(),
        monthName: d.toLocaleDateString('en-US', { month: 'short' }),
        isToday,
      });
    }
    return days;
  }, [weekOffset, viewMode, timezone]);

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

  // Parse time to minutes from 06:00
  const getMinutesFrom6 = (timeStr?: string): number => {
    if (!timeStr) return 9 * 60 - 6 * 60; // Default 09:00 -> 180 min
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const clampedH = Math.max(6, Math.min(23, h));
    return (clampedH - 6) * 60 + m;
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
        description: t.description || `Priority: ${t.priority || 'medium'} • Category: ${t.category || 'general'}`,
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
        title: `🧠 Deep Work: ${dw.goalTitle || 'Focus Session'}`,
        description: 'Scheduled focus block via Optileno',
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
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="cal-btn-today"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </button>
          <button
            className="cal-btn-icon"
            onClick={() => setWeekOffset((p) => p + 1)}
            title="Next"
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
                if (!dueKey) return day.isToday; // Unscheduled tasks show on today
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

                  {/* Render Deep Work Blocks */}
                  {dayDeepWork.map((block, bIdx) => {
                    const timeStr = block.startTime || (block.start_time ? block.start_time.substring(11, 16) : '09:00');
                    const duration = block.durationMinutes || block.duration_minutes || 90;
                    const minsFrom6 = getMinutesFrom6(timeStr);
                    const topPct = (minsFrom6 / (18 * 60)) * 100;
                    const heightPct = Math.max((duration / (18 * 60)) * 100, 3.5);

                    return (
                      <div
                        key={block.id || `dw-${bIdx}`}
                        className="cal-event-block cal-deepwork-block"
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
                          <Brain size={12} />
                          <span>Deep Work ({duration}m)</span>
                        </div>
                        <div className="cal-dw-title">{block.goalTitle || 'Focused Execution Block'}</div>
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

                    return (
                      <div
                        key={task.id || task._id || `task-${tIdx}`}
                        className={`cal-event-block cal-task-block ${isDone ? 'is-completed' : ''} priority-${task.priority || 'medium'}`}
                        style={{
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onEditTask) onEditTask(task);
                        }}
                      >
                        <div className="cal-task-header">
                          <button
                            className="cal-check-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onCompleteTask) onCompleteTask(task.id);
                            }}
                          >
                            {isDone ? <CheckCircle2 size={13} className="check-done" /> : <Circle size={13} />}
                          </button>
                          <span className="cal-task-time">{timeStr}</span>
                          {task.energy === 'high' && <Zap size={11} className="energy-icon" />}
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
