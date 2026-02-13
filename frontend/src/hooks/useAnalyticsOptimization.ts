import { useState, useEffect, useCallback, useRef } from 'react';
import { useAnalyticsStore } from '../stores/analytics.store';

interface OptimizationOptions {
  enableCaching?: boolean;
  cacheTimeout?: number;
  batchSize?: number;
  enableLazyLoading?: boolean;
}

interface AnalyticsMetrics {
  productivity: number;
  focus: number;
  burnoutRisk: number;
  lastUpdated: string;
}

/**
 * Optimized hook for analytics data with caching and performance improvements
 */
export function useAnalyticsOptimization(options: OptimizationOptions = {}) {
  const {
    enableCaching = true,
    cacheTimeout = 60000, // 1 minute
    batchSize = 50,
    enableLazyLoading = true
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const loadingRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const { fetchAnalytics, fetchHistoricalAnalytics, currentMetrics } = useAnalyticsStore();

  // Cache management
  const getCachedData = useCallback((key: string) => {
    if (!enableCaching) return null;
    
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      cacheRef.current.delete(key);
    }
    
    return null;
  }, [enableCaching, cacheTimeout]);

  const setCachedData = useCallback((key: string, data: any) => {
    if (!enableCaching) return;
    
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (cacheRef.current.size > 100) {
      const oldestKey = cacheRef.current.keys().next().value;
      if (oldestKey) {
        cacheRef.current.delete(oldestKey);
      }
    }
  }, [enableCaching]);

  // Optimized data fetching with cancellation
  const fetchOptimizedData = useCallback(async (
    key: string,
    fetchFunction: () => Promise<any>
  ) => {
    // Check cache first
    const cached = getCachedData(key);
    if (cached) {
      return cached;
    }

    // Prevent duplicate requests
    if (loadingRef.current.has(key)) {
      return new Promise((resolve) => {
        const checkLoading = () => {
          if (!loadingRef.current.has(key)) {
            const data = getCachedData(key);
            resolve(data);
          } else {
            setTimeout(checkLoading, 100);
          }
        };
        checkLoading();
      });
    }

    // Cancel previous request for this key
    const currentController = abortControllerRef.current;
    if (currentController) {
      currentController.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    loadingRef.current.add(key);
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchFunction();
      
      if (!abortController.signal.aborted) {
        setCachedData(key, data);
        return data;
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        throw err;
      }
    } finally {
      loadingRef.current.delete(key);
      if (loadingRef.current.size === 0) {
        setIsLoading(false);
      }
    }

    return null;
  }, [getCachedData, setCachedData]);

  // Memoized analytics fetch
  const fetchAnalyticsData = useCallback(async (timeRange?: string) => {
    const key = `analytics_${timeRange || 'default'}`;
    
    return fetchOptimizedData(key, async () => {
      if (timeRange) {
        await fetchHistoricalAnalytics(timeRange as any);
      } else {
        await fetchAnalytics();
      }
      
      return {
        productivity: currentMetrics.productivityScore || 0,
        focus: currentMetrics.focusScore || 0,
        burnoutRisk: currentMetrics.burnoutRisk || 0,
        lastUpdated: currentMetrics.lastUpdated || new Date().toISOString()
      };
    });
  }, [fetchOptimizedData, fetchAnalytics, fetchHistoricalAnalytics, currentMetrics]);

  // Batch processing for large datasets
  const processBatch = useCallback(async <T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    size: number = batchSize
  ): Promise<R[]> => {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += size) {
      const batch = items.slice(i, i + size);
      const batchResults = await processor(batch);
      results.push(...batchResults);
      
      // Allow UI to breathe between batches
      if (i + size < items.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    
    return results;
  }, [batchSize]);

  // Lazy loading component
  const LazyComponent = useCallback(({ children, fallback = null }: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) => {
    if (!enableLazyLoading) {
      return <>{children}</>;
    }

    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      if (elementRef.current) {
        observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
    }, []);

    return (
      <div ref={elementRef}>
        {isVisible ? children : fallback}
      </div>
    );
  }, [enableLazyLoading]);

  // Performance monitoring
  const measurePerformance = useCallback((name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    
    const end = () => {
      const duration = performance.now() - start;
      
      // Log performance metrics in development
      if (import.meta.env.DEV) {
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      }
      
      // Send to monitoring service in production
      if (import.meta.env.PROD && duration > 1000) {
        // TODO: Send to monitoring service
      }
    };

    const result = fn();
    
    if (result instanceof Promise) {
      return result.then(end).catch(end);
    } else {
      end();
      return result;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      const currentController = abortControllerRef.current;
      if (currentController) {
        currentController.abort();
      }
    };
  }, []);

  return {
    isLoading,
    error,
    metrics,
    fetchAnalyticsData,
    processBatch,
    LazyComponent,
    measurePerformance,
    clearCache: useCallback(() => {
      cacheRef.current.clear();
    }, []),
    getCacheSize: useCallback(() => cacheRef.current.size, [])
  };
}

/**
 * Hook for optimizing real-time updates
 */
export function useRealtimeOptimization() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const updateQueueRef = useRef<Set<Function>>(new Set());
  const rafIdRef = useRef<number | null>(null);

  // Batch updates using requestAnimationFrame
  const batchUpdate = useCallback((updateFn: Function) => {
    updateQueueRef.current.add(updateFn);
    
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        const updates = Array.from(updateQueueRef.current);
        updateQueueRef.current.clear();
        
        updates.forEach(fn => fn());
        rafIdRef.current = null;
      });
    }
  }, []);

  // Debounced updates
  const debouncedUpdate = useCallback((
    fn: Function,
    delay: number = 300
  ) => {
    let timeoutId: number;
    
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    };
  }, []);

  return {
    isConnected,
    setIsConnected,
    lastUpdate,
    setLastUpdate,
    batchUpdate,
    debouncedUpdate
  };
}
