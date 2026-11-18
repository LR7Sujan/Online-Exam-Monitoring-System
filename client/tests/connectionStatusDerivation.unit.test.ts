import { describe, it, expect } from 'vitest';
import { deriveConnectionStatus } from '../src/utils/connectionStatus';

describe('Connection Status Derivation Unit Tests', () => {
  it('derives Connected state when socket is connected and services are up', () => {
    const res = deriveConnectionStatus({
      connectionState: 'connected',
      apiStatus: 'up',
      dbStatus: 'up',
      mysqlVersion: '8.0.46',
      latencyMs: 12,
    });

    expect(res.state).toBe('connected');
    expect(res.dotColor).toBe('emerald');
    expect(res.pulse).toBe(true);
    expect(res.statusLabel).toBe('CONNECTED');
    expect(res.subLabel).toBe('MySQL 8.0.46 • WSS • 12ms');
    expect(res.isFullyOperational).toBe(true);
  });

  it('derives Reconnecting state when socket is reconnecting', () => {
    const res = deriveConnectionStatus({
      connectionState: 'reconnecting',
      apiStatus: 'down',
      dbStatus: 'down',
      mysqlVersion: '8.0.46',
      latencyMs: null,
    });

    expect(res.state).toBe('reconnecting');
    expect(res.dotColor).toBe('amber');
    expect(res.pulse).toBe(true);
    expect(res.statusLabel).toBe('RECONNECTING...');
    expect(res.subLabel).toBe('MySQL 8.0.46 • WSS');
    expect(res.isFullyOperational).toBe(false);
  });

  it('derives Disconnected state when socket is disconnected', () => {
    const res = deriveConnectionStatus({
      connectionState: 'disconnected',
      apiStatus: 'down',
      dbStatus: 'down',
      mysqlVersion: '8.0',
      latencyMs: null,
    });

    expect(res.state).toBe('disconnected');
    expect(res.dotColor).toBe('rose');
    expect(res.pulse).toBe(false);
    expect(res.statusLabel).toBe('DISCONNECTED');
    expect(res.subLabel).toBe('MySQL 8.0 • WSS');
    expect(res.isFullyOperational).toBe(false);
  });

  it('downgrades connected socket to reconnecting if backend DB drops', () => {
    const res = deriveConnectionStatus({
      connectionState: 'connected',
      apiStatus: 'up',
      dbStatus: 'down',
      mysqlVersion: '8.0.46',
      latencyMs: 5,
    });

    expect(res.state).toBe('reconnecting');
    expect(res.dotColor).toBe('amber');
    expect(res.pulse).toBe(true);
    expect(res.statusLabel).toBe('RECONNECTING...');
    expect(res.isFullyOperational).toBe(false);
  });
});
