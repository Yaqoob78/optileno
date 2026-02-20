import React, { useEffect } from 'react';
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
          color: 'var(--color-text-primary)',
          background: 'var(--color-bg-primary)'
        }}>
          <h2>Something went wrong.</h2>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: 'var(--color-primary)',
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
  const { isHydrated } = useStoreHydration();
  const { checked: sessionChecked } = useSessionBootstrap();
  const theme = useSettingsStore((state) => state.theme);
  const profile = useUserStore((state) => state.profile);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
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

  if (!isHydrated || !sessionChecked) {
    return <FullScreenLoader size={96} />;
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
