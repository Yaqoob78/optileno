import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, LogIn, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import '../../styles/pages/auth.css';

export default function Login() {
    const navigate = useNavigate();
    const setProfile = useUserStore((state) => state.setProfile);
    const loginStore = useUserStore((state) => state.login);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                    navigate('/chat');
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

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div className={`input-wrapper ${formData.email ? 'has-value' : ''}`}>
                                <input
                                    type="email"
                                    className="auth-input"
                                    placeholder="Enter your email"
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
                                    type="password"
                                    className="auth-input"
                                    placeholder="Enter your password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                                <Lock className="input-icon" size={18} />
                            </div>
                        </div>

                        <div className="form-options">
                            <label className="remember-me">
                                <input type="checkbox" />
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
