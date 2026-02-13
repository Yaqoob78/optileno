// mobile/services/RealtimeService.ts
/**
 * Real-time Socket.IO Service for Mobile
 * Manages WebSocket connections with offline fallback
 */

import io, { Socket } from 'react-native-socket.io-client';
import { useStorageStore } from '../stores/useStorageStore';
import { API_BASE_URL } from '../config/api';

interface SocketEvent {
  event: string;
  callback: (data: any) => void;
}

class RealtimeServiceClass {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;

  /**
   * Connect to real-time server
   */
  async connect() {
    if (this.socket?.connected) return;
    if (this.isConnecting) return;

    this.isConnecting = true;

    try {
      const token = await useStorageStore.getState().getToken();

      this.socket = io(API_BASE_URL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'], // Fallback to polling if WS fails
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      // Setup event handlers
      this.socket.on('connect', () => {
        this.reconnectAttempts = 0;
        this.emit('connected');
      });

      this.socket.on('disconnect', () => {
        this.emit('disconnected');
      });

      this.socket.on('error', (error: any) => {
        this.emit('error', error);
      });

      // Subscribe to all real-time events
      this.setupEventListeners();

      this.isConnecting = false;
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  /**
   * Setup real-time event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // Task events
    this.socket.on('task:created', (data: any) => this.emit('task:created', data));
    this.socket.on('task:updated', (data: any) => this.emit('task:updated', data));
    this.socket.on('task:completed', (data: any) => this.emit('task:completed', data));
    this.socket.on('task:deleted', (data: any) => this.emit('task:deleted', data));

    // Deep work events
    this.socket.on('deep-work:started', (data: any) => this.emit('deep-work:started', data));
    this.socket.on('deep-work:completed', (data: any) => this.emit('deep-work:completed', data));
    this.socket.on('deep-work:paused', (data: any) => this.emit('deep-work:paused', data));

    // Analytics events
    this.socket.on('analytics:updated', (data: any) => this.emit('analytics:updated', data));
    this.socket.on('forecast:available', (data: any) => this.emit('forecast:available', data));

    // Chat events
    this.socket.on('chat:message', (data: any) => this.emit('chat:message', data));
    this.socket.on('chat:typing', (data: any) => this.emit('chat:typing', data));

    // Notification events
    this.socket.on('notification:received', (data: any) => this.emit('notification:received', data));
    this.socket.on('notification:achievement', (data: any) => this.emit('notification:achievement', data));

    // Collaboration events
    this.socket.on('collaboration:shared', (data: any) => this.emit('collaboration:shared', data));
    this.socket.on('collaboration:comment', (data: any) => this.emit('collaboration:comment', data));
    this.socket.on('collaboration:editing', (data: any) => this.emit('collaboration:editing', data));
  }

  /**
   * Disconnect from real-time server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: (data: any) => void) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  /**
   * Emit a local event
   */
  private emitLocal(event: string, data?: any) {
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

  /**
   * Emit an event to the server
   */
  emitToServer(event: string, data?: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Internal emit for local listeners
   */
  private emit(event: string, data?: any) {
    this.emitLocal(event, data);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const RealtimeService = new RealtimeServiceClass();
