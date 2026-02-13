import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationCenter } from '../components/notifications/NotificationCenter';

describe('NotificationCenter', () => {
  it('renders notification center when open', () => {
    render(
      <NotificationCenter 
        isOpen={true} 
        onClose={jest.fn()} 
      />
    );
    
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <NotificationCenter 
        isOpen={false} 
        onClose={jest.fn()} 
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('displays filter buttons', () => {
    render(
      <NotificationCenter 
        isOpen={true} 
        onClose={jest.fn()} 
      />
    );
    
    expect(screen.getByText(/All/i)).toBeInTheDocument();
    expect(screen.getByText(/Unread/i)).toBeInTheDocument();
  });

  it('filters notifications by unread', async () => {
    const { rerender } = render(
      <NotificationCenter 
        isOpen={true} 
        onClose={jest.fn()} 
      />
    );
    
    const unreadButton = screen.getByText(/Unread/i);
    fireEvent.click(unreadButton);
    
    await waitFor(() => {
      expect(unreadButton.closest('button')).toHaveClass('bg-blue-500');
    });
  });

  it('calls onClose when close button clicked', () => {
    const onClose = jest.fn();
    render(
      <NotificationCenter 
        isOpen={true} 
        onClose={onClose} 
      />
    );
    
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });
});
