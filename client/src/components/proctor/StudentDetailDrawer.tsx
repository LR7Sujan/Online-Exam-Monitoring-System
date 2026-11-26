import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Laptop,
  Lock,
  Maximize2,
  RotateCcw,
  ShieldAlert,
  ShieldOff,
  Unlock,
  User,
  Video,
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
import { EvidenceImage } from '../ui/EvidenceImage';
import { ParticleBurst } from '../ui/ParticleBurst';
import { StatusPill } from '../ui/StatusPill';
import { SeverityBadge } from '../ui/SeverityBadge';
import { ChartTooltip, useChartTheme } from '../charts/shared';
import { api } from '../../lib/api';
import { playPingSound } from '../../utils/audioAlert';
import { useAuthStore } from '../../store/authStore';
import { RecordingPlayer } from '../recording/RecordingPlayer';
import type {
  ProctorLiveMonitorRow,
  ReviewStatus,
  ViolationAuditRow,
  SessionWarning,
  ExamRecordingItem,
} from '../../types/domain';

interface StudentDetailDrawerProps {
  sessionId: number | null;
  onClose: () => void;
}

interface InspectResponse {
  session: ProctorLiveMonitorRow;
  logs: ViolationAuditRow[];
}

interface StudentPaperQuestion {
  questionId: number;
  displayNumber: number;
  originalOrderIndex: number;
  questionText: string;
  marks: number;
  displayedOptions: { A: string; B: string; C: string; D: string };
  originalOptions: { A: string; B: string; C: string; D: string };
  optionMapping: { A: string; B: string; C: string; D: string };
  correctOptionOriginal: string;
  studentAnswerOriginal: string | null;
  studentAnswerDisplayed: string | null;
  isCorrect: boolean;
}

interface StudentPaperResponse {
  session: {
    id: number;
    studentName: string;
    examTitle: string;
    paperCode: string;
    paperHash: string;
  };
  questions: StudentPaperQuestion[];
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

  const [paperModalOpen, setPaperModalOpen] = useState<boolean>(false);

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

  const warningsQuery = useQuery<SessionWarning[]>({
    queryKey: ['session-warnings', sessionId],
    queryFn: () => api.get<SessionWarning[]>(`/sessions/${sessionId}/warnings`),
    enabled: sessionId !== null && sessionId > 0,
    refetchInterval: 10000,
  });
  const warnings = warningsQuery.data ?? [];

  const paperQuery = useQuery<StudentPaperResponse>({
    queryKey: ['proctor-session-paper', sessionId],
    queryFn: () => api.get<StudentPaperResponse>(`/proctor/sessions/${sessionId}/paper`),
    enabled: paperModalOpen && sessionId !== null && sessionId > 0,
  });

  const token = useAuthStore((s) => s.token);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [playerModalOpen, setPlayerModalOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const recordingQuery = useQuery<ExamRecordingItem | null>({
    queryKey: ['session-recording', sessionId],
    queryFn: async () => {
      try {
        return await api.get<ExamRecordingItem>(`/recordings/session/${sessionId}`);
      } catch {
        return null;
      }
    },
    enabled: sessionId !== null && sessionId > 0,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'RECORDING') return 5000;
      return false;
    },
  });
  const recording = recordingQuery.data;

  const legalHoldMutation = useMutation({
    mutationFn: ({ recordingId, legalHold }: { recordingId: number; legalHold: boolean }) =>
      api.patch(`/recordings/${recordingId}/legal-hold`, { legalHold }),
    onSuccess: () => {
      toast.success('Legal hold status updated');
      queryClient.invalidateQueries({ queryKey: ['session-recording', sessionId] });
    },
    onError: () => {
      toast.error('Failed to update legal hold');
    },
  });

  // Review single log mutation
  const reviewMutation = useMutation({
    mutationFn: (vars: { logId: number; reviewStatus: ReviewStatus; notes?: string }) =>
      api.patch(`/proctor/logs/${vars.logId}/review`, {
        status: vars.reviewStatus,
        reviewStatus: vars.reviewStatus,
        note: vars.notes,
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
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      toast.error(`Review update failed: ${msg}`);
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

  if (typeof document === 'undefined' || !sessionId) return null;

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
          data-testid="student-detail-drawer"
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
                  size="md"
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

                <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 space-y-1 sm:col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">PAPER CODE VERSION</div>
                    <div className="text-brand font-bold flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand" />
                      <span data-testid="drawer-paper-code" className="text-sm">{session?.paper_code || 'Standard Paper'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="view-student-paper-button"
                    onClick={() => setPaperModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl border border-brand/40 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Student's Paper</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Time Extension Status & Actions */}
            {session?.extension_request_status && (
              <div
                className={`rounded-2xl border p-4 font-mono text-xs space-y-3 ${session.extension_request_status === 'PENDING'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                  : session.extension_request_status === 'APPROVED'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                    : 'border-border bg-surface-elevated/70 text-muted-foreground'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <strong className="text-foreground font-bold">Time Extension Status</strong>
                  </div>
                  <span className="font-bold px-2 py-0.5 rounded-full text-[10px] uppercase bg-surface border border-border">
                    {session.extension_request_status}
                  </span>
                </div>
                <div className="space-y-1 text-foreground">
                  <p>
                    Requested: <strong>{session.requested_extension_minutes || 0} minutes</strong>
                    {session.granted_extension_minutes ? ` • Granted: ${session.granted_extension_minutes}m` : ''}
                  </p>
                  {session.extension_reason && (
                    <p className="text-muted-foreground italic">"{session.extension_reason}"</p>
                  )}
                  {session.extension_decided_by_name && (
                    <p className="text-[11px] text-muted-foreground">
                      Decided by {session.extension_decided_by_name} at{' '}
                      {session.extension_decided_at ? new Date(session.extension_decided_at).toLocaleTimeString() : ''}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 4. Webcam Session Video Recording Player */}
            <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Video className="w-4 h-4 text-brand" />
                  <span>Webcam Session Recording</span>
                </h4>
                {recording && (
                  <div className="flex items-center gap-2">
                    {recording.status === 'READY' && (
                      <button
                        type="button"
                        data-testid="open-full-review-player-btn"
                        onClick={() => setPlayerModalOpen(true)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-brand/40 bg-brand/10 text-brand hover:bg-brand/20 transition-colors cursor-pointer"
                      >
                        <Maximize2 className="w-3 h-3" />
                        <span>Review Player</span>
                      </button>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        recording.status === 'READY'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : recording.status === 'RECORDING'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                      }`}
                    >
                      {recording.status}
                    </span>
                  </div>
                )}
              </div>

              {recordingQuery.isLoading ? (
                <div className="py-6 text-center text-muted-foreground">
                  Loading recording telemetry...
                </div>
              ) : !recording ? (
                <div className="py-5 text-center text-muted-foreground rounded-xl border border-dashed border-border/80 bg-surface/50">
                  <Video className="w-6 h-6 mx-auto mb-1 text-muted-foreground/40" />
                  <span>No recording stream available for this session</span>
                </div>
              ) : recording.status === 'RECORDING' ? (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-400 flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                  </span>
                  <div>
                    <p className="font-bold">Live Stream Capture In Progress</p>
                    <p className="text-[10px] text-muted-foreground">
                      Continuous chunk recording is active. Video playback will be finalized when candidate finishes the exam.
                    </p>
                  </div>
                </div>
              ) : recording.status === 'FAILED' ? (
                <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-400">
                  <p className="font-bold">Recording Finalization Failed</p>
                  <p className="text-[10px] text-muted-foreground">
                    Unable to concatenate or finalize webcam video stream.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* HTML5 Video Player */}
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border bg-black shadow-inner">
                    <video
                      ref={videoRef}
                      data-testid="recording-video-player"
                      src={`${import.meta.env.VITE_API_URL ?? '/api'}/recordings/${recording.recording_id}/stream?token=${encodeURIComponent(token || '')}`}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Controls & Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                    {/* Playback speed selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">SPEED:</span>
                      {[1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => {
                            setPlaybackSpeed(spd);
                            if (videoRef.current) {
                              videoRef.current.playbackRate = spd;
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            playbackSpeed === spd
                              ? 'bg-brand text-white border-brand'
                              : 'bg-surface border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>

                    {/* Metadata pill details */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{(recording.size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>
                        {Math.floor(recording.duration_ms / 60000)}m{' '}
                        {Math.floor((recording.duration_ms % 60000) / 1000)}s
                      </span>
                    </div>

                    {/* Legal Hold Toggle */}
                    <button
                      type="button"
                      disabled={legalHoldMutation.isPending}
                      onClick={() =>
                        legalHoldMutation.mutate({
                          recordingId: recording.recording_id,
                          legalHold: !recording.legal_hold,
                        })
                      }
                      title={
                        recording.legal_hold
                          ? 'Recording under legal hold (exempt from retention pruning)'
                          : 'Mark recording for legal hold'
                      }
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        recording.legal_hold
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-surface border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {recording.legal_hold ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Legal Hold Active</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          <span>Enable Legal Hold</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Violation Incident Ledger with Lightbox Snapshots */}
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
                  {logs.map((log, idx) => {
                    const isPending = log.proctor_review_status === 'PENDING';
                    const isDismissed = log.proctor_review_status === 'DISMISSED';

                    const logRecord = log as unknown as Record<string, unknown>;
                    const meta = log.evidence_meta as Record<string, unknown> | undefined;
                    const rawUrl =
                      (typeof logRecord.snapshot_url === 'string' ? logRecord.snapshot_url : undefined) ||
                      (typeof logRecord.snapshotUrl === 'string' ? logRecord.snapshotUrl : undefined) ||
                      (typeof meta?.snapshot_url === 'string' ? meta.snapshot_url : undefined) ||
                      (typeof meta?.snapshotUrl === 'string' ? meta.snapshotUrl : undefined);

                    return (
                      <div
                        key={`audit-log-${log.log_id ?? idx}-${idx}`}
                        className={`rounded-xl border p-3 transition-colors ${isDismissed
                          ? 'border-border/60 bg-surface/50 opacity-60'
                          : 'border-border bg-surface'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Webcam Snapshot Thumbnail with EvidenceImage */}
                            <EvidenceImage
                              src={rawUrl}
                              violationCode={log.violation_code}
                              timestamp={log.occurred_at}
                              containerClassName="h-16 w-24 shrink-0"
                              aspectRatio="auto"
                              enableLightbox={true}
                            />

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
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      logId: log.log_id,
                                      reviewStatus: 'CONFIRMED',
                                    })
                                  }
                                  className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-500 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Confirm violation penalty"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      logId: log.log_id,
                                      reviewStatus: 'DISMISSED',
                                    })
                                  }
                                  className="rounded-lg bg-surface-elevated border border-border px-2 py-0.5 text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Dismiss violation & restore trust score via DB trigger"
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const matchingWarning = warnings.find(
                            (w) => Number(w.log_id ?? w.logId) === Number(log.log_id)
                          );
                          if (!matchingWarning) return null;
                          const ackedAt = matchingWarning.acknowledged_at ?? matchingWarning.acknowledgedAt;
                          const warningIdx = warnings.indexOf(matchingWarning) + 1;
                          return (
                            <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono">
                              <span className="text-amber-500 font-bold">
                                Warning #{warningIdx}
                              </span>
                              {ackedAt ? (
                                <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    Warning acknowledged at {new Date(ackedAt).toLocaleTimeString()}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-amber-500 flex items-center gap-1 font-semibold">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Warning issued (Pending acknowledgment)</span>
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
      <Modal
        isOpen={Boolean(lightboxImage)}
        onClose={() => setLightboxImage(null)}
        size="lg"
        title={
          lightboxImage ? (
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-brand" />
              <span className="text-sm font-bold text-foreground font-mono">
                Optical Evidence: {lightboxImage.code}
              </span>
            </div>
          ) : undefined
        }
      >
        {lightboxImage && (
          <div className="space-y-4">
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
          </div>
        )}
      </Modal>

      {/* WARN CANDIDATE MODAL */}
      <Modal
        isOpen={warnModalOpen}
        onClose={() => setWarnModalOpen(false)}
        size="md"
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Issue Proctor Warning</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
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
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>

      {/* FORCE TERMINATE MODAL */}
      <Modal
        isOpen={terminateModalOpen}
        onClose={() => setTerminateModalOpen(false)}
        size="md"
        title={
          <div className="flex items-center gap-2 text-rose-500">
            <ShieldOff className="w-4 h-4" />
            <span>Confirm Force Disqualification</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
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
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>

      {/* STUDENT PAPER VERSION INSPECTION MODAL */}
      <Modal
        isOpen={paperModalOpen}
        onClose={() => setPaperModalOpen(false)}
        size="xl"
        title={
          <div className="flex items-center gap-2 text-brand">
            <FileText className="w-5 h-5 text-brand" />
            <span>Candidate Paper Layout ({paperQuery.data?.session.paperCode ?? session?.paper_code ?? 'Unique Paper'})</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full text-xs font-mono text-muted-foreground">
            <span>Deterministic SHA-256 Paper Hash: {paperQuery.data?.session.paperHash?.slice(0, 16)}...</span>
            <button
              type="button"
              onClick={() => setPaperModalOpen(false)}
              className="py-1.5 px-4 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-muted text-foreground border border-border cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 scrollbar-thin">
          <div className="p-3 rounded-xl border border-border bg-surface-elevated/70 text-xs font-mono flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Candidate:</span>{' '}
              <span className="font-bold text-foreground">{session?.student_name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Paper Code:</span>{' '}
              <span className="font-bold text-brand bg-brand/10 border border-brand/30 px-2 py-0.5 rounded">
                {paperQuery.data?.session.paperCode ?? session?.paper_code}
              </span>
            </div>
          </div>

          {paperQuery.isLoading && (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Retrieving candidate paper permutation and response mapping...
            </div>
          )}

          {paperQuery.data?.questions.map((q, qIdx) => (
            <div
              key={`paper-q-${q.questionId ?? qIdx}-${qIdx}`}
              className="rounded-2xl border border-border bg-surface p-4 space-y-3 text-xs"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-brand text-sm">
                    Q{q.displayNumber}
                  </span>
                  <span className="text-[11px] text-muted-foreground border border-border px-1.5 py-0.5 rounded bg-surface-elevated">
                    Orig #{q.originalOrderIndex ?? q.questionId}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span>{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}</span>
                  {q.studentAnswerOriginal && (
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${q.isCorrect
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                        }`}
                    >
                      {q.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                </div>
              </div>

              <p className="font-medium text-foreground text-sm leading-relaxed">
                {q.questionText}
              </p>

              {/* Options Mapping Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                {(['A', 'B', 'C', 'D'] as const).map((dispLetter) => {
                  const origLetter = q.optionMapping[dispLetter];
                  const text = q.displayedOptions[dispLetter];
                  const isSelected = q.studentAnswerDisplayed === dispLetter;
                  const isCorrectAnswer = origLetter === q.correctOptionOriginal;

                  return (
                    <div
                      key={`q-${q.questionId ?? qIdx}-opt-${dispLetter}`}
                      className={`p-2.5 rounded-xl border transition-all ${isSelected
                        ? isCorrectAnswer
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-rose-500 bg-rose-500/10'
                        : isCorrectAnswer
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-border bg-surface-elevated/60'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded flex items-center justify-center bg-brand/10 text-brand text-[11px]">
                            {dispLetter}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            (Orig {origLetter})
                          </span>
                        </span>
                        {isSelected && (
                          <span className="text-[10px] uppercase font-bold text-brand">
                            Candidate Choice
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground font-sans line-clamp-2">
                        {text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* FULL RECORDING REVIEW PLAYER PORTAL */}
      {playerModalOpen && recording && (
        <RecordingPlayer
          recordingId={recording.recording_id}
          isOpen={playerModalOpen}
          onClose={() => setPlayerModalOpen(false)}
          mode="modal"
        />
      )}
    </AnimatePresence>,
    document.body
  );
}
