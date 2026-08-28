import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, KeyRound, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import { clearSessionScopedData } from '../../utils/sessionReset';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import SEO from '../../components/common/SEO';
import '../../styles/pages/auth.css';

const PASSWORD_POLICY_MESSAGE = 'Password must be at least 8 characters and include at least 1 letter and 1 number.';

export default function GetAccess() {
  const navigate = useNavigate();
  const loginStore = useUserStore((state) => state.login);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const isPasswordValid = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(formData.password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      clearSessionScopedData();
      const response = await userService.getAccess({
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name.trim() || undefined,
      });

      if (response.success && response.data?.authenticated && response.data?.user) {
        loginStore(response.data.user as any, (response.data.user as any).preferences as any);
        navigate('/dashboard', { replace: true });
        return;
      }

      setError(
        response.data?.message ||
        response.error?.message ||
        'Access is not granted for this email yet. Ask admin to grant access first.',
      );
    } catch {
      setError('Unable to complete access sign-in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page dark">
      <SEO
        title="Get Access | Optileno AI Daily Planner"
        description="Invite-only early access: sign in to your Optileno account or claim your granted workspace."
        robots="index,follow"
        canonicalUrl="https://www.optileno.com/get-access"
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
            <h1 className="auth-title">Get Access</h1>
            <p className="auth-subtitle">Only pre-approved emails can create/login here</p>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <GoogleSignInButton
            mode="signin"
            onError={(msg) => setError(msg)}
          />

          <form className="auth-form" onSubmit={handleSubmit} autoComplete="on">
            <div className="form-group">
              <label className="form-label" htmlFor="access-name">Full Name</label>
              <div className={`input-wrapper ${formData.full_name ? 'has-value' : ''}`}>
                <input
                  id="access-name"
                  type="text"
                  className="auth-input"
                  placeholder="Enter your name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  autoComplete="name"
                />
                <User className="input-icon" size={18} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="access-email">Email Address</label>
              <div className={`input-wrapper ${formData.email ? 'has-value' : ''}`}>
                <input
                  id="access-email"
                  type="email"
                  className="auth-input"
                  placeholder="Enter the granted email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
                <Mail className="input-icon" size={18} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="access-password">Password</label>
              <div className={`input-wrapper ${formData.password ? 'has-value' : ''}`}>
                <input
                  id="access-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input has-toggle"
                  placeholder="Set your password"
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
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="access-confirm-password">Confirm Password</label>
              <div className={`input-wrapper ${formData.confirmPassword ? 'has-value' : ''}`}>
                <input
                  id="access-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="auth-input has-toggle"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  autoComplete="new-password"
                  required
                />
                <KeyRound className="input-icon" size={18} />
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

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>Continue</span>
                  <KeyRound size={20} />
                </>
              )}
            </button>
          </form>

          <p className="auth-footer">
            Already set up?
            <Link to="/login" className="auth-link">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
