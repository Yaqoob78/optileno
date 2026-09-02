// frontend/src/services/realtime/socket-client.ts
/**
 * Socket.IO client for real-time Concierge AI updates.
 * Uses cookie-session auth first, token auth as optional fallback.
 */

import { io, Socket } from 'socket.io-client';
import { env } from '../../config/env';

const SOCKET_URL = env.SOCKET_URL;

class RealtimeClient {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private connected = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private connectingPromise: Promise<void> | null = null;

  private resetSocketState(): void {
    this.socket = null;
    this.connected = false;
    this.connectingPromise = null;
  }

  connect(userId: string, token?: string): Promise<void> {
    if (this.socket && this.connected && this.userId === userId) {
      return Promise.resolve();
    }

    if (this.connectingPromise && this.userId === userId) {
      return this.connectingPromise;
    }

    if (this.socket && !this.connected) {
      this.disconnect();
    }

    if (this.socket && this.userId !== userId) {
      this.disconnect();
    }

    this.connectingPromise = new Promise((resolve, reject) => {
      let settled = false;
      let authTimeout: number | null = null;

      const finishResolve = () => {
        if (settled) return;
        settled = true;
        if (authTimeout) {
          window.clearTimeout(authTimeout);
        }
        this.connectingPromise = null;
        resolve();
      };

      const finishReject = (error: any) => {
        if (settled) return;
        settled = true;
        if (authTimeout) {
          window.clearTimeout(authTimeout);
        }
        this.connectingPromise = null;
        reject(error);
      };

      try {
        this.userId = userId;

        this.socket = io(SOCKET_URL, {
          path: '/socket.io',
          transports: ['polling', 'websocket'],
          upgrade: true,
          autoConnect: true,
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          timeout: 5000,
        });

        authTimeout = window.setTimeout(() => {
          // Cookie-auth sessions may connect without explicit authenticated event.
          finishResolve();
        }, 3000);

        this.socket.on('connect', () => {
          this.connected = true;
          if (token) {
            this.socket?.emit('authenticate', { user_id: userId, token });
          } else {
            finishResolve();
          }
        });

        this.socket.on('authenticated', () => {
          if (authTimeout !== null) {
            window.clearTimeout(authTimeout);
          }
          finishResolve();
        });

        this.socket.on('error', (_error) => {
          // Non-fatal; continue with REST API fallbacks
          if (authTimeout !== null) {
            window.clearTimeout(authTimeout);
          }
          finishResolve();
        });

        this.socket.on('connect_error', (_error) => {
          // Graceful fallback to REST polling without repeating broken WebSocket handshakes
          if (authTimeout !== null) {
            window.clearTimeout(authTimeout);
          }
          this.socket?.disconnect();
          finishResolve();
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
          this.connectingPromise = null;
        });

        this.socket.onAny((event: string, ...args: any[]) => {
          this.emit(event, ...args);
        });
      } catch (error) {
        this.resetSocketState();
        finishReject(error);
      }
    });

    return this.connectingPromise;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.resetSocketState();
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback?: Function): void {
    if (!callback) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    callbacks.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in listener for ${event}:`, error);
      }
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export const realtimeClient = new RealtimeClient();

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

export const socket = {
  connect: (userId?: string, token?: string) => realtimeClient.connect(userId || '', token),
  disconnect: () => realtimeClient.disconnect(),
  on: (event: string, cb: (data: any) => void) => realtimeClient.on(event, cb),
  off: (event: string, cb?: Function) => realtimeClient.off(event, cb),
  isConnected: () => realtimeClient.isConnected(),
  getSocketId: () => realtimeClient.getSocketId(),
};
