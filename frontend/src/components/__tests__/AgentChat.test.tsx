import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { api } from '../../services/api/client';
import { AgentChat } from '../chat/AgentChat';

jest.mock('../../services/realtime/socket-client', () => ({
  socket: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../hooks/usePlanner', () => ({
  usePlanner: () => ({ forceRefresh: jest.fn() }),
}));

jest.mock('../../services/api/client', () => ({
  api: {
    post: jest.fn(async () => ({
      success: true,
      data: {
        message: 'Agent reply',
        actions: [],
        pending_confirmations: [],
      },
    })),
  },
}));

describe('AgentChat', () => {
  it('renders mode selector and input', () => {
    render(<AgentChat conversationId="conv_1" />);

    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask me anything/i)).toBeInTheDocument();
  });

  it('sends a message and clears input', async () => {
    render(<AgentChat conversationId="conv_1" />);

    const input = screen.getByPlaceholderText(/ask me anything/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'Help me plan today' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/chat/send',
        expect.objectContaining({ message: 'Help me plan today', mode: 'CHAT' }),
      );
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
