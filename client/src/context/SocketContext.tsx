import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket, reconnectSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { toast as sonnerToast } from '../components/ui/Toast';
import {
  SocketContext,
  type LiveViolationEvent,
  type LiveSessionEvent,
  type ConnectionState,
} from './SocketContextCore';

export type { LiveViolationEvent, LiveSessionEvent, ConnectionState };

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [transport, setTransport] = useState<string>('websocket');
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);
  const [apiStatus, setApiStatus] = useState<'up' | 'down'>('down');
  const [dbStatus, setDbStatus] = useState<'up' | 'down'>('down');
  const [mysqlVersion, setMysqlVersion] = useState<string>('8.0');

  const [violationCount, setViolationCount] = useState<number>(0);
  const [recentAlerts, setRecentAlerts] = useState<LiveViolationEvent[]>([]);
  const [lastSessionEvent, setLastSessionEvent] = useState<LiveSessionEvent | null>(null);

  const hasShownDisconnectToastRef = useRef<boolean>(false);
  const wasEverConnectedRef = useRef<boolean>(false);

  // Poll /api/health every 15s (or immediately on mount / state change)
  const pollHealth = useCallback(async () => {
    try {
      const res = await api.get<{
        api?: 'up' | 'down';
        db?: 'up' | 'down';
        mysqlVersion?: string;
      }>('/health');
      setApiStatus(res?.api ?? 'up');
      setDbStatus(res?.db ?? 'up');
      if (res?.mysqlVersion) {
        setMysqlVersion(res.mysqlVersion);
      }
    } catch {
      setApiStatus('down');
      setDbStatus('down');
    }
  }, []);

  useEffect(() => {
    pollHealth();
    const interval = setInterval(pollHealth, 15000);
    return () => clearInterval(interval);
  }, [pollHealth]);

  // Measure latency
  const measureLatency = useCallback((s: Socket) => {
    if (!s.connected) return;
    const start = Date.now();
    s.emit('ping:latency', start, (clientTs: unknown) => {
      const ts = typeof clientTs === 'number' ? clientTs : start;
      const diff = Math.max(1, Date.now() - ts);
      setLatencyMs(diff);
      const currentTransport =
        (s.io?.engine as { transport?: { name?: string } })?.transport?.name ?? 'websocket';
      setTransport(currentTransport);
    });
  }, []);

  // Manual reconnect trigger
  const handleReconnectNow = useCallback(() => {
    setConnectionState('reconnecting');
    reconnectSocket();
    pollHealth();
  }, [pollHealth]);

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      setSocket(null);
      setConnectionState('disconnected');
      setLatencyMs(null);
      return;
    }

    const s = getSocket(token);
    setSocket(s);

    if (!s) return;

    const onConnect = () => {
      setConnectionState('connected');
      setLastConnectedAt(new Date());
      setApiStatus('up');
      setDbStatus('up');
      measureLatency(s);

      // If we previously lost connection, show recovery toast and refetch active queries
      if (wasEverConnectedRef.current && hasShownDisconnectToastRef.current) {
        sonnerToast.success('Back online', {
          id: 'connection-status-toast',
          duration: 3000,
        });
        hasShownDisconnectToastRef.current = false;
        queryClient.refetchQueries({ type: 'active' });
      }
      wasEverConnectedRef.current = true;
    };

    const onDisconnect = (reason: string) => {
      // If server closed or network dropped, transition to reconnecting/disconnected
      if (reason === 'io client disconnect') {
        setConnectionState('disconnected');
      } else {
        setConnectionState('reconnecting');
        if (!hasShownDisconnectToastRef.current && wasEverConnectedRef.current) {
          sonnerToast.warning('Connection lost, retrying...', {
            id: 'connection-status-toast',
            duration: 5000,
          });
          hasShownDisconnectToastRef.current = true;
        }
      }
      setLatencyMs(null);
      pollHealth();
    };

    const onConnectError = () => {
      setConnectionState('reconnecting');
      if (!hasShownDisconnectToastRef.current && wasEverConnectedRef.current) {
        sonnerToast.warning('Connection lost, retrying...', {
          id: 'connection-status-toast',
          duration: 5000,
        });
        hasShownDisconnectToastRef.current = true;
      }
      pollHealth();
    };

    const onReconnectAttempt = () => {
      setConnectionState('reconnecting');
    };

    const onReconnect = () => {
      onConnect();
    };

    const onReconnectFailed = () => {
      setConnectionState('disconnected');
      pollHealth();
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

    const onSimulatorReset = () => {
      setRecentAlerts((prev) =>
        prev.filter((a) => !a.studentName?.startsWith('Virtual Candidate'))
      );
      setLastSessionEvent((prev) =>
        prev?.studentName?.startsWith('Virtual Candidate') ? null : prev
      );
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect', onReconnect);
    s.io.on('reconnect_failed', onReconnectFailed);

    s.on('violation:new', onViolation);
    s.on('session:update', onSessionUpdate);
    s.on('session:terminated', onSessionTerminated);
    s.on('exam:submitted', onExamSubmitted);
    s.on('simulator:reset', onSimulatorReset);

    const handleOffline = () => {
      setConnectionState('disconnected');
      setApiStatus('down');
      setDbStatus('down');
      setLatencyMs(null);
      if (!hasShownDisconnectToastRef.current && wasEverConnectedRef.current) {
        sonnerToast.warning('Connection lost, retrying...', {
          id: 'connection-status-toast',
          duration: 5000,
        });
        hasShownDisconnectToastRef.current = true;
      }
    };

    const handleOnline = () => {
      setConnectionState('reconnecting');
      reconnectSocket();
      pollHealth();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (s.connected) {
      onConnect();
    }

    // Ping latency timer every 10s while connected
    const latencyTimer = setInterval(() => {
      measureLatency(s);
    }, 10000);

    return () => {
      clearInterval(latencyTimer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect', onReconnect);
      s.io.off('reconnect_failed', onReconnectFailed);

      s.off('violation:new', onViolation);
      s.off('session:update', onSessionUpdate);
      s.off('session:terminated', onSessionTerminated);
      s.off('exam:submitted', onExamSubmitted);
      s.off('simulator:reset', onSimulatorReset);
    };
  }, [token, user, queryClient, pollHealth, measureLatency]);

  const clearAlerts = useCallback(() => {
    setViolationCount(0);
    setRecentAlerts([]);
  }, []);

  const markAlertRead = useCallback((id: string) => {
    setRecentAlerts((prev) => prev.filter((a) => a.id !== id));
    setViolationCount((c) => Math.max(0, c - 1));
  }, []);

  const isConnected = connectionState === 'connected';

  const value = useMemo(
    () => ({
      socket,
      connectionState,
      isConnected,
      latencyMs,
      transport,
      lastConnectedAt,
      apiStatus,
      dbStatus,
      mysqlVersion,
      reconnectNow: handleReconnectNow,
      violationCount,
      recentAlerts,
      lastSessionEvent,
      clearAlerts,
      markAlertRead,
    }),
    [
      socket,
      connectionState,
      isConnected,
      latencyMs,
      transport,
      lastConnectedAt,
      apiStatus,
      dbStatus,
      mysqlVersion,
      handleReconnectNow,
      violationCount,
      recentAlerts,
      lastSessionEvent,
      clearAlerts,
      markAlertRead,
    ]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
