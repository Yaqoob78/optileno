import React, { useEffect, useState, useCallback } from 'react';
import {
    CreditCard, Zap, Check, ArrowRight, Loader2,
    ShieldCheck, AlertCircle, Clock, Star, Crown, Gift
} from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { paymentService, SubscriptionStatus } from '../../services/api/payment.service';
import { userService } from '../../services/api/user.service';
import { normalizePlanTierValue } from '../../utils/plan';

// Add Cashfree type definition
declare global {
    interface Window {
        Cashfree: any;
    }
}

export default function BillingSettings() {
    const { profile, isUltra: storeIsUltra, setProfile } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [syncingPlan, setSyncingPlan] = useState(true);
    const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [cashfree, setCashfree] = useState<any>(null);
    const [selectedPlan, setSelectedPlan] = useState<'explorer' | 'ultra'>('explorer');
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    // Initialize Cashfree SDK
    useEffect(() => {
        const isProduction = import.meta.env.PROD;
        const mode = isProduction ? "production" : "sandbox";

        if (window.Cashfree) {
            setCashfree(new window.Cashfree({ mode }));
        } else {
            const interval = setInterval(() => {
                if (window.Cashfree) {
                    setCashfree(new window.Cashfree({ mode }));
                    clearInterval(interval);
                }
            }, 500);
            return () => clearInterval(interval);
        }
    }, []);

    // Check for payment return (verify if user just came back from checkout)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentStatus = urlParams.get('payment');
        const orderId = urlParams.get('order_id');

        if (paymentStatus === 'success' && orderId) {
            verifyPayment(orderId);
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const verifyPayment = async (orderId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await paymentService.verifyPayment(orderId);
            if (result.success && result.data?.success) {
                setSuccessMsg(`🎉 Subscription activated! You're now on the ${result.data.plan} plan.`);
                // Refresh subscription status
                await fetchSubscriptionStatus();
            } else {
                setError(result.data?.message || 'Payment verification pending. Please refresh in a moment.');
            }
        } catch {
            setError('Could not verify payment. If you were charged, your subscription will activate shortly.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch subscription status
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
            // Silently fail — use store values as fallback
        } finally {
            setSyncingPlan(false);
        }
    }, [setProfile]);

    useEffect(() => {
        fetchSubscriptionStatus();
    }, [fetchSubscriptionStatus]);

    // Derived state
    const isOwner = subscriptionInfo?.is_owner === true;
    const currentTier = subscriptionInfo?.tier || (storeIsUltra ? 'ultra' : 'explorer');
    const isUltra = currentTier === 'ultra';
    const isTrialing = subscriptionInfo?.is_trial === true;
    const subscriptionStatus = subscriptionInfo?.status || 'explorer';

    const configuredLimit = Number(profile?.limits?.chat_daily_limit);
    const chatDailyLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
        ? configuredLimit
        : (isUltra ? 150 : 15);

    // Format date
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    };

    const handleSubscribe = async (plan: 'explorer' | 'ultra') => {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        if (!cashfree) {
            setError("Payment system initializing... please try again in a moment.");
            setLoading(false);
            return;
        }

        try {
            const response = await paymentService.createOrder(plan, billingCycle);

            if (response.success && response.data) {
                // Owner accounts — no payment needed
                if ((response.data as any).is_owner) {
                    setSuccessMsg("Owner account — full access already granted!");
                    setLoading(false);
                    return;
                }

                if (response.data.payment_session_id) {
                    // Open Cashfree checkout
                    const checkoutOptions = {
                        paymentSessionId: response.data.payment_session_id,
                        redirectTarget: "_self",
                    };
                    cashfree.checkout(checkoutOptions);
                } else {
                    setError("Failed to create payment session.");
                }
            } else {
                setError((response as any).error?.message || 'Failed to initiate payment');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm(
            "Are you sure you want to cancel?\n\nYour access will continue until the end of your current billing period."
        )) return;

        setLoading(true);
        setError(null);
        try {
            const response = await paymentService.cancelSubscription();
            if (response.success) {
                setSuccessMsg("Subscription cancelled. Access continues until the end of your billing period.");
                await fetchSubscriptionStatus();
            } else {
                setError((response as any).error?.message || "Failed to cancel subscription");
            }
        } catch {
            setError("Failed to cancel subscription");
        } finally {
            setLoading(false);
        }
    };

    // Plan cards data
    const plans = [
        {
            id: 'explorer' as const,
            name: 'Explorer',
            price: '$2',
            priceAnnual: '$20',
            period: '/month',
            trialText: '3-day free trial',
            description: 'Everything you need to get started with AI-powered planning.',
            features: [
                'AI chat — 15 requests/day',
                'Full planner: tasks, habits, goals',
                'Mood tracker & productivity score',
                'Basic analytics dashboard',
                'Big Five personality test (every 14 days)',
                'Email support',
            ],
            icon: <Star size={20} />,
            color: '#3b82f6',
        },
        {
            id: 'ultra' as const,
            name: 'Ultra',
            price: '$10',
            priceAnnual: '$80',
            period: '/month',
            trialText: null,
            description: 'Maximum intelligence. Advanced analytics & automation.',
            features: [
                'AI chat — 150 requests/day',
                'Agentic planner automation',
                'Advanced analytics & AI insights',
                'Focus heatmap & burnout risk',
                'Detailed goal intelligence',
                'Big Five test (every 7 days)',
                'Priority support',
            ],
            icon: <Crown size={20} />,
            color: '#a855f7',
            popular: true,
        },
    ];

    return (
        <div className="billing-settings">
            {/* Success Message */}
            {successMsg && (
                <div className="billing-success" style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    color: '#22c55e',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}>
                    <Check size={16} />
                    {successMsg}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="billing-error" style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.5rem',
                    color: '#ef4444',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}>
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            {/* Current Subscription Status */}
            <div className={`billing-card ${isUltra ? 'billing-card-premium' : ''}`}>
                <div className="billing-header">
                    <div className="billing-title">
                        <div className="billing-title-row">
                            <h3>
                                {isOwner ? 'Owner Account' :
                                    isUltra ? 'Ultra Membership' : 'Explorer Plan'}
                            </h3>
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
                                    ? 'Advanced analytics, agentic automation, and higher AI limits.'
                                    : 'Core planning with practical daily AI limits.'}
                        </p>
                    </div>
                    <div className={`billing-status ${isUltra || isOwner ? 'billing-status-premium' : ''}`}>
                        {isOwner ? 'OWNER' : isTrialing ? 'TRIAL' :
                            subscriptionStatus === 'active' ? 'ACTIVE' :
                                subscriptionStatus === 'canceled' ? 'CANCELED' :
                                    isUltra ? 'ULTRA' : 'EXPLORER'}
                    </div>
                </div>

                {syncingPlan && (
                    <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Loader2 size={12} className="animate-spin" /> Syncing subscription status...
                    </p>
                )}

                {/* Trial / Expiry Info */}
                {isTrialing && subscriptionInfo?.trial_ends_at && (
                    <div style={{
                        marginTop: '0.75rem',
                        padding: '0.625rem 1rem',
                        background: 'rgba(251, 191, 36, 0.1)',
                        border: '1px solid rgba(251, 191, 36, 0.25)',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        color: '#fbbf24',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                        <Gift size={14} />
                        Free trial ends {formatDate(subscriptionInfo.trial_ends_at)}. Your subscription will begin automatically.
                    </div>
                )}

                {subscriptionInfo?.subscription_ends_at && !isTrialing && subscriptionStatus === 'active' && (
                    <div style={{
                        marginTop: '0.75rem',
                        padding: '0.625rem 1rem',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '10px',
                        fontSize: '0.8rem',
                        color: 'rgba(147, 197, 253, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                    }}>
                        <Clock size={14} />
                        Next billing: {formatDate(subscriptionInfo.subscription_ends_at)}
                    </div>
                )}

                {/* Current Plan Features */}
                <div className="billing-features">
                    {(isUltra ? [
                        { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
                        { icon: <ShieldCheck size={14} />, title: 'Agentic Planner', sub: 'Automation enabled' },
                        { icon: <Zap size={14} />, title: 'Advanced Analytics', sub: 'Heatmap, burnout, AI insights' },
                        { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 7 days' },
                    ] : [
                        { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
                        { icon: <ShieldCheck size={14} />, title: 'Planner Access', sub: 'Manual tasks, habits, goals' },
                        { icon: <Zap size={14} />, title: 'Analytics', sub: 'Productivity, mood, basic insights' },
                        { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 14 days' },
                    ]).map((feat, i) => (
                        <div key={i} className="billing-feature">
                            <div className="billing-feature-icon">{feat.icon}</div>
                            <div className="billing-feature-text">
                                <h4>{feat.title}</h4>
                                <span>{feat.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Cancel button for active subscriptions */}
                {!isOwner && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
                    <button
                        className="billing-secondary-btn"
                        onClick={handleCancelSubscription}
                        disabled={loading}
                        style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', marginTop: '1rem' }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : (
                            <>
                                <AlertCircle size={14} />
                                <span>Cancel Subscription</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Available Plans (show only if not already subscribed to Ultra, and not owner) */}
            {!isOwner && !isUltra && (
                <>
                    <div style={{
                        margin: '2rem 0 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                            Choose Your Plan
                        </h3>

                        {/* Billing Toggle */}
                        <div style={{
                            display: 'flex',
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: '8px',
                            padding: '2px',
                            marginLeft: 'auto',
                        }}>
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                style={{
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    background: billingCycle === 'monthly' ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    color: billingCycle === 'monthly' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('annual')}
                                style={{
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    background: billingCycle === 'annual' ? 'rgba(255,255,255,0.12)' : 'transparent',
                                    color: billingCycle === 'annual' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Annual
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`billing-card ${selectedPlan === plan.id ? 'billing-card-selected' : ''}`}
                                onClick={() => setSelectedPlan(plan.id)}
                                style={{
                                    cursor: 'pointer',
                                    border: selectedPlan === plan.id
                                        ? `1px solid ${plan.color}44`
                                        : '1px solid rgba(255,255,255,0.06)',
                                    position: 'relative',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                {plan.popular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-10px',
                                        right: '16px',
                                        background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`,
                                        color: '#fff',
                                        fontSize: '0.625rem',
                                        fontWeight: 700,
                                        padding: '3px 10px',
                                        borderRadius: '20px',
                                        letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                    }}>
                                        Most Popular
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div style={{
                                        width: 36, height: 36,
                                        borderRadius: 10,
                                        background: `${plan.color}18`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: plan.color,
                                    }}>
                                        {plan.icon}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.95)', margin: 0 }}>
                                            {plan.name}
                                        </h4>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: plan.color }}>
                                                {billingCycle === 'annual' ? plan.priceAnnual : plan.price}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                                                /{billingCycle === 'annual' ? 'year' : 'month'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {plan.trialText && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.375rem',
                                        padding: '4px 10px',
                                        background: 'rgba(34, 197, 94, 0.1)',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                        borderRadius: '20px',
                                        fontSize: '0.6875rem',
                                        color: '#22c55e',
                                        fontWeight: 500,
                                        marginBottom: '0.75rem',
                                    }}>
                                        <Gift size={11} />
                                        {plan.trialText}
                                    </div>
                                )}

                                <p style={{
                                    fontSize: '0.8rem',
                                    color: 'rgba(255,255,255,0.5)',
                                    margin: '0.25rem 0 0.75rem',
                                    lineHeight: 1.4,
                                }}>
                                    {plan.description}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    {plan.features.map((feat, i) => (
                                        <div key={i} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            fontSize: '0.775rem',
                                            color: 'rgba(255,255,255,0.65)',
                                        }}>
                                            <Check size={12} style={{ color: plan.color, flexShrink: 0 }} />
                                            {feat}
                                        </div>
                                    ))}
                                </div>

                                <button
                                    className="billing-primary-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSubscribe(plan.id);
                                    }}
                                    disabled={loading}
                                    style={{
                                        marginTop: '1.25rem',
                                        background: selectedPlan === plan.id
                                            ? `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`
                                            : 'rgba(255,255,255,0.06)',
                                        borderColor: selectedPlan === plan.id ? plan.color : 'rgba(255,255,255,0.1)',
                                    }}
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                        <>
                                            <span>
                                                {plan.id === 'explorer' ? 'Start Free Trial' : 'Subscribe Now'}
                                            </span>
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Upgrade to Ultra (for Explorer users) */}
            {!isOwner && !isUltra && subscriptionStatus === 'active' && (
                <div style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    background: 'rgba(168, 85, 247, 0.08)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '12px',
                    textAlign: 'center',
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
                        Want more? Upgrade to <strong style={{ color: '#a855f7' }}>Ultra</strong> for advanced analytics and 150 AI requests/day.
                    </p>
                    <button
                        className="billing-primary-btn"
                        onClick={() => handleSubscribe('ultra')}
                        disabled={loading}
                        style={{
                            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                            borderColor: '#a855f7',
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : (
                            <>
                                <Crown size={14} />
                                <span>Upgrade to Ultra ($10/mo)</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Security/Trust Note */}
            <div className="billing-note">
                <ShieldCheck size={18} />
                <p>
                    Payments are handled securely via Cashfree, India's leading payment gateway.
                    We never store your card details. Cancel anytime from this page.
                </p>
            </div>
        </div>
    );
}
