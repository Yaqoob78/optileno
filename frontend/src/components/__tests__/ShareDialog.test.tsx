import { fireEvent, render, screen } from '@testing-library/react';

import { ShareDialog } from '../collaboration/ShareDialog';

describe('ShareDialog', () => {
  const mockTaskId = 'task_1';

  it('renders when open', () => {
    render(
      <ShareDialog
        isOpen={true}
        taskId={mockTaskId}
        onShare={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Share Task' })).toBeInTheDocument();
    expect(screen.getByText(/permissions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeDisabled();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ShareDialog
        isOpen={false}
        taskId={mockTaskId}
        onShare={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('closes on cancel', () => {
    const onClose = jest.fn();
    render(
      <ShareDialog
        isOpen={true}
        taskId={mockTaskId}
        onShare={jest.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
