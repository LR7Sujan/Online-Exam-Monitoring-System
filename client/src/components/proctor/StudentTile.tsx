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

function formatRelativeTime(dateStr: string | null): { relative: string; exact: string } {
  if (!dateStr) {
    return { relative: 'Clean', exact: 'No incidents recorded' };
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { relative: 'Unknown', exact: 'Invalid timestamp' };
  }

  const exact = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return { relative: 'Just now', exact };
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return { relative: 'Just now', exact };
  if (seconds < 60) return { relative: `${seconds}s ago`, exact };

  const mins = Math.floor(seconds / 60);
  if (mins < 60) return { relative: `${mins}m ago`, exact };

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { relative: `${hrs}h ago`, exact };

  const days = Math.floor(hrs / 24);
  if (days < 30) return { relative: `${days}d ago`, exact };

  // For 30+ days, format as "Nov 7" (or "Nov 7, 2025" if different year)
  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  const dateFormatted = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
  });

  return { relative: dateFormatted, exact };
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

  const { relative: relativeTime, exact: exactTime } = formatRelativeTime(session.last_violation_at);

  return (
    <motion.div
      layout
      layoutId={`student-tile-${session.session_id}`}
      data-testid={`student-tile-${session.session_id}`}
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
      className={`group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer backdrop-blur-xl overflow-hidden min-w-0 w-full ${glowClasses}`}
    >
      {/* Time Extension Request Pending Pill */}
      {session.extension_request_status === 'PENDING' && (
        <div className="absolute -top-2.5 left-4 z-10 flex items-center gap-1 rounded-full border border-amber-500/80 bg-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 shadow-md animate-pulse">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>EXTRA TIME (+{session.requested_extension_minutes || 5}m)</span>
        </div>
      )}

      {/* Reinstatement Flag Pill */}
      {needsReinstatement && (
        <div className="absolute -top-2.5 right-4 z-10 flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-500 shadow-sm">
          <RotateCcw className="w-3 h-3 animate-spin" />
          <span>REINSTATEMENT READY</span>
        </div>
      )}

      {/* Header Row: CSS Grid with 44px avatar | 2-line name & exam | status pill right */}
      <div className="grid grid-cols-[44px_1fr_auto] items-start gap-2 min-w-0 w-full">
        {/* Cell 1: Avatar (44px x 44px) */}
        <div className="w-11 h-11 shrink-0 min-w-0">
          <motion.div
            layoutId={`student-avatar-${session.session_id}`}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold shadow-sm ${
              riskColor === 'rose'
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
        </div>

        {/* Cell 2: Name and Exam Title on two lines, truncated with tooltip */}
        <div className="min-w-0 flex flex-col justify-center gap-0.5">
          <h3
            className="text-[15px] font-semibold text-foreground truncate group-hover:text-brand transition-colors leading-snug"
            title={session.student_name}
          >
            {session.student_name}
          </h3>
          <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground leading-normal">
            <span className="truncate" title={session.exam_title}>
              {session.exam_title}
            </span>
            {session.paper_code && (
              <span
                data-testid="tile-paper-code"
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-brand/10 border border-brand/30 text-brand shadow-sm"
                title={`Paper version: ${session.paper_code}`}
              >
                {session.paper_code}
              </span>
            )}
          </div>
        </div>

        {/* Cell 3: Status Pill aligned right */}
        <div className="shrink-0 flex items-start justify-end min-w-0 pl-1">
          <StatusPill status={session.status} size="sm" />
        </div>
      </div>

      {/* Body Row: 56px TrustRing + Score & Min on two lines | Right violation stack */}
      <div className="mt-2.5 rounded-xl border border-border/80 bg-surface-elevated/70 p-2 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          {/* Left Cluster: TrustRing (fixed 56px slot) + Score/Min */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-14 h-14 shrink-0 flex items-center justify-center min-w-0">
              <TrustRing
                score={score}
                minThreshold={minThreshold}
                size="xs"
                showThresholdMarker={false}
              />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="font-mono text-xs font-bold text-foreground truncate">
                {score}% <span className="font-sans text-[11px] font-normal text-muted-foreground">Trust</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">
                Min: {minThreshold}%
              </div>
            </div>
          </div>

          {/* Right Cluster: Violation count chip & Pending review chip */}
          <div className="flex flex-col items-end gap-1 shrink-0 max-w-full min-w-0">
            <div className="flex items-center justify-end font-mono text-xs font-semibold max-w-full min-w-0">
              {Number(session.total_violations) > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 text-rose-500 max-w-full truncate">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {session.total_violations} {Number(session.total_violations) === 1 ? 'violation' : 'violations'}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 text-emerald-500 max-w-full truncate">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Clean Record</span>
                </span>
              )}
            </div>

            {Number(session.pending_violations) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-500 max-w-full truncate">
                <Clock className="w-3 h-3 shrink-0" />
                <span className="truncate">{session.pending_violations} Pending Review</span>
              </span>
            )}

            {Boolean(session.warning_count && session.warning_count > 0) && (
              <span
                data-testid="tile-warning-badge"
                className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/35 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-500 max-w-full truncate"
              >
                <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                <span className="truncate">Warning {session.warning_count}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Row: Last activity with relative time format + Inspect on one line */}
      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between gap-2 min-w-0 text-xs font-mono text-muted-foreground">
        <div
          className="flex items-center gap-1.5 min-w-0 truncate"
          title={`Last infraction: ${exactTime}`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {session.last_violation_at ? (
              <span className="text-rose-500">Last: {relativeTime}</span>
            ) : (
              <span className="text-emerald-500">0 Incidents</span>
            )}
          </span>
        </div>

        <span className="inline-flex items-center gap-0.5 text-brand group-hover:underline font-semibold shrink-0">
          Inspect <ArrowUpRight className="w-3 h-3 shrink-0" />
        </span>
      </div>
    </motion.div>
  );
}
