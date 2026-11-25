import type { JwtUserPayload } from '../types/api.js';

export type RealtimeProviderName = 'pusher' | 'polling';

export interface ServerRealtimeAdapter {
  readonly name: RealtimeProviderName;
  publish(channel: string, event: string, payload: unknown): Promise<void>;
  authorizeChannel?(socketId: string, channel: string, user: JwtUserPayload): Promise<{ auth: string; channel_data?: string }>;
}

export interface StoredEventRow {
  event_id: number;
  channel: string;
  type: string;
  payload: string | Record<string, unknown>;
  created_at: Date | string;
}

export interface RealtimeEventPayload {
  eventId?: number;
  channel: string;
  type: string;
  payload: unknown;
  createdAt: string;
}
