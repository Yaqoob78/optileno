import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Calendar, Clock, Coffee, Lock, Pause, Play, Timer, X, CheckCircle2 } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import {
  formatLocalDateLabel,
  getDateKeyInTimezone,
  getNextLocalDateForWeekday,
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
    startDeepWork,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStartingNow, setIsStartingNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startNowError, setStartNowError] = useState<string | null>(null);
  const [scheduledBlocks, setScheduledBlocks] = useState<Array<any>>([]);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
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

  const dayPreview = useMemo(
    () =>
      selectedDays.map((day) => {
        const localDate = getNextLocalDateForWeekday(timezone, day);
        const today = getDateKeyInTimezone(new Date(), timezone);
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = getDateKeyInTimezone(tomorrowDate, timezone);
        if (localDate === today) return `${DAYS.find((d) => d.value === day)?.label}: Today`;
        if (localDate === tomorrow) return `${DAYS.find((d) => d.value === day)?.label}: Tomorrow`;
        return `${DAYS.find((d) => d.value === day)?.label}: ${formatLocalDateLabel(localDate, timezone)}`;
      }),
    [selectedDays, timezone],
  );

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
    if (selectedDays.length === 0) {
      setError('Select at least one day.');
      return;
    }
    if (!startTime) {
      setError('Select a start time.');
      return;
    }
    if (!durationMinutes || durationMinutes < 5) {
      setError('Duration must be at least 5 minutes.');
      return;
    }

    setIsSubmitting(true);
    const result = await scheduleDeepWork({
      days_of_week: selectedDays,
      start_time: startTime,
      duration_minutes: durationMinutes,
      timezone,
      goal_id: selectedGoalId || null,
      notes: notes || undefined,
    });
    setIsSubmitting(false);

    if (!result.success || !result.sessions) {
      setError(result.error || 'Failed to schedule deep work.');
      return;
    }

    setScheduledBlocks(result.sessions);
    setNotes('');
  };

  const handleStartNow = async () => {
    setStartNowError(null);
    const plannedMinutes = Math.max(60, Math.min(720, startNowHours * 60));
    setIsStartingNow(true);
    try {
      const result = await startDeepWork({
        plannedDurationMinutes: plannedMinutes,
        goalId: startNowGoalId || undefined,
        notes: startNowNotes.trim() || undefined,
      });
      if (!result.success) {
        setStartNowError(result.error || 'Failed to start deep work session.');
        return;
      }
      setIsStartModalOpen(false);
      setStartNowNotes('');
      setStartNowGoalId('');
      setStartNowHours(2);
      setIsBreakPromptOpen(false);
      setIsBreakActive(false);
      setBreakTimerSeconds(0);
      setHandledBreakMarkers([]);
    } finally {
      setIsStartingNow(false);
    }
  };

  const handlePauseSession = async () => {
    await pauseDeepWork();
  };

  const handleResumeSession = async () => {
    await resumeDeepWork();
  };

  const handleFinishSession = async () => {
    const actualMinutes = Math.max(1, Math.min(720, Math.round(elapsedSeconds / 60)));
    await completeDeepWork(actualMinutes);
    setIsBreakPromptOpen(false);
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
    setHandledBreakMarkers([]);
  };

  const handleCancelSession = async () => {
    await cancelDeepWork();
    setIsBreakPromptOpen(false);
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
    setHandledBreakMarkers([]);
  };

  const startBreak = (minutes: number) => {
    setIsBreakPromptOpen(false);
    setIsBreakActive(true);
    setBreakTimerSeconds(minutes * 60);
  };

  const handleSkipBreak = async () => {
    setIsBreakPromptOpen(false);
    await resumeDeepWork();
  };

  const handleEndBreak = async () => {
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
    await resumeDeepWork();
  };

  useEffect(() => {
    if (!activeSession) return;
    const timer = window.setInterval(() => {
      setTickNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession?.id, activeSession?.status, activeSession?.paused_at, activeSession?.accumulated_pause_seconds]);

  useEffect(() => {
    if (!activeSession) {
      setHandledBreakMarkers([]);
      setIsBreakPromptOpen(false);
      setIsBreakActive(false);
      setBreakTimerSeconds(0);
      return;
    }
    const elapsedMinutes = Math.floor(getElapsedSeconds(activeSession, Date.now()) / 60);
    const initializedMarkers: number[] = [];
    for (let marker = 30; marker <= elapsedMinutes; marker += 30) {
      initializedMarkers.push(marker);
    }
    setHandledBreakMarkers(initializedMarkers);
    setIsBreakPromptOpen(false);
    setIsBreakActive(false);
    setBreakTimerSeconds(0);
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;
    if (isBreakPromptOpen || isBreakActive) return;

    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 30 || elapsedMinutes % 30 !== 0) return;
    if (handledBreakMarkers.includes(elapsedMinutes)) return;

    setHandledBreakMarkers((prev) => [...prev, elapsedMinutes]);
    setIsBreakPromptOpen(true);
    void pauseDeepWork();
  }, [
    activeSession,
    elapsedSeconds,
    handledBreakMarkers,
    isBreakActive,
    isBreakPromptOpen,
    pauseDeepWork,
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
          onClick={() => {
            setStartNowError(null);
            setIsStartModalOpen(true);
          }}
          disabled={!!activeSession}
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
              onClick={() => {
                setStartNowError(null);
                setIsStartModalOpen(true);
              }}
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
                <button type="button" className="timer-btn" onClick={handlePauseSession}>
                  <Pause size={14} />
                  <span>Pause</span>
                </button>
              ) : (
                <button type="button" className="timer-btn" onClick={handleResumeSession}>
                  <Play size={14} />
                  <span>Resume</span>
                </button>
              )}
              <button type="button" className="timer-btn complete" onClick={handleFinishSession}>
                <CheckCircle2 size={14} />
                <span>Finish</span>
              </button>
              <button type="button" className="timer-btn cancel" onClick={handleCancelSession}>
                <X size={14} />
                <span>Cancel</span>
              </button>
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
          <button type="button" className="timer-btn" onClick={handleEndBreak}>Resume Early</button>
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
              min={5}
              max={720}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Math.max(5, Number(event.target.value) || 5))}
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

        <button
          className="deepwork-submit-btn"
          style={{ width: '100%' }}
          onClick={handleSchedule}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Scheduling...' : 'Schedule Deep Work'}
        </button>
      </div>

      {scheduledBlocks.length > 0 && (
        <div className="completed-sessions">
          <h4>Scheduled Blocks</h4>
          <div className="sessions-list">
            {scheduledBlocks.map((session) => {
              const startedAt = session.started_at ? new Date(session.started_at) : null;
              const localDate = startedAt ? getDateKeyInTimezone(startedAt, timezone) : '';
              const startTimeLabel =
                startedAt
                  ? new Intl.DateTimeFormat(undefined, {
                      timeZone: timezone,
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(startedAt)
                  : startTime;
              return (
                <div key={session.id} className="session-item">
                  <span>
                    {localDate ? formatLocalDateLabel(localDate, timezone) : 'Scheduled'} at {startTimeLabel}
                    {' '}({session.planned_duration_minutes || durationMinutes} min)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        isOpen={isStartModalOpen}
        onOpenChange={setIsStartModalOpen}
        title="Start Deep Work"
        className="deepwork-modal-shell"
        maxWidth="sm"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              className="app-modal-btn app-modal-btn-secondary"
              onClick={() => setIsStartModalOpen(false)}
              disabled={isStartingNow}
            >
              Cancel
            </button>
            <button
              className="app-modal-btn app-modal-btn-primary"
              onClick={handleStartNow}
              disabled={isStartingNow}
            >
              {isStartingNow ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        }
      >
        <div className="deepwork-start-modal">
          {startNowError && <div className="deepwork-form-error">{startNowError}</div>}

          <div className="deepwork-form-group">
            <label>Session Duration (1-12 hours)</label>
            <div className="deepwork-hour-picker">
              <button
                type="button"
                className="hour-step-btn"
                onClick={() => setStartNowHours((prev) => Math.max(1, prev - 1))}
                disabled={startNowHours <= 1 || isStartingNow}
              >
                -
              </button>
              <div className="hour-value">{startNowHours}h</div>
              <button
                type="button"
                className="hour-step-btn"
                onClick={() => setStartNowHours((prev) => Math.min(12, prev + 1))}
                disabled={startNowHours >= 12 || isStartingNow}
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
              disabled={isStartingNow}
            />
            <div className="deepwork-duration-hint">{startNowHours * 60} minutes focus time</div>
          </div>

          <div className="deepwork-form-group">
            <label>Goal (Optional)</label>
            <select
              className="deepwork-select"
              value={startNowGoalId}
              onChange={(event) => setStartNowGoalId(event.target.value)}
              disabled={isStartingNow}
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
              disabled={isStartingNow}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
