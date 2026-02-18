import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { Loader2, CreditCard, Zap } from 'lucide-react';

declare global {
    interface Window {
        Cashfree: any;
    }
}

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
    const hasChecked = React.useRef(false);
    const [initiatingPayment, setInitiatingPayment] = useState(false);

    // Check if returning from Cashfree payment
    const params = new URLSearchParams(location.search);
    const isPaymentReturn = params.get('payment') === 'success' && !!params.get('order_id');

    useEffect(() => {
        const checkAuth = async () => {
            console.log('[ProtectedRoute] checkAuth running. isAuthenticated:', isAuthenticated, 'hasChecked:', hasChecked.current);

            // Already checked on this mount
            if (hasChecked.current) return;

            // If store already says authenticated, allow access immediately
            // and refresh profile in background to avoid stale persisted plan tier.
            if (isAuthenticated) {
                console.log('[ProtectedRoute] User is already authenticated in store. Refreshing profile in background.');
                setChecking(false);
                hasChecked.current = true;
                try {
                    const response = await userService.getProfile();
                    if (response.success && response.data) {
                        login(response.data as any, response.data.preferences as any);
                    }
                } catch (err) {
                    // Ignore transient profile refresh errors for already-authenticated users.
                }
                return;
            }

            console.log('[ProtectedRoute] Validating session with backend...');
            hasChecked.current = true;
            try {
                const response = await userService.getProfile();
                console.log('[ProtectedRoute] Session check response:', response.success ? 'SUCCESS' : 'FAILED');

                if (response.success && response.data) {
                    console.log('[ProtectedRoute] Backend session valid. Logging in user.');
                    login(response.data as any, response.data.preferences as any);
                } else {
                    console.log('[ProtectedRoute] Backend session invalid or no data. Logging out user.');
                    logout();
                }
            } catch (err) {
                console.error('[ProtectedRoute] Session check error:', err);
                logout();
            } finally {
                setChecking(false);
            }
        };

        checkAuth();
    }, [isAuthenticated, login, logout]);

    // Handle payment initiation from the paywall
    const handleInitiatePayment = async () => {
        setInitiatingPayment(true);
        try {
            const { paymentService } = await import('../../services/api/payment.service');

            // Determine plan from user profile
            const planType = (profile as any)?.planType || (profile as any)?.plan_type || 'EXPLORER';
            const planName = planType.toLowerCase();

            const orderRes = await paymentService.createOrder(
                planName === 'ultra' ? 'ultra' : 'explorer',
                'monthly'
            );

            if (orderRes.success && orderRes.data?.payment_session_id) {
                // Load Cashfree SDK and open checkout
                if (window.Cashfree) {
                    const isProduction = import.meta.env.PROD;
                    const cf = new window.Cashfree({ mode: isProduction ? "production" : "sandbox" });
                    cf.checkout({
                        paymentSessionId: orderRes.data.payment_session_id,
                        redirectTarget: "_self",
                    });
                } else {
                    // Try loading the SDK
                    const script = document.createElement('script');
                    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
                    script.async = true;
                    script.onload = () => {
                        if (window.Cashfree) {
                            const isProduction = import.meta.env.PROD;
                            const cf = new window.Cashfree({ mode: isProduction ? "production" : "sandbox" });
                            cf.checkout({
                                paymentSessionId: orderRes.data.payment_session_id,
                                redirectTarget: "_self",
                            });
                        }
                    };
                    document.head.appendChild(script);
                }
            } else {
                alert('Failed to create payment order. Please try again.');
                setInitiatingPayment(false);
            }
        } catch (err) {
            console.error('Payment initiation failed:', err);
            alert('Payment initiation failed. Please try again.');
            setInitiatingPayment(false);
        }
    };

    if (checking) {
        return (
            <div style={{
                display: 'flex', height: '100vh', width: '100vw',
                alignItems: 'center', justifyContent: 'center',
                background: '#020617',
            }}>
                <Loader2 className="animate-spin" style={{ height: '2rem', width: '2rem', color: '#3b82f6' }} />
            </div>
        );
    }

    if (!isAuthenticated) {
        // PREVENT LOOP: If we are already on a public route, do NOT redirect to /
        const publicPaths = ['/', '/login', '/register'];
        if (publicPaths.includes(location.pathname)) {
            console.log('[ProtectedRoute] Already on public path. Not redirecting.');
            return <>{children}</>;
        }

        console.log('[ProtectedRoute] Not authenticated. Path:', location.pathname, 'Redirecting to /');
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── PAYMENT WALL ──────────────────────────────────────────────
    // Block ALL protected routes if subscription_status is "pending_payment"
    // EXCEPT when returning from Cashfree payment (payment=success in URL)
    const subscriptionStatus = (profile as any)?.subscription?.status;
    const isPendingPayment = subscriptionStatus === 'pending_payment';

    if (isPendingPayment && !isPaymentReturn) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', width: '100vw', padding: '2rem',
                background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
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
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}>
                        <CreditCard size={36} style={{ color: '#60a5fa' }} />
                    </div>

                    <h2 style={{
                        color: '#fff', fontSize: '1.5rem', fontWeight: 700,
                        marginBottom: '0.75rem',
                    }}>
                        Complete Your Payment
                    </h2>

                    <p style={{
                        color: '#94a3b8', fontSize: '0.95rem', marginBottom: '0.5rem',
                        lineHeight: '1.6',
                    }}>
                        Your account has been created successfully! To start using Optileno,
                        please complete your subscription payment.
                    </p>

                    <p style={{
                        color: '#64748b', fontSize: '0.8rem', marginBottom: '2rem',
                        lineHeight: '1.5',
                    }}>
                        {(profile as any)?.planType === 'ULTRA' ? (
                            <>Ultra Plan — $10/month</>
                        ) : (
                            <>Explorer Plan — $2/month (includes 3-day free trial)</>
                        )}
                    </p>

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
                                <span>Pay & Get Started</span>
                            </>
                        )}
                    </button>

                    <p style={{
                        color: '#475569', fontSize: '0.7rem', marginTop: '1.25rem',
                        lineHeight: '1.4',
                    }}>
                        🔒 Secure payment powered by Cashfree. Your payment details are encrypted and safe.
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
                        Log out & go back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
