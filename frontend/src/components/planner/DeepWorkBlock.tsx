import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Brain, Calendar, Clock, Coffee, Lock, Pause, Play, Timer, X } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import type { DeepWorkSession } from '../../services/api/planner.service';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import {
  addDaysToLocalDateKey,
  formatLocalDateLabel,
  getDateKeyInTimezone,
  getNextLocalDateForWeekday,
  getTimeHHMMInTimezone,
  getWeekdayIndexInTimezone,
} from '../../utils/timezone';
import { Modal } from '../common/Modal';
import '../../styles/components/planner/DeepWorkBlock.css';

interface DeepWorkBlockProps {
  currentTime: Date;
}

const DAYS: Array<{ label: string; value: number }> = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

export default function DeepWorkBlock({ currentTime }: DeepWorkBlockProps) {
  const {
    goals,
    scheduleDeepWork,
    fetchScheduledDeepWork,
    startDeepWork,
    startScheduledDeepWork,
    activeDeepWork,
    pauseDeepWork,
    resumeDeepWork,
    cancelDeepWork,
    completeDeepWork,
  } = usePlanner();
  const timezone = useSettingsStore((state) => state.timezone);
  const isUltra = useUserStore((state) => state.isUltra);

  const [selectedDays, setSelectedDays] = useState<number[]>([getWeekdayIndexInTimezone(currentTime, timezone)]);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingNow, setIsStartingNow] = useState(false);
  const [isSessionActionBusy, setIsSessionActionBusy] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startNowError, setStartNowError] = useState<string | null>(null);
  const [scheduledBlocks, setScheduledBlocks] = useState<DeepWorkSession[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedScheduledSessionId, setSelectedScheduledSessionId] = useState<string | null>(null);
  const [startNowHours, setStartNowHours] = useState(2);
  const [startNowGoalId, setStartNowGoalId] = useState('');
  const [startNowNotes, setStartNowNotes] = useState('');

  const [tickNow, setTickNow] = useState<number>(Date.now());
  const [isBreakPromptOpen, setIsBreakPromptOpen] = useState(false);
  const [isBreakActive, setIsBreakActive] = useState(false);
  const [breakTimerSeconds, setBreakTimerSeconds] = useState(0);
  const [handledBreakMarkers, setHandledBreakMarkers] = useState<number[]>([]);

  const activeSession = useMemo(() => {
    if (!activeDeepWork) return null;
    return activeDeepWork.status === 'active' || activeDeepWork.status === 'paused' ? activeDeepWork : null;
  }, [activeDeepWork]);

  const selectedScheduledSession = useMemo(
    () => scheduledBlocks.find((session) => session.id === selectedScheduledSessionId) || null,
    [scheduledBlocks, selectedScheduledSessionId],
  );
  const isScheduledStartMode = !!selectedScheduledSession;

  const resetBreakState = useCallback(() => {
    setIsBreakPromptOpen(false);
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
    setHandledBreakMarkers([]);
  }, []);

  const openStartModalForImmediate = () => {
    setSelectedScheduledSessionId(null);
    setStartNowHours(2);
    setStartNowGoalId('');
    setStartNowNotes('');
    setStartNowError(null);
    setIsStartModalOpen(true);
  };

  const openStartModalForScheduled = (session: DeepWorkSession) => {
    const durationMinutes = Math.max(60, Math.min(720, Number(session.planned_duration_minutes || 60)));
    setSelectedScheduledSessionId(session.id);
    setStartNowHours(Math.max(1, Math.min(12, Math.round(durationMinutes / 60))));
    setStartNowGoalId(session.goal_id ? String(session.goal_id) : '');
    setStartNowNotes(session.notes || '');
    setStartNowError(null);
    setIsStartModalOpen(true);
  };

  const loadScheduledBlocks = useCallback(async () => {
    if (!isUltra) {
      setScheduledBlocks([]);
      return;
    }
    setIsScheduleLoading(true);
    const result = await fetchScheduledDeepWork({ includeMissed: true, daysAhead: 14 });
    if (result.success && result.sessions) {
      setScheduledBlocks(result.sessions);
    } else if (result.error) {
      setError(result.error);
    }
    setIsScheduleLoading(false);
  }, [fetchScheduledDeepWork, isUltra]);

  const getSessionStartMs = (session: typeof activeSession): number => {
    if (!session) return Date.now();
    const raw = session.started_at || session.startTime || session.scheduled_start_at;
    if (!raw) return Date.now();
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  };

  const getSessionPausedAtMs = (session: typeof activeSession): number | null => {
    if (!session || !session.paused_at) return null;
    const parsed = new Date(session.paused_at).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const getElapsedSeconds = (session: typeof activeSession, nowMs: number): number => {
    if (!session) return 0;
    const startMs = getSessionStartMs(session);
    let elapsed = Math.floor((nowMs - startMs) / 1000);
    elapsed -= Number(session.accumulated_pause_seconds || 0);

    if (session.status === 'paused') {
      const pausedAtMs = getSessionPausedAtMs(session);
      if (pausedAtMs) {
        elapsed -= Math.floor((nowMs - pausedAtMs) / 1000);
      }
    }

    return Math.max(0, elapsed);
  };

  const plannedDurationMinutes = useMemo(() => {
    const raw = Number(activeSession?.planned_duration_minutes || activeSession?.duration || 60);
    return Math.max(60, Math.min(720, Number.isFinite(raw) ? raw : 60));
  }, [activeSession]);

  const elapsedSeconds = useMemo(() => {
    if (!activeSession) return 0;
    return getElapsedSeconds(activeSession, tickNow);
  }, [activeSession, tickNow]);

  const totalSeconds = plannedDurationMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progressPercent = totalSeconds > 0 ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  const formatClock = (seconds: number) => {
    const safe = Math.max(0, seconds);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const selectedDaySchedules = useMemo(() => {
    const now = currentTime;
    const todayLocalDate = getDateKeyInTimezone(now, timezone);
    const nowLocalHHMM = getTimeHHMMInTimezone(now, timezone);

    return selectedDays
      .map((day) => {
        let localDate = getNextLocalDateForWeekday(timezone, day, now);

        // If today is selected but the chosen time has already passed, move to next week's same day.
        if (localDate === todayLocalDate && startTime <= nowLocalHHMM) {
          localDate = addDaysToLocalDateKey(localDate, 7);
        }

        return {
          day,
          dayLabel: DAYS.find((d) => d.value === day)?.label ?? `Day ${day}`,
          localDate,
        };
      })
      .filter((item, index, arr) => arr.findIndex((entry) => entry.localDate === item.localDate) === index);
  }, [currentTime, selectedDays, startTime, timezone]);

  const dayPreview = useMemo(() => {
    const now = currentTime;
    const today = getDateKeyInTimezone(now, timezone);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = getDateKeyInTimezone(tomorrowDate, timezone);

    return selectedDaySchedules.map(({ dayLabel, localDate }) => {
      if (localDate === today) return `${dayLabel}: Today`;
      if (localDate === tomorrow) return `${dayLabel}: Tomorrow`;
      return `${dayLabel}: ${formatLocalDateLabel(localDate, timezone)}`;
    });
  }, [currentTime, selectedDaySchedules, timezone]);

  const scheduledReminderCards = useMemo(() => {
    const nowMs = currentTime.getTime();
    return scheduledBlocks
      .map((session) => {
        const plannedMinutes = Math.max(60, Math.min(720, Number(session.planned_duration_minutes || 60)));
        const scheduledStartMs = session.scheduled_start_at ? new Date(session.scheduled_start_at).getTime() : Number.NaN;
        const windowEndMs = Number.isNaN(scheduledStartMs) ? Number.NaN : scheduledStartMs + plannedMinutes * 60 * 1000;
        const dueNow =
          session.status === 'scheduled' &&
          !Number.isNaN(scheduledStartMs) &&
          nowMs >= scheduledStartMs &&
          (!Number.isNaN(windowEndMs) ? nowMs < windowEndMs : true);
        const locallyMissed =
          session.status === 'scheduled' &&
          !Number.isNaN(windowEndMs) &&
          nowMs >= windowEndMs;
        const normalizedStatus = session.status === 'missed' || locallyMissed ? 'missed' : session.status;
        const scheduledStart = session.scheduled_start_at ? new Date(session.scheduled_start_at) : null;

        return {
          ...session,
          plannedMinutes,
          dueNow,
          normalizedStatus,
          sortTimestamp: Number.isNaN(scheduledStartMs) ? Number.MAX_SAFE_INTEGER : scheduledStartMs,
          displayDate: scheduledStart ? formatLocalDateLabel(getDateKeyInTimezone(scheduledStart, timezone), timezone) : 'Scheduled',
          displayTime: scheduledStart
            ? new Intl.DateTimeFormat(undefined, {
              timeZone: timezone,
              hour: 'numeric',
              minute: '2-digit',
            }).format(scheduledStart)
            : '--:--',
        };
      })
      .filter((session) => session.normalizedStatus === 'scheduled' || session.normalizedStatus === 'missed')
      .sort((a, b) => a.sortTimestamp - b.sortTimestamp);
  }, [currentTime, scheduledBlocks, timezone]);

  const toggleDay = (dayValue: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayValue)) {
        return prev.filter((value) => value !== dayValue);
      }
      return [...prev, dayValue].sort((a, b) => a - b);
    });
  };

  const handleSchedule = async () => {
    setError(null);
    if (selectedDays.length === 0 || selectedDaySchedules.length === 0) {
      setError('Select at least one day.');
      return;
    }
    if (!startTime) {
      setError('Select a start time.');
      return;
    }
    if (!durationMinutes || durationMinutes < 60) {
      setError('Duration must be at least 60 minutes.');
      return;
    }

    setIsSubmitting(true);
    const result = await scheduleDeepWork({
      days_of_week: selectedDays,
      local_dates: selectedDaySchedules.map((item) => item.localDate),
      start_time: startTime,
      duration_minutes: durationMinutes,
      timezone,
      goal_id: selectedGoalId || null,
      notes: notes || undefined,
      recurring: isRecurring,
    });
    setIsSubmitting(false);

    if (!result.success || !result.sessions) {
      setError(result.error || 'Failed to schedule deep work.');
      return;
    }

    setScheduledBlocks(result.sessions);
    void loadScheduledBlocks();
    setNotes('');
  };

  const handleStartNow = async () => {
    setStartNowError(null);
    setIsStartingNow(true);
    try {
      if (isScheduledStartMode && selectedScheduledSessionId) {
        const result = await startScheduledDeepWork(selectedScheduledSessionId);
        if (!result.success) {
          setStartNowError(result.error || 'Failed to start scheduled deep work session.');
          void loadScheduledBlocks();
          return;
        }
      } else {
        const plannedMinutes = Math.max(60, Math.min(720, startNowHours * 60));
        const result = await startDeepWork({
          plannedDurationMinutes: plannedMinutes,
          goalId: startNowGoalId || undefined,
          notes: startNowNotes.trim() || undefined,
        });
        if (!result.success) {
          setStartNowError(result.error || 'Failed to start deep work session.');
          return;
        }
      }

      void loadScheduledBlocks();
      setIsStartModalOpen(false);
      setStartNowNotes('');
      setStartNowGoalId('');
      setStartNowHours(2);
      setSelectedScheduledSessionId(null);
      resetBreakState();
    } finally {
      setIsStartingNow(false);
    }
  };

  const handlePauseSession = async () => {
    setError(null);
    setIsSessionActionBusy(true);
    const result = await pauseDeepWork();
    if (!result.success) {
      setError(result.error || 'Unable to pause the deep work session.');
    }
    setIsSessionActionBusy(false);
  };

  const handleResumeSession = async () => {
    setError(null);
    setIsSessionActionBusy(true);
    const result = await resumeDeepWork();
    if (!result.success) {
      setError(result.error || 'Unable to resume the deep work session.');
    }
    setIsSessionActionBusy(false);
  };

  const handleCancelSession = async () => {
    setError(null);
    setIsSessionActionBusy(true);
    const result = await cancelDeepWork();
    if (!result.success) {
      setError(result.error || 'Unable to cancel the deep work session.');
      setIsSessionActionBusy(false);
      return;
    }
    resetBreakState();
    setIsSessionActionBusy(false);
    void loadScheduledBlocks();
  };

  const startBreak = (minutes: number) => {
    setIsBreakPromptOpen(false);
    setIsBreakActive(true);
    setBreakTimerSeconds(minutes * 60);
  };

  const handleSkipBreak = async () => {
    setIsBreakPromptOpen(false);
    const result = await resumeDeepWork();
    if (!result.success) {
      setError(result.error || 'Unable to resume after break.');
    }
  };

  const handleEndBreak = async () => {
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
    const result = await resumeDeepWork();
    if (!result.success) {
      setError(result.error || 'Unable to resume after break.');
    }
  };

  useEffect(() => {
    if (!isUltra) return;
    void loadScheduledBlocks();
    const interval = window.setInterval(() => {
      void loadScheduledBlocks();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [isUltra, loadScheduledBlocks]);

  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.status, activeSession?.paused_at, activeSession?.accumulated_pause_seconds]);

  useEffect(() => {
    if (!activeSession) {
      setIsAutoCompleting(false);
      resetBreakState();
      return;
    }
    const elapsedMinutes = Math.floor(getElapsedSeconds(activeSession, Date.now()) / 60);
    const initializedMarkers: number[] = [];
    for (let marker = 30; marker <= elapsedMinutes; marker += 30) {
      initializedMarkers.push(marker);
    }
    setHandledBreakMarkers(initializedMarkers);
    resetBreakState();
  }, [activeSession?.id, resetBreakState]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    if (isBreakPromptOpen || isBreakActive) return;

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 30 || elapsedMinutes % 30 !== 0) return;
    if (handledBreakMarkers.includes(elapsedMinutes)) return;

    setHandledBreakMarkers((prev) => [...prev, elapsedMinutes]);
    setIsBreakPromptOpen(true);
    void (async () => {
      const result = await pauseDeepWork();
      if (!result.success) {
        setError(result.error || 'Unable to pause session for break.');
      }
    })();
  }, [
    activeSession,
    elapsedSeconds,
    handledBreakMarkers,
    isBreakActive,
    isBreakPromptOpen,
    pauseDeepWork,
  ]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    if (remainingSeconds > 0 || isAutoCompleting) return;

    setIsAutoCompleting(true);
    void (async () => {
      const actualMinutes = Math.max(1, Math.min(720, Math.round(elapsedSeconds / 60)));
      const result = await completeDeepWork(actualMinutes);
      if (!result.success) {
        setError(result.error || 'Failed to auto-complete deep work session.');
        setIsAutoCompleting(false);
        return;
      }
      resetBreakState();
      setIsAutoCompleting(false);
      void loadScheduledBlocks();
    })();
  }, [
    activeSession,
    completeDeepWork,
    elapsedSeconds,
    isAutoCompleting,
    loadScheduledBlocks,
    remainingSeconds,
    resetBreakState,
  ]);

  useEffect(() => {
    if (!isBreakActive || breakTimerSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setBreakTimerSeconds((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isBreakActive, breakTimerSeconds]);

  useEffect(() => {
    if (!isBreakActive || breakTimerSeconds > 0) return;
    void handleEndBreak();
  }, [breakTimerSeconds, isBreakActive]);

  if (!isUltra) {
    return (
      <div className="deepwork-block">
        <div className="block-header">
          <div className="icon-title">
            <div className="icon-wrapper">
              <Brain size={20} />
            </div>
            <h3>Deep Work Scheduling</h3>
          </div>
        </div>
        <div className="timer-inactive">
          <Lock size={36} />
          <p>Deep work tools are available on Ultra.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deepwork-block">
      <div className="block-header">
        <div className="icon-title">
          <div className="icon-wrapper">
            <Brain size={20} />
          </div>
          <h3>Deep Work Scheduling</h3>
        </div>
        <button
          type="button"
          className="deepwork-start-now-btn"
          onClick={openStartModalForImmediate}
          disabled={!!activeSession || isSessionActionBusy || isAutoCompleting}
        >
          <Play size={14} />
          <span>{activeSession ? 'Session Running' : 'Start Now'}</span>
        </button>
      </div>

      <div className="timer-container">
        {!activeSession ? (
          <div className="timer-inactive">
            <Timer size={40} className="timer-icon" />
            <p>Start a focus session right now and track it live.</p>
            <button
              type="button"
              className="start-btn"
              onClick={openStartModalForImmediate}
              disabled={isSessionActionBusy || isAutoCompleting}
            >
              <Play size={16} />
              <span>Start Deep Work</span>
            </button>
          </div>
        ) : (
          <div className="timer-active">
            <div className="timer-status-bar">
              <span className={`session-state-badge ${activeSession.status === 'paused' ? 'paused' : 'active'}`}>
                {activeSession.status === 'paused' ? 'Paused' : 'Active'}
              </span>
              <span className="session-duration-label">
                Planned {Math.round(plannedDurationMinutes / 60)}h
              </span>
            </div>
            <div className="timer-display">
              <div className="time-left">{formatClock(remainingSeconds)}</div>
              <div className="progress-label">{progressPercent.toFixed(1)}% complete</div>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="timer-controls">
              {activeSession.status === 'active' ? (
                <button
                  type="button"
                  className="timer-btn"
                  onClick={handlePauseSession}
                  disabled={isSessionActionBusy || isAutoCompleting}
                >
                  <Pause size={14} />
                  <span>{isSessionActionBusy ? 'Pausing...' : 'Pause'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="timer-btn"
                  onClick={handleResumeSession}
                  disabled={isSessionActionBusy || isAutoCompleting}
                >
                  <Play size={14} />
                  <span>{isSessionActionBusy ? 'Resuming...' : 'Resume'}</span>
                </button>
              )}
              <button
                type="button"
                className="timer-btn cancel"
                onClick={handleCancelSession}
                disabled={isSessionActionBusy || isAutoCompleting}
              >
                <X size={14} />
                <span>{isSessionActionBusy ? 'Cancelling...' : 'Cancel'}</span>
              </button>
            </div>
            <div className="timer-auto-finish-note">
              {isAutoCompleting ? 'Finishing session...' : 'Session auto-finishes when timer reaches 00:00.'}
            </div>
          </div>
        )}
      </div>

      {isBreakPromptOpen && (
        <div className="break-modal-overlay">
          <div className="break-modal">
            <div className="break-header">
              <Coffee size={24} />
              <h3>Break Time</h3>
            </div>
            <p>You have focused for 30 minutes. Take a short break?</p>
            <div className="break-options">
              <button type="button" className="break-option" onClick={() => startBreak(2)}>2 min</button>
              <button type="button" className="break-option" onClick={() => startBreak(5)}>5 min</button>
              <button type="button" className="break-option" onClick={() => startBreak(10)}>10 min</button>
            </div>
            <div className="break-controls">
              <button type="button" className="skip-break" onClick={handleSkipBreak}>
                Skip Break
              </button>
            </div>
          </div>
        </div>
      )}

      {isBreakActive && (
        <div className="break-warning">
          <Coffee size={16} />
          <span>Break running: {formatClock(breakTimerSeconds)}</span>
          <button type="button" className="timer-btn" onClick={handleEndBreak} disabled={isSessionActionBusy || isAutoCompleting}>
            Resume Early
          </button>
        </div>
      )}

      <div className="deepwork-divider" />

      <div className="planner-panel-body" style={{ paddingTop: 0 }}>
        {error && <div className="deepwork-form-error">{error}</div>}

        <div className="deepwork-form-group">
          <label>
            <Calendar size={16} style={{ marginRight: '8px' }} />
            Select Day(s) in Next 7 Days
          </label>
          <div className="deepwork-day-picker-row">
            {DAYS.map((day) => {
              const isSelected = selectedDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={`deepwork-day-pill${isSelected ? ' selected' : ''}`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {dayPreview.length > 0 && (
            <div className="deepwork-day-picker-hint" style={{ display: 'grid', gap: '0.25rem' }}>
              {dayPreview.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          )}
        </div>

        <div className="deepwork-form-row">
          <div className="deepwork-form-group">
            <label>
              <Clock size={16} style={{ marginRight: '8px' }} />
              Start Time
            </label>
            <input
              type="time"
              className="deepwork-input"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </div>
          <div className="deepwork-form-group">
            <label>Duration (minutes)</label>
            <input
              type="number"
              className="deepwork-input"
              min={60}
              max={720}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Math.max(60, Number(event.target.value) || 60))}
            />
          </div>
        </div>

        <div className="deepwork-form-group">
          <label>Goal (Optional)</label>
          <select
            className="deepwork-select"
            value={selectedGoalId}
            onChange={(event) => setSelectedGoalId(event.target.value)}
          >
            <option value="">No specific goal</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </div>

        <div className="deepwork-form-group">
          <label>Notes (Optional)</label>
          <textarea
            className="deepwork-textarea"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="deepwork-form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
          <label style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary, #6c5ce7)', cursor: 'pointer' }}
            />
            Repeat every week
          </label>
          {isRecurring && (
            <span style={{ fontSize: '0.8rem', opacity: 0.7, fontStyle: 'italic' }}>
              Sessions auto-renew weekly
            </span>
          )}
        </div>

        <button
          className="deepwork-submit-btn"
          style={{ width: '100%' }}
          onClick={handleSchedule}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Scheduling...' : isRecurring ? 'Schedule Recurring Deep Work' : 'Schedule Deep Work'}
        </button>
      </div>

      {(isScheduleLoading || scheduledReminderCards.length > 0) && (
        <div className="completed-sessions">
          <h4>Scheduled Blocks</h4>
          {isScheduleLoading && <div className="session-loading">Refreshing schedule...</div>}
          <div className="sessions-list">
            {scheduledReminderCards.map((session) => {
              const isMissed = session.normalizedStatus === 'missed';
              const isDueNow = session.dueNow && !isMissed;
              const canStartFromReminder = isDueNow && !activeSession && !isSessionActionBusy && !isAutoCompleting;
              return (
                <button
                  key={session.id}
                  type="button"
                  className={`session-item ${isDueNow ? 'due-now' : ''} ${isMissed ? 'missed' : ''} ${canStartFromReminder ? 'clickable' : ''}`}
                  disabled={!canStartFromReminder}
                  onClick={() => openStartModalForScheduled(session)}
                >
                  <span className="session-item-title">
                    {(isDueNow || isMissed) && <AlertCircle size={14} />}
                    {isDueNow
                      ? 'Due now - tap to start'
                      : isMissed
                        ? 'Missed deep work - penalty applied'
                        : 'Scheduled deep work'}
                  </span>
                  <span className="session-item-meta">
                    {session.displayDate} at {session.displayTime} ({session.plannedMinutes} min)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={isStartModalOpen}
        onOpenChange={(open) => {
          setIsStartModalOpen(open);
          if (!open) {
            setSelectedScheduledSessionId(null);
            setStartNowError(null);
          }
        }}
        title={isScheduledStartMode ? 'Start Scheduled Deep Work' : 'Start Deep Work'}
        className="deepwork-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={() => {
                setIsStartModalOpen(false);
                setSelectedScheduledSessionId(null);
              }}
              disabled={isStartingNow}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn app-modal-btn-primary"
              onClick={handleStartNow}
              disabled={isStartingNow}
            >
              {isStartingNow ? 'Starting...' : isScheduledStartMode ? 'Start Scheduled Session' : 'Start Session'}
            </button>
          </div>
        }
      >
        <div className="deepwork-start-modal">
          {startNowError && <div className="deepwork-form-error">{startNowError}</div>}

          {isScheduledStartMode && selectedScheduledSession && (
            <div className="deepwork-scheduled-note">
              Scheduled for {selectedScheduledSession.scheduled_start_at
                ? new Intl.DateTimeFormat(undefined, {
                  timeZone: timezone,
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(selectedScheduledSession.scheduled_start_at))
                : 'this slot'}
            </div>
          )}

          <div className="deepwork-form-group">
            <label>{isScheduledStartMode ? 'Scheduled Duration' : 'Session Duration (1-12 hours)'}</label>
            <div className="deepwork-hour-picker">
              <button
                type="button"
                className="hour-step-btn"
                onClick={() => setStartNowHours((prev) => Math.max(1, prev - 1))}
                disabled={isScheduledStartMode || startNowHours <= 1 || isStartingNow}
              >
                -
              </button>
              <div className="hour-value">{startNowHours}h</div>
              <button
                type="button"
                className="hour-step-btn"
                onClick={() => setStartNowHours((prev) => Math.min(12, prev + 1))}
                disabled={isScheduledStartMode || startNowHours >= 12 || isStartingNow}
              >
                +
              </button>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={startNowHours}
              onChange={(event) => setStartNowHours(Number(event.target.value))}
              disabled={isScheduledStartMode || isStartingNow}
            />
            <div className="deepwork-duration-hint">
              {isScheduledStartMode
                ? `${selectedScheduledSession?.planned_duration_minutes || startNowHours * 60} minutes (locked by schedule)`
                : `${startNowHours * 60} minutes focus time`}
            </div>
          </div>

          <div className="deepwork-form-group">
            <label>Goal (Optional)</label>
            <select
              className="deepwork-select"
              value={startNowGoalId}
              onChange={(event) => setStartNowGoalId(event.target.value)}
              disabled={isStartingNow || isScheduledStartMode}
            >
              <option value="">No specific goal</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>

          <div className="deepwork-form-group">
            <label>Session Notes (Optional)</label>
            <textarea
              className="deepwork-textarea"
              rows={3}
              value={startNowNotes}
              onChange={(event) => setStartNowNotes(event.target.value)}
              disabled={isStartingNow || isScheduledStartMode}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
