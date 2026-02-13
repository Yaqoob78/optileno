import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';

describe('AnalyticsDashboard', () => {
  it('renders dashboard title', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
  });

  it('displays time range selector', () => {
    render(<AnalyticsDashboard />);
    
    expect(screen.getByRole('button', { name: /week/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /year/i })).toBeInTheDocument();
  });

  it('allows changing time range', async () => {
    render(<AnalyticsDashboard />);
    
    const monthButton = screen.getByRole('button', { name: /month/i });
    fireEvent.click(monthButton);
    
    await waitFor(() => {
      expect(monthButton).toHaveClass('active');
    });
  });

  it('displays key metrics cards', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Tasks Completed/i)).toBeInTheDocument();
      expect(screen.getByText(/Avg Completion Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Collaboration Score/i)).toBeInTheDocument();
    });
  });

  it('shows chart containers', () => {
    render(<AnalyticsDashboard />);
    
    const chartElements = screen.getAllByRole('img');
    expect(chartElements.length).toBeGreaterThan(0);
  });

  it('displays forecast data', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Forecast/i)).toBeInTheDocument();
    });
  });

  it('shows performance tips section', async () => {
    render(<AnalyticsDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/Performance Tips/i)).toBeInTheDocument();
    });
  });
});
