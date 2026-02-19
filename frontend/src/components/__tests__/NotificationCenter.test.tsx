import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { NotificationCenter } from '../notifications/NotificationCenter';

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
      data: [
        {
          id: 'n1',
          type: 'info',
          title: 'New update',
          message: 'Task completed',
          priority: 'medium',
          read: false,
          created_at: new Date().toISOString(),
        },
      ],
    })),
    patch: jest.fn(async () => ({ success: true })),
    delete: jest.fn(async () => ({ success: true })),
  },
}));

describe('NotificationCenter', () => {
  it('renders when open and supports unread filter', async () => {
    render(<NotificationCenter isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    await screen.findByText('New update');

    const unreadButton = screen.getByRole('button', { name: /unread/i });
    fireEvent.click(unreadButton);

    await waitFor(() => {
      expect(unreadButton.className).toContain('bg-blue-500');
    });
  });

  it('does not render when closed', () => {
    const { container } = render(<NotificationCenter isOpen={false} onClose={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose from header close button', async () => {
    const onClose = jest.fn();
    render(<NotificationCenter isOpen={true} onClose={onClose} />);
    await screen.findByText('New update');

    const closeButton = screen.getAllByRole('button')[0];
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
