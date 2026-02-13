import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Sparkles, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import '../../styles/pages/auth.css';

export default function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        plan_type: 'EXPLORER', // Default to Explorer
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

            if (response.success) {
                // Redirect to login after successful registration
                navigate('/login', { state: { message: 'Account created successfully! Please log in.' } });
            } else {
                setError(response.error?.message || 'Registration failed. Please try again.');
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
                        <h1 className="auth-title">Create Account</h1>
                        <p className="auth-subtitle">Join the future of personal productivity</p>
                    </div>

                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        {/* Plan Selection */}
                        <div className="pricing-options">
                            <div
                                className={`pricing-card ${formData.plan_type === 'EXPLORER' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, plan_type: 'EXPLORER' })}
                            >
                                <div className="pricing-header">
                                    <span className="plan-name">Explorer</span>
                                    <span className="plan-price">$1<span style={{ fontSize: '0.7em', opacity: 0.7 }}>/mo</span></span>
                                </div>
                                <div className="plan-features">
                                    <div className="plan-feature">✓ Task Management & Habits</div>
                                    <div className="plan-feature">✓ Planner Dashboard</div>
                                    <div className="plan-feature">✓ AI Chat (20 req/day)</div>
                                    <div className="plan-feature">✓ Basic Analytics</div>
                                </div>
                            </div>

                            <div
                                className={`pricing-card ${formData.plan_type === 'ULTRA' ? 'selected' : ''}`}
                                onClick={() => setFormData({ ...formData, plan_type: 'ULTRA' })}
                                style={{ borderColor: formData.plan_type === 'ULTRA' ? 'var(--primary-color)' : '' }}
                            >
                                <div className="plan-badge">BEST VALUE</div>
                                <div className="pricing-header">
                                    <span className="plan-name">Ultra</span>
                                    <span className="plan-price">$9.99<span style={{ fontSize: '0.7em', opacity: 0.7 }}>/mo</span></span>
                                </div>
                                <div className="plan-features" style={{ gap: '6px' }}>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Unlimited Leno AI & Memory</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Deep Work & Flow Tools</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Strategic Goal Timeline</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Advanced Behavioral Analytics</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Predictive Life Trajectories</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Smart Context Notifications</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Mood & Stress Intelligence</div>
                                    <div className="plan-feature"><span style={{ color: 'var(--primary-color)' }}>✦</span> Priority Features Access</div>
                                </div>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Full Name</label>
                            <div className="input-wrapper">
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
                            <div className="input-wrapper">
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
                            <div className="input-wrapper">
                                <input
                                    type="password"
                                    className="auth-input"
                                    placeholder="Min. 8 characters"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    minLength={8}
                                />
                                <Lock className="input-icon" size={18} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="input-wrapper">
                                <input
                                    type="password"
                                    className="auth-input"
                                    placeholder="Confirm your password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                />
                                <Lock className="input-icon" size={18} />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
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

                        <button type="submit" className="auth-button" disabled={loading}>
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
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
