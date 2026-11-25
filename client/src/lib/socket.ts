/* eslint-disable @typescript-eslint/no-explicit-any */
import { useAuthStore } from '../store/authStore';
import {
  getRealtimeAdapter,
  resetRealtimeAdapter,
  type ClientRealtimeAdapter,
  type EventCallback,
  type UnsubscribeFn,
} from './realtime';

export type SocketLike = {
  connected: boolean;
  on: <T = any>(event: string, handler: EventCallback<T>) => SocketLike;
  off: <T = any>(event: string, handler: EventCallback<T>) => SocketLike;
  emit: (event: string, ...args: unknown[]) => SocketLike;
  disconnect: () => void;
  connect: () => void;
  io?: {
    on: <T = any>(event: string, handler: EventCallback<T>) => void;
    off: <T = any>(event: string, handler: EventCallback<T>) => void;
  };
};

class RealtimeSocketBridge implements SocketLike {
  private joinedSessions = new Set<number>();
  private eventHandlers = new Map<string, Set<EventCallback<any>>>();
  private unsubs = new Map<string, UnsubscribeFn>();
  private connUnsub: UnsubscribeFn | null = null;

  io = {
    on: <T = any>(event: string, handler: EventCallback<T>) => {
      this.on(event, handler);
    },
    off: <T = any>(event: string, handler: EventCallback<T>) => {
      this.off(event, handler);
    },
  };

  constructor(private adapter: ClientRealtimeAdapter) {
    this.connUnsub = this.adapter.onConnectionChange((state) => {
      if (state === 'connected') {
        this.triggerLocal('connect');
      } else if (state === 'disconnected') {
        this.triggerLocal('disconnect');
      } else if (state === 'reconnecting') {
        this.triggerLocal('reconnecting');
      }
    });
  }

  get connected(): boolean {
    return this.adapter.connectionState === 'connected';
  }

  private triggerLocal(event: string, ...args: unknown[]) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(args[0]);
        } catch (err) {
          console.error(`[RealtimeSocketBridge] Handler error for '${event}':`, err);
        }
      }
    }
  }

  private resolveChannelsForUser(): string[] {
    const user = useAuthStore.getState().user;
    const channels: string[] = [];

    if (!user) return channels;

    if (user.role === 'PROCTOR' || user.role === 'ADMIN') {
      channels.push('private-role-proctor');
      if (user.role === 'ADMIN') {
        channels.push('private-role-admin');
      }
    }

    channels.push(`private-user-${user.id}`);

    for (const sId of this.joinedSessions) {
      channels.push(`private-session-${sId}`);
    }

    return channels;
  }

  private rebindSubscriptions() {
    // Clear old unsubs
    for (const unsub of this.unsubs.values()) {
      unsub();
    }
    this.unsubs.clear();

    const channels = this.resolveChannelsForUser();
    for (const [eventName, handlers] of this.eventHandlers.entries()) {
      // Skip internal connection events
      if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'reconnecting') {
        continue;
      }

      for (const ch of channels) {
        const subKey = `${ch}:${eventName}`;
        const unsub = this.adapter.subscribe(ch, eventName, (payload) => {
          for (const handler of handlers) {
            try {
              handler(payload);
            } catch (err) {
              console.error(`[RealtimeSocketBridge] Event handler failed for '${eventName}':`, err);
            }
          }
        });
        this.unsubs.set(subKey, unsub);
      }
    }
  }

  on<T = any>(event: string, handler: EventCallback<T>): this {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler as EventCallback<any>);

    // If already connected and listening for a connection event, invoke immediately
    if (event === 'connect' && this.connected) {
      setTimeout(() => (handler as EventCallback<any>)(undefined), 0);
    }

    this.rebindSubscriptions();
    return this;
  }

  off<T = any>(event: string, handler: EventCallback<T>): this {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventCallback<any>);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
    this.rebindSubscriptions();
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    if (event === 'session:join') {
      const sId = Number(args[0]);
      if (Number.isInteger(sId) && sId > 0) {
        this.joinedSessions.add(sId);
        this.rebindSubscriptions();
      }
    } else if (event === 'session:leave') {
      const sId = Number(args[0]);
      if (Number.isInteger(sId) && sId > 0) {
        this.joinedSessions.delete(sId);
        this.rebindSubscriptions();
      }
    } else if (event === 'ping:latency') {
      const clientTs = args[0];
      const callback = args[1];
      if (typeof callback === 'function') {
        const latency = this.adapter.latencyMs ?? 15;
        setTimeout(() => callback(clientTs), latency);
      }
    }
    return this;
  }

  connect(): void {
    this.adapter.connect();
  }

  disconnect(): void {
    for (const unsub of this.unsubs.values()) {
      unsub();
    }
    this.unsubs.clear();
    if (this.connUnsub) {
      this.connUnsub();
      this.connUnsub = null;
    }
    this.adapter.disconnect();
  }
}

let bridgeInstance: RealtimeSocketBridge | null = null;
let lastToken: string | null = null;

export function getSocket(token: string | null): SocketLike | null {
  if (!token) {
    if (bridgeInstance) {
      bridgeInstance.disconnect();
      bridgeInstance = null;
    }
    resetRealtimeAdapter();
    lastToken = null;
    return null;
  }

  if (bridgeInstance && token === lastToken) {
    return bridgeInstance;
  }

  lastToken = token;
  const adapter = getRealtimeAdapter(token);
  bridgeInstance = new RealtimeSocketBridge(adapter);
  return bridgeInstance;
}

export function reconnectSocket(): void {
  const token = useAuthStore.getState().token;
  if (token) {
    const s = getSocket(token);
    s?.connect();
  }
}

export function disconnectSocket(): void {
  if (bridgeInstance) {
    bridgeInstance.disconnect();
    bridgeInstance = null;
  }
  resetRealtimeAdapter();
  lastToken = null;
}
