import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Clock,
  RotateCcw,
  Shield,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { TrustRing } from '../ui/TrustRing';
import { StatusPill } from '../ui/StatusPill';
import type { ProctorLiveMonitorRow } from '../../types/domain';

interface StudentTileProps {
  session: ProctorLiveMonitorRow;
  isShaking?: boolean;
  onSelect: (sessionId: number) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Clean';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export function StudentTile({
  session,
  isShaking = false,
  onSelect,
}: StudentTileProps) {
  const score = Number(session.trust_score);
  const minThreshold = Number(session.min_trust_score ?? 50);
  const isTerminated = session.status === 'TERMINATED_CHEATING';
  const needsReinstatement = Boolean(session.needs_reinstatement);

  // Risk Level Evaluation
  let riskColor: 'rose' | 'amber' | 'emerald' = 'emerald';
  let glowClasses = 'border-border bg-surface/85 hover:border-emerald-500/50 hover:bg-surface shadow-sm hover:shadow-layered-sm';

  if (isTerminated || score < minThreshold) {
    riskColor = 'rose';
    glowClasses = 'border-rose-500/50 bg-rose-500/5 hover:border-rose-500 hover:bg-rose-500/10 shadow-sm hover:shadow-rose-500/10';
  } else if (score < 85 || Number(session.total_violations) > 0) {
    riskColor = 'amber';
    glowClasses = 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500 hover:bg-amber-500/10 shadow-sm hover:shadow-amber-500/10';
  }

  return (
    <motion.div
      layout
      layoutId={`student-tile-${session.session_id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        x: isShaking ? [-6, 6, -4, 4, -2, 2, 0] : 0,
      }}
      transition={{
        layout: { duration: 0.4, ease: 'easeOut' },
        x: { duration: 0.35, ease: 'easeInOut' },
      }}
      onClick={() => onSelect(session.session_id)}
      className={`group relative rounded-2xl border p-4.5 transition-all duration-200 cursor-pointer backdrop-blur-xl ${glowClasses}`}
    >
      {/* Time Extension Request Pending Pill */}
      {session.extension_request_status === 'PENDING' && (
        <div className="absolute -top-2.5 left-4 z-10 flex items-center gap-1 rounded-full border border-amber-500/80 bg-amber-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 shadow-md animate-pulse">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>EXTRA TIME REQUESTED (+{session.requested_extension_minutes || 5}m)</span>
        </div>
      )}

      {/* Reinstatement Flag Pill */}
      {needsReinstatement && (
        <div className="absolute -top-2.5 right-4 z-10 flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-amber-500 shadow-sm">
          <RotateCcw className="w-3 h-3 animate-spin" />
          <span>REINSTATEMENT READY</span>
        </div>
      )}

      {/* Top Row: Avatar + Student Meta + Status Pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with Risk Ring */}
          <motion.div
            layoutId={`student-avatar-${session.session_id}`}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-sm ${riskColor === 'rose'
              ? 'border-2 border-rose-500 bg-rose-500/15 text-rose-500'
              : riskColor === 'amber'
                ? 'border-2 border-amber-500 bg-amber-500/15 text-amber-500'
                : 'border-2 border-brand/50 bg-brand/10 text-brand'
              }`}
          >
            {getInitials(session.student_name)}
            {session.status === 'IN_PROGRESS' && (
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            )}
          </motion.div>

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand transition-colors">
              {session.student_name}
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {session.exam_title}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusPill status={session.status} size="sm" />
          {session.paper_code && (
            <span
              data-testid="tile-paper-code"
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-brand/10 border border-brand/30 text-brand shadow-sm"
            >
              {session.paper_code}
            </span>
          )}
        </div>
      </div>

      {/* Middle Row: Mini TrustRing + Violations Badge */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-elevated/70 p-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <TrustRing
              score={score}
              minThreshold={minThreshold}
              size="xs"
              showThresholdMarker={false}
            />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-xs font-bold text-foreground truncate">
              {score}% <span className="text-[10px] font-normal text-muted-foreground">Trust</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground truncate">
              Min: {minThreshold}%
            </div>
          </div>
        </div>

        {/* Violations Count & Status */}
        <div className="text-right shrink-0">
          <div className="flex items-center justify-end gap-1 font-mono text-xs font-semibold">
            {Number(session.total_violations) > 0 ? (
              <span className="flex items-center gap-1 text-rose-500 whitespace-nowrap">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{session.total_violations} {Number(session.total_violations) === 1 ? 'violation' : 'violations'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500 whitespace-nowrap">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Clean Record</span>
              </span>
            )}
          </div>

          {Number(session.pending_violations) > 0 && (
            <span className="inline-block rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500 mt-0.5 whitespace-nowrap">
              {session.pending_violations} Pending Review
            </span>
          )}

          {Boolean(session.warning_count && session.warning_count > 0) && (
            <div className="flex justify-end mt-1">
              <span
                data-testid="tile-warning-badge"
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/35 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-500 whitespace-nowrap"
              >
                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                <span>Warning {session.warning_count}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer: Last Violation Time + Inspect Link */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/60 pt-2">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span>
            {session.last_violation_at ? (
              <span className="text-rose-500">Last: {formatRelativeTime(session.last_violation_at)}</span>
            ) : (
              <span className="text-emerald-500">0 Incidents</span>
            )}
          </span>
        </div>

        <span className="flex items-center gap-0.5 text-indigo-400 dark:text-indigo-400 group-hover:underline text-[11px] font-semibold">
          Inspect <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}
