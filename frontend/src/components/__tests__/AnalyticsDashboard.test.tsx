import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { api } from '../../services/api/client';
import { AnalyticsDashboard } from '../analytics/AnalyticsDashboard';

jest.mock('../../services/realtime/socket-client', () => ({
  socket: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../services/api/client', () => ({
  api: {
    get: jest.fn(async () => ({
      success: true,
      data: {
        data: [
          { date: '2026-02-15', productivity: 72, focus: 68, wellness: 70 },
          { date: '2026-02-16', productivity: 75, focus: 71, wellness: 69 },
        ],
        forecasts: [
          { metric: 'focus', current: 70, predicted: 74, confidence: 0.84, trend: 'up' },
        ],
      },
    })),
  },
}));

describe('AnalyticsDashboard', () => {
  it('renders dashboard header and range controls', async () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /quarter/i })).toBeInTheDocument();
  });

  it('changes range and refetches analytics', async () => {
    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /month/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/analytics/historical/monthly');
    });
  });
});
