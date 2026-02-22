import React, { useMemo, useState } from 'react';
import { Brain, Calendar, Clock, Lock } from 'lucide-react';
import { usePlanner } from '../../hooks/usePlanner';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import {
  formatLocalDateLabel,
  getDateKeyInTimezone,
  getNextLocalDateForWeekday,
  getWeekdayIndexInTimezone,
} from '../../utils/timezone';
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
  const { goals, scheduleDeepWork } = usePlanner();
  const timezone = useSettingsStore((state) => state.timezone);
  const isUltra = useUserStore((state) => state.isUltra);

  const [selectedDays, setSelectedDays] = useState<number[]>([getWeekdayIndexInTimezone(currentTime, timezone)]);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledBlocks, setScheduledBlocks] = useState<Array<any>>([]);

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
          <p>Deep work scheduling is available on Ultra.</p>
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
      </div>

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
              max={480}
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
    </div>
  );
}
