import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import {
  SocketContext,
  type LiveViolationEvent,
  type LiveSessionEvent,
} from './SocketContextCore';

export type { LiveViolationEvent, LiveSessionEvent };

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [violationCount, setViolationCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<LiveViolationEvent[]>([]);
  const [lastSessionEvent, setLastSessionEvent] = useState<LiveSessionEvent | null>(null);

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const s = getSocket(token);
    setSocket(s);

    if (!s) return;

    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onViolation = (data: Record<string, unknown>) => {
      const alert: LiveViolationEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        logId: typeof data.logId === 'number' ? data.logId : undefined,
        sessionId: Number(data.sessionId ?? 0),
        studentName: typeof data.studentName === 'string' ? data.studentName : undefined,
        examTitle: typeof data.examTitle === 'string' ? data.examTitle : undefined,
        violationCode: String(data.violationCode ?? data.code ?? 'UNKNOWN'),
        violationLabel: typeof data.violationLabel === 'string' ? data.violationLabel : undefined,
        severity: (data.severity as LiveViolationEvent['severity']) ?? 'MEDIUM',
        penaltyApplied: typeof data.penaltyApplied === 'number' ? data.penaltyApplied : undefined,
        newTrustScore: typeof data.newTrustScore === 'number' ? data.newTrustScore : undefined,
        sessionStatus: typeof data.sessionStatus === 'string' ? data.sessionStatus : undefined,
        occurredAt: String(data.occurredAt ?? new Date().toISOString()),
      };

      setViolationCount((c) => c + 1);
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 19)]);
    };

    const onSessionUpdate = (data: Record<string, unknown>) => {
      setLastSessionEvent({
        sessionId: Number(data.sessionId ?? 0),
        studentId: typeof data.studentId === 'number' ? data.studentId : undefined,
        studentName: typeof data.studentName === 'string' ? data.studentName : undefined,
        status: String(data.status ?? 'UPDATED'),
        trustScore: typeof data.trustScore === 'number' ? data.trustScore : undefined,
        timestamp: new Date().toISOString(),
      });
    };

    const onSessionTerminated = (data: Record<string, unknown>) => {
      setLastSessionEvent({
        sessionId: Number(data.sessionId ?? 0),
        studentId: typeof data.studentId === 'number' ? data.studentId : undefined,
        studentName: typeof data.studentName === 'string' ? data.studentName : undefined,
        status: 'TERMINATED_CHEATING',
        trustScore: typeof data.trustScore === 'number' ? data.trustScore : 0,
        timestamp: new Date().toISOString(),
      });
      setViolationCount((c) => c + 1);
    };

    const onExamSubmitted = (data: Record<string, unknown>) => {
      setLastSessionEvent({
        sessionId: Number(data.sessionId ?? 0),
        studentId: typeof data.studentId === 'number' ? data.studentId : undefined,
        studentName: typeof data.studentName === 'string' ? data.studentName : undefined,
        status: 'SUBMITTED',
        percentage:
          typeof data.percentage === 'number' || typeof data.percentage === 'string'
            ? data.percentage
            : undefined,
        timestamp: new Date().toISOString(),
      });
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('violation:new', onViolation);
    s.on('session:update', onSessionUpdate);
    s.on('session:terminated', onSessionTerminated);
    s.on('exam:submitted', onExamSubmitted);

    if (s.connected) {
      setIsConnected(true);
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('violation:new', onViolation);
      s.off('session:update', onSessionUpdate);
      s.off('session:terminated', onSessionTerminated);
      s.off('exam:submitted', onExamSubmitted);
    };
  }, [token, user]);

  const clearAlerts = useCallback(() => {
    setViolationCount(0);
    setRecentAlerts([]);
  }, []);

  const markAlertRead = useCallback((id: string) => {
    setRecentAlerts((prev) => prev.filter((a) => a.id !== id));
    setViolationCount((c) => Math.max(0, c - 1));
  }, []);

  const value = useMemo(
    () => ({
      socket,
      isConnected,
      violationCount,
      recentAlerts,
      lastSessionEvent,
      clearAlerts,
      markAlertRead,
    }),
    [socket, isConnected, violationCount, recentAlerts, lastSessionEvent, clearAlerts, markAlertRead]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
