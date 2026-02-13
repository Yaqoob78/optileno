import React, { useState } from 'react';
import { CreditCard, Zap, Check, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { paymentService } from '../../services/api/payment.service';

export default function BillingSettings() {
    const { profile } = useUserStore();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Owner email always gets Ultra
    const isUltra = profile.planType === 'ULTRA' || profile.email === 'khan011504@gmail.com' || profile.role === 'admin' || profile.subscription?.tier === 'elite';

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
                                ? 'Complete access to advanced behavior analysis and unlimited intelligence.'
                                : 'Start with basic assistance. Upgrade for full features.'}
                        </p>
                    </div>
                    <div className={`billing-status ${isUltra ? 'billing-status-premium' : ''}`}>
                        {isUltra ? 'PREMIUM' : 'FREE'}
                    </div>
                </div>

                <div className="billing-features">
                        {[
                            { icon: <Zap size={14} />, title: "Unlimited Usage", sub: "No limits" },
                            { icon: <ShieldCheck size={14} />, title: "Private Compute", sub: "Isolated" },
                            { icon: <Zap size={14} />, title: "Expert Analysis", sub: "Patterns" },
                            { icon: <Check size={14} />, title: "Priority Labs", sub: "Early access" }
                        ].map((feat, i) => (
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
                    Payments are handled securely via Stripe. We do not store your credit card information.
                    Subscriptions can be cancelled at any time through the billing portal.
                </p>
            </div>
        </div>
    );
}
