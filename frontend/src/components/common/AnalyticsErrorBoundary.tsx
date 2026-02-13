import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AnalyticsErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface AnalyticsErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

class AnalyticsErrorBoundary extends React.Component<AnalyticsErrorBoundaryProps, AnalyticsErrorBoundaryState> {
  constructor(props: AnalyticsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): AnalyticsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error to monitoring service in production
    if (import.meta.env.PROD) {
      // TODO: Send to monitoring service
      console.error('Analytics Error Boundary caught an error:', error, errorInfo);
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultAnalyticsErrorFallback;
      return <FallbackComponent error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

function DefaultAnalyticsErrorFallback({ error, retry }: { error?: Error; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="text-center max-w-[500px]">
        <div className="mb-4">
          <AlertTriangle size={48} className="text-red-500 mx-auto" />
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Analytics Temporarily Unavailable</h3>
          <p className="text-gray-600 leading-relaxed">
            We're having trouble loading your analytics data. This might be due to a temporary connection issue.
          </p>
          {import.meta.env.DEV && error && (
            <details className="text-left bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 text-sm text-red-600 overflow-x-auto whitespace-pre-wrap">
                {error.stack}
              </pre>
            </details>
          )}
          <button 
            onClick={retry} 
            className="inline-flex items-center gap-2 bg-blue-600 text-white border-none px-6 py-3 rounded-lg font-medium cursor-pointer transition-colors hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsErrorBoundary;
