import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Laptop,
  Maximize2,
  RotateCcw,
  Send,
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
import { NeonButton } from '../ui/NeonButton';
import { TrustRing } from '../ui/TrustRing';
import { useAuthStore } from '../../store/authStore';
import { StatusPill } from '../ui/StatusPill';
import { SeverityBadge } from '../ui/SeverityBadge';
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

  const [warnModalOpen, setWarnModalOpen] = useState<boolean>(false);
  const [warnMessage, setWarnMessage] = useState<string>('Please ensure your face remains centered in the camera frame.');

  const [terminateModalOpen, setTerminateModalOpen] = useState<boolean>(false);
  const [terminateReason, setTerminateReason] = useState<string>('Proctor detected non-compliant examination behavior.');

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#060814]/80 backdrop-blur-md"
        />

        {/* Slide-over Container */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0C0E1C]/98 shadow-2xl overflow-hidden"
        >
          {/* Drawer Top Bar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#121528]/80 p-5">
            <div className="flex items-center gap-3">
              <motion.div
                layoutId={`student-avatar-${sessionId}`}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan/15 border border-cyan/40 text-cyan"
              >
                <User className="w-5 h-5" />
              </motion.div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {session?.student_name ?? `Candidate Session #${sessionId}`}
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  {session?.student_email} • {session?.exam_title}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill status={session?.status ?? 'IN_PROGRESS'} size="md" />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Close Inspector"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body Scroll */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
            {/* 1. Header Overview: TrustRing + Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-white/10 bg-[#080914]/80 p-4 items-center">
              <div className="flex justify-center sm:justify-start">
                <TrustRing
                  score={currentScore}
                  minThreshold={minThreshold}
                  size={96}
                  sublabel="Score"
                />
              </div>

              <div className="sm:col-span-2 space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Current Trust Rating:</span>
                  <span
                    className={
                      currentScore < minThreshold
                        ? 'text-magenta font-bold'
                        : currentScore < 85
                        ? 'text-amber font-bold'
                        : 'text-emerald font-bold'
                    }
                  >
                    {currentScore}%
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Termination Limit:</span>
                  <span className="text-magenta font-bold">{minThreshold}%</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Logged Violations:</span>
                  <span className="text-white font-bold">
                    {session?.total_violations ?? logs.length} (
                    <span className="text-amber">
                      {session?.pending_violations ?? 0} Pending
                    </span>
                    )
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Integrity Classification:</span>
                  <span
                    className={
                      currentScore < minThreshold || isTerminated
                        ? 'text-magenta font-bold'
                        : currentScore < 100
                        ? 'text-amber font-bold'
                        : 'text-emerald font-bold'
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
              <div className="rounded-xl border border-amber/40 bg-amber/10 p-3.5 flex items-center justify-between gap-3 shadow-glow-amber-sm">
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-5 h-5 text-amber animate-spin" />
                  <div>
                    <h5 className="text-xs font-bold text-amber">
                      Candidate Reinstatement Eligible
                    </h5>
                    <p className="text-[11px] text-amber-200/80">
                      Restored trust score satisfies exam threshold. Reopening exam requires proctor confirmation.
                    </p>
                  </div>
                </div>
                <NeonButton
                  variant="success"
                  size="sm"
                  isLoading={reinstateMutation.isPending}
                  onClick={() => reinstateMutation.mutate()}
                >
                  Reinstate Session
                </NeonButton>
              </div>
            )}

            {/* 2. Trust Score Timeline Chart */}
            <div className="rounded-2xl border border-white/10 bg-[#080914]/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan" />
                  <span>Trust Score Telemetry Timeline</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  Threshold: {minThreshold}%
                </span>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={currentScore < minThreshold ? '#F43F5E' : '#22D3EE'} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={currentScore < minThreshold ? '#F43F5E' : '#22D3EE'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="#475569"
                      fontSize={10}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-white/10 bg-[#0C0E1A]/95 p-2.5 text-xs font-mono shadow-xl">
                              <p className="text-white font-bold">{data.label}</p>
                              <p className="text-cyan">Trust Score: {data.trustScore}%</p>
                              <p className="text-slate-400 text-[10px]">{data.time}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine
                      y={minThreshold}
                      stroke="#F43F5E"
                      strokeDasharray="4 4"
                      label={{ value: `Limit: ${minThreshold}%`, fill: '#F43F5E', fontSize: 10, position: 'insideBottomRight' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="trustScore"
                      stroke={currentScore < minThreshold ? '#F43F5E' : '#22D3EE'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#trustGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Session Technical Info (IP, Device Fingerprint, Latency) */}
            <div className="rounded-2xl border border-white/10 bg-[#080914]/80 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-violet" />
                <span>Client Telemetry & Kiosk State</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/5 bg-[#0C0E1C] p-3 space-y-1">
                  <div className="text-[10px] text-slate-400">IP ADDRESS</div>
                  <div className="text-white font-semibold flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-cyan" />
                    <span>{session?.ip_address ?? '127.0.0.1 (Local)'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0C0E1C] p-3 space-y-1">
                  <div className="text-[10px] text-slate-400">DEVICE FINGERPRINT</div>
                  <div className="text-white font-semibold truncate" title={session?.device_fingerprint ?? 'Chrome / Windows Kiosk'}>
                    {session?.device_fingerprint ?? 'Chrome / Windows Kiosk'}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0C0E1C] p-3 space-y-1">
                  <div className="text-[10px] text-slate-400">STARTED AT</div>
                  <div className="text-white">
                    {session?.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0C0E1C] p-3 space-y-1">
                  <div className="text-[10px] text-slate-400">SERVER DEADLINE</div>
                  <div className="text-white">
                    {session?.server_deadline ? new Date(session.server_deadline).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Violation Incident Ledger with Lightbox Snapshots */}
            <div className="rounded-2xl border border-white/10 bg-[#080914]/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-magenta" />
                  <span>Violation Audit & Optical Evidence</span>
                </h4>
                <span className="text-[10px] font-mono text-slate-400">
                  {logs.length} Total Incidents
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-emerald">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald" />
                  Zero violations recorded. Perfect candidate integrity.
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => {
                    const isPending = log.proctor_review_status === 'PENDING';
                    const isDismissed = log.proctor_review_status === 'DISMISSED';

                    const token = useAuthStore.getState().token;
                    const rawUrl =
                      (log as any).snapshot_url ||
                      (log.evidence_meta as any)?.snapshot_url ||
                      (log.evidence_meta as any)?.snapshotUrl;
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
                            ? 'border-white/5 bg-[#0A0B16]/50 opacity-60'
                            : 'border-white/10 bg-[#0D0F1E]'
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
                              className="group relative h-14 w-18 shrink-0 overflow-hidden rounded-lg border border-cyan/40 bg-void"
                              title="Click to view optical snapshot in lightbox"
                            >
                              <img
                                src={snapshotUrl}
                                alt="Webcam Optical Capture"
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-void/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-4 h-4 text-cyan" />
                              </div>
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <SeverityBadge severity={log.severity} size="sm" />
                                <span className="font-mono text-xs font-bold text-white">
                                  {log.violation_code}
                                </span>
                                <span className="font-mono text-xs font-bold text-magenta">
                                  -{log.penalty_applied} PTS
                                </span>
                              </div>

                              <p className="text-xs text-slate-300 mt-1 truncate">
                                {log.violation_label}
                              </p>

                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">
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
                                  className="rounded bg-emerald/20 border border-emerald/40 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald hover:bg-emerald/30 transition-colors"
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
                                  className="rounded bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300 hover:bg-white/20 transition-colors"
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
          <div className="border-t border-white/10 bg-[#121528]/90 p-4 sm:p-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <NeonButton
                variant="ghost"
                size="sm"
                leftIcon={<AlertTriangle className="w-4 h-4 text-amber" />}
                onClick={() => setWarnModalOpen(true)}
              >
                Warn Candidate
              </NeonButton>
            </div>

            <div className="flex items-center gap-2">
              {isTerminated ? (
                <NeonButton
                  variant="success"
                  size="sm"
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                  isLoading={reinstateMutation.isPending}
                  onClick={() => reinstateMutation.mutate()}
                >
                  Reinstate Exam
                </NeonButton>
              ) : (
                <NeonButton
                  variant="danger"
                  size="sm"
                  leftIcon={<ShieldOff className="w-4 h-4" />}
                  onClick={() => setTerminateModalOpen(true)}
                >
                  Force Terminate
                </NeonButton>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#05060E]/90 backdrop-blur-xl">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-xl w-full rounded-2xl border border-cyan/40 bg-[#0A0D1E] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan" />
                <h4 className="text-sm font-bold text-white font-mono">
                  Optical Evidence: {lightboxImage.code}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black">
              <img
                src={lightboxImage.url}
                alt="Optical Evidence Snapshot"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-emerald border border-emerald/40">
                LIVE TIMESTAMP: {lightboxImage.time}
              </div>
            </div>

            <div className="text-xs font-mono text-slate-300">
              {lightboxImage.caption}
            </div>
          </motion.div>
        </div>
      )}

      {/* WARN CANDIDATE MODAL */}
      {warnModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#05060E]/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-amber/40 bg-[#101222] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber" />
                <span>Issue Proctor Warning</span>
              </h4>
              <button
                type="button"
                onClick={() => setWarnModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Transmit an immediate intervention overlay to candidate's screen.
            </p>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setWarnMessage('Please keep your eyes and face directed at the screen.')}
                className="w-full text-left text-xs font-mono p-2 rounded border border-white/5 bg-white/5 hover:bg-white/10 text-slate-300"
              >
                • "Please keep your eyes and face directed at the screen."
              </button>
              <button
                type="button"
                onClick={() => setWarnMessage('Secondary screen or background tab activity detected. Return immediately.')}
                className="w-full text-left text-xs font-mono p-2 rounded border border-white/5 bg-white/5 hover:bg-white/10 text-slate-300"
              >
                • "Secondary screen or background tab activity detected."
              </button>
            </div>

            <textarea
              value={warnMessage}
              onChange={(e) => setWarnMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-[#0A0B14] p-3 text-xs text-white focus:border-amber focus:outline-none font-mono"
            />

            <div className="flex justify-end gap-2">
              <NeonButton variant="ghost" size="sm" onClick={() => setWarnModalOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton
                variant="secondary"
                size="sm"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                isLoading={warnMutation.isPending}
                onClick={() => warnMutation.mutate(warnMessage)}
              >
                Transmit Warning
              </NeonButton>
            </div>
          </motion.div>
        </div>
      )}

      {/* FORCE TERMINATE MODAL */}
      {terminateModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[#05060E]/85 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-2xl border border-magenta/50 bg-[#160B14] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-magenta/20 border border-magenta text-magenta">
                <AlertOctagon className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Confirm Force Disqualification
                </h4>
                <p className="text-xs text-rose-200/80">
                  Instantly terminates session and grades zero with DISQUALIFIED rating.
                </p>
              </div>
            </div>

            <textarea
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              rows={3}
              placeholder="State reason for manual termination..."
              className="w-full rounded-xl border border-magenta/30 bg-[#0A050B] p-3 text-xs text-white focus:border-magenta focus:outline-none font-mono"
            />

            <div className="flex justify-end gap-2">
              <NeonButton variant="ghost" size="sm" onClick={() => setTerminateModalOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton
                variant="danger"
                size="sm"
                isLoading={terminateMutation.isPending}
                onClick={() => terminateMutation.mutate(terminateReason)}
              >
                Disqualify & Terminate
              </NeonButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
