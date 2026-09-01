import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import {
  AlertCircle,
  Check,
  Gift,
  PauseCircle,
  Sparkles,
  ArrowRight,
  Shield,
  Loader2,
  X,
  Tag,
} from 'lucide-react';
import { paymentService, CancellationSurveyPayload } from '../../services/api/payment.service';
import { useUserStore } from '../../stores/useUserStore';
import { LEMONSQUEEZY_50_OFF_COUPON, openLemonSqueezyCheckout } from '../../utils/lemonsqueezy';
import '../../styles/components/settings/CancellationSurveyModal.css';

interface CancellationSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelled: (message: string) => void;
  onOfferApplied: (message: string) => void;
}

type CancelReasonKey =
  | 'too_expensive'
  | 'not_using_enough'
  | 'missing_feature'
  | 'switched_alternative'
  | 'temporary_need'
  | 'other';

interface ReasonConfig {
  key: CancelReasonKey;
  label: string;
  followupPrompt?: string;
  followupOptions?: string[];
  followupPlaceholder?: string;
  offerType: string;
  offerBadge: string;
  offerTitle: string;
  offerDesc: string;
  offerCta: string;
  couponCode?: string;
}

const CANCEL_REASONS: ReasonConfig[] = [
  {
    key: 'too_expensive',
    label: 'Too expensive / looking to reduce monthly expenses',
    followupPrompt: 'What monthly price would feel fair and sustainable for you?',
    followupOptions: ['$5 / month', '$9 / month', '$12 / month', 'Free only'],
    offerType: 'discount_50',
    offerBadge: '50% Loyalty Discount (Coupon: M3MDQWMQ)',
    offerTitle: 'Keep Ultra Pro for 50% Off ($9.50/mo)',
    offerDesc: 'We’d love to keep supporting your deep work. Use coupon code M3MDQWMQ for 50% off your subscription at checkout.',
    offerCta: 'Apply 50% Off Coupon (M3MDQWMQ)',
    couponCode: LEMONSQUEEZY_50_OFF_COUPON,
  },
  {
    key: 'not_using_enough',
    label: 'Not using it enough / too busy right now',
    followupPrompt: 'Would a 60-day billing pause help while your workload eases?',
    followupOptions: ['Yes, pause for 60 days ($0)', 'No, I need to cancel completely'],
    offerType: 'pause_60',
    offerBadge: '60-Day Billing Freeze',
    offerTitle: 'Pause Your Subscription for 60 Days ($0/mo)',
    offerDesc: 'Preserve all your custom goals, streak history, and deep work logs. We will freeze billing at $0 for 60 days.',
    offerCta: 'Pause for 60 Days ($0)',
  },
  {
    key: 'missing_feature',
    label: 'Missing a key feature I need for my workflow',
    followupPrompt: 'Which capability was missing from your workflow?',
    followupOptions: ['2-way Outlook/Apple Sync', 'Team/Collab sharing', 'Mobile Widgets', 'Other'],
    followupPlaceholder: 'Describe the feature you need...',
    offerType: 'roadmap_feature',
    offerBadge: 'Priority Roadmap Request',
    offerTitle: 'Submit to Core Engineering + Keep Free Explorer Plan',
    offerDesc: 'Your request goes straight to our sprint review. In the meantime, keep all your planning on our 100% Free tier.',
    offerCta: 'Submit Feature & Keep Free Plan',
  },
  {
    key: 'switched_alternative',
    label: 'Switching to another tool (Motion, Sunsama, Todoist, etc.)',
    followupPrompt: 'Which tool did you switch to and why?',
    followupOptions: ['Motion', 'Sunsama', 'Todoist', 'Reclaim.ai', 'Other'],
    offerType: 'free_downgrade',
    offerBadge: '100% Free Forever Tier',
    offerTitle: 'Downgrade to Free Explorer (Zero Data Lost)',
    offerDesc: 'You never lose your tasks, habits, or history. Switch to Explorer for $0/mo with unlimited standard planning.',
    offerCta: 'Keep Free Explorer Tier',
  },
  {
    key: 'temporary_need',
    label: 'I only needed it for a short-term project / sprint',
    followupPrompt: 'Did Optileno help you achieve your project milestone?',
    followupOptions: ['Yes, completed goal!', 'Partially', 'No'],
    offerType: 'free_downgrade',
    offerBadge: '100% Free Forever Tier',
    offerTitle: 'Keep Your Project Data on Free Explorer',
    offerDesc: 'When your next project starts, your historical analytics and plans will be right here waiting.',
    offerCta: 'Downgrade to Free Tier',
  },
  {
    key: 'other',
    label: 'Other reason',
    followupPrompt: 'Any feedback you would like to share with our team?',
    followupPlaceholder: 'Tell us how we could improve Optileno...',
    offerType: 'free_downgrade',
    offerBadge: '100% Free Forever Tier',
    offerTitle: 'Keep Full Access on the Free Explorer Plan',
    offerDesc: 'Downgrade to Free Explorer with zero risk and no charges.',
    offerCta: 'Keep Free Explorer Tier',
  },
];

export const CancellationSurveyModal: React.FC<CancellationSurveyModalProps> = ({
  isOpen,
  onClose,
  onCancelled,
  onOfferApplied,
}) => {
  const [selectedReasonKey, setSelectedReasonKey] = useState<CancelReasonKey | null>(null);
  const [followupAnswer, setFollowupAnswer] = useState<string>('');
  const [customFollowupText, setCustomFollowupText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeReasonConfig = CANCEL_REASONS.find((r) => r.key === selectedReasonKey);

  const handleSelectReason = (key: CancelReasonKey) => {
    setSelectedReasonKey(key);
    setFollowupAnswer('');
    setCustomFollowupText('');
    setError(null);
  };

  const handleFinalCancel = async () => {
    if (!selectedReasonKey) {
      setError('Please select a cancellation reason before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const fullFollowup = customFollowupText.trim()
      ? `${followupAnswer ? followupAnswer + ': ' : ''}${customFollowupText.trim()}`
      : followupAnswer;

    const payload: CancellationSurveyPayload = {
      reason: selectedReasonKey,
      followup_answer: fullFollowup || undefined,
      offer_presented: activeReasonConfig?.offerType,
      offer_accepted: false,
    };

    try {
      const res = await paymentService.cancelSubscription(payload);
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to cancel subscription');
      }
      onCancelled(res.data?.message || 'Subscription successfully cancelled.');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Cancellation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!activeReasonConfig) return;

    setIsSubmitting(true);
    setError(null);

    const fullFollowup = customFollowupText.trim()
      ? `${followupAnswer ? followupAnswer + ': ' : ''}${customFollowupText.trim()}`
      : followupAnswer;

    try {
      const res = await paymentService.applyRetentionOffer({
        offer_type: activeReasonConfig.offerType,
        reason: selectedReasonKey || undefined,
        followup_answer: fullFollowup || undefined,
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to apply offer');
      }

      onOfferApplied(res.data?.message || 'Offer applied successfully!');
      onClose();

      if (activeReasonConfig.offerType === 'discount_50' && activeReasonConfig.couponCode) {
        const profile = useUserStore.getState().profile;
        openLemonSqueezyCheckout(profile, 'monthly', activeReasonConfig.couponCode);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not apply offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
      title=""
      maxWidth="md"
      footer={null}
    >
      <div className="cancel-modal-container">
        {/* Header */}
        <div className="cancel-modal-header">
          <h3 className="cancel-modal-title">Subscription Cancellation</h3>
          <p className="cancel-modal-subtitle">
            We’re sorry to see you go. Help us understand what we could do better.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded-lg">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Primary Mutually Exclusive Reason */}
        <div className="cancel-reasons-group">
          <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            What's the main reason you're cancelling?
          </label>
          {CANCEL_REASONS.map((r) => {
            const isSelected = selectedReasonKey === r.key;
            return (
              <button
                key={r.key}
                type="button"
                className={`cancel-reason-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelectReason(r.key)}
              >
                <div className="cancel-radio-circle">
                  {isSelected && <div className="cancel-radio-dot" />}
                </div>
                <span className="cancel-reason-label">{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step 2: Context-Specific Follow-Up */}
        {activeReasonConfig && activeReasonConfig.followupPrompt && (
          <div className="cancel-followup-box">
            <div className="cancel-followup-title">{activeReasonConfig.followupPrompt}</div>

            {activeReasonConfig.followupOptions && (
              <div className="cancel-followup-options">
                {activeReasonConfig.followupOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`cancel-followup-chip ${followupAnswer === opt ? 'is-active' : ''}`}
                    onClick={() => setFollowupAnswer(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {(activeReasonConfig.followupPlaceholder || followupAnswer === 'Other') && (
              <input
                type="text"
                className="cancel-followup-input"
                placeholder={activeReasonConfig.followupPlaceholder || 'Please specify...'}
                value={customFollowupText}
                onChange={(e) => setCustomFollowupText(e.target.value)}
              />
            )}
          </div>
        )}

        {/* Step 3: Reason-Matched Retention Offer */}
        {activeReasonConfig && (
          <div className="retention-offer-card">
            <div className="retention-badge">
              <Gift size={12} />
              <span>{activeReasonConfig.offerBadge}</span>
            </div>
            <div className="retention-offer-headline">{activeReasonConfig.offerTitle}</div>
            <div className="retention-offer-desc">{activeReasonConfig.offerDesc}</div>
          </div>
        )}

        {/* Action Controls */}
        <div className="cancel-modal-actions">
          {activeReasonConfig && (
            <button
              type="button"
              className="retention-accept-btn"
              onClick={handleAcceptOffer}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>{activeReasonConfig.offerCta}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="cancel-confirm-btn"
            onClick={handleFinalCancel}
            disabled={isSubmitting || !selectedReasonKey}
          >
            {isSubmitting ? 'Processing...' : 'Decline offer and finalize cancellation'}
          </button>

          <button
            type="button"
            className="cancel-back-btn"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Keep subscription & go back
          </button>
        </div>
      </div>
    </Modal>
  );
};
