import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Laptop,
  Maximize2,
  RotateCcw,
  ShieldAlert,
  ShieldOff,
  User,
  Wifi,
  X,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrustRing } from '../ui/TrustRing';
import { ParticleBurst } from '../ui/ParticleBurst';
import { useAuthStore } from '../../store/authStore';
import { StatusPill } from '../ui/StatusPill';
import { SeverityBadge } from '../ui/SeverityBadge';
import { ChartTooltip, useChartTheme } from '../charts/shared';
import { api } from '../../lib/api';
import { playPingSound } from '../../utils/audioAlert';
import type {
  ProctorLiveMonitorRow,
  ReviewStatus,
  ViolationAuditRow,
} from '../../types/domain';

interface StudentDetailDrawerProps {
  sessionId: number | null;
  onClose: () => void;
}

interface InspectResponse {
  session: ProctorLiveMonitorRow;
  logs: ViolationAuditRow[];
}

export function StudentDetailDrawer({ sessionId, onClose }: StudentDetailDrawerProps) {
  const queryClient = useQueryClient();

  // Modals & Lightbox states
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption: string;
    code: string;
    time: string;
  } | null>(null);
  const [showReinstateBurst, setShowReinstateBurst] = useState(false);
  const chartTheme = useChartTheme();

  const [warnModalOpen, setWarnModalOpen] = useState<boolean>(false);
  const [warnMessage, setWarnMessage] = useState<string>('Please ensure your face remains centered in the camera frame.');

  const [terminateModalOpen, setTerminateModalOpen] = useState<boolean>(false);
  const [terminateReason, setTerminateReason] = useState<string>('Proctor detected non-compliant examination behavior.');

  useEffect(() => {
    if (!sessionId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sessionId, onClose]);

  // Fetch session inspection and audit timeline
  const inspectQuery = useQuery({
    queryKey: ['proctor-session-inspect', sessionId],
    queryFn: () => api.get<InspectResponse>(`/proctor/sessions/${sessionId}/inspect`),
    enabled: sessionId !== null && sessionId > 0,
    refetchInterval: 10000,
  });

  // Review single log mutation
  const reviewMutation = useMutation({
    mutationFn: (vars: { logId: number; reviewStatus: ReviewStatus; notes?: string }) =>
      api.patch(`/proctor/logs/${vars.logId}/review`, {
        reviewStatus: vars.reviewStatus,
        reviewNotes: vars.notes ?? `Reviewed as ${vars.reviewStatus} via Proctor Console`,
      }),
    onSuccess: (_, vars) => {
      if (vars.reviewStatus === 'CONFIRMED') {
        playPingSound('confirm');
      } else {
        playPingSound('reinstate');
      }
      queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
    },
  });

  // Warn student mutation
  const warnMutation = useMutation({
    mutationFn: (message: string) =>
      api.post(`/proctor/sessions/${sessionId}/warn`, { message }),
    onSuccess: () => {
      setWarnModalOpen(false);
      playPingSound('confirm');
    },
  });

  // Force terminate mutation
  const terminateMutation = useMutation({
    mutationFn: (reason: string) =>
      api.post(`/proctor/sessions/${sessionId}/terminate`, { reason }),
    onSuccess: () => {
      setTerminateModalOpen(false);
      playPingSound('critical');
      queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    },
  });

  // Reinstate mutation
  const reinstateMutation = useMutation({
    mutationFn: () =>
      api.post(`/proctor/sessions/${sessionId}/reinstate`, {
        reason: 'Candidate reinstated after proctor audit verification',
      }),
    onSuccess: () => {
      playPingSound('reinstate');
      setShowReinstateBurst(true);
      setTimeout(() => setShowReinstateBurst(false), 2200);
      queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    },
  });

  if (!sessionId) return null;

  const session = inspectQuery.data?.session;
  const logs = inspectQuery.data?.logs ?? [];

  const currentScore = Number(session?.trust_score ?? 100);
  const minThreshold = Number(session?.min_trust_score ?? 50);
  const isTerminated = session?.status === 'TERMINATED_CHEATING';
  const needsReinstatement = Boolean(session?.needs_reinstatement);

  // Build Chronological Timeline Data for Recharts
  const sortedLogs = [...logs].reverse();
  const timelineData: Array<{
    time: string;
    trustScore: number;
    violationCode?: string;
    penalty?: number;
    label: string;
  }> = [];

  // Start marker
  if (session?.started_at) {
    const startD = new Date(session.started_at);
    timelineData.push({
      time: startD.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      trustScore: 100,
      label: 'Session Start',
    });
  }

  // Intermediate violation markers
  sortedLogs.forEach((log) => {
    const d = new Date(log.occurred_at);
    timelineData.push({
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      trustScore: Number(log.current_trust_score ?? 100),
      violationCode: log.violation_code,
      penalty: Number(log.penalty_applied),
      label: `${log.violation_code} (-${log.penalty_applied})`,
    });
  });

  // End / Current point
  timelineData.push({
    time: 'Now',
    trustScore: currentScore,
    label: `Current (${currentScore}%)`,
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div key="student-drawer-root" className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          key="drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
        />

        {/* Slide-over Container */}
        <motion.div
          key="drawer-slideover"
          role="dialog"
          aria-modal="true"
          aria-label="Student Inspection Details"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-border bg-surface/98 backdrop-blur-2xl shadow-2xl overflow-hidden"
        >
          {/* Drawer Top Bar */}
          <div className="flex items-center justify-between border-b border-border/70 bg-surface-elevated/60 p-5">
            <div className="flex items-center gap-3">
              <motion.div
                layoutId={`student-avatar-${sessionId}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand shadow-sm font-bold"
              >
                <User className="w-5 h-5" />
              </motion.div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {session?.student_name ?? `Candidate Session #${sessionId}`}
                </h3>
                <p className="text-xs font-mono text-muted-foreground">
                  {session?.student_email} • {session?.exam_title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill status={session?.status ?? 'IN_PROGRESS'} size="md" />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Close Inspector"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin">
            {/* 1. Header Overview: TrustRing + Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-border bg-surface-elevated/70 p-4 items-center">
              <div className="flex justify-center sm:justify-start relative">
                {showReinstateBurst && <ParticleBurst count={24} />}
                <TrustRing
                  score={currentScore}
                  minThreshold={minThreshold}
                  size={96}
                  sublabel="Score"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-border/60 pb-1.5">
                  <span className="text-muted-foreground">Current Trust Rating:</span>
                  <span
                    className={
                      currentScore < minThreshold
                        ? 'text-rose-500 font-bold'
                        : currentScore < 85
                        ? 'text-amber-500 font-bold'
                        : 'text-emerald-500 font-bold'
                    }
                  >
                    {currentScore}%
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-1.5">
                  <span className="text-muted-foreground">Termination Limit:</span>
                  <span className="text-rose-500 font-bold">{minThreshold}%</span>
                </div>
                <div className="flex justify-between border-b border-border/60 pb-1.5">
                  <span className="text-muted-foreground">Logged Violations:</span>
                  <span className="text-foreground font-bold">
                    {session?.total_violations ?? logs.length} (
                    <span className="text-amber-500">
                      {session?.pending_violations ?? 0} Pending
                    </span>
                    )
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Integrity Classification:</span>
                  <span
                    className={
                      currentScore < minThreshold || isTerminated
                        ? 'text-rose-500 font-bold'
                        : currentScore < 100
                        ? 'text-amber-500 font-bold'
                        : 'text-emerald-500 font-bold'
                    }
                  >
                    {currentScore < minThreshold || isTerminated
                      ? 'DISQUALIFIED'
                      : currentScore < 100
                      ? 'FLAGGED'
                      : 'CLEAN'}
                  </span>
                </div>
              </div>
            </div>

            {/* Reinstatement Alert Box */}
            {needsReinstatement && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-5 h-5 text-amber-500 animate-spin" />
                  <div>
                    <h5 className="text-xs font-bold text-amber-500">
                      Candidate Reinstatement Eligible
                    </h5>
                    <p className="text-[11px] text-amber-600 dark:text-amber-200/80">
                      Restored trust score satisfies exam threshold. Reopening exam requires proctor confirmation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={reinstateMutation.isPending}
                  onClick={() => reinstateMutation.mutate()}
                  className="py-1.5 px-3 rounded-lg font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all cursor-pointer"
                >
                  Reinstate Session
                </button>
              </div>
            )}

            {/* 2. Trust Score Timeline Chart */}
            <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand" />
                  <span>Trust Score Telemetry Timeline</span>
                </h4>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Threshold: {minThreshold}%
                </span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={currentScore < minThreshold ? chartTheme.series.rose : chartTheme.series.indigo} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={currentScore < minThreshold ? chartTheme.series.rose : chartTheme.series.indigo} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke={chartTheme.axisLine}
                      tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke={chartTheme.axisLine}
                      tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }}
                      tickLine={false}
                    />
                    <Tooltip
                      {...chartTheme.lineTooltipProps}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <ChartTooltip
                              active={active}
                              title={data.time}
                              payload={[
                                {
                                  name: data.label,
                                  value: `${data.trustScore}%`,
                                  color: currentScore < minThreshold ? chartTheme.series.rose : chartTheme.series.indigo,
                                },
                              ]}
                            />
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={minThreshold}
                      stroke={chartTheme.series.rose}
                      strokeDasharray="4 4"
                      label={{ value: `Limit: ${minThreshold}%`, fill: chartTheme.series.rose, fontSize: 10, position: 'insideBottomRight' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="trustScore"
                      stroke={currentScore < minThreshold ? chartTheme.series.rose : chartTheme.series.indigo}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#trustGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Session Technical Info (IP, Device Fingerprint, Latency) */}
            <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Laptop className="w-4 h-4 text-violet-500" />
                <span>Client Telemetry & Kiosk State</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground">IP ADDRESS</div>
                  <div className="text-foreground font-semibold flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-brand" />
                    <span>{session?.ip_address ?? '127.0.0.1 (Local)'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground">DEVICE FINGERPRINT</div>
                  <div className="text-foreground font-semibold truncate" title={session?.device_fingerprint ?? 'Chrome / Windows Kiosk'}>
                    {session?.device_fingerprint ?? 'Chrome / Windows Kiosk'}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground">STARTED AT</div>
                  <div className="text-foreground">
                    {session?.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3 space-y-1">
                  <div className="text-[10px] text-muted-foreground">SERVER DEADLINE</div>
                  <div className="text-foreground">
                    {session?.server_deadline ? new Date(session.server_deadline).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Violation Incident Ledger with Lightbox Snapshots */}
            <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>Violation Audit & Optical Evidence</span>
                </h4>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {logs.length} Total Incidents
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-emerald-500">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-500" />
                  Zero violations recorded. Perfect candidate integrity.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const isPending = log.proctor_review_status === 'PENDING';
                    const isDismissed = log.proctor_review_status === 'DISMISSED';

                    const token = useAuthStore.getState().token;
                    const logRecord = log as unknown as Record<string, unknown>;
                    const meta = log.evidence_meta as Record<string, unknown> | undefined;
                    const rawUrl =
                      (typeof logRecord.snapshot_url === 'string' ? logRecord.snapshot_url : undefined) ||
                      (typeof meta?.snapshot_url === 'string' ? meta.snapshot_url : undefined) ||
                      (typeof meta?.snapshotUrl === 'string' ? meta.snapshotUrl : undefined);
                    const serverHost = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(
                      /\/api\/?$/,
                      ''
                    );
                    const authParam = token ? `?token=${encodeURIComponent(token)}` : '';
                    const snapshotUrl = rawUrl
                      ? rawUrl.startsWith('http')
                        ? `${rawUrl}${authParam}`
                        : `${serverHost}${rawUrl}${authParam}`
                      : `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80`;

                    return (
                      <div
                        key={log.log_id}
                        className={`rounded-xl border p-3 transition-colors ${
                          isDismissed
                            ? 'border-border/60 bg-surface/50 opacity-60'
                            : 'border-border bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Webcam Snapshot Thumbnail with Lightbox trigger */}
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: snapshotUrl,
                                  caption: `${log.violation_label} (${log.violation_code})`,
                                  code: log.violation_code,
                                  time: new Date(log.occurred_at).toLocaleString(),
                                })
                              }
                              className="group relative h-14 w-18 shrink-0 overflow-hidden rounded-lg border border-border bg-background cursor-pointer"
                              title="Click to view optical snapshot in lightbox"
                            >
                              <img
                                src={snapshotUrl}
                                alt="Webcam Optical Capture"
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-background/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-4 h-4 text-brand" />
                              </div>
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <SeverityBadge severity={log.severity} size="sm" />
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {log.violation_code}
                                </span>
                                <span className="font-mono text-xs font-bold text-rose-500">
                                  -{log.penalty_applied} PTS
                                </span>
                              </div>

                              <p className="text-xs text-foreground mt-1 truncate">
                                {log.violation_label}
                              </p>

                              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                {new Date(log.occurred_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusPill status={log.proctor_review_status} size="sm" />

                            {/* Review Actions */}
                            {isPending && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      logId: log.log_id,
                                      reviewStatus: 'CONFIRMED',
                                    })
                                  }
                                  className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-500 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                                  title="Confirm violation penalty"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      logId: log.log_id,
                                      reviewStatus: 'DISMISSED',
                                    })
                                  }
                                  className="rounded-lg bg-surface-elevated border border-border px-2 py-0.5 text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Dismiss violation & restore trust score via DB trigger"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Actions: Warn, Force Terminate, Reinstate */}
          <div className="border-t border-border/70 bg-surface-elevated/70 p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWarnModalOpen(true)}
                className="py-2 px-3.5 rounded-xl text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Warn Candidate</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {isTerminated ? (
                <button
                  type="button"
                  disabled={reinstateMutation.isPending}
                  onClick={() => reinstateMutation.mutate()}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reinstate Exam</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTerminateModalOpen(true)}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldOff className="w-4 h-4" />
                  <span>Force Terminate</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div key="lightbox-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/85 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-xl w-full rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand" />
                <h4 className="text-sm font-bold text-foreground font-mono">
                  Optical Evidence: {lightboxImage.code}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border bg-black">
              <img
                src={lightboxImage.url}
                alt="Optical Evidence Snapshot"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/40">
                LIVE TIMESTAMP: {lightboxImage.time}
              </div>
            </div>

            <div className="text-xs font-mono text-foreground">
              {lightboxImage.caption}
            </div>
          </motion.div>
        </div>
      )}

      {/* WARN CANDIDATE MODAL */}
      {warnModalOpen && (
        <div key="warn-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Issue Proctor Warning</span>
              </h4>
              <button
                type="button"
                onClick={() => setWarnModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Transmit an immediate intervention overlay to candidate's screen.
            </p>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setWarnMessage('Please keep your eyes and face directed at the screen.')}
                className="w-full text-left text-xs font-mono p-2 rounded-lg border border-border bg-surface-elevated hover:bg-muted text-foreground cursor-pointer"
              >
                • "Please keep your eyes and face directed at the screen."
              </button>
              <button
                type="button"
                onClick={() => setWarnMessage('Secondary screen or background tab activity detected. Return immediately.')}
                className="w-full text-left text-xs font-mono p-2 rounded-lg border border-border bg-surface-elevated hover:bg-muted text-foreground cursor-pointer"
              >
                • "Secondary screen or background tab activity detected."
              </button>
            </div>

            <textarea
              value={warnMessage}
              onChange={(e) => setWarnMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-elevated p-3 text-xs text-foreground focus:border-brand focus:outline-none font-mono"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWarnModalOpen(false)}
                className="py-1.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={warnMutation.isPending}
                onClick={() => warnMutation.mutate(warnMessage)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-95 shadow-sm transition-all cursor-pointer"
              >
                {warnMutation.isPending ? 'Transmitting...' : 'Send Warning Overlay'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* FORCE TERMINATE MODAL */}
      {terminateModalOpen && (
        <div key="terminate-modal" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-surface p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-rose-500 flex items-center gap-2">
                <ShieldOff className="w-4 h-4" />
                <span>Confirm Force Disqualification</span>
              </h4>
              <button
                type="button"
                onClick={() => setTerminateModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Immediately locks candidate out, writes terminal status to MySQL, and submits for ACID grading.
            </p>

            <textarea
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              rows={3}
              placeholder="Reason for termination..."
              className="w-full rounded-xl border border-rose-500/30 bg-surface-elevated p-3 text-xs text-foreground focus:border-rose-500 focus:outline-none font-mono"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTerminateModalOpen(false)}
                className="py-1.5 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={terminateMutation.isPending}
                onClick={() => terminateMutation.mutate(terminateReason)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer"
              >
                {terminateMutation.isPending ? 'Executing Lockout...' : 'Confirm Disqualification'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
