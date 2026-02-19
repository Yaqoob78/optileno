import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { api } from '../../services/api/client';
import { CommentThread } from '../collaboration/CommentThread';

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
      data: { comments: [] },
    })),
    post: jest.fn(async () => ({
      success: true,
      data: {
        id: 'comment_1',
        author: 'Test User',
        content: 'Test comment',
        created_at: new Date().toISOString(),
        replies: [],
      },
    })),
    delete: jest.fn(async () => ({ success: true })),
  },
}));

describe('CommentThread', () => {
  it('renders comment thread and empty state', async () => {
    render(<CommentThread taskId="task_1" />);

    expect(screen.getByText('Comments')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('submits a comment', async () => {
    render(<CommentThread taskId="task_1" />);

    const input = await screen.findByPlaceholderText(/add a comment/i);
    fireEvent.change(input, { target: { value: 'Test comment' } });
    fireEvent.click(screen.getByRole('button', { name: /comment/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tasks/task_1/comments', {
        content: 'Test comment',
        parent_comment_id: null,
      });
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });
});
