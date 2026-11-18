import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

export interface LiveViolationEvent {
  id: string;
  logId?: number;
  sessionId: number;
  studentName?: string;
  examTitle?: string;
  violationCode: string;
  violationLabel?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  penaltyApplied?: number;
  newTrustScore?: number;
  sessionStatus?: string;
  occurredAt: string;
}

export interface LiveSessionEvent {
  sessionId: number;
  studentId?: number;
  studentName?: string;
  status: string;
  trustScore?: number;
  percentage?: number | string;
  timestamp: string;
}

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

export interface SocketContextValue {
  socket: Socket | null;
  connectionState: ConnectionState;
  isConnected: boolean;
  latencyMs: number | null;
  transport: string;
  lastConnectedAt: Date | null;
  apiStatus: 'up' | 'down';
  dbStatus: 'up' | 'down';
  mysqlVersion: string;
  reconnectNow: () => void;
  violationCount: number;
  recentAlerts: LiveViolationEvent[];
  lastSessionEvent: LiveSessionEvent | null;
  clearAlerts: () => void;
  markAlertRead: (id: string) => void;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connectionState: 'disconnected',
  isConnected: false,
  latencyMs: null,
  transport: 'websocket',
  lastConnectedAt: null,
  apiStatus: 'down',
  dbStatus: 'down',
  mysqlVersion: '8.0',
  reconnectNow: () => {},
  violationCount: 0,
  recentAlerts: [],
  lastSessionEvent: null,
  clearAlerts: () => {},
  markAlertRead: () => {},
});
