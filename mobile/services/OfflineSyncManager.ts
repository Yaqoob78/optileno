// mobile/services/OfflineSyncManager.ts
/**
 * Offline Sync Manager
 * Queues operations when offline and syncs when connection restored
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineSyncManagerClass {
  private syncQueue: QueuedOperation[] = [];
  private isSyncing = false;
  private periodicSyncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<(data?: any) => void>> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly QUEUE_STORAGE_KEY = '@concierge_sync_queue';

  constructor() {
    this.loadQueueFromStorage();
  }

  /**
   * Load sync queue from persistent storage
   */
  private async loadQueueFromStorage() {
    try {
      const stored = await AsyncStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading sync queue:', error);
    }
  }

  /**
   * Save sync queue to persistent storage
   */
  private async saveQueueToStorage() {
    try {
      await AsyncStorage.setItem(
        this.QUEUE_STORAGE_KEY,
        JSON.stringify(this.syncQueue)
      );
    } catch (error) {
      console.error('Error saving sync queue:', error);
    }
  }

  /**
   * Queue an operation for offline
   */
  queueOperation(
    type: 'create' | 'update' | 'delete',
    resource: string,
    data: any
  ) {
    const operation: QueuedOperation = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      resource,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(operation);
    this.saveQueueToStorage();
    this.emit('queue-updated', this.syncQueue);
  }

  /**
   * Sync queued operations with server
   */
  async sync() {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;
    this.emit('sync-start');

    const token = await AsyncStorage.getItem('@concierge_token');
    const failedOps: QueuedOperation[] = [];

    for (const operation of this.syncQueue) {
      try {
        const method = operation.type === 'delete' ? 'DELETE' : operation.type === 'create' ? 'POST' : 'PUT';
        const url = `${API_BASE_URL}/api/v1/${operation.resource}`;

        await axios({
          method,
          url,
          data: operation.data,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Remove from queue after successful sync
        this.syncQueue = this.syncQueue.filter((op) => op.id !== operation.id);
      } catch (error) {
        operation.retries++;
        if (operation.retries < this.MAX_RETRIES) {
          failedOps.push(operation);
        } else {
          console.error(`Failed to sync operation ${operation.id} after ${this.MAX_RETRIES} retries`);
        }
      }
    }

    // Keep only failed operations for retry
    this.syncQueue = failedOps;
    await this.saveQueueToStorage();

    this.isSyncing = false;
    this.emit('sync-complete', { failed: failedOps.length });
  }

  /**
   * Start periodic syncing
   */
  startPeriodicSync(intervalMs: number) {
    this.stopPeriodicSync();
    this.periodicSyncInterval = setInterval(() => {
      this.sync();
    }, intervalMs);
  }

  /**
   * Stop periodic syncing
   */
  stopPeriodicSync() {
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval);
      this.periodicSyncInterval = null;
    }
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedOperation[] {
    return [...this.syncQueue];
  }

  /**
   * Clear entire queue
   */
  async clearQueue() {
    this.syncQueue = [];
    await this.saveQueueToStorage();
  }

  /**
   * Subscribe to sync manager events
   */
  on(event: string, callback: (data?: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from sync manager events
   */
  off(event: string, callback: (data?: any) => void) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: string, data?: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }
}

export const OfflineSyncManager = new OfflineSyncManagerClass();
