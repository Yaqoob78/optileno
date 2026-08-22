import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    ArrowRight,
    Check,
    Clock,
    Crown,
    Gift,
    Loader2,
    ShieldCheck,
    Star,
    Zap,
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { paymentService, SubscriptionStatus } from '../../services/api/payment.service';
import { userService } from '../../services/api/user.service';
import { loadCashfreeSdk, openCashfreeCheckout, openCashfreeSubscriptionCheckout } from '../../utils/cashfree';

type PlanId = 'explorer' | 'ultra';
type BillingCycle = 'monthly' | 'annual';

interface PlanCard {
    id: PlanId;
    name: string;
    monthlyLabel: string;
    annualLabel: string;
    description: string;
    trialText?: string;
    features: string[];
    color: string;
    icon: React.ReactNode;
    popular?: boolean;
}

const PLAN_CARDS: PlanCard[] = [
    {
        id: 'explorer',
        name: 'Free Plan',
        monthlyLabel: '$0',
        annualLabel: '$0',
        description: 'Core planning, habits, goals, and daily AI assistance — 100% Free Forever.',
        features: [
            'AI chat - 15 requests/day',
            'Full planner: tasks, habits, goals',
            'Mood tracker and productivity score',
            'Basic analytics dashboard',
            'Big Five test every 14 days',
            'Email support',
        ],
        color: '#3b82f6',
        icon: <Star size={20} />,
    },
    {
        id: 'ultra',
        name: 'Ultra Pro',
        monthlyLabel: '$6.99',
        annualLabel: '$49',
        description: 'Maximum intelligence. Leno agentic automation and deep behavioral analytics.',
        features: [
            'AI chat - 150 requests/day',
            'Agentic planner automation',
            'Advanced analytics and AI insights',
            'Focus heatmap and burnout risk',
            'Detailed goal intelligence',
            'Big Five test every 7 days',
            'Priority support',
        ],
        color: '#a855f7',
        icon: <Crown size={20} />,
        popular: true,
    },
];

export default function BillingSettings() {
    const { profile, isUltra: storeIsUltra, setProfile } = useUserStore();

    const [loading, setLoading] = useState(false);
    const [syncingPlan, setSyncingPlan] = useState(true);
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionStatus | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<PlanId>('explorer');
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    useEffect(() => {
        loadCashfreeSdk()
            .catch(() => {
                // Non-blocking warmup; checkout utility retries load on demand.
            });
    }, []);

    const fetchSubscriptionStatus = useCallback(async () => {
        setSyncingPlan(true);
        try {
            const [profileRes, subRes] = await Promise.all([
                userService.getProfile(),
                paymentService.getSubscriptionStatus(),
            ]);

            if (profileRes.success && profileRes.data) {
                setProfile(profileRes.data as any);
            }
            if (subRes.success && subRes.data) {
                setSubscriptionInfo(subRes.data);
            }
        } catch {
            setError('Could not load your subscription status. Please refresh to try again.');
        } finally {
            setSyncingPlan(false);
        }
    }, [setProfile]);

    useEffect(() => {
        fetchSubscriptionStatus();
    }, [fetchSubscriptionStatus]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const orderId = urlParams.get('order_id');
        const subscriptionId = urlParams.get('subscription_id');

        if (paymentStatus === 'success' && subscriptionId) {
            void verifySubscription(subscriptionId);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (paymentStatus === 'success' && orderId) {
            void verifyOrderPayment(orderId);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const verifyOrderPayment = async (orderId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await paymentService.verifyPayment(orderId);
            if (result.success && result.data?.success) {
                setSuccessMsg(`Subscription activated. You are now on the ${result.data.plan} plan.`);
                await fetchSubscriptionStatus();
                return;
            }
            setError(result.data?.message || 'Payment verification is still pending. Please retry shortly.');
        } catch {
            setError('Could not verify payment right now. If charged, subscription will sync shortly.');
        } finally {
            setLoading(false);
        }
    };

    const verifySubscription = async (subscriptionId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await paymentService.verifySubscription(subscriptionId);
            if (result.success && result.data?.success) {
                setSuccessMsg(`Subscription activated. You are now on the ${result.data.plan} plan.`);
                await fetchSubscriptionStatus();
                return;
            }
            setError(result.data?.message || 'Subscription verification is still pending. Please retry shortly.');
        } catch {
            setError('Could not verify subscription right now. If authorization succeeded, state will sync shortly.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan: PlanId) => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const effectiveCycle: BillingCycle = plan === 'explorer' ? 'monthly' : billingCycle;
            const subscriptionRes = await paymentService.createSubscription(plan, effectiveCycle);
            if (subscriptionRes.success && subscriptionRes.data) {
                if ((subscriptionRes.data as any).is_owner) {
                    setSuccessMsg('Owner account detected. Full access already granted.');
                    return;
                }

                if (subscriptionRes.data.subscription_session_id) {
                    const mode = subscriptionRes.data.environment === 'production' ? 'production' : 'sandbox';
                    await openCashfreeSubscriptionCheckout(subscriptionRes.data.subscription_session_id, mode);
                    return;
                }
            }

            // Backward-compatible fallback (legacy order flow).
            const orderRes = await paymentService.createOrder(plan, effectiveCycle);

            if (!orderRes.success || !orderRes.data) {
                throw new Error(orderRes.error?.message || subscriptionRes.error?.message || 'Failed to initiate payment.');
            }

            if ((orderRes.data as any).is_owner) {
                setSuccessMsg('Owner account detected. Full access already granted.');
                return;
            }

            if (!orderRes.data.payment_session_id) {
                throw new Error('Payment session could not be created.');
            }

            const mode = orderRes.data.environment === 'production' ? 'production' : 'sandbox';
            await openCashfreeCheckout(orderRes.data.payment_session_id, mode);
        } catch (err: any) {
            setError(err?.message || 'Unable to start checkout.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm('Cancel subscription? Access continues until the end of your current billing period.')) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await paymentService.cancelSubscription();
            if (!response.success) {
                throw new Error((response as any).error?.message || 'Failed to cancel subscription.');
            }
            setSuccessMsg('Subscription cancelled. Access continues until period end.');
            await fetchSubscriptionStatus();
        } catch (err: any) {
            setError(err?.message || 'Failed to cancel subscription.');
        } finally {
            setLoading(false);
        }
    };

    const isOwner = subscriptionInfo?.is_owner === true;
    const currentTier = subscriptionInfo?.tier || (storeIsUltra ? 'ultra' : 'explorer');
    const isUltra = currentTier === 'ultra';
    const isTrialing = subscriptionInfo?.is_trial === true;
    const subscriptionStatus = subscriptionInfo?.status || 'explorer';

    const chatDailyLimit = useMemo(() => {
        const configuredLimit = Number(profile?.limits?.chat_daily_limit);
        if (Number.isFinite(configuredLimit) && configuredLimit > 0) {
            return configuredLimit;
        }
        return isUltra ? 150 : 15;
    }, [profile?.limits?.chat_daily_limit, isUltra]);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="billing-settings">
            {successMsg && (
                <div className="billing-success" style={{ marginBottom: '1rem' }}>
                    <Check size={16} /> {successMsg}
                </div>
            )}

            {error && (
                <div className="billing-error" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            <div className={`billing-card ${isUltra ? 'billing-card-premium' : ''}`}>
                <div className="billing-header">
                    <div className="billing-title">
                        <div className="billing-title-row">
                            <h3>{isOwner ? 'Owner Account' : isUltra ? 'Ultra Membership' : 'Explorer Plan'}</h3>
                            {(isUltra || isOwner) && (
                                <span className="billing-title-badge">
                                    <Zap size={10} />
                                </span>
                            )}
                        </div>
                        <p>
                            {isOwner
                                ? 'Full access to all features. Owner privileges active.'
                                : isUltra
                                    ? 'Advanced analytics, automation, and higher AI limits.'
                                    : 'Core planning with practical daily AI limits.'}
                        </p>
                    </div>
                    <div className={`billing-status ${isUltra || isOwner ? 'billing-status-premium' : ''}`}>
                        {isOwner
                            ? 'OWNER'
                            : isTrialing
                                ? 'TRIAL'
                                : subscriptionStatus === 'active'
                                    ? 'ACTIVE'
                                    : subscriptionStatus === 'canceled'
                                        ? 'CANCELED'
                                        : isUltra
                                            ? 'ULTRA'
                                            : 'EXPLORER'}
                    </div>
                </div>

                {syncingPlan && (
                    <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                        <Loader2 size={12} className="animate-spin" /> Syncing subscription status...
                    </p>
                )}

                {isTrialing && subscriptionInfo?.trial_ends_at && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <Gift size={14} /> Trial ends {formatDate(subscriptionInfo.trial_ends_at)}. Billing starts automatically.
                    </div>
                )}

                {!isTrialing && subscriptionInfo?.subscription_ends_at && subscriptionStatus === 'active' && (
                    <div style={{ marginTop: '0.75rem' }}>
                        <Clock size={14} /> Next billing: {formatDate(subscriptionInfo.subscription_ends_at)}
                    </div>
                )}

                <div className="billing-features">
                    {(isUltra
                        ? [
                            { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
                            { icon: <ShieldCheck size={14} />, title: 'Agentic Planner', sub: 'Automation enabled' },
                            { icon: <Zap size={14} />, title: 'Advanced Analytics', sub: 'Heatmap, burnout, AI insights' },
                            { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 7 days' },
                        ]
                        : [
                            { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
                            { icon: <ShieldCheck size={14} />, title: 'Planner Access', sub: 'Tasks, habits, goals' },
                            { icon: <Zap size={14} />, title: 'Analytics', sub: 'Productivity and mood insights' },
                            { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 14 days' },
                        ]).map((feature, idx) => (
                        <div key={idx} className="billing-feature">
                            <div className="billing-feature-icon">{feature.icon}</div>
                            <div className="billing-feature-text">
                                <h4>{feature.title}</h4>
                                <span>{feature.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {!isOwner && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
                    <button
                        className="billing-secondary-btn"
                        onClick={handleCancelSubscription}
                        disabled={loading}
                        style={{ marginTop: '1rem' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <AlertCircle size={14} />}
                        <span>Cancel Subscription</span>
                    </button>
                )}
            </div>

            {!isOwner && !isUltra && (
                <>
                    <div style={{ margin: '1.5rem 0 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Choose Your Plan</h3>
                        <div className="billing-cycle-toggle" role="group" aria-label="Billing cycle">
                            <button
                                className={billingCycle === 'monthly' ? 'is-active' : ''}
                                aria-pressed={billingCycle === 'monthly'}
                                onClick={() => setBillingCycle('monthly')}
                            >
                                Monthly
                            </button>
                            <button
                                className={billingCycle === 'annual' ? 'is-active' : ''}
                                aria-pressed={billingCycle === 'annual'}
                                onClick={() => setBillingCycle('annual')}
                            >
                                Annual
                                <span className="billing-cycle-save">Save 33%</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                        {PLAN_CARDS.map((plan) => {
                            const isSelected = selectedPlan === plan.id;
                            const usesAnnual = plan.id === 'ultra' && billingCycle === 'annual';
                            const priceLabel = usesAnnual ? plan.annualLabel : plan.monthlyLabel;
                            const periodLabel = usesAnnual ? '/year' : '/month';

                            return (
                                <div
                                    key={plan.id}
                                    className={`billing-card ${isSelected ? 'billing-card-selected' : ''}`}
                                    onClick={() => setSelectedPlan(plan.id)}
                                    style={{ cursor: 'pointer', border: isSelected ? `1px solid ${plan.color}` : undefined }}
                                >
                                    {plan.popular && <div>Most Popular</div>}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{ color: plan.color }}>{plan.icon}</div>
                                        <div>
                                            <h4 style={{ margin: 0 }}>{plan.name}</h4>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: plan.color }}>{priceLabel}</span>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{periodLabel}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {plan.trialText && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                            <Gift size={12} />
                                            {plan.trialText}
                                        </div>
                                    )}

                                    <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>{plan.description}</p>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        {plan.features.map((feature, idx) => (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                                                <Check size={12} style={{ color: plan.color }} />
                                                {feature}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className="billing-primary-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (plan.id === 'ultra') {
                                                void handleSubscribe(plan.id);
                                            }
                                        }}
                                        disabled={loading || (plan.id === 'explorer' && !isUltra)}
                                        style={{
                                            marginTop: '1rem',
                                            opacity: plan.id === 'explorer' && !isUltra ? 0.75 : 1,
                                            cursor: plan.id === 'explorer' && !isUltra ? 'default' : 'pointer',
                                        }}
                                    >
                                        {loading ? (
                                            <Loader2 className="animate-spin" size={16} />
                                        ) : (
                                            <>
                                                <span>
                                                    {plan.id === 'explorer'
                                                        ? (isUltra ? 'Downgrade to Free' : 'Active Free Plan')
                                                        : `Upgrade to Ultra Pro (${priceLabel}${periodLabel})`}
                                                </span>
                                                {plan.id === 'ultra' && <ArrowRight size={14} />}
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {!isOwner && !isUltra && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
                <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px' }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        Upgrade to <strong>Ultra</strong> for advanced analytics and higher daily AI limits.
                    </p>
                    <button
                        className="billing-primary-btn"
                        onClick={() => void handleSubscribe('ultra')}
                        disabled={loading}
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <>
                                <Crown size={14} />
                                <span>{billingCycle === 'annual' ? 'Upgrade to Ultra Pro ($49/year)' : 'Upgrade to Ultra Pro ($6.99/month)'}</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            )}

            <div className="billing-note">
                <ShieldCheck size={18} />
                <p>
                    Payments are handled securely via Cashfree. Card details are never stored on our servers.
                </p>
            </div>
        </div>
    );
}
