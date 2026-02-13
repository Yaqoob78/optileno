import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareDialog } from '../components/collaboration/ShareDialog';

describe('ShareDialog', () => {
  const mockTaskId = 'task_1';
  const mockOnShare = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders share dialog when open', () => {
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    expect(screen.getByText('Share Task')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ShareDialog 
        isOpen={false}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('displays user input field', () => {
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    expect(screen.getByPlaceholderText(/Search users/i)).toBeInTheDocument();
  });

  it('shows permission checkboxes', () => {
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    expect(screen.getByLabelText(/View/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Edit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Comment/i)).toBeInTheDocument();
  });

  it('calls onShare when sharing', async () => {
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    const userInput = screen.getByPlaceholderText(/Search users/i);
    fireEvent.change(userInput, { target: { value: 'user@example.com' } });
    
    const shareButton = screen.getByRole('button', { name: /share/i });
    fireEvent.click(shareButton);
    
    await waitFor(() => {
      expect(mockOnShare).toHaveBeenCalled();
    });
  });

  it('closes dialog on cancel', () => {
    const mockOnClose = jest.fn();
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={mockOnClose}
      />
    );
    
    const closeButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('allows toggling permissions', async () => {
    render(
      <ShareDialog 
        isOpen={true}
        taskId={mockTaskId}
        onShare={mockOnShare}
        onClose={jest.fn()}
      />
    );
    
    const editCheckbox = screen.getByLabelText(/Edit/i);
    fireEvent.click(editCheckbox);
    
    await waitFor(() => {
      expect(editCheckbox).toBeChecked();
    });
  });
});
