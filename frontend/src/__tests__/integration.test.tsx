import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from '../App';
import { useSessionBootstrap } from '../hooks/useSessionBootstrap';
import { useStoreHydration } from '../hooks/useStoreHydration';

jest.mock('../routes/AppRoutes', () => ({
  __esModule: true,
  default: () => <div>AppRoutesMock</div>,
}));

jest.mock('../components/legal/CookieConsent', () => ({
  __esModule: true,
  default: () => <div>CookieConsentMock</div>,
}));

jest.mock('../hooks/useAutoSaveChat', () => ({
  useAutoSaveChat: jest.fn(),
}));

jest.mock('../hooks/useSessionTracking', () => ({
  useSessionTracking: jest.fn(),
}));

jest.mock('../hooks/useSessionBootstrap', () => ({
  useSessionBootstrap: jest.fn(() => ({ checked: true })),
}));

jest.mock('../hooks/useStoreHydration', () => ({
  useStoreHydration: jest.fn(() => ({ isHydrated: true, error: null })),
  usePreserveState: jest.fn(),
  useStateListener: jest.fn(),
}));

jest.mock('../utils/statePreservation', () => ({
  initializeStatePreservation: jest.fn(() => jest.fn()),
}));

jest.mock('../services/realtime/socket-client', () => ({
  realtimeClient: {
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  },
  socket: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../stores/settings.store', () => ({
  useSettingsStore: (selector: any) => selector({ theme: 'light' }),
}));

jest.mock('../stores/useUserStore', () => ({
  useUserStore: (selector: any) => selector({ profile: { id: 1 } }),
}));

jest.mock('../stores/planner.store', () => ({
  usePlannerStore: (selector: any) => selector({ initSocketListeners: jest.fn() }),
}));

describe('App Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderApp = () => {
    return render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );
  };

  it('shows loading state until hydration/session checks finish', () => {
    (useStoreHydration as jest.Mock).mockReturnValueOnce({ isHydrated: false, error: null });
    (useSessionBootstrap as jest.Mock).mockReturnValueOnce({ checked: false });

    renderApp();

    expect(screen.getByText(/loading your data/i)).toBeInTheDocument();
  });

  it('renders app routes and cookie consent once initialized', () => {
    (useStoreHydration as jest.Mock).mockReturnValue({ isHydrated: true, error: null });
    (useSessionBootstrap as jest.Mock).mockReturnValue({ checked: true });

    renderApp();

    expect(screen.getByText('AppRoutesMock')).toBeInTheDocument();
    expect(screen.getByText('CookieConsentMock')).toBeInTheDocument();
  });
});
