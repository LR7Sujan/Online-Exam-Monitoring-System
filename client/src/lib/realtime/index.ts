import { PollingRealtimeAdapter } from './PollingAdapter';
import { PusherClientAdapter } from './PusherAdapter';
import type { ClientRealtimeAdapter, RealtimeProviderName } from './types';

export * from './types';
export * from './PollingAdapter';
export * from './PusherAdapter';

let adapterInstance: ClientRealtimeAdapter | null = null;
let currentTokenRef: string | null = null;

export function getRealtimeAdapter(token?: string | null): ClientRealtimeAdapter {
  const currentToken = token ?? null;

  // If token changed or cleared, reset existing adapter
  if (adapterInstance && currentToken !== currentTokenRef) {
    adapterInstance.disconnect();
    adapterInstance = null;
  }
  currentTokenRef = currentToken;

  if (adapterInstance) {
    return adapterInstance;
  }

  const providerEnv = (
    import.meta.env.VITE_REALTIME_PROVIDER || 'polling'
  ).toLowerCase() as RealtimeProviderName;

  const pusherKey = import.meta.env.VITE_PUSHER_KEY;
  const pusherCluster = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1';

  if (providerEnv === 'pusher' && pusherKey) {
    adapterInstance = new PusherClientAdapter({
      key: pusherKey,
      cluster: pusherCluster,
      token: currentToken,
    });
  } else {
    adapterInstance = new PollingRealtimeAdapter();
  }

  return adapterInstance;
}

export function resetRealtimeAdapter(): void {
  if (adapterInstance) {
    adapterInstance.disconnect();
    adapterInstance = null;
  }
  currentTokenRef = null;
}
