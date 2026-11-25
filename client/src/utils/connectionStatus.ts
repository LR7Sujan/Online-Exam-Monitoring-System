export type SocketConnectionState = 'connected' | 'reconnecting' | 'disconnected';
export type ServiceHealthState = 'up' | 'down';

export interface ConnectionStatusInput {
  connectionState: SocketConnectionState;
  apiStatus: ServiceHealthState;
  dbStatus: ServiceHealthState;
  transport?: 'websocket' | 'polling' | 'pusher';
  mysqlVersion?: string;
  latencyMs?: number | null;
}

export interface DerivedConnectionStatus {
  state: SocketConnectionState;
  dotColor: 'emerald' | 'amber' | 'rose';
  pulse: boolean;
  statusLabel: string;
  subLabel: string;
  diagnosticHint: string | null;
  isFullyOperational: boolean;
}

export function deriveConnectionStatus(input: ConnectionStatusInput): DerivedConnectionStatus {
  const {
    connectionState,
    apiStatus,
    dbStatus,
    transport = 'websocket',
    mysqlVersion = '8.0.46',
    latencyMs,
  } = input;

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

  // Plain-language diagnostic hint for down services
  let diagnosticHint: string | null = null;
  if (apiStatus === 'down') {
    diagnosticHint = 'API is not running: start it with npm run dev';
  } else if (dbStatus === 'down') {
    diagnosticHint = 'Database is down: start MySQL';
  } else if (state === 'disconnected') {
    diagnosticHint = 'Realtime stream disconnected: click Reconnect Now';
  }

  const transportLabel =
    transport === 'websocket' ? 'WSS' : transport === 'pusher' ? 'PUSHER' : 'POLL';

  const latencyPart =
    state === 'connected' && typeof latencyMs === 'number' && latencyMs >= 0
      ? ` • ${latencyMs}ms`
      : '';

  // Dynamic subLabel showing real MySQL version and active transport
  const subLabel =
    apiStatus === 'down'
      ? 'API Unreachable'
      : dbStatus === 'down'
      ? `MySQL ${mysqlVersion} • Down`
      : state === 'connected'
      ? `MySQL ${mysqlVersion} • ${transportLabel}${latencyPart}`
      : `MySQL ${mysqlVersion} • ${transportLabel}`;

  const isFullyOperational =
    state === 'connected' && apiStatus === 'up' && dbStatus === 'up';

  return {
    state,
    dotColor,
    pulse,
    statusLabel,
    subLabel,
    diagnosticHint,
    isFullyOperational,
  };
}
