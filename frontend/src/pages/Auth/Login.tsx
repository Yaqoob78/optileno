import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import { clearSessionScopedData } from '../../utils/sessionReset';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
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

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const emailClean = formData.email.trim();
        if (!emailClean) {
            setError('Please enter your email address.');
            setLoading(false);
            return;
        }

        try {
            // Clean previous session-scoped data to ensure fresh user isolation
            clearSessionScopedData();

            const response = await userService.login({
                email: emailClean,
                password: formData.password,
                remember_me: formData.remember_me,
            });

            if (response.success && response.data) {
                const userObj = response.data.user || response.data;
                const userPrefs = userObj.preferences || response.data.preferences;

                // Log into store
                loginStore(userObj as any, userPrefs as any);

                // Optionally sync profile in background without blocking navigation
                userService.getProfile().then((profileRes) => {
                    if (profileRes.success && profileRes.data) {
                        useUserStore.getState().setProfile(profileRes.data as any);
                    }
                }).catch(() => {
                    // Fallback to initial payload
                });

                navigate('/dashboard', { replace: true });
            } else {
                setError(response.error?.message || 'Invalid email or password. Please check your credentials.');
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
                title="Sign In | Optileno AI Daily Planner"
                description="Sign in to your Optileno account to access your AI daily planner, calendar time blocking, and productivity dashboard."
                robots="index,follow"
                canonicalUrl="https://www.optileno.com/login"
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

                    <GoogleSignInButton
                        mode="signin"
                        onError={(msg) => setError(msg)}
                    />

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
