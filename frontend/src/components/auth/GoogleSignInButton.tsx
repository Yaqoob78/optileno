import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { env } from '../../config/env';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/user.store';
import { clearSessionScopedData } from '../../utils/sessionReset';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (notification?: any) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  mode?: 'signin' | 'signup';
  planType?: string;
  onError?: (errorMsg: string) => void;
  onSuccess?: () => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  mode = 'signin',
  planType = 'EXPLORER',
  onError,
  onSuccess,
  className = '',
}) => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const clientId = env.GOOGLE_CLIENT_ID || '';

  const handleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      onError?.('Google authentication failed. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // 1. Wipe any lingering browser state from past sessions
      clearSessionScopedData();

      // 2. Submit Google credential token to Optileno backend
      const res = await userService.googleAuth({
        credential: response.credential,
        plan_type: planType,
      });

      if (res.success && res.data?.user) {
        const user = res.data.user;
        useUserStore.getState().login(user, user.preferences || {});

        onSuccess?.();
        navigate('/dashboard', { replace: true });
      } else {
        const errMsg = res.error?.message || 'Google sign-in failed. Please try again.';
        onError?.(errMsg);
      }
    } catch (err: any) {
      console.error('Google Sign-in Exception:', err);
      onError?.(err?.message || 'Network error during Google sign-in.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If Google GIS script is already loaded
    if (window.google?.accounts?.id) {
      setScriptLoaded(true);
      return;
    }

    // Check if script tag is already in DOM
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    // Load Google Identity Services script dynamically
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.warn('Google Identity Services script failed to load.');
    };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !window.google?.accounts?.id || !buttonRef.current || !clientId) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render official Google button
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 340,
      });

      // Also trigger Google One Tap with silent dismissal handler
      window.google.accounts.id.prompt((notification: any) => {
        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          // Normal One-Tap prompt dismissal, handled gracefully without console errors
        }
      });
    } catch (err) {
      console.warn('Google button init error:', err);
    }
  }, [scriptLoaded, clientId, mode]);

  const handleManualClick = () => {
    if (clientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      onError?.(
        'Google 1-Click is ready. Configure VITE_GOOGLE_CLIENT_ID in your environment to enable native popup.'
      );
    }
  };

  return (
    <div className={`google-auth-container ${className}`} style={{ width: '100%', marginBottom: '1.25rem' }}>
      {/* If Google GIS is active and client ID is provided, render native Google element */}
      {clientId && scriptLoaded ? (
        <div
          ref={buttonRef}
          style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }}
        />
      ) : (
        /* Styled fallback 1-click Google button */
        <button
          type="button"
          onClick={handleManualClick}
          disabled={loading}
          className="btn-google-one-click"
          style={{
            width: '100%',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            color: '#f3f4f6',
            fontSize: '0.92rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
        </button>
      )}

      {/* Modern Or Divider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '1.25rem 0 0.5rem 0',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
        <span>or with email</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
      </div>
    </div>
  );
};
