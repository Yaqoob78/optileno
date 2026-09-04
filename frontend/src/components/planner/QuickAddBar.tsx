// frontend/src/components/planner/QuickAddBar.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  Zap,
  Tag,
  Clock,
  Flame,
  Maximize2,
  CornerDownLeft,
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { parseQuickAdd, ParsedQuickAdd, ParsedToken } from '../../utils/quickAddParser';
import '../../styles/components/planner/QuickAddBar.css';

export interface PrebuiltHabit {
  id: string;
  name: string;
  emoji: string;
  category: string;
  frequency: 'daily' | 'weekly';
  description?: string;
}

export const PREBUILT_HABITS: PrebuiltHabit[] = [
  { id: 'water', name: 'Drink 2L Water', emoji: '💧', category: 'Health', frequency: 'daily', description: 'Hydrate for sustained physical and cognitive energy' },
  { id: 'meditation', name: '10m Meditation', emoji: '🧘', category: 'Wellness', frequency: 'daily', description: 'Mindful breathing and stress relief' },
  { id: 'reading', name: 'Read 20 Pages', emoji: '📖', category: 'Learning', frequency: 'daily', description: 'Consistent daily reading and mental growth' },
  { id: 'workout', name: '30m Workout', emoji: '🏃', category: 'Health', frequency: 'daily', description: 'Cardio, strength, or bodyweight exercise' },
  { id: 'deepwork', name: 'Deep Work Sprint', emoji: '⚡', category: 'Productivity', frequency: 'daily', description: '45-min distraction-free focus sprint' },
  { id: 'sleep', name: 'Sleep by 11 PM', emoji: '🌙', category: 'Wellness', frequency: 'daily', description: 'Consistent sleep schedule for full recovery' },
  { id: 'steps', name: '8,000 Steps', emoji: '🚶', category: 'Health', frequency: 'daily', description: 'Daily active walking streak' },
  { id: 'detox', name: 'Screen-Free Morning', emoji: '📵', category: 'Wellness', frequency: 'daily', description: 'Zero phone or social media for the first 30 mins' },
  { id: 'gratitude', name: 'Daily Gratitude', emoji: '📝', category: 'Wellness', frequency: 'daily', description: 'Reflect on 3 things you are grateful for' },
  { id: 'stretch', name: '10m Full-Body Stretch', emoji: '🤸', category: 'Health', frequency: 'daily', description: 'Relieve muscle tension and boost flexibility' },
];

interface QuickAddBarProps {
  initialMode?: 'task' | 'habit';
  timezone?: string;
  onTaskCreated: (payload: any) => Promise<{ success: boolean; error?: string }>;
  onHabitCreated: (payload: any) => Promise<{ success: boolean; error?: string }>;
  onExpandToModal?: (parsed: ParsedQuickAdd) => void;
  className?: string;
}

export const QuickAddBar: React.FC<QuickAddBarProps> = ({
  initialMode = 'task',
  timezone = 'UTC',
  onTaskCreated,
  onHabitCreated,
  onExpandToModal,
  className = '',
}) => {
  const [mode, setMode] = useState<'task' | 'habit'>(initialMode);
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Parse input progressively in real time
  const parsed = useMemo(() => {
    return parseQuickAdd(inputValue, timezone, mode);
  }, [inputValue, timezone, mode]);

  // Global Keyboard Shortcut: 'Q' or 'N' to focus quick-add when not in another input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (!isInputActive && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Clear notice after delay
  useEffect(() => {
    if (!feedbackNotice) return;
    const t = window.setTimeout(() => setFeedbackNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [feedbackNotice]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const title = parsed.cleanTitle.trim();
    if (!title || isSubmitting) return;

    setIsSubmitting(true);
    setFeedbackNotice(null);

    try {
      if (mode === 'habit' || parsed.isHabit) {
        // Create Habit
        const habitPayload = {
          name: title,
          title: title,
          description: '',
          category: parsed.category ? parsed.category.charAt(0).toUpperCase() + parsed.category.slice(1) : 'Wellness',
          frequency: parsed.habitFrequency || 'daily',
        };

        const result = await onHabitCreated(habitPayload);
        if (result.success) {
          setInputValue('');
          setFeedbackNotice({ type: 'success', text: `Habit "${title}" created!` });
        } else {
          setFeedbackNotice({ type: 'error', text: result.error || 'Failed to create habit.' });
        }
      } else {
        // Create Task
        const taskPayload = {
          title,
          description: '',
          priority: parsed.priority || 'medium',
          status: 'planned',
          due_local_date: parsed.dueDate || undefined,
          due_local_time: parsed.dueTime || undefined,
          timezone,
          estimated_duration_minutes: parsed.duration || 60,
          tags: parsed.tags || [],
          category: parsed.category || 'work',
          energy: parsed.energy || 'medium',
        };

        const result = await onTaskCreated(taskPayload);
        if (result.success) {
          setInputValue('');
          setFeedbackNotice({ type: 'success', text: `Task "${title}" scheduled!` });
        } else {
          setFeedbackNotice({ type: 'error', text: result.error || 'Failed to create task.' });
        }
      }
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', text: err.message || 'Creation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddHabit = async (prebuilt: PrebuiltHabit) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedbackNotice(null);

    try {
      const habitPayload = {
        name: prebuilt.name,
        title: prebuilt.name,
        description: prebuilt.description || '',
        category: prebuilt.category,
        frequency: prebuilt.frequency,
      };

      const result = await onHabitCreated(habitPayload);
      if (result.success) {
        setFeedbackNotice({
          type: 'success',
          text: `${prebuilt.emoji} "${prebuilt.name}" added to daily habits!`,
        });
      } else {
        setFeedbackNotice({
          type: 'error',
          text: result.error || `Failed to add ${prebuilt.name}.`,
        });
      }
    } catch (err: any) {
      setFeedbackNotice({ type: 'error', text: err.message || 'Creation failed.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInsertShortcut = (textToAppend: string) => {
    setInputValue((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${textToAppend}` : textToAppend;
    });
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey && onExpandToModal) {
        e.preventDefault();
        onExpandToModal(parsed);
      } else {
        e.preventDefault();
        void handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setInputValue('');
      inputRef.current?.blur();
    } else if (e.key === 'Tab' && !inputValue.trim()) {
      e.preventDefault();
      setMode((prev) => (prev === 'task' ? 'habit' : 'task'));
    }
  };

  const handleExpandClick = () => {
    if (onExpandToModal) {
      onExpandToModal(parsed);
    }
  };

  const removeToken = (token: ParsedToken) => {
    setInputValue((prev) => prev.replace(token.rawText, '').replace(/\s+/g, ' ').trim());
  };

  return (
    <div className={`quick-add-container ${isFocused ? 'is-focused' : ''} ${className}`}>
      {feedbackNotice && (
        <div className={`quick-add-toast is-${feedbackNotice.type}`} role="status">
          <div className="quick-add-toast-content">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 size={15} className="toast-icon" />
            ) : (
              <AlertCircle size={15} className="toast-icon" />
            )}
            <span>{feedbackNotice.text}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} aria-label="Dismiss notification">
            <X size={13} />
          </button>
        </div>
      )}

      <form className="quick-add-form" onSubmit={handleSubmit}>
        <div className="quick-add-input-row">
          {/* Mode Selector Pill */}
          <div className="quick-add-mode-toggle">
            <button
              type="button"
              className={`quick-add-mode-tab ${mode === 'task' ? 'is-active is-task' : ''}`}
              onClick={() => setMode('task')}
              title="Switch to Task mode"
            >
              <Plus size={13} className="mode-icon" />
              <span>Task</span>
            </button>
            <button
              type="button"
              className={`quick-add-mode-tab ${mode === 'habit' ? 'is-active is-habit' : ''}`}
              onClick={() => setMode('habit')}
              title="Switch to Habit mode (1-click tracking)"
            >
              <Flame size={13} className="mode-icon" />
              <span>Habit</span>
            </button>
          </div>

          {/* Natural Language Input */}
          <div className="quick-add-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              className="quick-add-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'habit'
                  ? "Track a habit... (e.g. Read 20 pages daily)"
                  : "What needs to be done? (e.g. Team sync tomorrow 3pm)"
              }
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="quick-add-actions">
            {onExpandToModal && (
              <button
                type="button"
                className="quick-add-action-btn expand-btn"
                onClick={handleExpandClick}
                title="Expand detailed form (Shift+Enter)"
                disabled={isSubmitting}
              >
                <Maximize2 size={14} />
              </button>
            )}

            <button
              type="submit"
              className={`quick-add-action-btn submit-btn ${parsed.cleanTitle ? 'is-ready' : ''}`}
              disabled={!parsed.cleanTitle || isSubmitting}
              title={`Add ${mode === 'habit' ? 'habit' : 'task'} (Enter)`}
            >
              {isSubmitting ? (
                <span className="quick-add-spinner" />
              ) : (
                <CornerDownLeft size={14} />
              )}
            </button>
          </div>
        </div>

        {/* Real-time Visual Confirmation Chips (Only shown when parsed tokens exist) */}
        {parsed.tokens.length > 0 && (
          <div className="quick-add-chips-row">
            <div className="chips-label">
              <Sparkles size={12} className="sparkle-icon" />
              <span>Smart Preview:</span>
            </div>

            <div className="chips-list">
              {parsed.tokens.map((token, idx) => {
                let icon = <Tag size={12} />;
                let colorClass = 'chip-default';

                if (token.type === 'date' || token.type === 'time') {
                  icon = <CalendarIcon size={12} />;
                  colorClass = 'chip-date';
                } else if (token.type === 'priority') {
                  icon = <Zap size={12} />;
                  colorClass = `chip-prio-${token.value}`;
                } else if (token.type === 'category') {
                  icon = <Layers size={12} />;
                  colorClass = 'chip-category';
                } else if (token.type === 'duration') {
                  icon = <Clock size={12} />;
                  colorClass = 'chip-duration';
                } else if (token.type === 'frequency') {
                  icon = <Flame size={12} />;
                  colorClass = 'chip-frequency';
                }

                return (
                  <span key={idx} className={`quick-add-chip ${colorClass}`}>
                    <span className="chip-icon">{icon}</span>
                    <span className="chip-text">{token.label}</span>
                    <button
                      type="button"
                      className="chip-remove-btn"
                      onClick={() => removeToken(token)}
                      title="Remove filter"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 1-Click Prebuilt Good Habits (Visible in Habit mode) */}
        {mode === 'habit' && (
          <div className="quick-add-prebuilt-tray">
            <div className="prebuilt-header">
              <Sparkles size={13} className="sparkle-icon" />
              <span>1-Click Good Habits:</span>
            </div>
            <div className="prebuilt-chips-scroll">
              {PREBUILT_HABITS.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  className="prebuilt-habit-btn"
                  onClick={() => void handleQuickAddHabit(habit)}
                  disabled={isSubmitting}
                  title={`Add "${habit.name}" - ${habit.description}`}
                >
                  <span className="prebuilt-emoji">{habit.emoji}</span>
                  <span className="prebuilt-text">{habit.name}</span>
                  <Plus size={11} className="prebuilt-plus" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Task Helpers (Only in Task mode when focused or typing) */}
        {mode === 'task' && (isFocused || inputValue.length > 0) && (
          <div className="quick-add-task-helpers">
            <span className="helper-label">Quick actions:</span>
            <button
              type="button"
              className="quick-helper-pill"
              onClick={() => handleInsertShortcut('today')}
            >
              📅 Today
            </button>
            <button
              type="button"
              className="quick-helper-pill"
              onClick={() => handleInsertShortcut('tomorrow 9am')}
            >
              ⏰ Tomorrow 9am
            </button>
            <button
              type="button"
              className="quick-helper-pill"
              onClick={() => handleInsertShortcut('!high')}
            >
              ⚡ High Priority
            </button>
            <button
              type="button"
              className="quick-helper-pill"
              onClick={() => handleInsertShortcut('30m')}
            >
              ⏱️ 30m
            </button>
            <button
              type="button"
              className="quick-helper-pill highlight-pill"
              onClick={() => setMode('habit')}
            >
              <Flame size={11} />
              <span>1-Click Habits</span>
              <ChevronRight size={11} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default QuickAddBar;
