import Pusher from 'pusher';
import type { RowDataPacket } from 'mysql2';
import { executeSql, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import type { JwtUserPayload } from '../types/api.js';
import type { ServerRealtimeAdapter, StoredEventRow } from './types.js';

let lastPurgeAt = 0;

/**
 * Sweeps events older than 10 minutes from the Events table.
 * Throttled to execute at most once per 60 seconds.
 */
export async function purgeOldEvents(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastPurgeAt < 60000) return;
  lastPurgeAt = now;

  try {
    await executeSql(
      'DELETE FROM Events WHERE created_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)'
    );
  } catch (err) {
    console.error('[PollingAdapter] Error purging expired events:', err);
  }
}

/**
 * Polling Adapter: Stores events in MySQL Events table for client long-polling.
 */
export class PollingRealtimeAdapter implements ServerRealtimeAdapter {
  readonly name = 'polling' as const;
  private static memEvents: Array<{
    event_id: number;
    channel: string;
    type: string;
    payload: unknown;
    created_at: Date;
  }> = [];
  private static memNextId = 1;

  async publish(channel: string, event: string, payload: unknown): Promise<void> {
    const jsonStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    try {
      await executeSql(
        'INSERT INTO Events (channel, type, payload) VALUES (?, ?, ?)',
        [channel, event, jsonStr]
      );
      void purgeOldEvents();
    } catch (err) {
      console.warn(`[PollingAdapter] Falling back to in-memory events buffer:`, err);
      PollingRealtimeAdapter.memEvents.push({
        event_id: PollingRealtimeAdapter.memNextId++,
        channel,
        type: event,
        payload,
        created_at: new Date(),
      });
    }
  }

  async getEvents(
    channels: string[],
    since: number,
    limit = 100
  ): Promise<{ events: { eventId: number; channel: string; type: string; payload: unknown; createdAt: string }[]; cursor: number }> {
    if (channels.length === 0) {
      return { events: [], cursor: since };
    }

    // Auto-clean expired records before reading
    void purgeOldEvents();

    try {
      const placeholders = channels.map(() => '?').join(', ');
      const rows = await queryRows<(StoredEventRow & RowDataPacket)[]>(
        `SELECT event_id, channel, type, payload, created_at
           FROM Events
          WHERE channel IN (${placeholders})
            AND event_id > ?
          ORDER BY event_id ASC
          LIMIT ?`,
        [...channels, since, limit]
      );

      let maxId = since;
      const formatted = rows.map((r) => {
        const id = Number(r.event_id);
        if (id > maxId) maxId = id;
        let parsedPayload = r.payload;
        if (typeof parsedPayload === 'string') {
          try {
            parsedPayload = JSON.parse(parsedPayload);
          } catch {
            // keep string if not json
          }
        }
        return {
          eventId: id,
          channel: r.channel,
          type: r.type,
          payload: parsedPayload,
          createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
        };
      });

      return { events: formatted, cursor: maxId };
    } catch {
      // In-memory fallback if database is not reachable
      const filtered = PollingRealtimeAdapter.memEvents
        .filter((e) => channels.includes(e.channel) && e.event_id > since)
        .slice(0, limit);

      let maxId = since;
      const formatted = filtered.map((r) => {
        if (r.event_id > maxId) maxId = r.event_id;
        return {
          eventId: r.event_id,
          channel: r.channel,
          type: r.type,
          payload: r.payload,
          createdAt: r.created_at.toISOString(),
        };
      });

      return { events: formatted, cursor: maxId };
    }
  }
}

/**
 * Pusher Adapter: Publishes via Pusher Channels REST API for serverless compatibility.
 */
export class PusherRealtimeAdapter implements ServerRealtimeAdapter {
  readonly name = 'pusher' as const;
  private pusherClient: Pusher | null = null;

  constructor() {
    if (env.PUSHER_APP_ID && env.PUSHER_KEY && env.PUSHER_SECRET) {
      this.pusherClient = new Pusher({
        appId: env.PUSHER_APP_ID,
        key: env.PUSHER_KEY,
        secret: env.PUSHER_SECRET,
        cluster: env.PUSHER_CLUSTER,
        useTLS: env.PUSHER_USE_TLS,
      });
    }
  }

  setPusherClient(client: Pusher | null): void {
    this.pusherClient = client;
  }

  getPusherClient(): Pusher | null {
    return this.pusherClient;
  }

  async publish(channel: string, event: string, payload: unknown): Promise<void> {
    if (!this.pusherClient) {
      console.warn(`[PusherAdapter] Pusher credentials not configured. Skipped publish to '${channel}': '${event}'`);
      return;
    }
    try {
      await this.pusherClient.trigger(channel, event, payload);
    } catch (err) {
      console.error(`[PusherAdapter] Failed to trigger event '${event}' on channel '${channel}':`, err);
    }
  }

  async authorizeChannel(
    socketId: string,
    channel: string,
    _user: JwtUserPayload
  ): Promise<{ auth: string; channel_data?: string }> {
    if (!this.pusherClient) {
      throw new Error('[PusherAdapter] Pusher client not configured on server.');
    }
    return this.pusherClient.authorizeChannel(socketId, channel);
  }
}

let activeAdapter: ServerRealtimeAdapter | null = null;

export function getRealtimeAdapter(): ServerRealtimeAdapter {
  if (activeAdapter) return activeAdapter;

  if (env.REALTIME_PROVIDER === 'pusher') {
    activeAdapter = new PusherRealtimeAdapter();
  } else {
    activeAdapter = new PollingRealtimeAdapter();
  }
  return activeAdapter;
}

export function setRealtimeAdapter(adapter: ServerRealtimeAdapter | null): void {
  activeAdapter = adapter;
}
