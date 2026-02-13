import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentChat } from '../components/chat/AgentChat';

describe('AgentChat', () => {
  const mockTaskId = 'task_1';

  it('renders agent chat interface', () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    expect(screen.getByText(/Agent Chat/i)).toBeInTheDocument();
  });

  it('displays mode selector buttons', () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    expect(screen.getByRole('button', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /task/i })).toBeInTheDocument();
  });

  it('shows message input field', () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument();
  });

  it('allows switching agent modes', async () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    const planButton = screen.getByRole('button', { name: /plan/i });
    fireEvent.click(planButton);
    
    await waitFor(() => {
      expect(planButton).toHaveClass('active');
    });
  });

  it('sends message on submit', async () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    const input = screen.getByPlaceholderText(/Type your message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'What should I do?' } });
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('displays thinking indicator', async () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    const input = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(input, { target: { value: 'Analyze this task' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    await waitFor(() => {
      expect(screen.queryByText(/thinking/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('displays agent response messages', async () => {
    render(
      <AgentChat 
        taskId={mockTaskId} 
      />
    );
    
    const input = screen.getByPlaceholderText(/Type your message/i);
    fireEvent.change(input, { target: { value: 'Help me' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    
    await waitFor(() => {
      const messages = screen.queryAllByRole('article');
      expect(messages.length).toBeGreaterThan(0);
    });
  });
});
