import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AppRoutes from "./routes/AppRoutes";
import { useSettingsStore } from "./stores/settings.store";
import { useUserStore } from "./stores/useUserStore";
import { usePlannerStore } from "./stores/planner.store";
import { realtimeClient } from "./services/realtime/socket-client";
import { useAutoSaveChat } from "./hooks/useAutoSaveChat";
import { useSessionTracking } from "./hooks/useSessionTracking";
import { useSessionBootstrap } from "./hooks/useSessionBootstrap";
import { useStoreHydration, usePreserveState, useStateListener } from "./hooks/useStoreHydration";
import { initializeStatePreservation } from "./utils/statePreservation";
import CookieConsent from "./components/legal/CookieConsent";
import { FullScreenLoader } from "./components/common/loader/Loader";

const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/get-access',
  '/forgot-password',
  '/reset-password',
  '/chat-leno',
  '/plan-task',
  '/ai-planner',
  '/ai-calendar-planner',
  '/workflow-automation-agency-owners',
  '/agency-workflow-automation',
  '/ai-task-manager',
  '/ai-task',
  '/ai-productivity',
  '/ai-daily-productivity',
  '/tools',
  '/free-ai-tools',
  '/tools/ai-task-prioritizer',
  '/tools/ai-weekly-planner',
  '/show-analytics',
  '/dashboard-preview',
  '/goal-progress',
  '/vs/motion',
  '/vs/sunsama',
  '/terms',
  '/privacy',
  '/refund',
  '/cookies',
]);

const isPublicPath = (pathname: string) => {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/vs/')) return true;
  return false;
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgb(var(--color-text-primary))',
          background: 'rgb(var(--color-bg-primary))',
          minHeight: '100dvh',
        }}>
          <h2>Something went wrong.</h2>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'rgb(var(--color-primary))',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function StoreInitializer({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const isPublicRoute = isPublicPath(location.pathname);
  const shouldValidateSession = !isPublicRoute || isAuthenticated;

  const { isHydrated } = useStoreHydration();
  const { checked: sessionChecked } = useSessionBootstrap(shouldValidateSession);
  const theme = useSettingsStore((state) => state.theme);
  const profile = useUserStore((state) => state.profile);
  const initPlannerSockets = usePlannerStore((state) => state.initSocketListeners);

  useEffect(() => {
    const cleanup = initializeStatePreservation();
    return cleanup;
  }, []);

  useAutoSaveChat(5000);
  useSessionTracking(sessionChecked);
  usePreserveState();
  useStateListener(false);

  useEffect(() => {
    if (sessionChecked && isAuthenticated && profile?.id) {
      realtimeClient.connect(profile.id)
        .then(() => {
          initPlannerSockets();
        })
        .catch((err) => {
          console.error('Realtime connection failed:', err);
        });

      return () => {
        realtimeClient.disconnect();
      };
    }

    return undefined;
  }, [sessionChecked, isAuthenticated, profile?.id, initPlannerSockets]);

  useEffect(() => {
    const appliedTheme = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [theme]);

  if (!isHydrated || (shouldValidateSession && !sessionChecked)) {
    return <FullScreenLoader size={96} text="Loading your data" />;
  }

  return children as React.ReactElement;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  return (
    <StoreInitializer>
      {children}
    </StoreInitializer>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInitializer>
        <AppRoutes />
        <CookieConsent />
      </AppInitializer>
    </ErrorBoundary>
  );
}
