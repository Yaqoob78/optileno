import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import { openLemonSqueezyCheckout } from '../../utils/lemonsqueezy';
import SEO from '../../components/common/SEO';
import '../../styles/pages/auth.css';

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include at least 1 letter and 1 number.';

type RegisterValidationFields = {
    password: string;
    confirmPassword: string;
};

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
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        register: registerField,
        handleSubmit: handleFormSubmit,
        trigger,
        formState: { errors: validationErrors },
    } = useForm<RegisterValidationFields>({
        mode: 'onChange',
    });

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async () => {
        const valid = await trigger(['password', 'confirmPassword']);
        if (!valid) {
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
                    login(data.user as any, (data.user as any).preferences as any);
                }

                // If user selected Ultra Pro, open Lemon Squeezy checkout directly (unless owner/admin)
                if (formData.plan_type === 'ULTRA') {
                    if (data.requires_payment === false || data.user?.role === 'admin') {
                        navigate('/dashboard', { replace: true });
                        return;
                    }
                    openLemonSqueezyCheckout(data.user || { email: formData.email, name: formData.full_name });
                    return;
                }

                // Default Free Forever plan -> navigate straight to dashboard
                navigate('/dashboard', { replace: true });
            } else {
                setError(response.error?.message || 'Registration failed. Please try again.');
            }
        } catch (err: any) {
            setError(err?.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const passwordField = registerField('password', {
        validate: (value) =>
            (value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value))
            || PASSWORD_POLICY_MESSAGE,
    });

    const confirmPasswordField = registerField('confirmPassword', {
        validate: (value) =>
            value === formData.password || 'Passwords do not match.',
    });

    return (
        <div className="auth-page dark">
            <SEO title="Create Account | Optileno" description="Join Optileno for free to convert unstructured ambitions into actionable execution plans." robots="noindex,nofollow" />
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

                    <form className="auth-form" onSubmit={handleFormSubmit(handleSubmit)}>
                            {/* Plan Selection */}
                            <div className="pricing-options">
                                <div
                                    className={`pricing-card ${formData.plan_type === 'EXPLORER' ? 'selected' : ''}`}
                                    onClick={() => setFormData({ ...formData, plan_type: 'EXPLORER' })}
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
                                        {...passwordField}
                                        value={formData.password}
                                        onChange={async (e) => {
                                            setFormData({ ...formData, password: e.target.value });
                                            passwordField.onChange(e);
                                            if (formData.confirmPassword) {
                                                await trigger('confirmPassword');
                                            }
                                        }}
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
                                {validationErrors.password?.message && (
                                    <p style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#f87171' }}>
                                        {validationErrors.password.message}
                                    </p>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <div className={`input-wrapper ${formData.confirmPassword ? 'has-value' : ''}`}>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="auth-input has-toggle"
                                        placeholder="Confirm your password"
                                        {...confirmPasswordField}
                                        value={formData.confirmPassword}
                                        onChange={(e) => {
                                            setFormData({ ...formData, confirmPassword: e.target.value });
                                            confirmPasswordField.onChange(e);
                                        }}
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
                                {validationErrors.confirmPassword?.message && (
                                    <p style={{ marginTop: '0.45rem', fontSize: '0.78rem', color: '#f87171' }}>
                                        {validationErrors.confirmPassword.message}
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
