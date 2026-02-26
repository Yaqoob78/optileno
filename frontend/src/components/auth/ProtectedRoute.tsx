import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, CreditCard, Zap } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { openCashfreeCheckout, openCashfreeSubscriptionCheckout } from '../../utils/cashfree';

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
    const [verifyingReturnPayment, setVerifyingReturnPayment] = useState(false);
    const hasChecked = useRef(false);

    const params = new URLSearchParams(location.search);
    const paymentReturnOrderId = params.get('order_id');
    const paymentReturnSubscriptionId = params.get('subscription_id');
    const isPaymentReturn = params.get('payment') === 'success' && (!!paymentReturnOrderId || !!paymentReturnSubscriptionId);

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
                if (isPaymentReturn) {
                    try {
                        const { paymentService } = await import('../../services/api/payment.service');
                        const restoreRes = await paymentService.completePaymentReturn({
                            order_id: paymentReturnOrderId || undefined,
                            subscription_id: paymentReturnSubscriptionId || undefined,
                        });
                        if (
                            restoreRes.success &&
                            restoreRes.data?.authenticated &&
                            restoreRes.data?.user
                        ) {
                            login(restoreRes.data.user as any, (restoreRes.data.user as any).preferences as any);
                            setChecking(false);
                            return;
                        }
                    } catch {
                        // Fall back to normal session/profile check below.
                    }
                }

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
    }, [
        isAuthenticated,
        isPaymentReturn,
        login,
        logout,
        paymentReturnOrderId,
        paymentReturnSubscriptionId,
        profile,
    ]);

    useEffect(() => {
        if (!isAuthenticated || !isPaymentReturn) {
            return;
        }

        const subscriptionStatus = ((profile as any)?.subscription?.status || '').toLowerCase();
        if (subscriptionStatus !== 'pending_payment' && subscriptionStatus !== 'payment_failed') {
            navigate(location.pathname, { replace: true });
            return;
        }

        let cancelled = false;

        const verifyPaymentReturn = async () => {
            setVerifyingReturnPayment(true);
            setPaymentError(null);

            try {
                const { paymentService } = await import('../../services/api/payment.service');
                const verifyRes = paymentReturnSubscriptionId
                    ? await paymentService.verifySubscription(paymentReturnSubscriptionId)
                    : await paymentService.verifyPayment(paymentReturnOrderId as string);

                if (!verifyRes.success || !verifyRes.data?.success) {
                    throw new Error(verifyRes.data?.message || 'Payment verification is still pending.');
                }

                const profileRes = await userService.getProfile();
                if (!cancelled && profileRes.success && profileRes.data) {
                    login(profileRes.data as any, profileRes.data.preferences as any);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setPaymentError(err?.message || 'Payment could not be confirmed yet. Please try again.');
                }
            } finally {
                if (!cancelled) {
                    setVerifyingReturnPayment(false);
                }
                navigate(location.pathname, { replace: true });
            }
        };

        verifyPaymentReturn();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, isPaymentReturn, paymentReturnOrderId, paymentReturnSubscriptionId, profile, login, navigate, location.pathname]);

    const handleInitiatePayment = async () => {
        setInitiatingPayment(true);
        setPaymentError(null);

        try {
            const { paymentService } = await import('../../services/api/payment.service');
            const planType = (profile as any)?.planType || (profile as any)?.plan_type || 'EXPLORER';
            const planName = String(planType).toLowerCase() === 'ultra' ? 'ultra' : 'explorer';

            const subscriptionRes = await paymentService.createSubscription(planName, 'monthly');
            if (subscriptionRes.success && subscriptionRes.data?.subscription_session_id) {
                const mode = subscriptionRes.data.environment === 'production' ? 'production' : 'sandbox';
                await openCashfreeSubscriptionCheckout(subscriptionRes.data.subscription_session_id, mode);
                return;
            }

            // Backward-compatible fallback (legacy order flow).
            const orderRes = await paymentService.createOrder(planName, 'monthly');
            if (!orderRes.success || !orderRes.data?.payment_session_id) {
                throw new Error(orderRes.error?.message || subscriptionRes.error?.message || 'Failed to create payment order. Please try again.');
            }

            const mode = orderRes.data.environment === 'production' ? 'production' : 'sandbox';
            await openCashfreeCheckout(orderRes.data.payment_session_id, mode);
        } catch (err: any) {
            setPaymentError(err?.message || 'Payment initiation failed. Please try again.');
        } finally {
            setInitiatingPayment(false);
        }
    };

    if (checking) {
        return (
            <div style={{
                display: 'flex',
                height: '100vh',
                width: '100vw',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617',
            }}>
                <Loader2 className="animate-spin" style={{ height: '2rem', width: '2rem', color: '#3b82f6' }} />
            </div>
        );
    }

    if (!isAuthenticated) {
        const publicPaths = ['/', '/login', '/register', '/get-access'];
        if (publicPaths.includes(location.pathname)) {
            return <>{children}</>;
        }
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    const subscriptionStatus = String((profile as any)?.subscription?.status || '').toLowerCase();
    const isPendingPayment = subscriptionStatus === 'pending_payment' || subscriptionStatus === 'payment_failed';

    if (isPendingPayment && verifyingReturnPayment) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                width: '100vw',
                padding: '2rem',
                background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
            }}>
                <div style={{
                    background: 'rgba(10, 15, 30, 0.85)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '24px',
                    padding: '2rem',
                    maxWidth: '460px',
                    width: '100%',
                    textAlign: 'center',
                }}>
                    <Loader2 className="animate-spin" size={28} style={{ color: '#60a5fa', marginBottom: '1rem' }} />
                    <h2 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                        Verifying Payment
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6' }}>
                        Please wait while we confirm your payment securely with Cashfree.
                    </p>
                </div>
            </div>
        );
    }

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
                        color: '#fff',
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
                            ? 'Ultra Plan - $10/month'
                            : 'Explorer Plan - $2/month (includes 3-day free trial)'}
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
                        Secure payment powered by Cashfree. Your payment details are encrypted and safe.
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
