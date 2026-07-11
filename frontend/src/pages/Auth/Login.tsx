import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import SEO from '../../components/common/SEO';
import '../../styles/pages/auth.css';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const loginStore = useUserStore((state) => state.login);
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const routeMessage = typeof (location.state as any)?.message === 'string'
        ? (location.state as any).message
        : '';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember_me: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processingPaymentReturn, setProcessingPaymentReturn] = useState(false);

    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    React.useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paymentStatus = params.get('payment');
        const orderId = params.get('order_id');
        const subscriptionId = params.get('subscription_id');

        if (paymentStatus !== 'success' || (!orderId && !subscriptionId)) {
            return;
        }

        let cancelled = false;
        const restoreSession = async () => {
            setProcessingPaymentReturn(true);
            setError(null);
            try {
                const { paymentService } = await import('../../services/api/payment.service');
                const response = await paymentService.completePaymentReturn({
                    order_id: orderId || undefined,
                    subscription_id: subscriptionId || undefined,
                });

                if (cancelled) {
                    return;
                }

                if (response.success && response.data?.authenticated && response.data?.user) {
                    loginStore(response.data.user as any, (response.data.user as any).preferences as any);
                    navigate('/dashboard', { replace: true });
                    return;
                }

                setError(
                    response.error?.message ||
                    response.data?.message ||
                    'Payment completed, but we could not restore your session. Please sign in.'
                );
            } catch {
                if (!cancelled) {
                    setError('Payment completed, but we could not restore your session. Please sign in.');
                }
            } finally {
                if (!cancelled) {
                    setProcessingPaymentReturn(false);
                }
            }
        };

        restoreSession();
        return () => {
            cancelled = true;
        };
    }, [location.search, loginStore, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await userService.login(formData);

            if (response.success && response.data) {
                // Fetch full profile after login
                const profileRes = await userService.getProfile();
                if (profileRes.success && profileRes.data) {
                    loginStore(profileRes.data as any, profileRes.data.preferences as any);
                    navigate('/dashboard', { replace: true });
                } else {
                    setError('Failed to load user profile');
                }
            } else {
                setError(response.error?.message || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page dark">
            <SEO title="Login | Optileno" description="Sign in to your Optileno account to access your AI productivity system." robots="noindex,nofollow" />
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
                        <h1 className="auth-title">Welcome Back</h1>
                        <p className="auth-subtitle">Continue your journey with Leno AI</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {routeMessage && (
                        <div className="success-message">{routeMessage}</div>
                    )}

                    {processingPaymentReturn && (
                        <div className="success-message">Finalizing your payment and signing you in...</div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
                        <div className="form-group">
                            <label className="form-label" htmlFor="login-email">Email Address</label>
                            <div className={`input-wrapper ${formData.email ? 'has-value' : ''}`}>
                                <input
                                    id="login-email"
                                    type="email"
                                    name="email"
                                    className="auth-input"
                                    placeholder="Enter your email"
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
                            <label className="form-label" htmlFor="login-password">Password</label>
                            <div className={`input-wrapper ${formData.password ? 'has-value' : ''}`}>
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    className="auth-input has-toggle"
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    autoComplete="current-password"
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
                        </div>

                        <div className="form-options">
                            <label className="remember-me">
                                <input
                                    type="checkbox"
                                    name="remember_me"
                                    checked={formData.remember_me}
                                    onChange={(e) =>
                                        setFormData({ ...formData, remember_me: e.target.checked })
                                    }
                                />
                                <span>Remember me</span>
                            </label>
                            <Link to="/forgot-password" className="forgot-password">
                                Forgot Password?
                            </Link>
                        </div>

                        <div className="form-options" style={{ marginTop: '1rem' }}>
                            <label className="remember-me" style={{ alignItems: 'flex-start' }}>
                                <input
                                    type="checkbox"
                                    required
                                    style={{ marginTop: '4px' }}
                                />
                                <span style={{ fontSize: '0.85rem', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                                    I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Privacy Policy</a>
                                </span>
                            </label>
                        </div>

                        <button type="submit" className="auth-button" disabled={loading} style={{ marginTop: '1.5rem' }}>
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <LogIn size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="auth-footer">
                        Don't have an account?
                        <Link to="/register" className="auth-link">Create an account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
