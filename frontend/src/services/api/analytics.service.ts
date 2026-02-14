import api from './client';
import { AppEvent, UserMetrics, AnalyticsEvent } from '../../types/events.types';

// Endpoints are relative to the client's baseURL (which already includes /api/v1)
const ENDPOINTS = {
  ANALYTICS: '/analytics',
  EVENTS: '/analytics/events',
  METRICS: '/analytics/metrics',
  INSIGHTS: '/analytics/insights',
  PREDICTIONS: '/analytics/predictions',
  SYNC: '/analytics/sync',
};

export interface BackendAnalyticsResponse {
  events: AppEvent[];
  insights: AnalyticsEvent[];
  predictions: Array<{
    type: string;
    confidence: number;
    description: string;
    timeframe: string;
  }>;
  recommendations: Array<{
    priority: 'low' | 'medium' | 'high';
    action: string;
    reason: string;
    impact: number;
  }>;
}

export interface SyncPayload {
  events: AppEvent[];
  metrics: UserMetrics[];
  insights: AnalyticsEvent[];
  timestamp: Date;
  userId?: string;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private isOnline: boolean = navigator.onLine;
  private offlineQueue: AppEvent[] = [];

  private constructor() {
    // Setup online/offline detection
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // ====================
  // EVENT SUBMISSION
  // ====================

  async submitEvent(event: AppEvent): Promise<void> {
    if (!this.isOnline) {
      this.offlineQueue.push(event);
      console.log('Event queued offline:', event.type);
      return;
    }

    try {
      // Backend expects: { event: string, source: string, metadata: dict }
      await api.post(ENDPOINTS.EVENTS, {
        event: event.type || 'unknown',
        source: event.source || 'frontend',
        metadata: {
          ...event.metadata,
          original_event: event,
          timestamp: new Date().toISOString(),
        }
      });

      console.log('Event submitted:', event.type);
    } catch (error) {
      console.error('Failed to submit event:', error);
      this.offlineQueue.push(event);
    }
  }

  async submitEvents(events: AppEvent[]): Promise<void> {
    if (!this.isOnline) {
      this.offlineQueue.push(...events);
      console.log(`${events.length} events queued offline`);
      return;
    }

    try {
      await api.post(ENDPOINTS.EVENTS + '/batch', {
        events,
        timestamp: new Date().toISOString(),
      });

      console.log(`${events.length} events submitted`);
    } catch (error) {
      console.error('Failed to submit events:', error);
      this.offlineQueue.push(...events);
    }
  }

  // ====================
  // SYNC DATA
  // ====================

  async syncData(payload: SyncPayload): Promise<BackendAnalyticsResponse> {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const response = await api.post<BackendAnalyticsResponse>(ENDPOINTS.SYNC, payload);

      if (!response.success || !response.data) {
        throw new Error(`Sync failed: ${response.error?.message || 'Unknown error'}`);
      }

      const data = response.data;

      // Process any queued events
      if (this.offlineQueue.length > 0) {
        await this.submitEvents(this.offlineQueue);
        this.offlineQueue = [];
      }

      return data;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  }

  // ====================
  // GET ANALYTICS
  // ====================

  async getMetrics(timeRange: { start: Date; end: Date }): Promise<UserMetrics[]> {
    try {
      const response = await api.get<UserMetrics[]>(
        `${ENDPOINTS.METRICS}?start=${timeRange.start.toISOString()}&end=${timeRange.end.toISOString()}`
      );

      if (!response.success || !response.data) {
        throw new Error(`Failed to get metrics: ${response.error?.message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get metrics:', error);
      return [];
    }
  }

  async getInsights(limit: number = 10): Promise<AnalyticsEvent[]> {
    try {
      const response = await api.get<AnalyticsEvent[]>(`${ENDPOINTS.INSIGHTS}?limit=${limit}`);

      if (!response.success || !response.data) {
        throw new Error(`Failed to get insights: ${response.error?.message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get insights:', error);
      return [];
    }
  }

  async getPredictions(): Promise<BackendAnalyticsResponse['predictions']> {
    try {
      const response = await api.get<BackendAnalyticsResponse['predictions']>(ENDPOINTS.PREDICTIONS);

      if (!response.success || !response.data) {
        throw new Error(`Failed to get predictions: ${response.error?.message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get predictions:', error);
      return [];
    }
  }

  // ====================
  // PATTERN ANALYSIS
  // ====================

  async analyzePatterns(events: AppEvent[]): Promise<AnalyticsEvent[]> {
    try {
      const response = await api.post<AnalyticsEvent[]>(ENDPOINTS.ANALYTICS + '/patterns', { events });

      if (!response.success || !response.data) {
        throw new Error(`Pattern analysis failed: ${response.error?.message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      console.error('Pattern analysis failed:', error);
      return [];
    }
  }

  async getRecommendations(): Promise<BackendAnalyticsResponse['recommendations']> {
    try {
      const response = await api.get<BackendAnalyticsResponse['recommendations']>(ENDPOINTS.ANALYTICS + '/recommendations');

      if (!response.success || !response.data) {
        throw new Error(`Failed to get recommendations: ${response.error?.message || 'Unknown error'}`);
      }

      return response.data;
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      return [];
    }
  }

  // ====================
  // OFFLINE HANDLING
  // ====================

  private handleOnline(): void {
    this.isOnline = true;
    console.log('Back online, processing queued events...');

    // Try to sync queued events
    if (this.offlineQueue.length > 0) {
      this.submitEvents(this.offlineQueue)
        .then(() => {
          console.log('Offline queue processed successfully');
          this.offlineQueue = [];
        })
        .catch((error) => {
          console.error('Failed to process offline queue:', error);
        });
    }
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log('Offline, events will be queued');
  }

  // ====================
  // UTILITY METHODS
  // ====================

  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  isConnected(): boolean {
    return this.isOnline;
  }

  // ====================
  // USER FEEDBACK
  // ====================

  async submitFeedback(
    insightId: string,
    feedback: 'helpful' | 'not_helpful' | 'irrelevant',
    comment?: string
  ): Promise<void> {
    try {
      await api.post(ENDPOINTS.ANALYTICS + '/feedback', {
        insightId,
        feedback,
        comment,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }

  async dismissInsight(insightId: string): Promise<void> {
    try {
      await api.post(`${ENDPOINTS.INSIGHTS}/${insightId}/dismiss`);
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();
