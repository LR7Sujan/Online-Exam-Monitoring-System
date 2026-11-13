import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Square,
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { StatusPill } from '../components/ui/StatusPill';
import { TrustRing } from '../components/ui/TrustRing';
import { LiveDot } from '../components/ui/LiveDot';
import { api } from '../lib/api';
import type { ExamItem } from '../types/domain';

interface SimCandidate {
  studentId: number;
  fullName: string;
  email: string;
  sessionId: number;
  trustScore: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING';
  lastAction: string;
  lastActionAt: string;
  violationsCount: number;
  answersCount: number;
}

interface SimActivityLog {
  id: string;
  timestamp: string;
  candidateName: string;
  type: 'answer' | 'violation' | 'status_change';
  detail: string;
  severity?: string;
  trustScore?: number;
}

interface SimulatorStatusResponse {
  isRunning: boolean;
  isPaused: boolean;
  examId: number;
  studentCount: number;
  speed: number;
  chaos: 'low' | 'medium' | 'high';
  startedAt: string | null;
  stats: {
    activeCount: number;
    answersCount: number;
    infractionsCount: number;
    terminatedCount: number;
  };
  candidates: SimCandidate[];
  activityLogs: SimActivityLog[];
}

export const SimulatorPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Local form state
  const [selectedExamId, setSelectedExamId] = useState<number>(1);
  const [studentCount, setStudentCount] = useState<number>(12);
  const [speed, setSpeed] = useState<number>(2.0);
  const [chaos, setChaos] = useState<'low' | 'medium' | 'high'>('medium');

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

  // Mutations
  const startMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/simulator/start', {
        examId: selectedExamId,
        studentCount,
        speed,
        chaos,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/pause'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/resume'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => api.post('/admin/simulator/stop'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['simulator-status'] }),
  });

  const exams = examsQuery.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan/10 border border-cyan/30 text-cyan">
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
          <p className="text-xs font-mono text-slate-400 mt-1">
            Spawn virtual examinees to simulate live exam telemetry, optical violations, and real-time Socket.IO broadcasts.
          </p>
        </div>

        {/* Live Proctor View Link */}
        <div className="flex items-center gap-3">
          <Link to="/proctor" target="_blank" rel="noreferrer">
            <NeonButton variant="outline" size="sm" className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-magenta" />
              <span>Open Proctor Monitor</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </NeonButton>
          </Link>
        </div>
      </div>

      {/* 2. Top KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ACTIVE SWARM</span>
            <Users className="w-4 h-4 text-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {sim?.stats.activeCount ?? 0}
            <span className="text-xs text-slate-500 font-sans ml-1">
              / {sim?.candidates.length ?? studentCount} candidates
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>ANSWERS DISPATCHED</span>
            <CheckCircle2 className="w-4 h-4 text-emerald" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald">
            {sim?.stats.answersCount ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
            <span>INFRACTIONS LOGGED</span>
            <AlertTriangle className="w-4 h-4 text-amber" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber">
            {sim?.stats.infractionsCount ?? 0}
          </div>
        </GlassCard>

        <GlassCard className="p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
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
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan" />
              <span>Simulation Controls & Scenario Tuning</span>
            </h3>
            <p className="text-xs text-slate-400">
              Tune candidate volume, response velocity, and anti-cheating chaos intensity.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <NeonButton
                variant="primary"
                size="md"
                isLoading={startMutation.isPending}
                onClick={() => startMutation.mutate()}
                className="flex items-center gap-2 font-mono uppercase"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Launch Swarm</span>
              </NeonButton>
            ) : (
              <>
                {isPaused ? (
                  <NeonButton
                    variant="success"
                    size="md"
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
                  isLoading={stopMutation.isPending}
                  onClick={() => stopMutation.mutate()}
                  className="flex items-center gap-2 font-mono"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Halt Swarm</span>
                </NeonButton>
              </>
            )}
          </div>
        </div>

        {/* Sliders and Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Target Exam */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 block">
              TARGET EXAMINATION
            </label>
            <select
              disabled={isRunning}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#0A0B16] px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan disabled:opacity-50"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  #{ex.id}: {ex.title}
                </option>
              ))}
              {exams.length === 0 && <option value={1}>Exam #1 (Default)</option>}
            </select>
          </div>

          {/* Student Count Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">CANDIDATES (N)</span>
              <span className="text-cyan font-bold px-2 py-0.5 rounded bg-cyan/10 border border-cyan/30">
                {studentCount} Students
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              disabled={isRunning}
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full accent-cyan cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>

          {/* Speed Multiplier Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">SPEED MULTIPLIER</span>
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
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.5x</span>
              <span>2.5x</span>
              <span>5.0x</span>
            </div>
          </div>

          {/* Chaos Level Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-300 block">
              CHAOS PROFILE
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('low')}
                className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                  chaos === 'low'
                    ? 'border-emerald/60 bg-emerald/20 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'border-white/10 bg-[#0A0B16] text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                LOW
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('medium')}
                className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                  chaos === 'medium'
                    ? 'border-amber/60 bg-amber/20 text-amber shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'border-white/10 bg-[#0A0B16] text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                MED
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setChaos('high')}
                className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                  chaos === 'high'
                    ? 'border-rose/60 bg-rose/20 text-rose shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                    : 'border-white/10 bg-[#0A0B16] text-slate-400 hover:text-white'
                } disabled:opacity-50`}
              >
                HIGH 🔥
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Swarm Candidate Grid + Live Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Candidate Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan" />
              <span>Simulated Candidates ({sim?.candidates.length ?? 0})</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Live Trust Scores & Telemetry
            </span>
          </div>

          {(!sim?.candidates || sim.candidates.length === 0) && (
            <GlassCard className="p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-mono text-slate-400">
                No active candidate swarm running.
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Configure your target parameters above and click <strong>"Launch Swarm"</strong> to spawn virtual examinees.
              </p>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
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
                    className={`rounded-2xl border p-4 transition-all ${
                      isTerminated
                        ? 'border-rose/40 bg-rose/10 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                        : isLow
                        ? 'border-amber/40 bg-amber/10'
                        : 'border-white/10 bg-[#0A0B16]/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">
                            {c.fullName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block truncate">
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
                    <div className="mt-3 flex items-center justify-between text-[11px] font-mono border-t border-white/5 pt-2">
                      <StatusPill status={c.status} size="sm" />
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Ans: <strong className="text-cyan">{c.answersCount}</strong></span>
                        <span>•</span>
                        <span>Inf: <strong className="text-amber">{c.violationsCount}</strong></span>
                      </div>
                    </div>

                    {/* Last Action ticker */}
                    <div className="mt-2 text-[10px] font-mono text-slate-400 bg-black/40 rounded px-2 py-1 truncate">
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
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald" />
              <span>Real-Time Activity Stream</span>
            </h3>
            <span className="text-[10px] font-mono text-emerald flex items-center gap-1">
              <LiveDot color="emerald" size="sm" pulse={isRunning} />
              LIVE SOCKET FEED
            </span>
          </div>

          <GlassCard className="p-4 bg-[#05060E] border-white/10 font-mono text-xs max-h-[560px] overflow-y-auto space-y-2">
            {(!sim?.activityLogs || sim.activityLogs.length === 0) && (
              <div className="py-12 text-center text-slate-500 text-xs">
                Awaiting simulation events...
              </div>
            )}

            {sim?.activityLogs.map((log) => {
              const isViol = log.type === 'violation';
              const isTerm = log.severity === 'CRITICAL' || log.detail.includes('DISQUALIFIED');

              return (
                <div
                  key={log.id}
                  className={`p-2.5 rounded-lg border text-[11px] leading-relaxed transition-all ${
                    isTerm
                      ? 'border-rose/50 bg-rose/15 text-rose'
                      : isViol
                      ? 'border-amber/30 bg-amber/10 text-amber'
                      : 'border-white/5 bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pb-1 mb-1 border-b border-white/5">
                    <span className="font-bold text-white flex items-center gap-1">
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
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
