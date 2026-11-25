/* eslint-disable @typescript-eslint/no-explicit-any */
import Pusher, { type Channel } from 'pusher-js';
import type {
  ClientRealtimeAdapter,
  ConnectionState,
  EventCallback,
  RealtimeProviderName,
  UnsubscribeFn,
} from './types';

export interface PusherConfig {
  key: string;
  cluster: string;
  token?: string | null;
  authEndpoint?: string;
}

export class PusherClientAdapter implements ClientRealtimeAdapter {
  readonly provider: RealtimeProviderName = 'pusher';
  private pusher: Pusher | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private _latencyMs: number | null = null;
  private channelMap = new Map<string, Channel>();
  private connectionListeners = new Set<(state: ConnectionState) => void>();
  private reconnectListeners = new Set<() => void>();
  private wasConnected = false;

  constructor(private config: PusherConfig) {
    this.initPusher();
  }

  private initPusher() {
    if (!this.config.key) {
      console.warn('[PusherClientAdapter] Pusher key not set.');
      return;
    }

    this.pusher = new Pusher(this.config.key, {
      cluster: this.config.cluster || 'mt1',
      authEndpoint: this.config.authEndpoint || '/api/realtime/auth',
      auth: {
        headers: {
          Authorization: this.config.token ? `Bearer ${this.config.token}` : '',
        },
      },
    });

    this.pusher.connection.bind('state_change', (states: { current: string; previous: string }) => {
      let mapped: ConnectionState = 'disconnected';
      if (states.current === 'connected') {
        mapped = 'connected';
        if (this.wasConnected) {
          for (const cb of this.reconnectListeners) {
            try {
              cb();
            } catch (err) {
              console.error('[PusherClientAdapter] Reconnect listener error:', err);
            }
          }
        }
        this.wasConnected = true;
      } else if (states.current === 'connecting' || states.current === 'unavailable') {
        mapped = 'reconnecting';
      } else {
        mapped = 'disconnected';
      }

      this.setConnectionState(mapped);
    });
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
          console.error('[PusherClientAdapter] Listener error:', err);
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

  onReconnect(callback: () => void): UnsubscribeFn {
    this.reconnectListeners.add(callback);
    return () => {
      this.reconnectListeners.delete(callback);
    };
  }

  connect(): void {
    if (this.pusher) {
      this.pusher.connect();
    }
  }

  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
    }
    this.setConnectionState('disconnected');
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  subscribe<T = any>(channelName: string, event: string, handler: EventCallback<T>): UnsubscribeFn {
    if (!this.pusher) {
      console.warn('[PusherClientAdapter] Pusher instance not available for subscribe.');
      return () => {};
    }

    let channel = this.channelMap.get(channelName);
    if (!channel) {
      channel = this.pusher.subscribe(channelName);
      this.channelMap.set(channelName, channel);
    }

    channel.bind(event, handler as EventCallback<any>);

    return () => {
      if (channel) {
        channel.unbind(event, handler as EventCallback<any>);
      }
    };
  }
}
