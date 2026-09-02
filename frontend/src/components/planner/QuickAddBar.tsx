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
          setFeedbackNotice({ type: 'success', text: `Habit "${title}" created successfully!` });
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

  const handleInsertSyntax = (snippet: string) => {
    setInputValue((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${snippet}` : snippet;
    });
    inputRef.current?.focus();
  };

  return (
    <div className={`quick-add-container ${isFocused ? 'is-focused' : ''} ${className}`}>
      {feedbackNotice && (
        <div className={`quick-add-toast is-${feedbackNotice.type}`}>
          <div className="quick-add-toast-content">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 size={15} className="toast-icon" />
            ) : (
              <AlertCircle size={15} className="toast-icon" />
            )}
            <span>{feedbackNotice.text}</span>
          </div>
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
            title={`Switch to ${mode === 'task' ? 'Habit' : 'Task'} mode (or press Tab)`}
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
                  ? "Track habit... e.g. 'Read 20m daily #learning' (Press Tab to switch)"
                  : "Quick add task... e.g. 'Review quarterly roadmap tomorrow 3pm !high #work 45m'"
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
              title="Add task or habit (Enter)"
            >
              {isSubmitting ? (
                <span className="quick-add-spinner" />
              ) : (
                <CornerDownLeft size={14} />
              )}
            </button>
          </div>
        </div>

        {/* Real-time Visual Confirmation Chips */}
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
          <button
            type="button"
            className="syntax-pill-btn"
            onClick={() => handleInsertSyntax('!high')}
            title="Click to add !high priority"
          >
            <code>!high</code> Priority
          </button>
          <button
            type="button"
            className="syntax-pill-btn"
            onClick={() => handleInsertSyntax('#work')}
            title="Click to add #work category"
          >
            <code>#work</code> Category
          </button>
          <button
            type="button"
            className="syntax-pill-btn"
            onClick={() => handleInsertSyntax('tomorrow 3pm')}
            title="Click to add date/time"
          >
            <code>tomorrow 3pm</code> Date
          </button>
          <button
            type="button"
            className="syntax-pill-btn"
            onClick={() => handleInsertSyntax('45m')}
            title="Click to add duration"
          >
            <code>45m</code> Duration
          </button>
          <button
            type="button"
            className="syntax-pill-btn"
            onClick={() => handleInsertSyntax('@deepwork')}
            title="Click to add @tag"
          >
            <code>@deepwork</code> Tag
          </button>
          <span className="syntax-key-hint">
            <kbd>Enter</kbd> Add • <kbd>Shift+Enter</kbd> Details • <kbd>Tab</kbd> Mode
          </span>
        </div>
      </form>
    </div>
  );
};

export default QuickAddBar;
