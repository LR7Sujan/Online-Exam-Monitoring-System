/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from '../api';
import type {
  ClientRealtimeAdapter,
  ConnectionState,
  EventCallback,
  RealtimeProviderName,
  RealtimeServerEvent,
  UnsubscribeFn,
} from './types';

export class PollingRealtimeAdapter implements ClientRealtimeAdapter {
  readonly provider: RealtimeProviderName = 'polling';
  private _connectionState: ConnectionState = 'disconnected';
  private _latencyMs: number | null = null;
  private lastCursor = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private isDestroyed = false;
  private isPolling = false;
  private backoffMs = 2500;
  private readonly defaultPollInterval = 2500;

  // channel -> eventName -> Set of handlers
  private subscriptions = new Map<string, Map<string, Set<EventCallback<any>>>>();
  private connectionListeners = new Set<(state: ConnectionState) => void>();
  private resumeListeners = new Set<() => void>();

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get latencyMs(): number | null {
    return this._latencyMs;
  }

  private setConnectionState(newState: ConnectionState) {
    if (this._connectionState !== newState) {
      this._connectionState = newState;
      for (const listener of this.connectionListeners) {
        try {
          listener(newState);
        } catch (err) {
          console.error('[PollingAdapter] Error in connection listener:', err);
        }
      }
    }
  }

  onConnectionChange(callback: (state: ConnectionState) => void): UnsubscribeFn {
    this.connectionListeners.add(callback);
    callback(this._connectionState);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  onResume(callback: () => void): UnsubscribeFn {
    this.resumeListeners.add(callback);
    return () => {
      this.resumeListeners.delete(callback);
    };
  }

  private handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible') {
      // Tab became active: trigger immediate poll and notify resume listeners
      for (const cb of this.resumeListeners) {
        try {
          cb();
        } catch (err) {
          console.error('[PollingAdapter] Error in resume listener:', err);
        }
      }
      this.scheduleNextPoll(0);
    }
  }

  connect(): void {
    if (this.isDestroyed) return;
    if (this._connectionState === 'disconnected') {
      this.setConnectionState('reconnecting');
    }
    this.scheduleNextPoll(0);
  }

  disconnect(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.setConnectionState('disconnected');
  }

  reconnect(): void {
    this.disconnect();
    this.backoffMs = this.defaultPollInterval;
    this.connect();
  }

  destroy(): void {
    this.isDestroyed = true;
    this.disconnect();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.subscriptions.clear();
    this.connectionListeners.clear();
    this.resumeListeners.clear();
  }

  subscribe<T = any>(channel: string, event: string, handler: EventCallback<T>): UnsubscribeFn {
    let channelMap = this.subscriptions.get(channel);
    if (!channelMap) {
      channelMap = new Map();
      this.subscriptions.set(channel, channelMap);
    }

    let handlers = channelMap.get(event);
    if (!handlers) {
      handlers = new Set();
      channelMap.set(event, handlers);
    }

    handlers.add(handler as EventCallback<any>);

    // If we have active subscriptions, ensure connection is running
    if (this._connectionState === 'disconnected') {
      this.connect();
    }

    return () => {
      const cMap = this.subscriptions.get(channel);
      if (!cMap) return;
      const hSet = cMap.get(event);
      if (hSet) {
        hSet.delete(handler);
        if (hSet.size === 0) {
          cMap.delete(event);
        }
      }
      if (cMap.size === 0) {
        this.subscriptions.delete(channel);
      }
    };
  }

  private scheduleNextPoll(delayMs = this.backoffMs) {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    if (this.isDestroyed) return;

    this.pollTimer = setTimeout(() => {
      void this.executePoll();
    }, delayMs);
  }

  private async executePoll(): Promise<void> {
    if (this.isDestroyed || this.isPolling) return;

    // Pause when tab is not visible
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    // Determine subscribed channels
    const activeChannels = Array.from(this.subscriptions.keys());
    if (activeChannels.length === 0) {
      this.scheduleNextPoll(this.defaultPollInterval);
      return;
    }

    this.isPolling = true;
    const startMs = Date.now();

    try {
      const channelParam = activeChannels.join(',');
      const res = await api.get<{
        events: RealtimeServerEvent[];
        cursor: number;
        channels: string[];
      }>(`/events?since=${this.lastCursor}&channels=${encodeURIComponent(channelParam)}`);

      this._latencyMs = Math.max(1, Date.now() - startMs);
      this.setConnectionState('connected');
      this.backoffMs = this.defaultPollInterval;

      if (res?.cursor !== undefined) {
        this.lastCursor = res.cursor;
      }

      if (res?.events && Array.isArray(res.events)) {
        for (const item of res.events) {
          this.dispatchEvent(item);
        }
      }

      this.scheduleNextPoll(this.defaultPollInterval);
    } catch (err) {
      console.warn('[PollingAdapter] Polling request failed:', err);
      this.setConnectionState('reconnecting');
      // Exponential backoff up to 10s
      this.backoffMs = Math.min(10000, this.backoffMs * 1.5);
      this.scheduleNextPoll(this.backoffMs);
    } finally {
      this.isPolling = false;
    }
  }

  private dispatchEvent(eventItem: RealtimeServerEvent): void {
    const channelMap = this.subscriptions.get(eventItem.channel);
    if (!channelMap) return;

    // Specific event name handlers
    const handlers = channelMap.get(eventItem.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(eventItem.payload);
        } catch (err) {
          console.error(`[PollingAdapter] Error executing handler for ${eventItem.channel} : ${eventItem.type}:`, err);
        }
      }
    }

    // Wildcard '*' event handlers
    const wildcardHandlers = channelMap.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(eventItem.payload);
        } catch (err) {
          console.error(`[PollingAdapter] Error executing wildcard handler for ${eventItem.channel}:`, err);
        }
      }
    }
  }
}
