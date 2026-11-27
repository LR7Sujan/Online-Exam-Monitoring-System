import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Grid3X3,
  ListOrdered,
  Radio,
  Search,
  Shield,
} from 'lucide-react';
import { EmergencyBanner, type CriticalViolationEvent } from '../components/proctor/EmergencyBanner';
import { KpiStrip, type ProctorKpiData } from '../components/proctor/KpiStrip';
import { StudentTile } from '../components/proctor/StudentTile';
import { LiveFeedSidebar, type LiveViolationItem } from '../components/proctor/LiveFeedSidebar';
import { StudentDetailDrawer } from '../components/proctor/StudentDetailDrawer';
import { ReviewQueueTable } from '../components/proctor/ReviewQueueTable';
import { TimeExtensionRequestsDrawer } from '../components/proctor/TimeExtensionRequestsDrawer';
import { SkeletonCard, useBoundedLoading } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { playPingSound } from '../utils/audioAlert';
import type { ExamItem, ProctorLiveMonitorRow, SessionStatus, TimeExtensionRequest } from '../types/domain';

export function ProctorDashboardPage({ initialTab = 'monitor' }: { initialTab?: string } = {}) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Navigation Views: 'monitor' (Live Grid + Feed) | 'queue' (Review Queue Table)
  const [activeTab, setActiveTab] = useState<'monitor' | 'queue'>(
    initialTab === 'audit' || initialTab === 'queue' ? 'queue' : 'monitor'
  );

  // Synchronize active tab when URL route changes (e.g. /proctor <-> /proctor/audit)
  useEffect(() => {
    setActiveTab(initialTab === 'audit' || initialTab === 'queue' ? 'queue' : 'monitor');
  }, [initialTab]);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [inspectedSessionId, setInspectedSessionId] = useState<number | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<CriticalViolationEvent | null>(null);
  const [extensionDrawerOpen, setExtensionDrawerOpen] = useState<boolean>(false);

  // Shaking tiles map (sessionId -> boolean)
  const [shakingTiles, setShakingTiles] = useState<Record<number, boolean>>({});

  // Batched socket query invalidation via requestAnimationFrame to avoid frame drops
  const rafInvalidateRef = useRef<number | null>(null);
  const batchInvalidate = useCallback(() => {
    if (rafInvalidateRef.current !== null) return;
    rafInvalidateRef.current = requestAnimationFrame(() => {
      rafInvalidateRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    });
  }, [queryClient]);

  useEffect(() => {
    return () => {
      if (rafInvalidateRef.current !== null) {
        cancelAnimationFrame(rafInvalidateRef.current);
      }
    };
  }, []);

  // Realtime streaming violation feed
  const [liveFeed, setLiveFeed] = useState<LiveViolationItem[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Just finished sessions strip (last 5 min, collapsed by default)
  const [justFinished, setJustFinished] = useState<
    { sessionId: number; studentName: string; examTitle: string; status: string; finishedAt: number }[]
  >([]);
  const [showJustFinished, setShowJustFinished] = useState<boolean>(false);

  // 1. Fetch Authoritative KPIs
  const kpiQuery = useQuery({
    queryKey: ['proctor-kpis'],
    queryFn: () => api.get<ProctorKpiData>('/proctor/kpis'),
    placeholderData: keepPreviousData,
    refetchInterval: () => (typeof document !== 'undefined' && document.hidden ? false : 10000),
  });

  // 2. Fetch Exams for Filter Dropdown
  const examsQuery = useQuery({
    queryKey: ['proctor-exams-list'],
    queryFn: () => api.get<ExamItem[]>('/exams'),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // 3. Fetch Live Monitor Grid Sessions from SQL View vw_LiveSessions
  const monitorQuery = useQuery({
    queryKey: ['proctor-live-monitor', selectedExamId, selectedStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedExamId !== 'ALL') params.set('examId', selectedExamId);
      if (selectedStatus !== 'ALL') {
        params.set('status', selectedStatus);
      }
      return api.get<ProctorLiveMonitorRow[]>(`/proctor/live-monitor?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    refetchInterval: () => (typeof document !== 'undefined' && document.hidden ? false : 10000),
  });

  const { isTimedOut: isMonitorTimedOut } = useBoundedLoading(monitorQuery.isLoading);

  // 3b. Fetch Time Extension Requests for Indicator Badge
  const extensionsQuery = useQuery({
    queryKey: ['proctor-extensions'],
    queryFn: () => api.get<TimeExtensionRequest[]>('/monitor/extensions'),
    placeholderData: keepPreviousData,
    refetchInterval: () => (typeof document !== 'undefined' && document.hidden ? false : 6000),
  });
  const pendingExtensionsCount = (extensionsQuery.data ?? []).filter((r) => r.status === 'PENDING').length;

  const rawSessions = useMemo(() => monitorQuery.data ?? [], [monitorQuery.data]);
  const exams = useMemo(() => examsQuery.data ?? [], [examsQuery.data]);

  // Exam filter lists only exams that have live sessions
  const liveExams = useMemo(() => {
    const liveExamIds = new Set(rawSessions.map((s) => s.exam_id));
    return exams.filter((e) => liveExamIds.has(e.id));
  }, [rawSessions, exams]);

  // Reset exam filter if current selection has no live sessions
  useEffect(() => {
    if (selectedExamId !== 'ALL' && !liveExams.some((e) => String(e.id) === String(selectedExamId))) {
      setSelectedExamId('ALL');
    }
  }, [liveExams, selectedExamId]);

  // Helper to trigger a temporary tile shake animation
  const triggerTileShake = useCallback((sessionId: number) => {
    setShakingTiles((prev) => ({ ...prev, [sessionId]: true }));
    setTimeout(() => {
      setShakingTiles((prev) => ({ ...prev, [sessionId]: false }));
    }, 1200);
  }, []);

  // Helper to remove finished/terminated candidate tile with exit animation
  const removeLiveTile = useCallback(
    (sessionId: number, studentName?: string, examTitle?: string, status?: string) => {
      // Resolve candidate name and exam title from query cache if missing in event payload
      const cached = queryClient.getQueryData<ProctorLiveMonitorRow[]>(['proctor-live-monitor']);
      const match = cached?.find((s) => s.session_id === sessionId);
      const finalName = studentName || match?.student_name || `Candidate #${sessionId}`;
      const finalTitle = examTitle || match?.exam_title || 'Assessment';

      // 1. Optimistically filter from query cache so exit animation starts immediately
      queryClient.setQueriesData<ProctorLiveMonitorRow[]>(
        { queryKey: ['proctor-live-monitor'] },
        (old) => {
          if (!old) return old;
          return old.filter((s) => s.session_id !== sessionId);
        }
      );

      // 2. Add to Just Finished strip (keep last 5)
      setJustFinished((prev) => [
        {
          sessionId,
          studentName: finalName,
          examTitle: finalTitle,
          status: status ?? 'COMPLETED',
          finishedAt: Date.now(),
        },
        ...prev.filter((p) => p.sessionId !== sessionId).slice(0, 4),
      ]);

      // 3. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    },
    [queryClient]
  );

  // 4. Serverless Realtime Telemetry Ingestion
  useEffect(() => {
    const socket = getSocket(token);
    if (!socket) return;

    setSocketConnected(socket.connected);

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    // Violation Event
    const onViolation = (payload: {
      logId?: number;
      sessionId: number;
      examId?: number;
      examTitle?: string;
      studentId?: number;
      studentName?: string;
      violationCode: string;
      violationLabel?: string;
      severity?: string;
      penaltyApplied?: number;
      trustScore?: number;
      trust_score?: number;
      status?: SessionStatus;
      sessionStatus?: SessionStatus;
      occurredAt?: string;
    }) => {
      const severity = payload.severity ?? 'MEDIUM';
      const score = payload.trustScore ?? payload.trust_score ?? 100;
      const isCritical =
        severity === 'CRITICAL' ||
        payload.violationCode === 'MULTIPLE_FACES' ||
        payload.violationCode === 'DEVTOOLS_OPEN';

      // 1. Play synthesized Web Audio Ping
      playPingSound(isCritical ? 'critical' : 'violation');

      // 2. Trigger Emergency Banner if critical
      if (isCritical) {
        setCriticalAlert({
          logId: payload.logId,
          sessionId: payload.sessionId,
          studentName: payload.studentName,
          violationCode: payload.violationCode,
          violationLabel: payload.violationLabel,
          severity,
          penaltyApplied: payload.penaltyApplied,
          trustScore: score,
          occurredAt: payload.occurredAt ?? new Date().toISOString(),
          examTitle: payload.examTitle,
        });
      }

      // 3. Slide new item into Right-side Live Feed
      const newItem: LiveViolationItem = {
        id: `${payload.sessionId}-${Date.now()}-${Math.random()}`,
        logId: payload.logId,
        sessionId: payload.sessionId,
        studentName: payload.studentName,
        violationCode: payload.violationCode,
        violationLabel: payload.violationLabel,
        severity,
        penaltyApplied: payload.penaltyApplied,
        trustScore: score,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
      };
      setLiveFeed((prev) => [newItem, ...prev.slice(0, 39)]);

      // 4. Shake the specific student tile
      triggerTileShake(payload.sessionId);

      // 5. Invalidate cached queries batched via rAF
      batchInvalidate();
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
      if (inspectedSessionId === payload.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
      }
    };

    // Session Terminated Event
    const onSessionTerminated = (payload: {
      sessionId: number;
      studentName?: string;
      examTitle?: string;
      reason?: string;
    }) => {
      playPingSound('critical');
      triggerTileShake(payload.sessionId);
      removeLiveTile(payload.sessionId, payload.studentName, payload.examTitle, 'TERMINATED');
    };

    // Exam Submitted Event
    const onExamSubmitted = (payload: {
      sessionId: number;
      studentName?: string;
      examTitle?: string;
      status?: string;
    }) => {
      removeLiveTile(payload.sessionId, payload.studentName, payload.examTitle, payload.status ?? 'SUBMITTED');
    };

    // Session Update / Reinstated / Status change
    const onSessionUpdate = (payload: {
      sessionId: number;
      status?: string;
      studentName?: string;
      examTitle?: string;
    }) => {
      if (payload.status && payload.status !== 'IN_PROGRESS') {
        removeLiveTile(payload.sessionId, payload.studentName, payload.examTitle, payload.status);
      } else {
        batchInvalidate();
        if (inspectedSessionId === payload.sessionId) {
          queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
        }
      }
    };

    // Session Started Event (New Candidate Entered)
    const onSessionStarted = () => {
      batchInvalidate();
    };

    // Simulator Reset Event
    const onSimulatorReset = () => {
      batchInvalidate();
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
      queryClient.setQueryData<ProctorLiveMonitorRow[]>(['proctor-live-monitor'], (old) => {
        if (!old) return old;
        return old.filter((s) => !s.student_email.startsWith('virtual.candidate.'));
      });
      if (inspectedSessionId) {
        queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
      }
    };

    const onExtensionRequested = () => {
      playPingSound('violation');
      queryClient.invalidateQueries({ queryKey: ['proctor-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
    };

    const onExtensionDecided = () => {
      queryClient.invalidateQueries({ queryKey: ['proctor-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
    };

    const onWarningIssued = (payload: {
      warningId: number;
      sessionId: number;
      studentName?: string;
      violationCode?: string;
      penaltyPoints?: number;
      trustScoreAfter?: number;
      warningCount?: number;
      issuedAt?: string;
    }) => {
      playPingSound('violation');
      triggerTileShake(payload.sessionId);
      const newItem: LiveViolationItem = {
        id: `warning-issued-${payload.warningId}-${Date.now()}`,
        sessionId: payload.sessionId,
        studentName: payload.studentName ?? `Session #${payload.sessionId}`,
        violationCode: 'WARNING_ISSUED',
        violationLabel: `Warning ${payload.warningCount ?? ''} Issued`,
        severity: 'HIGH',
        penaltyApplied: payload.penaltyPoints,
        trustScore: payload.trustScoreAfter,
        occurredAt: payload.issuedAt ?? new Date().toISOString(),
      };
      setLiveFeed((prev) => [newItem, ...prev.slice(0, 39)]);
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      if (inspectedSessionId === payload.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
      }
    };

    const onWarningAcked = (payload: {
      warningId: number;
      sessionId: number;
      studentName?: string;
      acknowledgedAt?: string;
    }) => {
      const newItem: LiveViolationItem = {
        id: `warning-acked-${payload.warningId}-${Date.now()}`,
        sessionId: payload.sessionId,
        studentName: payload.studentName ?? `Session #${payload.sessionId}`,
        violationCode: 'WARNING_ACKED',
        violationLabel: 'Warning Acknowledged',
        severity: 'LOW',
        occurredAt: payload.acknowledgedAt ?? new Date().toISOString(),
      };
      setLiveFeed((prev) => [newItem, ...prev.slice(0, 39)]);
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      if (inspectedSessionId === payload.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('violation:new', onViolation);
    socket.on('session:terminated', onSessionTerminated);
    socket.on('session:update', onSessionUpdate);
    socket.on('session:reinstated', onSessionUpdate);
    socket.on('session:started', onSessionStarted);
    socket.on('exam:submitted', onExamSubmitted);
    socket.on('violation:reviewed', onSessionUpdate);
    socket.on('simulator:reset', onSimulatorReset);
    socket.on('extension:requested', onExtensionRequested);
    socket.on('extension:decided', onExtensionDecided);
    socket.on('warning:issued', onWarningIssued);
    socket.on('warning:acked', onWarningAcked);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('violation:new', onViolation);
      socket.off('session:terminated', onSessionTerminated);
      socket.off('session:update', onSessionUpdate);
      socket.off('session:reinstated', onSessionUpdate);
      socket.off('session:started', onSessionStarted);
      socket.off('exam:submitted', onExamSubmitted);
      socket.off('violation:reviewed', onSessionUpdate);
      socket.off('simulator:reset', onSimulatorReset);
      socket.off('extension:requested', onExtensionRequested);
      socket.off('extension:decided', onExtensionDecided);
      socket.off('warning:issued', onWarningIssued);
      socket.off('warning:acked', onWarningAcked);
    };
  }, [inspectedSessionId, queryClient, removeLiveTile, token, triggerTileShake, batchInvalidate]);

  // Filter & Sort Sessions for Student Grid
  const displaySessions = useMemo(() => {
    let result = [...rawSessions];

    // Filter by live exam
    if (selectedExamId !== 'ALL') {
      result = result.filter((s) => String(s.exam_id) === String(selectedExamId));
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.student_name.toLowerCase().includes(q) ||
          s.student_email.toLowerCase().includes(q) ||
          s.exam_title.toLowerCase().includes(q)
      );
    }

    // Filter by Live Status: 'ALL' (All live) | 'WARNED' | 'AT_RISK'
    if (selectedStatus === 'WARNED') {
      result = result.filter(
        (s) => Number(s.warning_count ?? 0) > 0 || Boolean(s.pending_warning_log_id)
      );
    } else if (selectedStatus === 'AT_RISK') {
      result = result.filter((s) => {
        const score = Number(s.trust_score);
        const minThreshold = Number(s.min_trust_score ?? 50);
        return score < minThreshold + 15;
      });
    }

    // Filter by Severity
    if (selectedSeverity !== 'ALL') {
      result = result.filter((s) => {
        const score = Number(s.trust_score);
        const minThreshold = Number(s.min_trust_score ?? 50);
        if (selectedSeverity === 'CRITICAL') {
          return score < minThreshold;
        }
        if (selectedSeverity === 'HIGH') {
          return score >= minThreshold && score < 75;
        }
        if (selectedSeverity === 'MEDIUM') {
          return score >= 75 && score < 90;
        }
        if (selectedSeverity === 'LOW') {
          return score >= 90;
        }
        return true;
      });
    }

    // Sort order: risk-first
    // 1. Lower trust score first
    // 2. Higher violations first
    result.sort((a, b) => {
      const aScore = Number(a.trust_score);
      const bScore = Number(b.trust_score);
      if (aScore !== bScore) {
        return aScore - bScore;
      }
      return Number(b.total_violations) - Number(a.total_violations);
    });

    return result;
  }, [rawSessions, searchQuery, selectedExamId, selectedStatus, selectedSeverity]);

  const kpis: ProctorKpiData = kpiQuery.data ?? {
    activeSessions: rawSessions.length,
    violationsLast10Min: 0,
    warningsPending: rawSessions.filter((s) => Number(s.warning_count ?? 0) > 0 || Boolean(s.pending_warning_log_id)).length,
    timeRequestsWaiting: pendingExtensionsCount,
    flaggedStudents: rawSessions.filter((s) => Number(s.warning_count ?? 0) > 0 || Boolean(s.pending_warning_log_id)).length,
    terminatedToday: 0,
  };

  return (
    <div className="space-y-6" data-source="vw_ProctorLiveMonitor">
      {/* 1. EMERGENCY BANNER (full-width top alert) */}
      <EmergencyBanner
        criticalAlert={criticalAlert}
        onDismiss={() => setCriticalAlert(null)}
        onInspect={(sId) => {
          setInspectedSessionId(sId);
          setCriticalAlert(null);
        }}
      />

      {/* Header Bar with Live Socket Status & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand" />
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-brand font-semibold">
                Orbital Surveillance Core
              </span>
              <span className="rounded-full bg-surface border border-border px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {socketConnected ? (
                  <span className="text-emerald-500 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Socket Connected
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1 font-medium">
                    <Radio className="w-3 h-3 animate-pulse" /> Reconnecting
                  </span>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              Proctor Mission Control
            </h1>
          </div>

          {/* Mode Switcher: Live Monitor vs Review Queue */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface p-1 shadow-sm shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('monitor')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-mono font-medium transition-all cursor-pointer ${
                activeTab === 'monitor'
                  ? 'bg-brand text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              <span>Live Telemetry Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-mono font-medium transition-all cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-brand text-accent-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Adjudication Queue</span>
            </button>

            {/* Time Requests Drawer Trigger */}
            <button
              type="button"
              onClick={() => setExtensionDrawerOpen(true)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-mono font-medium transition-all cursor-pointer border ${
                pendingExtensionsCount > 0
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Time Requests</span>
              {pendingExtensionsCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-black text-[10px] font-bold px-1 animate-pulse">
                  {pendingExtensionsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 2. TOP KPI STRIP (active sessions, violations 10m, flagged, terminated) */}
        <KpiStrip kpis={kpis} isLoading={kpiQuery.isLoading} />

        {/* 3. MAIN CONTENT: Grid or Queue View */}
        {activeTab === 'queue' ? (
          /* ================================================================ */
          /* ADJUDICATION REVIEW QUEUE VIEW */
          /* ================================================================ */
          <ReviewQueueTable onInspectStudent={(id) => setInspectedSessionId(id)} />
        ) : (
          /* ================================================================ */
          /* LIVE TELEMETRY GRID + RIGHT-SIDE LIVE FEED */
          /* ================================================================ */
          <div className="space-y-5">
            {/* Filter & Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Exam Filter - Only exams with live sessions */}
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  aria-label="Filter candidates by assessment"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                >
                  <option value="ALL">All Active Exams ({liveExams.length})</option>
                  {liveExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>

                {/* Status Filter: All live / Warned / At risk */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter candidates by session status"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                >
                  <option value="ALL">All live</option>
                  <option value="WARNED">Warned</option>
                  <option value="AT_RISK">At risk (trust below minimum + 15)</option>
                </select>

                {/* Severity Filter */}
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  aria-label="Filter candidates by severity risk level"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical Risk</option>
                  <option value="HIGH">High Risk (&lt;75%)</option>
                  <option value="MEDIUM">Medium Risk (75-89%)</option>
                  <option value="LOW">Low / Clean (≥90%)</option>
                </select>

                <div className="text-xs font-mono text-muted-foreground pl-1">
                  Showing <strong className="text-foreground">{displaySessions.length}</strong> live candidates
                </div>
              </div>

              {/* Search Candidate */}
              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter student name or email..."
                  className="w-full rounded-xl border border-border bg-background pl-10 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Just Finished Strip (Collapsible, last 5 minutes) */}
            {justFinished.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface/80 p-3 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setShowJustFinished((prev) => !prev)}
                  className="flex items-center justify-between w-full text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-semibold text-foreground">Just finished ({justFinished.length})</span>
                    <span className="text-[11px] text-muted-foreground">Sessions ended in the last 5 minutes</span>
                  </div>
                  <span className="text-xs text-brand hover:underline">
                    {showJustFinished ? 'Hide' : 'Show'}
                  </span>
                </button>
                {showJustFinished && (
                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-border">
                    {justFinished.map((jf) => (
                      <div
                        key={jf.sessionId}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-1.5 text-[11px]"
                      >
                        <span className="font-medium text-foreground">{jf.studentName}</span>
                        <span className="text-muted-foreground">({jf.examTitle})</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-bold">
                          {jf.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setInspectedSessionId(jf.sessionId)}
                          className="text-muted-foreground hover:text-foreground text-[10px] underline ml-1 cursor-pointer"
                        >
                          Drawer
                        </button>
                        <button
                          type="button"
                          data-testid={`just-finished-scorecard-${jf.sessionId}`}
                          onClick={() => navigate(`/proctor/students/0/exams/${jf.sessionId}`)}
                          className="text-brand hover:underline font-bold text-[10px] ml-1 cursor-pointer"
                        >
                          Scorecard &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid Layout: Student Tiles (left 2/3) + Live Feed (right 1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
              {/* Student Tiles Grid (2 cols on md, 2 or 3 cols on xl) */}
              <div className="lg:col-span-2 xl:col-span-3">
                <h2 className="sr-only">Active Candidate Surveillance Grid</h2>
                {monitorQuery.isLoading && !isMonitorTimedOut ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                ) : monitorQuery.isError || isMonitorTimedOut ? (
                  <ErrorState
                    title="Failed to Load Live Candidate Telemetry"
                    description={isMonitorTimedOut ? "The server is not reachable. Check that the API and MySQL are running" : (monitorQuery.error?.message || "The server is not reachable. Check that the API and MySQL are running")}
                    onRetry={() => monitorQuery.refetch()}
                  />
                ) : rawSessions.length === 0 ? (
                  <EmptyState
                    icon={<Radio className="w-8 h-8 text-brand animate-pulse" />}
                    title="No exams are running right now"
                    description="All candidate assessments have concluded. Completed results and forensically audited logs can be reviewed in Student Audit."
                    action={{
                      label: 'Open Student Audit',
                      onClick: () => navigate('/proctor/audit'),
                    }}
                  />
                ) : displaySessions.length === 0 ? (
                  <EmptyState
                    icon={<Shield className="w-8 h-8" />}
                    title="No active candidate sessions match"
                    description="No live sessions match the selected assessment, status, or severity filter. Telemetry streaming is nominal."
                    action={{
                      label: 'Reset Filters',
                      onClick: () => {
                        setSelectedExamId('ALL');
                        setSelectedStatus('ALL');
                        setSelectedSeverity('ALL');
                        setSearchQuery('');
                      },
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {displaySessions.map((session) => (
                        <StudentTile
                          key={session.session_id}
                          session={session}
                          isShaking={Boolean(shakingTiles[session.session_id])}
                          onSelect={(sId) => setInspectedSessionId(sId)}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Right-Side Live Feed Sidebar */}
              <div className="lg:col-span-1 h-[780px] sticky top-6">
                <LiveFeedSidebar
                  items={liveFeed}
                  onReviewSession={(sId) => setInspectedSessionId(sId)}
                  onClearFeed={() => setLiveFeed([])}
                />
              </div>
            </div>
          </div>
        )}

      {/* 4. STUDENT DETAIL DRAWER (Inspect Candidate) */}
      <StudentDetailDrawer
        sessionId={inspectedSessionId}
        onClose={() => setInspectedSessionId(null)}
      />

      {/* 5. TIME EXTENSION REQUESTS DRAWER */}
      <TimeExtensionRequestsDrawer
        isOpen={extensionDrawerOpen}
        onClose={() => setExtensionDrawerOpen(false)}
        onSelectSession={(sessId) => {
          setExtensionDrawerOpen(false);
          setInspectedSessionId(sessId);
        }}
      />
    </div>
  );
}

export default ProctorDashboardPage;
