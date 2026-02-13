import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../../stores/useUserStore';
import { userService } from '../../services/api/user.service';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const isAuthenticated = useUserStore((state) => state.isAuthenticated);
    const login = useUserStore((state) => state.login);
    const logout = useUserStore((state) => state.logout);
    const location = useLocation();
    const [checking, setChecking] = useState(true);
    const hasChecked = React.useRef(false);

    useEffect(() => {
        const checkAuth = async () => {
            console.log('[ProtectedRoute] checkAuth running. isAuthenticated:', isAuthenticated, 'hasChecked:', hasChecked.current);

            // Already checked on this mount
            if (hasChecked.current) return;

            // If store already says authenticated, stop checking
            if (isAuthenticated) {
                console.log('[ProtectedRoute] User is already authenticated in store.');
                setChecking(false);
                hasChecked.current = true;
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

    if (checking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

    return <>{children}</>;
};

export default ProtectedRoute;
