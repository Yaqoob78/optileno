import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Sparkles, Check } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import { clearSessionScopedData } from '../../utils/sessionReset';
import { openLemonSqueezyCheckout } from '../../utils/lemonsqueezy';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import SEO from '../../components/common/SEO';
import '../../styles/pages/auth.css';

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include at least 1 letter and 1 number.';

export default function Register() {
    const navigate = useNavigate();
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const login = useUserStore((state) => state.login);

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        plan_type: 'EXPLORER', // Default to Free Forever
        agreedToTerms: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const isPasswordValid = (pwd: string) =>
        pwd.length >= 8 && /[A-Za-z]/.test(pwd) && /\d/.test(pwd);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const emailClean = formData.email.trim().toLowerCase();
        const nameClean = formData.full_name.trim();

        if (!nameClean) {
            setError('Please enter your full name.');
            return;
        }

        if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
            setError('Please enter a valid email address.');
            return;
        }

        if (!isPasswordValid(formData.password)) {
            setError(PASSWORD_POLICY_MESSAGE);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        if (!formData.agreedToTerms) {
            setError('You must agree to the Terms & Conditions and Privacy Policy to create an account.');
            return;
        }

        setLoading(true);

        try {
            // Clean previous session-scoped data to ensure fresh user isolation
            clearSessionScopedData();

            const response = await userService.register({
                email: emailClean,
                password: formData.password,
                full_name: nameClean,
                username: emailClean.split('@')[0],
                plan_type: formData.plan_type,
            });

            if (response.success && response.data) {
                const data = response.data;

                // Existing account path: move user to login
                if (data.account_exists === true && data.authenticated === false) {
                    navigate('/login', {
                        replace: true,
                        state: {
                            message: data.message || 'Account already exists. Please sign in to continue.',
                        },
                    });
                    return;
                }

                if (data.user) {
                    const userObj = data.user;
                    const userPrefs = userObj.preferences || (data as any).preferences;
                    login(userObj as any, userPrefs as any);
                }

                // If user selected Ultra Pro, open Lemon Squeezy checkout directly (unless owner/admin)
                if (formData.plan_type === 'ULTRA') {
                    if (data.requires_payment === false || data.user?.role === 'admin') {
                        navigate('/dashboard', { replace: true });
                        return;
                    }
                    openLemonSqueezyCheckout(data.user || { email: emailClean, name: nameClean });
                    return;
                }

                // Default Free Forever plan -> navigate straight to dashboard
                navigate('/dashboard', { replace: true });
            } else {
                setError(response.error?.message || 'Registration failed. Please check your information and try again.');
            }
        } catch (err: any) {
            setError(err?.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page dark">
            <SEO
                title="Create Free Account | Optileno AI Daily Planner"
                description="Sign up for Optileno for 100% free. Organize tasks, time-block your calendar, build habits, and boost daily productivity with Leno AI."
                robots="index,follow"
                canonicalUrl="https://www.optileno.com/register"
            />
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
                        <p className="auth-subtitle">Join the future of personal productivity — 100% Free</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <GoogleSignInButton
                        mode="signup"
                        planType={formData.plan_type}
                        onError={(msg) => setError(msg)}
                    />

                    <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
                        {/* Plan Selection */}
                        <div className="pricing-options">
                            <div
                                className={`pricing-card ${formData.plan_type === 'EXPLORER' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, plan_type: 'EXPLORER' })}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="plan-badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>FREE FOREVER</div>
                                <div className="pricing-header">
                                    <span className="plan-name">Free Plan</span>
                                    <div className="plan-price-group">
                                        <span className="plan-price">$0</span>
                                    </div>
                                </div>
                                <div className="plan-offer-note">No credit card required</div>
                                <div className="plan-features">
                                    <div className="plan-feature">AI Chat (15 req/day)</div>
                                    <div className="plan-feature">Manual Planner: tasks, habits, deep work, goals</div>
                                    <div className="plan-feature">Mood tracker + productivity score</div>
                                    <div className="plan-feature">Big Five test every 14 days</div>
                                </div>
                            </div>

                            <div
                                className={`pricing-card ${formData.plan_type === 'ULTRA' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, plan_type: 'ULTRA' })}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="plan-badge">MOST POWERFUL</div>
                                <div className="pricing-header">
                                    <span className="plan-name">Ultra Pro</span>
                                    <div className="plan-price-group">
                                        <span className="plan-price">₹1,499<span style={{ fontSize: '0.7em', opacity: 0.7 }}>/mo</span></span>
                                    </div>
                                </div>
                                <div className="plan-offer-note" style={{ color: '#c084fc', fontWeight: 600 }}>Annual: ₹12,999/yr (~$155) • Save 28%</div>
                                <div className="plan-features" style={{ gap: '6px' }}>
                                    <div className="plan-feature">AI Chat (150 req/day)</div>
                                    <div className="plan-feature">Autonomous Agentic planner automation</div>
                                    <div className="plan-feature">Focus heatmap + burnout risk + AI insights</div>
                                    <div className="plan-feature">Detailed goal progress + AI intelligence</div>
                                    <div className="plan-feature">Big Five calibration every 7 days</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="register-name">Full Name</label>
                            <div className={`input-wrapper ${formData.full_name ? 'has-value' : ''}`}>
                                <input
                                    id="register-name"
                                    type="text"
                                    name="full_name"
                                    className="auth-input"
                                    placeholder="Your Name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    autoComplete="name"
                                    required
                                />
                                <User className="input-icon" size={18} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="register-email">Email Address</label>
                            <div className={`input-wrapper ${formData.email ? 'has-value' : ''}`}>
                                <input
                                    id="register-email"
                                    type="email"
                                    name="email"
                                    className="auth-input"
                                    placeholder="name@example.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    inputMode="email"
                                    required
                                />
                                <Mail className="input-icon" size={18} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="register-password">Password</label>
                            <div className={`input-wrapper ${formData.password ? 'has-value' : ''}`}>
                                <input
                                    id="register-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    className="auth-input has-toggle"
                                    placeholder="Min. 8 characters (letters + numbers)"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    autoComplete="new-password"
                                    required
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
                            {formData.password && !isPasswordValid(formData.password) && (
                                <p style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#f87171' }}>
                                    {PASSWORD_POLICY_MESSAGE}
                                </p>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="register-confirm-password">Confirm Password</label>
                            <div className={`input-wrapper ${formData.confirmPassword ? 'has-value' : ''}`}>
                                <input
                                    id="register-confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    className="auth-input has-toggle"
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    autoComplete="new-password"
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
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <p style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#f87171' }}>
                                    Passwords do not match.
                                </p>
                            )}
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
                                100% Free Forever. No credit card required. Upgrade to Ultra Pro anytime.
                            </div>
                        )}

                        <div className="form-group" style={{ marginTop: '0.5rem' }}>
                            <label className="remember-me" style={{ alignItems: 'flex-start', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.agreedToTerms}
                                    onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })}
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
                                    {formData.plan_type === 'ULTRA' ? <Sparkles size={18} /> : <ArrowRight size={18} />}
                                    <span>{formData.plan_type === 'ULTRA' ? 'Create Account & Continue to Pro' : 'Create Free Forever Account'}</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        {formData.plan_type === 'ULTRA' && (
                            <p style={{
                                textAlign: 'center',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                                margin: '-0.5rem 0 0',
                                lineHeight: '1.4',
                            }}>
                                Secure checkout via Lemon Squeezy. You will be redirected after account creation.
                            </p>
                        )}
                    </form>

                    <p className="auth-footer">
                        Already have an account?
                        <Link to="/login" className="auth-link">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
