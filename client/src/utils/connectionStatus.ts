export type SocketConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type ServiceHealthState = 'up' | 'down';

export interface ConnectionStatusInput {
  connectionState: SocketConnectionState;
  apiStatus: ServiceHealthState;
  dbStatus: ServiceHealthState;
  mysqlVersion?: string;
  latencyMs?: number | null;
}

export interface DerivedConnectionStatus {
  state: SocketConnectionState;
  dotColor: 'emerald' | 'amber' | 'rose';
  pulse: boolean;
  statusLabel: string;
  subLabel: string;
  isFullyOperational: boolean;
}

export function deriveConnectionStatus(input: ConnectionStatusInput): DerivedConnectionStatus {
  const { connectionState, apiStatus, dbStatus, mysqlVersion = '8.0', latencyMs } = input;

  let state: SocketConnectionState = connectionState;

  // If API or DB is down, sidebar status card derives disconnected state
  if (apiStatus === 'down' || dbStatus === 'down') {
    state = 'disconnected';
  }

  const dotColor: 'emerald' | 'amber' | 'rose' =
    state === 'connected' ? 'emerald' : state === 'reconnecting' ? 'amber' : 'rose';

  const pulse = state !== 'disconnected';

  const statusLabel =
    state === 'connected'
      ? 'CONNECTED'
      : state === 'reconnecting'
      ? 'RECONNECTING...'
      : 'DISCONNECTED';

  const latencyPart =
    state === 'connected' && typeof latencyMs === 'number' && latencyMs >= 0
      ? ` • ${latencyMs}ms`
      : '';

  const subLabel = `MySQL ${mysqlVersion} • WSS${latencyPart}`;

  const isFullyOperational =
    state === 'connected' && apiStatus === 'up' && dbStatus === 'up';

  return {
    state,
    dotColor,
    pulse,
    statusLabel,
    subLabel,
    isFullyOperational,
  };
}
