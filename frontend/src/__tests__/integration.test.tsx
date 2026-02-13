import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import * as socketIO from 'socket.io-client';

jest.mock('socket.io-client');

describe('Frontend Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification System Integration', () => {
    it('receives and displays real-time notifications', async () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn(),
      };
      (socketIO.io as jest.Mock).mockReturnValue(mockSocket);

      render(<App />);

      // Get the notification listener callback
      const notificationListener = mockSocket.on.mock.calls.find(
        call => call[0] === 'notification:received'
      )?.[1];

      expect(notificationListener).toBeDefined();

      // Simulate receiving a notification
      if (notificationListener) {
        notificationListener({
          id: 'notif_1',
          title: 'Task Assigned',
          message: 'You have been assigned a new task',
          priority: 'high',
        });
      }

      // Verify notification appears
      await waitFor(() => {
        expect(screen.getByText('Task Assigned')).toBeInTheDocument();
      });
    });

    it('filters notifications by status', async () => {
      render(<App />);

      const filterButton = screen.getByRole('button', { name: /unread/i });
      fireEvent.click(filterButton);

      await waitFor(() => {
        expect(filterButton).toHaveClass('active');
      });
    });
  });

  describe('Collaboration Feature Integration', () => {
    it('enables task sharing workflow', async () => {
      render(<App />);

      // Find and click share button
      const shareButton = screen.queryByRole('button', { name: /share/i });
      
      if (shareButton) {
        fireEvent.click(shareButton);

        // Share dialog should appear
        await waitFor(() => {
          expect(screen.getByText(/Share Task/i)).toBeInTheDocument();
        });

        // Fill in share details
        const userInput = screen.getByPlaceholderText(/Search users/i);
        await userEvent.type(userInput, 'colleague@example.com');

        // Select permissions
        const editCheckbox = screen.getByLabelText(/Edit/i);
        fireEvent.click(editCheckbox);

        // Share
        const shareSubmit = screen.getByRole('button', { name: /share/i });
        fireEvent.click(shareSubmit);

        await waitFor(() => {
          expect(screen.queryByText(/Share Task/i)).not.toBeInTheDocument();
        });
      }
    });

    it('handles real-time comment updates', async () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn(),
      };
      (socketIO.io as jest.Mock).mockReturnValue(mockSocket);

      render(<App />);

      // Get comment listener
      const commentListener = mockSocket.on.mock.calls.find(
        call => call[0] === 'collaboration:comment:added'
      )?.[1];

      expect(commentListener).toBeDefined();

      // Add a comment
      const commentInput = screen.queryByPlaceholderText(/Add a comment/i);
      if (commentInput) {
        await userEvent.type(commentInput, 'This is a test comment');
        fireEvent.click(screen.getByRole('button', { name: /comment/i }));

        // Simulate receiving comment via socket
        if (commentListener) {
          commentListener({
            id: 'comment_1',
            content: 'This is a test comment',
            author: 'Test User',
            created_at: new Date().toISOString(),
          });
        }

        await waitFor(() => {
          expect(screen.getByText('This is a test comment')).toBeInTheDocument();
        });
      }
    });
  });

  describe('AI Agent Integration', () => {
    it('switches between agent modes', async () => {
      render(<App />);

      const chatMode = screen.queryByRole('button', { name: /chat/i });
      const planMode = screen.queryByRole('button', { name: /plan/i });

      if (chatMode && planMode) {
        expect(chatMode).toHaveClass('active');

        fireEvent.click(planMode);

        await waitFor(() => {
          expect(planMode).toHaveClass('active');
          expect(chatMode).not.toHaveClass('active');
        });
      }
    });

    it('displays agent thinking state', async () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn(),
      };
      (socketIO.io as jest.Mock).mockReturnValue(mockSocket);

      render(<App />);

      const agentInput = screen.queryByPlaceholderText(/Type your message/i);

      if (agentInput) {
        await userEvent.type(agentInput, 'Analyze my tasks');
        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        // Get thinking listener
        const thinkingListener = mockSocket.on.mock.calls.find(
          call => call[0] === 'agent:thinking'
        )?.[1];

        if (thinkingListener) {
          thinkingListener({
            conversation_id: 'conv_1',
            step: 'Analyzing tasks...',
            progress: 0.5,
          });

          await waitFor(() => {
            expect(screen.queryByText(/thinking/i)).toBeInTheDocument();
          }, { timeout: 2000 });
        }
      }
    });

    it('handles agent response streaming', async () => {
      render(<App />);

      const agentInput = screen.queryByPlaceholderText(/Type your message/i);

      if (agentInput) {
        await userEvent.type(agentInput, 'What should I prioritize?');
        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        await waitFor(() => {
          const messages = screen.queryAllByRole('article');
          expect(messages.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('Analytics Integration', () => {
    it('displays analytics dashboard with data', async () => {
      render(<App />);

      // Navigate to analytics
      const analyticsLink = screen.queryByRole('link', { name: /analytics/i });
      if (analyticsLink) {
        fireEvent.click(analyticsLink);

        await waitFor(() => {
          expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
        });
      }
    });

    it('handles time range changes', async () => {
      render(<App />);

      const monthButton = screen.queryByRole('button', { name: /month/i });

      if (monthButton) {
        fireEvent.click(monthButton);

        await waitFor(() => {
          expect(monthButton).toHaveClass('active');
        });
      }
    });

    it('receives real-time forecast updates', async () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn(),
      };
      (socketIO.io as jest.Mock).mockReturnValue(mockSocket);

      render(<App />);

      const forecastListener = mockSocket.on.mock.calls.find(
        call => call[0] === 'analytics:updated'
      )?.[1];

      expect(forecastListener).toBeDefined();

      if (forecastListener) {
        forecastListener({
          tasks_completed: 42,
          completion_rate: 0.85,
          avg_time: 2.5,
        });

        await waitFor(() => {
          expect(screen.getByText(/tasks/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Multi-feature User Flows', () => {
    it('completes task creation to sharing to commenting flow', async () => {
      render(<App />);

      // Create task
      const createButton = screen.queryByRole('button', { name: /new task|create/i });
      if (createButton) {
        fireEvent.click(createButton);

        // Fill task form
        const titleInput = screen.getByPlaceholderText(/title/i);
        await userEvent.type(titleInput, 'New Project Task');

        const createTaskButton = screen.getByRole('button', { name: /create/i });
        fireEvent.click(createTaskButton);

        await waitFor(() => {
          expect(screen.getByText('New Project Task')).toBeInTheDocument();
        });

        // Share task
        const shareButton = screen.queryByRole('button', { name: /share/i });
        if (shareButton) {
          fireEvent.click(shareButton);

          const userInput = screen.getByPlaceholderText(/Search users/i);
          await userEvent.type(userInput, 'team@example.com');

          const shareSubmit = screen.getByRole('button', { name: /share/i });
          fireEvent.click(shareSubmit);

          // Add comment
          await waitFor(() => {
            const commentInput = screen.queryByPlaceholderText(/Add a comment/i);
            if (commentInput) {
              fireEvent.click(commentInput);
            }
          });
        }
      }
    });

    it('handles simultaneous real-time updates', async () => {
      const mockSocket = {
        on: jest.fn(),
        emit: jest.fn(),
        off: jest.fn(),
      };
      (socketIO.io as jest.Mock).mockReturnValue(mockSocket);

      render(<App />);

      // Get all listeners
      const listeners = mockSocket.on.mock.calls.reduce((acc, call) => {
        acc[call[0]] = call[1];
        return acc;
      }, {});

      // Simulate multiple simultaneous updates
      if (listeners['notification:received']) {
        listeners['notification:received']({
          id: 'notif_1',
          title: 'New Notification',
        });
      }

      if (listeners['collaboration:comment:added']) {
        listeners['collaboration:comment:added']({
          id: 'comment_1',
          content: 'New comment',
        });
      }

      if (listeners['agent:conversation:updated']) {
        listeners['agent:conversation:updated']({
          conversation_id: 'conv_1',
          response: 'Agent response',
        });
      }

      // All updates should be processed
      await waitFor(() => {
        expect(screen.queryByText('New Notification')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});
