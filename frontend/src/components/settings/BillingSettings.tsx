import React, { useEffect, useState } from 'react';
import { CreditCard, Zap, Check, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { paymentService } from '../../services/api/payment.service';
import { userService } from '../../services/api/user.service';
import { normalizePlanTierValue } from '../../utils/plan';

export default function BillingSettings() {
    const { profile, isUltra: storeIsUltra, setProfile } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [syncingPlan, setSyncingPlan] = useState(false);
    const [serverPlanTier, setServerPlanTier] = useState<'explorer' | 'ultra' | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const syncPlanFromServer = async () => {
            setSyncingPlan(true);
            try {
                const [profileRes, subscriptionRes] = await Promise.all([
                    userService.getProfile(),
                    userService.getSubscription(),
                ]);

                if (cancelled) return;

                if (profileRes.success && profileRes.data) {
                    setProfile(profileRes.data as any);
                }

                if (subscriptionRes.success && subscriptionRes.data?.currentPlan?.tier) {
                    setServerPlanTier(normalizePlanTierValue(subscriptionRes.data.currentPlan.tier));
                } else if (profileRes.success && profileRes.data) {
                    const fallbackTier = normalizePlanTierValue(
                        (profileRes.data as any).plan_tier ||
                        (profileRes.data as any).subscription?.tier ||
                        (profileRes.data as any).planType
                    );
                    setServerPlanTier(fallbackTier);
                }
            } catch {
                // Ignore: fall back to current store values.
            } finally {
                if (!cancelled) {
                    setSyncingPlan(false);
                }
            }
        };

        syncPlanFromServer();
        return () => {
            cancelled = true;
        };
    }, [setProfile]);

    const effectiveTier = serverPlanTier || (storeIsUltra ? 'ultra' : 'explorer');
    const isUltra = effectiveTier === 'ultra';
    const configuredLimit = Number(profile?.limits?.chat_daily_limit);
    const chatDailyLimit = Number.isFinite(configuredLimit) && configuredLimit > 0
        ? configuredLimit
        : (isUltra ? 150 : 15);
    const planFeatures = isUltra
        ? [
            { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
            { icon: <ShieldCheck size={14} />, title: 'Agentic Planner', sub: 'Automation enabled' },
            { icon: <Zap size={14} />, title: 'Advanced Analytics', sub: 'Heatmap, burnout, AI insights' },
            { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 7 days' },
        ]
        : [
            { icon: <Zap size={14} />, title: 'AI Chat Limit', sub: `${chatDailyLimit} req/day` },
            { icon: <ShieldCheck size={14} />, title: 'Planner Access', sub: 'Manual tasks, habits, goals' },
            { icon: <Zap size={14} />, title: 'Analytics', sub: 'Productivity, mood, basic insights' },
            { icon: <Check size={14} />, title: 'Big Five Interval', sub: 'Every 14 days' },
        ];

    const handleUpgrade = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await paymentService.createCheckoutSession();
            if (response.success && response.data?.url) {
                window.location.href = response.data.url;
            } else {
                setError(response.error?.message || 'Failed to initiate checkout');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleManageBilling = async () => {
        setLoading(true);
        try {
            const response = await paymentService.createPortalSession();
            if (response.success && response.data?.url) {
                window.location.href = response.data.url;
            }
        } catch (err) {
            setError('Failed to open billing portal');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="billing-settings">
            {/* Current Plan Card */}
            <div className={`billing-card ${isUltra ? 'billing-card-premium' : ''}`}>
                <div className="billing-header">
                    <div className="billing-title">
                        <div className="billing-title-row">
                            <h3>{isUltra ? 'Ultra Membership' : 'Explorer Plan'}</h3>
                            {isUltra && (
                                <span className="billing-title-badge">
                                    <Zap size={10} />
                                </span>
                            )}
                        </div>
                        <p>
                            {isUltra
                                ? 'Advanced analytics, agentic planner automation, and higher daily AI limits.'
                                : 'Core planning with practical daily AI limits. Upgrade for advanced analytics.'}
                        </p>
                    </div>
                    <div className={`billing-status ${isUltra ? 'billing-status-premium' : ''}`}>
                        {isUltra ? 'ULTRA' : 'EXPLORER'}
                    </div>
                </div>
                {syncingPlan && (
                    <p style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Syncing latest plan status...</p>
                )}

                <div className="billing-features">
                    {planFeatures.map((feat, i) => (
                        <div key={i} className="billing-feature">
                            <div className="billing-feature-icon">{feat.icon}</div>
                            <div className="billing-feature-text">
                                <h4>{feat.title}</h4>
                                <span>{feat.sub}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {!isUltra ? (
                    <button
                        className="billing-primary-btn"
                        onClick={handleUpgrade}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : (
                            <>
                                <span>Upgrade Now</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                ) : (
                    <button
                        className="billing-secondary-btn"
                        onClick={handleManageBilling}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : (
                            <>
                                <CreditCard size={14} />
                                <span>Manage Billing</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            {error && (
                <div className="billing-error">
                    {error}
                </div>
            )}

            {/* Security/Trust Note */}
            <div className="billing-note">
                <ShieldCheck size={18} />
                <p>
                    Payments are handled securely via Razorpay. We do not store your credit card information.
                    Subscriptions can be cancelled at any time through the billing portal.
                </p>
            </div>
        </div>
    );
}
