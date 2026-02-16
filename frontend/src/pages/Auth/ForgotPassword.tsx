import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import '../../styles/pages/auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await userService.forgotPassword({ email });
      if (response.success) {
        setSent(true);
      } else {
        setError(response.error?.message || 'Unable to send reset email right now.');
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
            <h1 className="auth-title">Forgot Password</h1>
            <p className="auth-subtitle">Enter your email to receive a secure reset link</p>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {sent ? (
            <div className="success-message">
              If the email exists, we sent a reset link.
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className={`input-wrapper ${email ? 'has-value' : ''}`}>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Mail className="input-icon" size={18} />
                </div>
              </div>

              <button type="submit" className="auth-button" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" size={20} /> : <span>Send Reset Link</span>}
              </button>
            </form>
          )}

          <p className="auth-footer">
            <Link to="/login" className="auth-link">
              <ArrowLeft size={14} style={{ marginRight: 6 }} />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
