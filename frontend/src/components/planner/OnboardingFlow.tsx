import React, { useState, useEffect, useRef } from 'react';
import { usePlanner } from '../../hooks/usePlanner';
import { useUser } from '../../hooks/useUser';
import { Modal } from '../common/Modal';
import {
  Target,
  Sparkles,
  Brain,
  Lock,
  ArrowRight,
  Loader2,
  Calendar,
  Shield,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { parseQuickAdd } from '../../utils/quickAddParser';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AnalyticsService } from '../../services/api/analytics.service';
import '../../styles/components/planner/OnboardingFlow.css';

type OnboardingIntent = 'goal' | 'focus' | 'task';

interface CreatedItemSummary {
  type: OnboardingIntent;
  title: string;
  time?: string;
  duration?: number;
  is_locked?: boolean;
  is_protected?: boolean;
}

export const OnboardingFlow: React.FC = () => {
  const { goals, tasks, isLoading, createTask, createGoal, forceRefresh } = usePlanner();
  const { isUltra } = useUser();
  const timezone = useSettingsStore((state) => state.timezone);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedIntent, setSelectedIntent] = useState<OnboardingIntent>('focus');
  const [actionInput, setActionInput] = useState('');
  const [focusTimeSlot, setFocusTimeSlot] = useState<'09:00' | '14:00' | '19:00'>('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdItem, setCreatedItem] = useState<CreatedItemSummary | null>(null);

  const startTimeRef = useRef<number>(Date.now());

  // Check if onboarding should open
  useEffect(() => {
    const hasCompleted = localStorage.getItem('optileno_onboarding_completed');

    if (!isLoading && !hasCompleted && goals.length === 0 && tasks.length === 0) {
      const timer = setTimeout(() => {
        startTimeRef.current = Date.now();
        setIsOpen(true);
        // Telemetry: onboarding started
        AnalyticsService.getInstance().submitEvent({
          type: 'onboarding_started',
          source: 'planner_onboarding',
          metadata: { timestamp: new Date().toISOString() },
        } as any);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isLoading, goals.length, tasks.length]);

  const handleSkip = (atStep: number) => {
    const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
    AnalyticsService.getInstance().submitEvent({
      type: 'onboarding_skipped',
      source: 'planner_onboarding',
      metadata: { dropped_at_step: atStep, duration_seconds: durationSeconds },
    } as any);

    localStorage.setItem('optileno_onboarding_completed', 'true');
    setIsOpen(false);
  };

  const handleSelectIntent = (intent: OnboardingIntent) => {
    setSelectedIntent(intent);
    AnalyticsService.getInstance().submitEvent({
      type: 'onboarding_intent_selected',
      source: 'planner_onboarding',
      metadata: { intent, step: 1 },
    } as any);
    setStep(2);
  };

  const handleExecuteAction = async () => {
    if (!actionInput.trim() && selectedIntent !== 'focus') {
      setError('Please enter a title to continue.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      let summary: CreatedItemSummary | null = null;

      if (selectedIntent === 'goal') {
        const goalTitle = actionInput.trim();
        await createGoal({
          title: goalTitle,
          description: 'Primary objective set during onboarding',
          priority: 'high',
          target_date: new Date(Date.now() + 30 * 86400000).toISOString(),
        } as any);

        await createTask({
          title: `Milestone 1: Outline execution plan for ${goalTitle}`,
          priority: 'high',
          status: 'todo',
          is_locked: true,
          estimated_duration_minutes: 60,
        } as any);

        summary = {
          type: 'goal',
          title: goalTitle,
          time: 'Today',
          duration: 60,
          is_locked: true,
          is_protected: true,
        };
      } else if (selectedIntent === 'focus') {
        const focusTitle = actionInput.trim() || 'Deep Work: High-Impact Execution';
        await createTask({
          title: `🧠 ${focusTitle}`,
          category: 'Deep Work',
          priority: 'high',
          status: 'planned',
          is_protected: true,
          is_locked: true,
          startTime: focusTimeSlot,
          due_local_time: focusTimeSlot,
          estimated_duration_minutes: 90,
        } as any);

        summary = {
          type: 'focus',
          title: focusTitle,
          time: focusTimeSlot,
          duration: 90,
          is_locked: true,
          is_protected: true,
        };
      } else {
        // Daily Task
        const parsed = parseQuickAdd(actionInput.trim(), timezone);
        const dueIso = parsed.dueDate ? `${parsed.dueDate}T${parsed.dueTime || '09:00'}:00` : undefined;
        await createTask({
          title: parsed.cleanTitle || actionInput.trim(),
          priority: parsed.priority || 'high',
          category: parsed.category || 'work',
          status: 'todo',
          is_locked: true,
          estimated_duration_minutes: parsed.duration || 45,
          due_date: dueIso,
        } as any);

        summary = {
          type: 'task',
          title: parsed.cleanTitle || actionInput.trim(),
          time: parsed.dueTime || 'Today',
          duration: parsed.duration || 45,
          is_locked: true,
        };
      }

      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      AnalyticsService.getInstance().submitEvent({
        type: 'onboarding_first_value_achieved',
        source: 'planner_onboarding',
        metadata: {
          intent: selectedIntent,
          duration_seconds: durationSeconds,
          item_title: summary?.title,
          is_locked: true,
        },
      } as any);

      setCreatedItem(summary);
      await forceRefresh();
      setStep(3);
    } catch (err: any) {
      console.error('Onboarding action failed', err);
      setError(err?.message || 'Failed to initialize plan. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('optileno_onboarding_completed', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) handleSkip(step);
      }}
      title=""
      maxWidth="md"
      footer={null}
    >
      <div className="onboarding-container">
        {/* Header & Step Progress */}
        <div className="onboarding-header">
          <div className="onboarding-step-indicator">
            <span className={`onboarding-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`} />
            <span className={`onboarding-dot ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`} />
            <span className={`onboarding-dot ${step === 3 ? 'active' : ''}`} />
          </div>

          <div className="onboarding-badge">
            <Sparkles size={13} />
            <span>Interactive Setup</span>
          </div>

          <h2 className="onboarding-title">
            {step === 1 && "What's your primary focus right now?"}
            {step === 2 && (
              selectedIntent === 'goal' ? "Set your #1 milestone" :
              selectedIntent === 'focus' ? "Protect your deep work window" :
              "Quick-capture your top task"
            )}
            {step === 3 && "First Focus Block Initialized!"}
          </h2>

          <p className="onboarding-subtitle">
            {step === 1 && "Choose your intent — Optileno will configure your board and schedule your first block."}
            {step === 2 && (
              selectedIntent === 'goal' ? "Tell us your overarching goal. Leno will schedule the first step." :
              selectedIntent === 'focus' ? "Select your peak productivity window to lock in protected focus." :
              "Enter your most urgent deliverable for today."
            )}
            {step === 3 && "Your focus block is defended against overlaps and plotted on your live calendar."}
          </p>
        </div>

        {/* STEP 1: Intent Selection */}
        {step === 1 && (
          <div className="onboarding-intent-grid">
            <button
              type="button"
              className={`onboarding-intent-card ${selectedIntent === 'goal' ? 'is-selected' : ''}`}
              onClick={() => handleSelectIntent('goal')}
            >
              <div className="intent-icon-wrapper">
                <Target size={20} />
              </div>
              <div className="intent-card-title">🚀 Ship a Goal</div>
              <div className="intent-card-desc">Break ambitious milestones into daily momentum.</div>
            </button>

            <button
              type="button"
              className={`onboarding-intent-card ${selectedIntent === 'focus' ? 'is-selected' : ''}`}
              onClick={() => handleSelectIntent('focus')}
            >
              <div className="intent-icon-wrapper">
                <Shield size={20} />
              </div>
              <div className="intent-card-title">🛡️ Defend Focus Time</div>
              <div className="intent-card-desc">Lock protected 90m deep work on your calendar.</div>
            </button>

            <button
              type="button"
              className={`onboarding-intent-card ${selectedIntent === 'task' ? 'is-selected' : ''}`}
              onClick={() => handleSelectIntent('task')}
            >
              <div className="intent-icon-wrapper">
                <Zap size={20} />
              </div>
              <div className="intent-card-title">⚡ Execute Daily Tasks</div>
              <div className="intent-card-desc">Fast-capture tasks with automatic time-blocking.</div>
            </button>
          </div>
        )}

        {/* STEP 2: Interactive Fast-Capture */}
        {step === 2 && (
          <div className="onboarding-action-box">
            {selectedIntent === 'goal' && (
              <div className="onboarding-input-group">
                <input
                  type="text"
                  className="onboarding-input"
                  placeholder="e.g. Launch MVP Beta, Deliver Client Project..."
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteAction();
                  }}
                />
                <div className="onboarding-chip-row">
                  <button type="button" className="onboarding-chip" onClick={() => setActionInput('Launch MVP Beta')}>
                    🚀 Launch MVP Beta
                  </button>
                  <button type="button" className="onboarding-chip" onClick={() => setActionInput('Deliver Client Board Deck')}>
                    📊 Deliver Client Board Deck
                  </button>
                  <button type="button" className="onboarding-chip" onClick={() => setActionInput('Ship Product Feature')}>
                    ⚡ Ship Product Feature
                  </button>
                </div>
              </div>
            )}

            {selectedIntent === 'focus' && (
              <div className="onboarding-input-group">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">Pick your best focus slot:</label>
                <div className="onboarding-time-grid">
                  <button
                    type="button"
                    className={`onboarding-time-btn ${focusTimeSlot === '09:00' ? 'is-active' : ''}`}
                    onClick={() => setFocusTimeSlot('09:00')}
                  >
                    <span className="time-slot-label">Morning</span>
                    <span className="time-slot-val">9:00 AM</span>
                  </button>
                  <button
                    type="button"
                    className={`onboarding-time-btn ${focusTimeSlot === '14:00' ? 'is-active' : ''}`}
                    onClick={() => setFocusTimeSlot('14:00')}
                  >
                    <span className="time-slot-label">Afternoon</span>
                    <span className="time-slot-val">2:00 PM</span>
                  </button>
                  <button
                    type="button"
                    className={`onboarding-time-btn ${focusTimeSlot === '19:00' ? 'is-active' : ''}`}
                    onClick={() => setFocusTimeSlot('19:00')}
                  >
                    <span className="time-slot-label">Evening</span>
                    <span className="time-slot-val">7:00 PM</span>
                  </button>
                </div>
                <input
                  type="text"
                  className="onboarding-input mt-2"
                  placeholder="Optional focus topic (e.g. Deep Coding, Core Writing)..."
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteAction();
                  }}
                />
              </div>
            )}

            {selectedIntent === 'task' && (
              <div className="onboarding-input-group">
                <input
                  type="text"
                  className="onboarding-input"
                  placeholder="e.g. Finish client review today 3pm !high"
                  value={actionInput}
                  onChange={(e) => setActionInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleExecuteAction();
                  }}
                />
                <div className="onboarding-chip-row">
                  <button type="button" className="onboarding-chip" onClick={() => setActionInput('Review Q3 Roadmap today 2pm !urgent')}>
                    🔥 Review Q3 Roadmap today 2pm
                  </button>
                  <button type="button" className="onboarding-chip" onClick={() => setActionInput('Code review & deployment 4pm 45m')}>
                    💻 Code review & deploy 4pm
                  </button>
                </div>
              </div>
            )}

            {error && <span className="text-xs text-red-400 mt-1">{error}</span>}
          </div>
        )}

        {/* STEP 3: First Value Live Showcase */}
        {step === 3 && createdItem && (
          <div className="onboarding-confirmation-card">
            <div className="confirmation-badge-row">
              <span className="confirmation-status-pill">
                <CheckCircle2 size={12} />
                Live on Calendar
              </span>
              <span className="confirmation-lock-pill">
                <Lock size={12} />
                Time Protected & Locked
              </span>
            </div>

            <div className="confirmation-item-title">{createdItem.title}</div>

            <div className="confirmation-details">
              <div className="confirmation-detail-item">
                <Clock size={14} />
                <span>{createdItem.time || 'Today'} ({createdItem.duration || 60}m)</span>
              </div>
              <div className="confirmation-detail-item">
                <Shield size={14} className="text-indigo-400" />
                <span>Collision Guard Active</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="onboarding-footer-controls">
          <button
            type="button"
            className="onboarding-skip-btn"
            onClick={() => handleSkip(step)}
          >
            {step === 3 ? "Done" : "Skip setup for now"}
          </button>

          {step === 1 && (
            <button
              type="button"
              className="onboarding-submit-btn"
              onClick={() => setStep(2)}
            >
              Continue <ArrowRight size={15} />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              className="onboarding-submit-btn"
              onClick={handleExecuteAction}
              disabled={isSubmitting || (!actionInput.trim() && selectedIntent !== 'focus')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Locking Plan...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Initialize & Lock In
                </>
              )}
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              className="onboarding-submit-btn"
              onClick={handleFinish}
            >
              Go to My Planner & Calendar <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
