/* eslint-disable @typescript-eslint/no-explicit-any */
export type RealtimeProviderName = 'pusher' | 'polling';
export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type EventCallback<T = any> = (payload: T) => void | Promise<void>;
export type UnsubscribeFn = () => void;

export interface RealtimeServerEvent {
  eventId?: number;
  channel: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface ClientRealtimeAdapter {
  readonly provider: RealtimeProviderName;
  readonly connectionState: ConnectionState;
  readonly latencyMs: number | null;
  subscribe<T = any>(channel: string, event: string, handler: EventCallback<T>): UnsubscribeFn;
  onConnectionChange(callback: (state: ConnectionState) => void): UnsubscribeFn;
  connect(): void;
  disconnect(): void;
  reconnect(): void;
}
