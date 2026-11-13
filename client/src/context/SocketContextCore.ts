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

export interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  violationCount: number;
  recentAlerts: LiveViolationEvent[];
  lastSessionEvent: LiveSessionEvent | null;
  clearAlerts: () => void;
  markAlertRead: (id: string) => void;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  violationCount: 0,
  recentAlerts: [],
  lastSessionEvent: null,
  clearAlerts: () => {},
  markAlertRead: () => {},
});

