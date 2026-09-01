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
} from 'lucide-react';
import { parseQuickAdd, ParsedQuickAdd, ParsedToken } from '../../utils/quickAddParser';
import '../../styles/components/planner/QuickAddBar.css';

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
      const isInputActive = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable;

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
    const t = window.setTimeout(() => setFeedbackNotice(null), 3000);
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
          setFeedbackNotice({ type: 'success', text: `Task "${title}" created!` });
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
        <div className={`quick-add-toast is-${feedbackNotice.type}`}>
          <span>{feedbackNotice.text}</span>
          <button onClick={() => setFeedbackNotice(null)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      <form className="quick-add-form" onSubmit={handleSubmit}>
        <div className="quick-add-input-row">
          {/* Mode Selector Pill */}
          <button
            type="button"
            className={`quick-add-mode-pill ${mode === 'habit' ? 'is-habit' : 'is-task'}`}
            onClick={() => setMode((prev) => (prev === 'task' ? 'habit' : 'task'))}
            title={`Switch to ${mode === 'task' ? 'Habit' : 'Task'} creation (or press Tab)`}
          >
            {mode === 'habit' ? (
              <>
                <Flame size={14} className="mode-icon flame-active" />
                <span>Habit</span>
              </>
            ) : (
              <>
                <Plus size={14} className="mode-icon" />
                <span>Task</span>
              </>
            )}
          </button>

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
                  ? "Track new habit... e.g. 'Read 20m daily #learning' (Press Tab to switch)"
                  : "Quick add task... e.g. 'Review pull request tomorrow 4pm !high #work 30m'"
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
                title="Expand to detailed form (Shift+Enter)"
                disabled={isSubmitting}
              >
                <Maximize2 size={15} />
              </button>
            )}

            <button
              type="submit"
              className={`quick-add-action-btn submit-btn ${parsed.cleanTitle ? 'is-ready' : ''}`}
              disabled={!parsed.cleanTitle || isSubmitting}
              title="Add (Enter)"
            >
              {isSubmitting ? (
                <span className="quick-add-spinner" />
              ) : (
                <CornerDownLeft size={15} />
              )}
            </button>
          </div>
        </div>

        {/* Real-time Visual Confirmation Chips */}
        {parsed.tokens.length > 0 && (
          <div className="quick-add-chips-row">
            <div className="chips-label">
              <Sparkles size={12} className="sparkle-icon" />
              <span>Parsed:</span>
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
                      title="Remove token"
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick syntax helper hint */}
        <div className={`quick-add-hint-row ${isFocused ? 'is-visible' : ''}`}>
          <span className="syntax-pill"><code>!high</code> Priority</span>
          <span className="syntax-pill"><code>#work</code> Category</span>
          <span className="syntax-pill"><code>tomorrow 3pm</code> Date</span>
          <span className="syntax-pill"><code>45m</code> Duration</span>
          <span className="syntax-pill"><code>@tag</code> Label</span>
          <span className="syntax-key-hint"><kbd>Enter</kbd> Add • <kbd>Shift+Enter</kbd> Details • <kbd>Q</kbd> Focus</span>
        </div>
      </form>
    </div>
  );
};

export default QuickAddBar;
