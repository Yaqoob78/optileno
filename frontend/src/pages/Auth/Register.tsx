import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, CreditCard } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import '../../styles/pages/auth.css';

declare global {
    interface Window {
        Cashfree: any;
    }
}

export default function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        plan_type: 'EXPLORER', // Default to Explorer
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cashfree, setCashfree] = useState<any>(null);
    const [paymentStep, setPaymentStep] = useState(false); // true = waiting for checkout

    // Load Cashfree SDK
    useEffect(() => {
        const loadCashfreeSDK = () => {
            if (window.Cashfree) {
                const isProduction = import.meta.env.PROD;
                setCashfree(new window.Cashfree({ mode: isProduction ? "production" : "sandbox" }));
                return;
            }

            // Load SDK script if not already available
            const existingScript = document.querySelector('script[src*="cashfree"]');
            if (!existingScript) {
                const script = document.createElement('script');
                script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                script.async = true;
                script.onload = () => {
                    if (window.Cashfree) {
                        const isProduction = import.meta.env.PROD;
                        setCashfree(new window.Cashfree({ mode: isProduction ? "production" : "sandbox" }));
                    }
                };
                document.head.appendChild(script);
            } else {
                // Script exists but Cashfree not ready - wait for it
                const check = setInterval(() => {
                    if (window.Cashfree) {
                        const isProduction = import.meta.env.PROD;
                        setCashfree(new window.Cashfree({ mode: isProduction ? "production" : "sandbox" }));
                        clearInterval(check);
                    }
                }, 200);
                setTimeout(() => clearInterval(check), 10000);
            }
        };

        loadCashfreeSDK();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await userService.register({
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name,
                username: formData.email.split('@')[0],
                plan_type: formData.plan_type
            });

            if (response.success && response.data) {
                const data = response.data;

                // Owner account - no payment needed, go directly to dashboard
                if (data.requires_payment === false) {
                    navigate('/dashboard');
                    return;
                }

                // Payment required - open Cashfree checkout
                if (data.payment && data.payment.payment_session_id) {
                    setPaymentStep(true);

                    if (cashfree) {
                        const checkoutOptions = {
                            paymentSessionId: data.payment.payment_session_id,
                            redirectTarget: "_self",
                        };
                        cashfree.checkout(checkoutOptions);
                    } else {
                        // SDK not loaded yet, fallback
                        setError('Payment system is loading. Please try again in a moment.');
                        setPaymentStep(false);
                    }
                } else {
                    // Payment order creation failed, redirect to dashboard to try from billing
                    setError('Account created but payment setup failed. You can complete payment from Settings > Billing.');
                    setTimeout(() => navigate('/dashboard'), 3000);
                }
            } else {
                setError(response.error?.message || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setError(err?.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page dark">
            <div className="auth-background">
                <div className="auth-sphere sphere-1" />
                <div className="auth-sphere sphere-2" />
            </div>

            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <Link to="/" className="auth-logo">
                            <img src="/logo-light.svg" alt="Optileno" className="auth-logo-img" />
                        </Link>
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle">Join the future of personal productivity</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {paymentStep ? (
                        <div className="payment-loading-state">
                            <CreditCard size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                            <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                                Redirecting to Payment...
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', lineHeight: '1.6' }}>
                                Your account has been created. You'll be redirected to complete payment securely via Cashfree.
                            </p>
                            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)', marginTop: '1rem' }} />
                        </div>
                    ) : (
                        <form className="auth-form" onSubmit={handleSubmit}>
                            {/* Plan Selection */}
                            <div className="pricing-launch-offer">
                                Join today and lock launch pricing. Limited deal for the first 100 users.
                            </div>
                            <div className="pricing-options">
                                <div
                                    className={`pricing-card ${formData.plan_type === 'EXPLORER' ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, plan_type: 'EXPLORER' })}
                                >
                                    <div className="pricing-header">
                                        <span className="plan-name">Explorer</span>
                                        <div className="plan-price-group">
                                            <span className="plan-price-original">$5</span>
                                            <span className="plan-price">$2<span style={{ fontSize: '0.7em', opacity: 0.7 }}>/mo</span></span>
                                        </div>
                                    </div>
                                    <div className="plan-offer-note">Limited deal: first 100 users</div>
                                    <div className="plan-features">
                                        <div className="plan-feature">AI Chat (15 req/day)</div>
                                        <div className="plan-feature">Manual Planner: tasks, habits, deep work, goals</div>
                                        <div className="plan-feature">Mood tracker + productivity score</div>
                                        <div className="plan-feature">Big Five every 14 days</div>
                                    </div>
                                </div>

                                <div
                                    className={`pricing-card ${formData.plan_type === 'ULTRA' ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, plan_type: 'ULTRA' })}
                                >
                                    <div className="plan-badge">LIMITED DEAL</div>
                                    <div className="pricing-header">
                                        <span className="plan-name">Ultra</span>
                                        <div className="plan-price-group">
                                            <span className="plan-price-original">$20</span>
                                            <span className="plan-price">$10<span style={{ fontSize: '0.7em', opacity: 0.7 }}>/mo</span></span>
                                        </div>
                                    </div>
                                    <div className="plan-offer-note">Limited deal: first 100 users</div>
                                    <div className="plan-features" style={{ gap: '6px' }}>
                                        <div className="plan-feature">AI Chat (150 req/day)</div>
                                        <div className="plan-feature">Agentic planner automation</div>
                                        <div className="plan-feature">Focus heatmap + burnout risk + AI insights</div>
                                        <div className="plan-feature">Detailed goal progress + AI intelligence</div>
                                        <div className="plan-feature">Big Five every 7 days</div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <div className={`input-wrapper ${formData.full_name ? 'has-value' : ''}`}>
                                    <input
                                        type="text"
                                        className="auth-input"
                                        placeholder="Your Name"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        required
                                    />
                                    <User className="input-icon" size={18} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <div className={`input-wrapper ${formData.email ? 'has-value' : ''}`}>
                                    <input
                                        type="email"
                                        className="auth-input"
                                        placeholder="name@example.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                    <Mail className="input-icon" size={18} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <div className={`input-wrapper ${formData.password ? 'has-value' : ''}`}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="auth-input has-toggle"
                                        placeholder="Min. 8 characters"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        minLength={8}
                                    />
                                    <Lock className="input-icon" size={18} />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <div className={`input-wrapper ${formData.confirmPassword ? 'has-value' : ''}`}>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="auth-input has-toggle"
                                        placeholder="Confirm your password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        required
                                    />
                                    <Lock className="input-icon" size={18} />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {formData.plan_type === 'EXPLORER' && (
                                <div style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '8px',
                                    background: 'rgba(34, 197, 94, 0.08)',
                                    border: '1px solid rgba(34, 197, 94, 0.25)',
                                    fontSize: '0.75rem',
                                    color: 'rgba(134, 239, 172, 0.9)',
                                    textAlign: 'center',
                                    lineHeight: '1.4'
                                }}>
                                    🎉 Includes 3-day free trial. Billing starts automatically after trial ends unless cancelled.
                                </div>
                            )}

                            <div className="form-group" style={{ marginTop: '0.5rem' }}>
                                <label className="remember-me" style={{ alignItems: 'flex-start' }}>
                                    <input
                                        type="checkbox"
                                        required
                                        style={{ marginTop: '4px' }}
                                    />
                                    <span style={{ fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                                        I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Terms & Conditions</a>,{' '}
                                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Privacy Policy</a>,{' '}
                                        <a href="/refund" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Refund Policy</a>, and{' '}
                                        <a href="/cookies" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Cookies Policy</a>
                                    </span>
                                </label>
                            </div>

                            <button type="submit" className="auth-button" disabled={loading}>
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        <CreditCard size={18} />
                                        <span>Create Account & Pay</span>
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </button>

                            <p style={{
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                margin: '-0.5rem 0 0',
                                lineHeight: '1.4',
                            }}>
                                🔒 Secure payment via Cashfree. You'll be redirected to complete payment after account creation.
                            </p>
                        </form>
                    )}

                    <p className="auth-footer">
                        Already have an account?
                        <Link to="/login" className="auth-link">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
