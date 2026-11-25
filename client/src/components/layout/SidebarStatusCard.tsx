import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Database,
  Radio,
  Server,
  X,
} from 'lucide-react';
import { LiveDot } from '../ui/LiveDot';
import { useSocketContext } from '../../context/useSocketContext';
import { useAuthStore } from '../../store/authStore';
import { deriveConnectionStatus } from '../../utils/connectionStatus';

interface SidebarStatusCardProps {
  isCollapsed?: boolean;
}

export function SidebarStatusCard({ isCollapsed = false }: SidebarStatusCardProps) {
  const {
    connectionState,
    latencyMs,
    transport,
    lastConnectedAt,
    apiStatus,
    dbStatus,
    mysqlVersion,
    reconnectNow,
  } = useSocketContext();

  const user = useAuthStore((s) => s.user);

  const [isOpen, setIsOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ bottom: number; left: number }>({
    bottom: 0,
    left: 0,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Position popover relative to trigger button
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (isCollapsed) {
      setPopoverCoords({
        bottom: Math.max(16, window.innerHeight - rect.bottom),
        left: rect.right + 12,
      });
    } else {
      setPopoverCoords({
        bottom: Math.max(16, window.innerHeight - rect.top + 8),
        left: Math.max(12, rect.left),
      });
    }
  }, [isCollapsed]);

  const togglePopover = (e: React.MouseEvent) => {
    console.log('[SidebarStatusCard] togglePopover clicked, isOpen currently:', isOpen);
    e.stopPropagation();
    updatePosition();
    setIsOpen((prev) => !prev);
  };

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const derived = deriveConnectionStatus({
    connectionState,
    apiStatus,
    dbStatus,
    transport:
      transport === 'pusher'
        ? 'pusher'
        : transport === 'websocket' || transport === 'wss'
        ? 'websocket'
        : 'polling',
    mysqlVersion,
    latencyMs,
  });

  return (
    <>
      {!isCollapsed ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={togglePopover}
          data-testid="sidebar-status-card"
          className="w-full text-left flex items-center justify-between rounded-xl p-2.5 border border-border bg-surface-elevated/80 dark:bg-[#12131d] hover:border-brand/40 transition-colors cursor-pointer group"
          title="Click to view live connection diagnostics"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <LiveDot
              color={derived.dotColor}
              size="sm"
              pulse={derived.pulse}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-mono text-foreground font-semibold truncate">
                {derived.statusLabel}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground truncate">
                {derived.subLabel}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-brand font-semibold shrink-0 ml-2 group-hover:underline">
            v2.0
          </span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={togglePopover}
          className="w-10 h-10 mx-auto rounded-full border border-border bg-surface-elevated/80 dark:bg-[#12131d] flex items-center justify-center relative cursor-pointer shadow-sm hover:border-brand/40 transition-colors"
          title={`Status: ${derived.statusLabel} | Role: ${user?.role || 'Guest'}`}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <LiveDot
            color={derived.dotColor}
            size="sm"
            pulse={derived.pulse}
          />
          {user && (
            <span
              className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center border border-border text-white ${
                user.role === 'ADMIN'
                  ? 'bg-indigo-600'
                  : user.role === 'PROCTOR'
                  ? 'bg-sky-600'
                  : 'bg-emerald-600'
              }`}
            >
              {user.role[0]}
            </span>
          )}
        </button>
      )}

      {/* SOLID DIAGNOSTICS POPOVER PORTAL */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            data-testid="connection-status-popover"
            style={{
              position: 'fixed',
              bottom: `${popoverCoords.bottom}px`,
              left: `${popoverCoords.left}px`,
            }}
            role="dialog"
            aria-label="Connection Status Diagnostics"
            className="z-50 w-72 rounded-2xl border border-border bg-surface dark:bg-[#13141f] p-4 shadow-2xl text-foreground text-xs space-y-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Activity className="w-4 h-4 text-brand" />
                <span>Node Telemetry</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close diagnostics"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Plain-Language Diagnostic Hint Banner when service is down */}
            {derived.diagnosticHint && (
              <div
                data-testid="connection-diagnostic-hint"
                className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-[11px] font-sans font-medium"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="leading-snug">{derived.diagnosticHint}</span>
              </div>
            )}

            {/* Diagnostics Rows */}
            <div className="space-y-2 font-mono text-[11px]">
              {/* 1. WebSocket Telemetry */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated/70 border border-border/60">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Radio className="w-3.5 h-3.5" />
                  <span>Realtime ({transport})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-semibold ${
                      connectionState === 'connected'
                        ? 'text-emerald-500'
                        : connectionState === 'reconnecting'
                        ? 'text-amber-500 animate-pulse'
                        : 'text-rose-500'
                    }`}
                  >
                    {derived.statusLabel}
                  </span>
                  {latencyMs !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      ({latencyMs}ms)
                    </span>
                  )}
                </div>
              </div>

              {/* 2. REST API Status */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated/70 border border-border/60">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Server className="w-3.5 h-3.5" />
                  <span>REST API</span>
                </div>
                <div className="flex items-center gap-1">
                  {apiStatus === 'up' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">200 OK</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-rose-500 font-semibold">Unreachable</span>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Database Status */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated/70 border border-border/60">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="w-3.5 h-3.5" />
                  <span>MySQL DBMS</span>
                </div>
                <div className="flex items-center gap-1">
                  {dbStatus === 'up' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-semibold">
                        v{mysqlVersion}
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                      <span className="text-rose-500 font-semibold">Down</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Last Connected Timestamp */}
            <div className="text-[10px] font-mono text-muted-foreground flex justify-between pt-1">
              <span>Last Synchronized:</span>
              <span>
                {lastConnectedAt instanceof Date
                  ? lastConnectedAt.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : lastConnectedAt
                  ? new Date(lastConnectedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : 'Pending'}
              </span>
            </div>

            {/* Action Footer */}
            <div className="pt-1">
              <button
                type="button"
                onClick={reconnectNow}
                disabled={connectionState === 'reconnecting'}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-sans text-xs font-semibold bg-brand text-white hover:bg-brand/90 transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 ${
                    connectionState === 'reconnecting' ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {connectionState === 'reconnecting'
                    ? 'Reconnecting...'
                    : 'Reconnect Now'}
                </span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
