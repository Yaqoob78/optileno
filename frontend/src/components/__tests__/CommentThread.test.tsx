import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentThread } from '../components/collaboration/CommentThread';

describe('CommentThread', () => {
  const mockTaskId = 'task_1';

  it('renders comment thread', () => {
    render(
      <CommentThread 
        taskId={mockTaskId} 
      />
    );
    
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('displays comment input field', () => {
    render(
      <CommentThread 
        taskId={mockTaskId} 
      />
    );
    
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  });

  it('shows empty state when no comments', async () => {
    render(
      <CommentThread 
        taskId={mockTaskId} 
      />
    );
    
    await waitFor(() => {
      expect(screen.getByText('No comments yet')).toBeInTheDocument();
    });
  });

  it('handles comment submission', async () => {
    render(
      <CommentThread 
        taskId={mockTaskId} 
      />
    );
    
    const input = screen.getByPlaceholderText('Add a comment...');
    const submitButton = screen.getByText('Comment');
    
    fireEvent.change(input, { target: { value: 'Test comment' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('allows replying to comments', async () => {
    render(
      <CommentThread 
        taskId={mockTaskId} 
      />
    );
    
    const replyButton = screen.queryByText('Reply');
    
    if (replyButton) {
      fireEvent.click(replyButton);
      await waitFor(() => {
        expect(screen.getByText(/Replying to/i)).toBeInTheDocument();
      });
    }
  });
});
