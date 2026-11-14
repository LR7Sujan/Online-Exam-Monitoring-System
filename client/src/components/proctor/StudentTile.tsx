import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Clock,
  RotateCcw,
  Shield,
  ShieldAlert,
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

          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand transition-colors">
              {session.student_name}
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {session.exam_title}
            </p>
          </div>
        </div>

        <StatusPill status={session.status} size="sm" />
      </div>

      {/* Middle Row: Mini TrustRing + Violations Badge */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface-elevated/70 p-2.5">
        <div className="flex items-center gap-2.5">
          <TrustRing
            score={score}
            minThreshold={minThreshold}
            size={48}
            showThresholdMarker={false}
          />
          <div>
            <div className="font-mono text-xs font-bold text-foreground">
              {score}% <span className="text-[10px] font-normal text-muted-foreground">Trust</span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              Min: {minThreshold}%
            </div>
          </div>
        </div>

        {/* Violations Count & Status */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 font-mono text-xs font-semibold">
            {Number(session.total_violations) > 0 ? (
              <span className="flex items-center gap-1 text-rose-500">
                <ShieldAlert className="w-3.5 h-3.5" />
                {session.total_violations} {Number(session.total_violations) === 1 ? 'violation' : 'violations'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-500">
                <Shield className="w-3.5 h-3.5" />
                Clean Record
              </span>
            )}
          </div>

          {Number(session.pending_violations) > 0 && (
            <span className="inline-block rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-500 mt-0.5">
              {session.pending_violations} Pending Review
            </span>
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
