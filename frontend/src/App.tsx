// App.tsx - UPDATED VERSION
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

// Simple error boundary component
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

/**
 * StoreInitializer Component
 * Ensures all stores are hydrated before rendering child components
 */
function StoreInitializer({ children }: { children: React.ReactNode }) {
  const { isHydrated, error } = useStoreHydration();
  const { checked: sessionChecked } = useSessionBootstrap();
  const theme = useSettingsStore((state) => state.theme);
  const profile = useUserStore((state) => state.profile);
  const initPlannerSockets = usePlannerStore((state) => state.initSocketListeners);

  // Initialize state preservation system (CRITICAL FOR DATA PERSISTENCE)
  useEffect(() => {
    const cleanup = initializeStatePreservation();
    return cleanup;
  }, []);

  // Initialize auto-save, session tracking, and state preservation
  useAutoSaveChat(5000);
  useSessionTracking();
  usePreserveState();

  // Enable debug logging for state changes (set to true for debugging)
  useStateListener(false);

  // Real-time connection management
  useEffect(() => {
    if (profile?.id) {
      console.log('🔄 Initializing Realtime Connection for user:', profile.id);
      const token = localStorage.getItem('access_token')
        || localStorage.getItem('auth_token')
        || localStorage.getItem('token')
        || undefined;

      realtimeClient.connect(profile.id, token)
        .then(() => {
          console.log('✅ Realtime Connected');
          initPlannerSockets();
        })
        .catch(err => console.error('❌ Realtime Connection Failed:', err));

      return () => {
        console.log('🔌 Disconnecting Realtime...');
        realtimeClient.disconnect();
      };
    }
  }, [profile?.id, initPlannerSockets]);

  // Force theme application on mount
  useEffect(() => {
    // Re-apply theme to ensure it's set
    const appliedTheme = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;

    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [theme]);

  // Show loading state while hydrating
  if (!isHydrated || !sessionChecked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontSize: '16px'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            marginBottom: '16px'
          }}>⏳</div>
          <div>Loading your data...</div>
          {error && (
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              color: 'var(--color-danger)',
              opacity: 0.7
            }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return children as React.ReactElement;
}

/**
 * AppInitializer Component
 * Initializes all global hooks and state management
 */
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
      </AppInitializer>
    </ErrorBoundary>
  );
}
