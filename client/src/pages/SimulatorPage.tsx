import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Zap,
  Users,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Activity,
  Terminal,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { StatusPill } from '../components/ui/StatusPill';
import { TrustRing } from '../components/ui/TrustRing';
import { LiveDot } from '../components/ui/LiveDot';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { ExamItem } from '../types/domain';

export type PersonaType = 'honest' | 'mostly_honest' | 'careless' | 'cheater';
export type ScenarioType = 'realistic' | 'strict' | 'stress_test';

export interface SimResult {
  rawScore: number;
  totalMarks: number;
  percentage: number;
  finalTrustScore: number;
  integrityStatus: 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED';
  gradedAt: string;
}

export interface SimCandidate {
  studentId: number;
  fullName: string;
  email: string;
  sessionId: number;
  trustScore: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING' | 'TIMED_OUT';
  lastAction: string;
  lastActionAt: string;
  violationsCount: number;
  answersCount: number;
  persona?: PersonaType;
  ability?: number;
  result?: SimResult;
}

export interface SimActivityLog {
  id: string;
  timestamp: string;
  candidateName: string;
  type: 'answer' | 'violation' | 'status_change';
  detail: string;
  severity?: string;
  trustScore?: number;
}

export interface SimulatorSummary {
  cleanCount: number;
  flaggedCount: number;
  disqualifiedCount: number;
  avgScore: number;
  avgTrust: number;
}

export interface SimulatorStatusResponse {
  isRunning: boolean;
  isPaused: boolean;
  examId: number;
  studentCount: number;
  speed: number;
  chaos: 'low' | 'medium' | 'high';
  scenario: ScenarioType;
  seed: string | number;
  startedAt: string | null;
  endedAt?: string | null;
  stats: {
    activeCount: number;
    answersCount: number;
    infractionsCount: number;
    terminatedCount: number;
    submittedCount?: number;
  };
  summary?: SimulatorSummary;
  candidates: SimCandidate[];
  activityLogs: SimActivityLog[];
}

export const SimulatorPage: React.FC = () => {
  useDocumentTitle('Swarm Simulator | ProctorIQ');
  const queryClient = useQueryClient();

  // Local form state
  const [selectedExamId, setSelectedExamId] = useState<number>(1);
  const [studentCount, setStudentCount] = useState<number>(12);
  const [speed, setSpeed] = useState<number>(2.0);
  const [chaos, setChaos] = useState<'low' | 'medium' | 'high'>('medium');
  const [scenario, setScenario] = useState<ScenarioType>('realistic');
  const [seed, setSeed] = useState<string>('');
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const candidateGridRef = useRef<HTMLDivElement | null>(null);
  const activityStreamRef = useRef<HTMLDivElement | null>(null);

  // Fetch published exams for dropdown
  const examsQuery = useQuery({
    queryKey: ['admin-exams-list'],
    queryFn: () => api.get<ExamItem[]>('/exams'),
  });

  // Query simulation status periodically while mounted
  const statusQuery = useQuery({
    queryKey: ['simulator-status'],
    queryFn: () => api.get<SimulatorStatusResponse>('/admin/simulator/status'),
    refetchInterval: (query) => (query.state.data?.isRunning ? 1200 : 3000),
  });

  const sim = statusQuery.data;
  const isRunning = Boolean(sim?.isRunning);
  const isPaused = Boolean(sim?.isPaused);

  // Browser-driven swarm engine: schedules tick calls with timers and AbortController
  useEffect(() => {
    if (!isRunning || isPaused) {
      return;
    }

    const abortController = new AbortController();
    let isCancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const intervalMs = Math.max(100, Math.round(1500 / (sim?.speed || speed || 2.0)));

    const executeTick = async () => {
      try {
        const response = await api.post<SimulatorStatusResponse>(
          '/admin/simulator/tick',
          {},
          { signal: abortController.signal }
        );
        if (!isCancelled && response) {
          queryClient.setQueryData(['simulator-status'], response);
          if (response.isRunning && !response.isPaused) {
            timerId = setTimeout(executeTick, intervalMs);
          }
        }
      } catch (err: unknown) {
        const error = err as { name?: string; code?: string };
        if (
          !isCancelled &&
          error?.name !== 'CanceledError' &&
          error?.name !== 'AbortError' &&
          error?.code !== 'ERR_CANCELED'
        ) {
          timerId = setTimeout(executeTick, Math.max(1000, intervalMs * 2));
        }
      }
    };

    timerId = setTimeout(executeTick, intervalMs);

    return () => {
      isCancelled = true;
      abortController.abort();
      if (timerId) clearTimeout(timerId);
    };
  }, [isRunning, isPaused, sim?.speed, speed, queryClient]);

  // Determines whether the simulator has run or has any populated state to clear
  const hasRun = Boolean(
    isRunning ||
    isPaused ||
    (sim?.candidates && sim.candidates.length > 0) ||
    (sim?.stats &&
      (sim.stats.answersCount > 0 ||
        sim.stats.infractionsCount > 0 ||
        sim.stats.terminatedCount > 0 ||
        sim.stats.activeCount > 0)) ||
    (sim?.activityLogs && sim.activityLogs.length > 0)
  );

  const exams = examsQuery.data ?? [];
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const isExamPublished = selectedExam ? Boolean(selectedExam.is_published) : true;
  const isExamWindowOpen = selectedExam ? Boolean(selectedExam.is_window_open ?? 1) : true;
  const hasQuestions = selectedExam ? (selectedExam.question_count ?? 1) > 0 : true;

  let unstartableReason: string | null = null;
  if (selectedExam && !isExamPublished) {
    unstartableReason = 'Selected exam is unpublished (DRAFT). Publish it before launching.';
  } else if (selectedExam && !isExamWindowOpen) {
    unstartableReason = 'Exam window is currently closed (expired or not yet open).';
  } else if (selectedExam && !hasQuestions) {
    unstartableReason = 'Selected exam has 0 questions configured.';
  }
  const isExamStartable = !unstartableReason;

  const [isOpenWindowModalOpen, setIsOpenWindowModalOpen] = useState<boolean>(false);

  // Mutations
  const startMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/simulator/start', {
        examId: selectedExamId,
        studentCount,
        speed,
        chaos,
        scenario,
        seed: seed.trim() !== '' ? seed.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success(`Launched simulator swarm with ${studentCount} candidates.`);
      queryClient.invalidateQueries({ queryKey: ['simulator-status'] });
    },
    onError: (err: unknown) => {
      const errorMsg = (err as { message?: string })?.message || 'Failed to launch simulator swarm.';
      toast.error('Swarm Launch Failed', {
        description: errorMsg,
      });
      // Append an activity log line so error is immediately visible in the activity stream
      queryClient.setQueryData<SimulatorStatusResponse>(['simulator-status'], (prev) => {
        if (!prev) return prev;
        const newLog: SimActivityLog = {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          candidateName: 'System Orchestrator',
          type: 'status_change',
          detail: `Launch swarm failed: ${errorMsg}`,
          severity: 'HIGH',
        };
        return {
          ...prev,
          activityLogs: [newLog, ...(prev.activityLogs || [])],
        };
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/pause'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
    onError: (err: unknown) => {
      toast.error('Failed to pause simulation', {
        description: (err as { message?: string })?.message || 'Unknown error',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/resume'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
    onError: (err: unknown) => {
      toast.error('Failed to resume simulation', {
        description: (err as { message?: string })?.message || 'Unknown error',
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/stop'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
    onError: (err: unknown) => {
      toast.error('Failed to stop simulation', {
        description: (err as { message?: string })?.message || 'Unknown error',
      });
    },
  });

  const openWindowMutation = useMutation({
    mutationFn: () => api.post(`/admin/exams/${selectedExamId}/open-window`),
    onSuccess: () => {
      toast.success('Exam window opened for testing and demo (valid for 24 hours).');
      queryClient.invalidateQueries({ queryKey: ['admin-exams-list'] });
      setIsOpenWindowModalOpen(false);
    },
    onError: (err: unknown) => {
      toast.error('Could not open exam window', {
        description: (err as { message?: string })?.message || 'Unknown error',
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      return api.post<{
        deletedLogs: number;
        deletedResponses: number;
        deletedResults: number;
        deletedSessions: number;
        deletedUsers: number;
      }>('/simulator/reset', undefined, {
        signal: abortControllerRef.current.signal,
      });
    },
    onSuccess: () => {
      // 1. Reset frontend query cache to fresh zero state immediately
      queryClient.setQueryData(['simulator-status'], {
        isRunning: false,
        isPaused: false,
        examId: exams[0]?.id ?? 1,
        studentCount: 12,
        speed: 2.0,
        chaos: 'medium',
        scenario: 'realistic',
        seed: 42,
        startedAt: null,
        stats: {
          activeCount: 0,
          answersCount: 0,
          infractionsCount: 0,
          terminatedCount: 0,
          submittedCount: 0,
        },
        candidates: [],
        activityLogs: [],
      });

      // 2. Invalidate queries so other open dashboards re-sync
      queryClient.invalidateQueries({ queryKey: ['simulator-status'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });

      // 3. Restore default control parameters (preserve current selected exam)
      setStudentCount(12);
      setSpeed(2.0);
      setChaos('medium');
      setScenario('realistic');
      setSeed('');

      // 4. Clear scroll positions
      if (candidateGridRef.current) {
        candidateGridRef.current.scrollTop = 0;
      }
      if (activityStreamRef.current) {
        activityStreamRef.current.scrollTop = 0;
      }

      toast.success('Simulator reset');
    },
    onError: (err: unknown) => {
      const error = err as { message?: string };
      toast.error('Failed to reset simulator', {
        description: error?.message || 'Could not clean up simulated data.',
        action: {
          label: 'Retry',
          onClick: () => handleExecuteReset(),
        },
      });
    },
  });

  const isResetDisabled = !hasRun || resetMutation.isPending;

  const handleExecuteReset = () => {
    setIsResetModalOpen(false);
    resetMutation.mutate();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand/10 border border-brand/30 text-brand">
                <Zap className="w-5 h-5" />
              </span>
              <span>Candidate Swarm Demo Simulator</span>
            </h1>
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-emerald/40 bg-emerald/10 text-emerald">
                <LiveDot color="emerald" size="sm" pulse />
                {isPaused ? 'PAUSED' : 'BROADCASTING LIVE'}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Spawn virtual examinees to simulate live exam telemetry, optical violations, and real-time Socket.IO broadcasts.
          </p>
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-lg bg-brand/5 border border-brand/20 text-xs text-muted-foreground w-fit">
            <Clock className="w-3.5 h-3.5 text-brand" />
            <span>The swarm runs while this tab is open.</span>
          </div>
        </div>

        {/* Live Proctor View Link */}
        <div className="flex items-center gap-3">
          <Link to="/proctor" target="_blank" rel="noreferrer">
            <NeonButton variant="outline" size="sm" className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-magenta" />
              <span>Open Proctor Monitor</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </NeonButton>
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>ACTIVE SWARM</span>
            <Users className="w-4 h-4 text-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {sim?.stats.activeCount ?? 0}
            <span className="text-xs text-muted-foreground font-sans ml-1">
              / {sim?.candidates.length ?? studentCount} candidates
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>ANSWERS DISPATCHED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald">
            {sim?.stats.answersCount ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>INFRACTIONS LOGGED</span>
            <AlertTriangle className="w-4 h-4 text-amber" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber">
            {sim?.stats.infractionsCount ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <span>DISQUALIFIED (TERMINATED)</span>
            <ShieldAlert className="w-4 h-4 text-rose" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose">
            {sim?.stats.terminatedCount ?? 0}
          </div>
        </GlassCard>
      </div>

      {/* 3. Controls & Configuration Panel */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Simulation Controls & Scenario Tuning</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Tune candidate volume, response velocity, and anti-cheating chaos intensity.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {!isRunning ? (
              <>
                <NeonButton
                  variant="primary"
                  size="md"
                  disabled={resetMutation.isPending || startMutation.isPending || !isExamStartable}
                  isLoading={startMutation.isPending}
                  title={!isExamStartable ? unstartableReason || 'Exam cannot be started' : undefined}
                  onClick={() => {
                    if (!startMutation.isPending && !isRunning && isExamStartable) {
                      startMutation.mutate();
                    }
                  }}
                  className="flex items-center gap-2 font-mono uppercase"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{startMutation.isPending ? `Launching ${studentCount} candidates...` : 'Launch Swarm'}</span>
                </NeonButton>

                <NeonButton
                  variant="outline"
                  size="md"
                  data-testid="simulator-reset-btn"
                  disabled={isResetDisabled}
                  isLoading={resetMutation.isPending}
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex items-center gap-2 font-mono uppercase text-muted-foreground hover:text-foreground border-border hover:border-brand/40"
                >
                  <RotateCcw className={`w-4 h-4 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>Reset</span>
                </NeonButton>
              </>
            ) : (
              <>
                {isPaused ? (
                  <NeonButton
                    variant="success"
                    size="md"
                    disabled={resetMutation.isPending}
                    isLoading={resumeMutation.isPending}
                    onClick={() => resumeMutation.mutate()}
                    className="flex items-center gap-2 font-mono"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </NeonButton>
                ) : (
                  <NeonButton
                    variant="outline"
                    size="md"
                    disabled={resetMutation.isPending}
                    isLoading={pauseMutation.isPending}
                    onClick={() => pauseMutation.mutate()}
                    className="flex items-center gap-2 font-mono text-amber border-amber/40"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </NeonButton>
                )}
                <NeonButton
                  variant="danger"
                  size="md"
                  disabled={resetMutation.isPending}
                  isLoading={stopMutation.isPending}
                  onClick={() => stopMutation.mutate()}
                  className="flex items-center gap-2 font-mono"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Halt Swarm</span>
                </NeonButton>

                <NeonButton
                  variant="outline"
                  size="md"
                  data-testid="simulator-reset-btn"
                  disabled={isResetDisabled}
                  isLoading={resetMutation.isPending}
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex items-center gap-2 font-mono uppercase text-muted-foreground hover:text-foreground border-border hover:border-brand/40"
                >
                  <RotateCcw className={`w-4 h-4 ${resetMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>Reset</span>
                </NeonButton>
              </>
            )}
          </div>
        </div>

        {/* Sliders and Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Target Exam */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              TARGET EXAMINATION
            </label>
            <select
              disabled={isRunning}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 transition-all"
            >
              {exams.map((ex) => {
                const published = Boolean(ex.is_published);
                const windowOpen = Boolean(ex.is_window_open ?? 0);
                const hasQs = (ex.question_count ?? 0) > 0;
                const startable = published && windowOpen && hasQs;
                const tag = !published ? ' [DRAFT]' : !windowOpen ? ' [CLOSED]' : !hasQs ? ' [0 Qs]' : '';
                return (
                  <option
                    key={ex.id}
                    value={ex.id}
                    className={`bg-surface ${startable ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    #{ex.id}: {ex.title}{tag}
                  </option>
                );
              })}
              {exams.length === 0 && <option value={1} className="bg-surface text-foreground">Exam #1 (Default)</option>}
            </select>
          </div>

          {/* Scenario Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              SCENARIO
            </label>
            <select
              disabled={isRunning}
              value={scenario}
              onChange={(e) => setScenario(e.target.value as ScenarioType)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 transition-all font-mono"
            >
              <option value="realistic" className="bg-surface text-foreground">Realistic (Default)</option>
              <option value="strict" className="bg-surface text-foreground">Strict Exam</option>
              <option value="stress_test" className="bg-surface text-foreground">Stress Test</option>
            </select>
          </div>

          {/* Student Count Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">CANDIDATES (N)</span>
              <span className="text-brand font-bold px-2 py-0.5 rounded bg-brand/10 border border-brand/30">
                {studentCount} Students
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={60}
              step={1}
              disabled={isRunning}
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>1</span>
              <span>30</span>
              <span>60</span>
            </div>
          </div>

          {/* Speed Multiplier Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">SPEED MULTIPLIER</span>
              <span className="text-emerald font-bold px-2 py-0.5 rounded bg-emerald/10 border border-emerald/30">
                {speed.toFixed(1)}x Velocity
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5.0}
              step={0.5}
              disabled={isRunning}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-emerald cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>0.5x</span>
              <span>2.5x</span>
              <span>5.0x</span>
            </div>
          </div>

          {/* Chaos Level Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground block">
              CHAOS PROFILE
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('low')}
                className={`py-2 px-1 rounded-xl border text-xs font-mono font-bold transition-all ${chaos === 'low'
                  ? 'border-emerald/60 bg-emerald/20 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                  : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                  } disabled:opacity-50`}
              >
                LOW
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('medium')}
                className={`py-2 px-1 rounded-xl border text-xs font-mono font-bold transition-all ${chaos === 'medium'
                  ? 'border-amber/60 bg-amber/20 text-amber shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                  } disabled:opacity-50`}
              >
                MED
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('high')}
                className={`py-2 px-1 rounded-xl border text-xs font-mono font-bold transition-all ${chaos === 'high'
                  ? 'border-rose/60 bg-rose/20 text-rose shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                  : 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                  } disabled:opacity-50`}
              >
                HIGH 🔥
              </button>
            </div>
          </div>

          {/* Seed Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">RANDOM SEED</span>
              <span className="text-[10px] text-muted-foreground">(Optional)</span>
            </div>
            <input
              type="text"
              disabled={isRunning}
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="e.g. 42 or cohort_1"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 transition-all"
            />
          </div>
        </div>

        {/* Unstartable warning banner */}
        {!isExamStartable && !isRunning && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber/40 bg-amber/10 text-amber font-mono text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber" />
              <span>{unstartableReason}</span>
            </div>
            {!isExamWindowOpen && isExamPublished && (
              <button
                type="button"
                onClick={() => setIsOpenWindowModalOpen(true)}
                className="px-3 py-1.5 rounded-lg border border-amber/50 bg-amber/20 hover:bg-amber/30 text-amber font-bold text-xs transition-colors cursor-pointer shrink-0"
              >
                Open exam window for demo
              </button>
            )}
          </div>
        )}
      </GlassCard>

      {/* 4. End-of-Run Summary Strip */}
      {sim?.summary && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          data-testid="simulator-summary-strip"
          className="p-4 rounded-2xl border border-brand/40 bg-brand/10 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-[0_0_25px_rgba(99,102,241,0.15)]"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-emerald" />
            <span className="font-bold text-foreground">Cohort Outcome Summary:</span>
            <span className="px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold">
              {sim.summary.cleanCount} CLEAN
            </span>
            <span className="px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold">
              {sim.summary.flaggedCount} FLAGGED
            </span>
            <span className="px-2 py-0.5 rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400 font-bold">
              {sim.summary.disqualifiedCount} DISQUALIFIED
            </span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>Avg Score: <strong className="text-cyan font-bold">{sim.summary.avgScore}%</strong></span>
            <span>•</span>
            <span>Avg Trust: <strong className="text-foreground font-bold">{sim.summary.avgTrust}%</strong></span>
          </div>
        </motion.div>
      )}

      {/* 5. Swarm Candidate Grid + Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Candidate Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-brand" />
              <span>Simulated Candidates ({sim?.candidates.length ?? 0})</span>
            </h3>
            <span className="text-xs font-mono text-muted-foreground">
              Live Trust Scores & Telemetry
            </span>
          </div>

          {(!sim?.candidates || sim.candidates.length === 0) && (
            <GlassCard className="p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <div className="text-sm font-medium text-foreground">
                No active candidate swarm running.
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Configure your target parameters above and click <strong>"Launch Swarm"</strong> to spawn virtual examinees.
              </p>
            </GlassCard>
          )}

          <div ref={candidateGridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
            <AnimatePresence>
              {sim?.candidates.map((c) => {
                const isTerminated = c.status === 'TERMINATED_CHEATING';
                const isLow = c.trustScore < 50;

                return (
                  <motion.div
                    key={c.sessionId}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`rounded-2xl border p-4 transition-all ${isTerminated
                      ? 'border-rose/40 bg-rose/10 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                      : isLow
                        ? 'border-amber/40 bg-amber/10'
                        : 'border-border bg-surface/90 hover:border-brand/40 shadow-sm'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground truncate">
                            {c.fullName}
                          </span>
                          {c.persona && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                                c.persona === 'honest'
                                  ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                                  : c.persona === 'mostly_honest'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                  : c.persona === 'careless'
                                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                              }`}
                            >
                              {c.persona.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground block truncate">
                          Session #{c.sessionId} • {c.email}
                        </span>
                      </div>

                      {/* Mini Trust Ring */}
                      <div className="shrink-0">
                        <TrustRing
                          score={c.trustScore}
                          minThreshold={50}
                          size="sm"
                        />
                      </div>
                    </div>

                    {/* Stats & Status Pills */}
                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono border-t border-border pt-2">
                      {c.result ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase ${
                            c.result.integrityStatus === 'CLEAN'
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                              : c.result.integrityStatus === 'FLAGGED'
                              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
                              : 'border-rose-500/50 bg-rose-500/15 text-rose-400'
                          }`}
                        >
                          {c.result.integrityStatus}
                        </span>
                      ) : isTerminated ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border uppercase border-rose-500/50 bg-rose-500/15 text-rose-400">
                          DISQUALIFIED
                        </span>
                      ) : (
                        <StatusPill status={c.status} size="sm" />
                      )}

                      <div className="flex items-center gap-2 text-muted-foreground">
                        {c.result ? (
                          <span className="text-cyan font-bold">
                            Score: {c.result.percentage}%
                          </span>
                        ) : (
                          <span>Ans: <strong className="text-cyan">{c.answersCount}</strong></span>
                        )}
                        <span>•</span>
                        <span>Inf: <strong className="text-amber">{c.violationsCount}</strong></span>
                      </div>
                    </div>

                    {/* Last Action ticker */}
                    <div className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/60 rounded px-2 py-1 truncate">
                      {c.lastAction}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Col: Live Activity Stream / Terminal */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald" />
              <span>Real-Time Activity Stream</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald flex items-center gap-1">
              <LiveDot color="emerald" size="sm" pulse={isRunning} />
              LIVE SOCKET FEED
            </span>
          </div>

          <div
            ref={activityStreamRef}
            className="rounded-2xl border p-4 bg-surface-elevated/70 border-border font-mono text-xs max-h-[560px] overflow-y-auto space-y-2 backdrop-blur-md"
          >
            {(!sim?.activityLogs || sim.activityLogs.length === 0) && (
              <div className="py-12 text-center text-muted-foreground text-xs">
                Awaiting simulation events...
              </div>
            )}

            {sim?.activityLogs.map((log) => {
              const isViol = log.type === 'violation';
              const isTerm = log.severity === 'CRITICAL' || log.detail.includes('DISQUALIFIED');

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed transition-all ${isTerm
                    ? 'border-rose/50 bg-rose/15 text-rose'
                    : isViol
                      ? 'border-amber/30 bg-amber/10 text-amber'
                      : 'border-border bg-surface/80 text-foreground'
                    }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1 mb-1 border-b border-border">
                    <span className="font-bold text-foreground flex items-center gap-1">
                      {isTerm ? (
                        <ShieldAlert className="w-3 h-3 text-rose" />
                      ) : isViol ? (
                        <AlertTriangle className="w-3 h-3 text-amber" />
                      ) : (
                        <Clock className="w-3 h-3 text-cyan" />
                      )}
                      <span>{log.candidateName}</span>
                    </span>
                    <span>{log.timestamp}</span>
                  </div>
                  <div>{log.detail}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Open Exam Window Confirmation Modal */}
      <Modal
        isOpen={isOpenWindowModalOpen}
        onClose={() => !openWindowMutation.isPending && setIsOpenWindowModalOpen(false)}
        title="Open Exam Window for Demo?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <NeonButton
              variant="outline"
              size="sm"
              disabled={openWindowMutation.isPending}
              onClick={() => setIsOpenWindowModalOpen(false)}
            >
              Cancel
            </NeonButton>
            <NeonButton
              variant="primary"
              size="sm"
              isLoading={openWindowMutation.isPending}
              onClick={() => openWindowMutation.mutate()}
            >
              Open Window (24h)
            </NeonButton>
          </div>
        }
      >
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Exam #{selectedExamId} ({selectedExam?.title || 'Selected Exam'}) is currently outside its scheduled window.
          Opening the window sets it active starting 1 hour ago and lasting for 24 hours, allowing you to run testing and swarm simulations.
        </p>
      </Modal>

      {/* 6. Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => !resetMutation.isPending && setIsResetModalOpen(false)}
        title="Reset simulator?"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <NeonButton
              variant="outline"
              size="sm"
              disabled={resetMutation.isPending}
              onClick={() => setIsResetModalOpen(false)}
            >
              Cancel
            </NeonButton>
            <NeonButton
              variant="danger"
              size="sm"
              isLoading={resetMutation.isPending}
              onClick={handleExecuteReset}
            >
              Reset
            </NeonButton>
          </div>
        }
      >
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          This stops the swarm and clears the simulated candidates and activity. Existing real data is not affected.
        </p>
      </Modal>
    </div>
  );
};
