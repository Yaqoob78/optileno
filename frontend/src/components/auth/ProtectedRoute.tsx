import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, Zap } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { openLemonSqueezyCheckout } from '../../utils/lemonsqueezy';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const profile = useUserStore((state) => state.profile);
    const login = useUserStore((state) => state.login);
    const logout = useUserStore((state) => state.logout);

    const location = useLocation();
    const navigate = useNavigate();

    const [checking, setChecking] = useState(true);
    const [initiatingPayment, setInitiatingPayment] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const hasChecked = useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            if (hasChecked.current) {
                return;
            }

            hasChecked.current = true;

            if (isAuthenticated) {
                // Fast path: session already restored in store, avoid extra blocking round-trip.
                if (profile) {
                    setChecking(false);
                    return;
                }

                try {
                    const response = await userService.getProfile();
                    if (response.success && response.data) {
                        login(response.data as any, response.data.preferences as any);
                    }
                } catch {
                    // Keep existing session state and continue.
                } finally {
                    setChecking(false);
                }
                return;
            }

            try {
                const response = await userService.getProfile();
                if (response.success && response.data) {
                    login(response.data as any, response.data.preferences as any);
                } else {
                    logout();
                }
            } catch {
                logout();
            } finally {
                setChecking(false);
            }
        };

        checkAuth();
    }, [isAuthenticated, profile, login, logout]);

    const handleInitiatePayment = () => {
        setInitiatingPayment(true);
        setPaymentError(null);
        openLemonSqueezyCheckout(profile);
    };

    if (checking) {
        return (
            <div style={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgb(var(--color-bg-primary, 2 6 23))',
            }}>
                <Loader2 className="animate-spin" style={{ height: '2rem', width: '2rem', color: '#3b82f6' }} />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const subscriptionStatus = String((profile as any)?.subscription?.status || '').toLowerCase();
    const isPendingPayment = subscriptionStatus === 'pending_payment' || subscriptionStatus === 'payment_failed';

    if (isPendingPayment) {
        const isUltraPlan = ((profile as any)?.planType || '').toUpperCase() === 'ULTRA';

        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                width: '100vw',
                padding: '2rem',
                background: 'rgb(var(--color-bg-primary, 2 6 23))',
            }}>
                <div style={{
                    background: 'rgba(10, 15, 30, 0.85)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px',
                    padding: '3rem 2.5rem',
                    maxWidth: '480px',
                    width: '100%',
                    textAlign: 'center',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}>
                        <CreditCard size={36} style={{ color: '#60a5fa' }} />
                    </div>

                    <h2 style={{
                        color: 'rgb(var(--color-text-primary, 248 250 252))',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        marginBottom: '0.75rem',
                    }}>
                        Complete Your Payment
                    </h2>

                    <p style={{
                        color: '#94a3b8',
                        fontSize: '0.95rem',
                        marginBottom: '0.5rem',
                        lineHeight: '1.6',
                    }}>
                        Your account has been created successfully. Please complete payment to continue.
                    </p>

                    <p style={{
                        color: '#64748b',
                        fontSize: '0.8rem',
                        marginBottom: '2rem',
                        lineHeight: '1.5',
                    }}>
                        {isUltraPlan
                            ? 'Ultra Pro Plan - $6.99/month'
                            : 'Free Plan - $0/month'}
                    </p>

                    {paymentError && (
                        <p style={{
                            color: '#fca5a5',
                            fontSize: '0.8rem',
                            marginBottom: '1rem',
                            lineHeight: '1.5',
                        }}>
                            {paymentError}
                        </p>
                    )}

                    <button
                        onClick={handleInitiatePayment}
                        disabled={initiatingPayment}
                        style={{
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '14px',
                            padding: '1rem 2.5rem',
                            fontSize: '1.05rem',
                            fontWeight: 700,
                            cursor: initiatingPayment ? 'wait' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            boxShadow: '0 4px 25px rgba(34, 197, 94, 0.35)',
                            transition: 'all 0.2s ease',
                            opacity: initiatingPayment ? 0.7 : 1,
                            width: '100%',
                            justifyContent: 'center',
                        }}
                    >
                        {initiatingPayment ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>Preparing Checkout...</span>
                            </>
                        ) : (
                            <>
                                <Zap size={20} />
                                <span>Pay and Get Started</span>
                            </>
                        )}
                    </button>

                    <p style={{
                        color: '#475569',
                        fontSize: '0.7rem',
                        marginTop: '1.25rem',
                        lineHeight: '1.4',
                    }}>
                        Secure checkout powered by Lemon Squeezy. Your payment details are encrypted and safe.
                    </p>

                    <button
                        onClick={() => {
                            logout();
                            navigate('/');
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            marginTop: '1rem',
                            textDecoration: 'underline',
                        }}
                    >
                        Log out and go back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
