import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
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
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { playPingSound } from '../utils/audioAlert';
import type { ExamItem, ProctorLiveMonitorRow, SessionStatus } from '../types/domain';

export function ProctorDashboardPage({ initialTab = 'monitor' }: { initialTab?: string } = {}) {
  const token = useAuthStore((s) => s.token);
  const queryClient = useQueryClient();

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

  // Shaking tiles map (sessionId -> boolean)
  const [shakingTiles, setShakingTiles] = useState<Record<number, boolean>>({});

  // Realtime streaming violation feed
  const [liveFeed, setLiveFeed] = useState<LiveViolationItem[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // 1. Fetch Authoritative KPIs
  const kpiQuery = useQuery({
    queryKey: ['proctor-kpis'],
    queryFn: () => api.get<ProctorKpiData>('/proctor/kpis'),
    refetchInterval: 15000,
  });

  // 2. Fetch Exams for Filter Dropdown
  const examsQuery = useQuery({
    queryKey: ['proctor-exams-list'],
    queryFn: () => api.get<ExamItem[]>('/exams'),
    staleTime: 60000,
  });

  // 3. Fetch Live Monitor Grid Sessions from SQL View vw_ProctorLiveMonitor
  const monitorQuery = useQuery({
    queryKey: ['proctor-live-monitor', selectedExamId, selectedStatus],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedExamId !== 'ALL') params.set('examId', selectedExamId);
      if (selectedStatus !== 'ALL' && selectedStatus !== 'FLAGGED') {
        params.set('status', selectedStatus);
      }
      return api.get<ProctorLiveMonitorRow[]>(`/proctor/live-monitor?${params.toString()}`);
    },
    refetchInterval: 12000,
  });

  const rawSessions = useMemo(() => monitorQuery.data ?? [], [monitorQuery.data]);
  const exams = useMemo(() => examsQuery.data ?? [], [examsQuery.data]);

  // Helper to trigger a temporary tile shake animation
  const triggerTileShake = useCallback((sessionId: number) => {
    setShakingTiles((prev) => ({ ...prev, [sessionId]: true }));
    setTimeout(() => {
      setShakingTiles((prev) => ({ ...prev, [sessionId]: false }));
    }, 1200);
  }, []);

  // 4. Socket.IO Realtime Telemetry Ingestion
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

      // 5. Invalidate cached queries immediately
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
      if (inspectedSessionId === payload.sessionId) {
        queryClient.invalidateQueries({ queryKey: ['proctor-session-inspect', inspectedSessionId] });
      }
    };

    // Session Terminated Event
    const onSessionTerminated = (payload: { sessionId: number; reason?: string }) => {
      playPingSound('critical');
      triggerTileShake(payload.sessionId);
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    };

    // Session Update / Reinstated / Submitted
    const onSessionUpdate = (payload: { sessionId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
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
    socket.on('exam:submitted', onSessionUpdate);
    socket.on('violation:reviewed', onSessionUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('violation:new', onViolation);
      socket.off('session:terminated', onSessionTerminated);
      socket.off('session:update', onSessionUpdate);
      socket.off('session:reinstated', onSessionUpdate);
      socket.off('exam:submitted', onSessionUpdate);
      socket.off('violation:reviewed', onSessionUpdate);
    };
  }, [inspectedSessionId, queryClient, token, triggerTileShake]);

  // Filter & Sort Sessions for Student Grid
  const displaySessions = useMemo(() => {
    let result = [...rawSessions];

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

    // Filter by Flagged Status
    if (selectedStatus === 'FLAGGED') {
      result = result.filter(
        (s) =>
          s.status === 'IN_PROGRESS' &&
          (Number(s.trust_score) < 100 || Number(s.total_violations) > 0)
      );
    }

    // Filter by Severity
    if (selectedSeverity !== 'ALL') {
      result = result.filter((s) => {
        const score = Number(s.trust_score);
        const minThreshold = Number(s.min_trust_score ?? 50);
        const isTerminated = s.status === 'TERMINATED_CHEATING';
        if (selectedSeverity === 'CRITICAL') {
          return isTerminated || score < minThreshold;
        }
        if (selectedSeverity === 'HIGH') {
          return !isTerminated && score >= minThreshold && score < 75;
        }
        if (selectedSeverity === 'MEDIUM') {
          return !isTerminated && score >= 75 && score < 90;
        }
        if (selectedSeverity === 'LOW') {
          return !isTerminated && score >= 90;
        }
        return true;
      });
    }

    // Sort order: risk-first
    // 1. IN_PROGRESS sessions with lowest trust scores first
    // 2. TERMINATED_CHEATING next
    // 3. Higher trust scores last
    result.sort((a, b) => {
      const aScore = Number(a.trust_score);
      const bScore = Number(b.trust_score);

      // Priority 1: Lower trust score first
      if (aScore !== bScore) {
        return aScore - bScore;
      }

      // Priority 2: In-progress over submitted
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;

      // Priority 3: Higher violations first
      return Number(b.total_violations) - Number(a.total_violations);
    });

    return result;
  }, [rawSessions, searchQuery, selectedStatus, selectedSeverity]);

  const kpis: ProctorKpiData = kpiQuery.data ?? {
    activeSessions: rawSessions.filter((s) => s.status === 'IN_PROGRESS').length,
    violationsLast10Min: 0,
    flaggedStudents: rawSessions.filter((s) => s.status === 'IN_PROGRESS' && Number(s.trust_score) < 100).length,
    terminatedToday: rawSessions.filter((s) => s.status === 'TERMINATED_CHEATING').length,
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground flex flex-col"
      data-source="vw_ProctorLiveMonitor"
    >
      {/* 1. EMERGENCY BANNER (full-width top alert) */}
      <EmergencyBanner
        criticalAlert={criticalAlert}
        onDismiss={() => setCriticalAlert(null)}
        onInspect={(sId) => {
          setInspectedSessionId(sId);
          setCriticalAlert(null);
        }}
      />

      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar with Live Socket Status & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
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
                  ? 'bg-brand text-white shadow-sm'
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
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Adjudication Queue</span>
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
                {/* Exam Filter */}
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  aria-label="Filter candidates by assessment"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                >
                  <option value="ALL">All Active Exams ({exams.length})</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label="Filter candidates by session status"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="IN_PROGRESS">In Progress (Live)</option>
                  <option value="FLAGGED">Flagged (&lt;100% Trust)</option>
                  <option value="TERMINATED_CHEATING">Terminated Cheating</option>
                  <option value="SUBMITTED">Submitted</option>
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
                  Showing <strong className="text-foreground">{displaySessions.length}</strong> candidates
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

            {/* Grid Layout: Student Tiles (left 2/3) + Live Feed (right 1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
              {/* Student Tiles Grid (2 cols on md, 2 or 3 cols on xl) */}
              <div className="lg:col-span-2 xl:col-span-3">
                <h2 className="sr-only">Active Candidate Surveillance Grid</h2>
                {displaySessions.length === 0 ? (
                  <div className="rounded-3xl border border-border bg-surface p-16 text-center space-y-3">
                    <Shield className="w-10 h-10 text-brand/40 mx-auto" />
                    <h3 className="text-base font-bold text-foreground">No active candidate sessions match</h3>
                    <p className="text-xs font-mono text-muted-foreground max-w-sm mx-auto">
                      Adjust your exam or status filters to view active candidates.
                    </p>
                  </div>
                ) : (
                  <motion.div
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  >
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
                  </motion.div>
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
      </div>

      {/* 4. STUDENT DETAIL DRAWER (Inspect Candidate) */}
      <StudentDetailDrawer
        sessionId={inspectedSessionId}
        onClose={() => setInspectedSessionId(null)}
      />
    </div>
  );
}

export default ProctorDashboardPage;
