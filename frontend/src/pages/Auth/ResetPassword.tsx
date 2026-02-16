import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import '../../styles/pages/auth.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await userService.resetPassword({
        token,
        new_password: newPassword,
      });

      if (response.success) {
        navigate('/login', {
          replace: true,
          state: { message: 'Password reset successful. Please sign in.' },
        });
      } else {
        setError(response.error?.message || 'Reset failed. Request a new link and try again.');
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
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">Set a new password for your account</p>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {!token ? (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>This reset link is invalid or incomplete.</span>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div className={`input-wrapper ${newPassword ? 'has-value' : ''}`}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="auth-input has-toggle"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <Lock className="input-icon" size={18} />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div className={`input-wrapper ${confirmPassword ? 'has-value' : ''}`}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="auth-input has-toggle"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
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

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : <span>Update Password</span>}
              </button>
            </form>
          )}

          <p className="auth-footer">
            Back to
            <Link to="/login" className="auth-link">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
