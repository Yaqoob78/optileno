// frontend/src/services/realtime/socket-client.ts
/**
 * Socket.IO client for real-time Concierge AI updates
 * Handles connection, authentication, and event subscriptions
 */

import { io, Socket } from 'socket.io-client';
import { env } from '../../config/env';

const SOCKET_URL = env.SOCKET_URL;

class RealtimeClient {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private connected: boolean = false;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Connect to socket server and authenticate
   */
  connect(userId: string, token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.userId = userId;

        this.socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          withCredentials: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        // Handle connection
        this.socket.on('connect', () => {
          console.log('✨ Socket connected:', this.socket?.id);
          this.connected = true;

          // Authenticate with user ID
          this.socket?.emit('authenticate', {
            user_id: userId,
            token,
          });
        });

        // Handle authentication
        this.socket.on('authenticated', (data) => {
          console.log('✅ Authenticated:', data);
          resolve();
        });

        // Handle errors
        this.socket.on('error', (error) => {
          console.error('❌ Socket error:', error);
          reject(error);
        });

        // Handle disconnection
        this.socket.on('disconnect', () => {
          console.log('👋 Socket disconnected');
          this.connected = false;
        });

        // Re-emit all received events
        this.socket.onAny((event: string, ...args: any[]) => {
          this.emit(event, ...args);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from socket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

// Export singleton instance
export const realtimeClient = new RealtimeClient();

// Export type for event data
export interface TaskEvent {
  event: string;
  task: any;
  timestamp: string;
}

export interface DeepWorkEvent {
  event: string;
  session: any;
  timestamp: string;
}

export interface AnalyticsEvent {
  event: string;
  metrics: any;
  timestamp: string;
}

export interface InsightEvent {
  event: string;
  insight: any;
  timestamp: string;
}

export interface NotificationEvent {
  event: string;
  notification: any;
  timestamp: string;
}

// Provide a backwards-compatible `socket` object used across the frontend.
// This proxy exposes common methods (`connect`, `disconnect`, `on`, `off`, `isConnected`, `getSocketId`)
// so existing imports of `{ socket }` continue to work.
export const socket = {
  connect: (userId?: string, token?: string) => realtimeClient.connect(userId || '', token),
  disconnect: () => realtimeClient.disconnect(),
  on: (event: string, cb: (data: any) => void) => realtimeClient.on(event, cb),
  off: (event: string, cb: Function) => realtimeClient.off(event, cb),
  isConnected: () => realtimeClient.isConnected(),
  getSocketId: () => realtimeClient.getSocketId(),
};
