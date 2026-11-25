import { useState, useRef, useEffect, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  AlertTriangle,
  Play,
  CheckCircle2,
  Clock,
  Radio,
  FileQuestion,
  Users,
  RotateCcw,
  Sparkles,
  Cpu,
  Database,
  Lock,
} from 'lucide-react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import {
  Skeleton,
  SkeletonCard,
  SkeletonText,
  EmptyState,
  ErrorState,
  SeverityBadge,
  TrustRing,
  useToast,
} from '../../../components/ui';

export type DemoStatus = 'loading' | 'loaded' | 'empty' | 'error';

interface StateMachineState {
  status: DemoStatus;
  durationMs: number;
}

type StateMachineAction =
  | { type: 'SELECT_STATUS'; status: DemoStatus; durationMs?: number }
  | { type: 'AUTO_RESOLVED' };

function stateReducer(state: StateMachineState, action: StateMachineAction): StateMachineState {
  switch (action.type) {
    case 'SELECT_STATUS':
      return {
        status: action.status,
        durationMs:
          action.durationMs !== undefined
            ? action.durationMs
            : action.status === 'loading'
              ? 1500
              : 0,
      };
    case 'AUTO_RESOLVED':
      if (state.status === 'loading') {
        return {
          status: 'loaded',
          durationMs: 0,
        };
      }
      return state;
    default:
      return state;
  }
}

interface SampleViolation {
  id: number;
  name: string;
  email: string;
  code: string;
  penalty: string;
  time: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  trustScore: number;
}

const SAMPLE_VIOLATIONS: SampleViolation[] = [
  {
    id: 1,
    name: 'Alex Rivera',
    email: 'a.rivera@university.edu',
    code: 'TAB_SWITCH',
    penalty: '-15 pts',
    time: '10:42:15 AM',
    severity: 'MEDIUM',
    trustScore: 85,
  },
  {
    id: 2,
    name: 'Sarah Chen',
    email: 's.chen@university.edu',
    code: 'MULTIPLE_FACES',
    penalty: '-35 pts',
    time: '10:41:03 AM',
    severity: 'HIGH',
    trustScore: 65,
  },
  {
    id: 3,
    name: 'Marcus Vance',
    email: 'm.vance@university.edu',
    code: 'DEVTOOLS_OPEN',
    penalty: '-50 pts',
    time: '10:39:50 AM',
    severity: 'CRITICAL',
    trustScore: 50,
  },
  {
    id: 4,
    name: 'Priya Sharma',
    email: 'p.sharma@university.edu',
    code: 'NO_FACE',
    penalty: '-20 pts',
    time: '10:37:22 AM',
    severity: 'HIGH',
    trustScore: 80,
  },
  {
    id: 5,
    name: "Liam O'Connor",
    email: 'l.oconnor@university.edu',
    code: 'COPY_PASTE',
    penalty: '-10 pts',
    time: '10:35:10 AM',
    severity: 'LOW',
    trustScore: 90,
  },
  {
    id: 6,
    name: 'Elena Rostova',
    email: 'e.rostova@university.edu',
    code: 'SECONDARY_DISPLAY',
    penalty: '-30 pts',
    time: '10:33:04 AM',
    severity: 'HIGH',
    trustScore: 70,
  },
];

export function LoadingEmptySection() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // 1. Interactive Demo State Machine (Default is LOADED per requirement)
  const [demoState, dispatch] = useReducer(stateReducer, {
    status: 'loaded', // Default state on open: LOADED so the user immediately sees working content
    durationMs: 0,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resolve timer managed via state machine effect, survives StrictMode and re-renders
  useEffect(() => {
    if (demoState.status === 'loading') {
      const delay = demoState.durationMs > 0 ? demoState.durationMs : 1500;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dispatch({ type: 'AUTO_RESOLVED' });
        timerRef.current = null;
        toastRef.current.info('Data Stream Resolved', 'Skeletons resolved to Loaded state');
      }, delay);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [demoState.status, demoState.durationMs]);

  // 2. Standalone Skeleton Demo mode ('content' | 'skeleton')
  // Default tab: Content so users immediately see what the skeleton is replacing
  const [standaloneMode, setStandaloneMode] = useState<'content' | 'skeleton'>('content');
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const replayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    };
  }, []);

  const handleReplayLoad = () => {
    setIsReplaying(true);
    setStandaloneMode('skeleton');
    if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    replayTimeoutRef.current = setTimeout(() => {
      setStandaloneMode('content');
      setIsReplaying(false);
      toast.success('Load Replayed', 'Rendered real card content after simulated 1s load');
    }, 1000);
  };

  // 3. Actionable Empty & Error states in Section 3
  const [emptyCardLoading, setEmptyCardLoading] = useState<boolean>(false);
  const [errorCardState, setErrorCardState] = useState<'error' | 'loading' | 'loaded'>('error');

  const handleEmptyRefresh = () => {
    setEmptyCardLoading(true);
    setTimeout(() => {
      setEmptyCardLoading(false);
      toast.info('Roster Refreshed', 'Candidate directory re-synced from MySQL 8.0 (0 active)');
    }, 1000);
  };

  const handleErrorRetry = () => {
    setErrorCardState('loading');
    setTimeout(() => {
      setErrorCardState('loaded');
      toast.success('Query Succeeded', 'Database introspection returned 14 table metrics');
    }, 1000);
  };

  const toc = [
    { id: 'interactive-state-machine', label: 'Interactive State Machine (Loading | Loaded | Empty | Error)' },
    { id: 'standalone-skeletons', label: 'Standalone Skeleton Loaders' },
    { id: 'empty-and-error-states', label: 'Empty & Error Actionable States' },
  ];

  return (
    <SectionDocPage slug="loading-empty" toc={toc}>
      {/* ============================================================== */}
      {/* 1. INTERACTIVE STATE MACHINE DEMO                              */}
      {/* ============================================================== */}
      <ComponentPreview
        id="interactive-state-machine"
        title="11. Interactive State Machine Demo"
        description="Four-state interactive data card demonstrating row-shaped moving shimmer skeletons, loaded real telemetry data, zero-state empty illustration, and error state with functioning retry."
        badge="State Machine"
        code={`// Interactive State Machine pattern:
type DemoStatus = 'loading' | 'loaded' | 'empty' | 'error';

// 1. Loading: row-shaped skeletons with moving shimmer (auto-resolves in 1.5s)
// 2. Loaded: real sample data rows with metrics (Default)
// 3. Empty: illustration, explanation & actionable Refresh button (1s loading -> loaded)
// 4. Error: alert banner & Retry button (1s loading -> loaded)`}
      >
        <div className="w-full space-y-5">
          {/* Controls Bar: Segmented Control + Caption + Auto Cycle Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface-elevated/70 shadow-xs">
            {/* Left: Segmented Control & Visible State Caption */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-background shadow-xs">
                {(['loading', 'loaded', 'empty', 'error'] as const).map((st) => {
                  const isSelected = demoState.status === st;
                  const label = st.charAt(0).toUpperCase() + st.slice(1);

                  return (
                    <button
                      key={st}
                      type="button"
                      data-testid={`btn-state-${st}`}
                      onClick={() => dispatch({ type: 'SELECT_STATUS', status: st })}
                      className={`h-8 px-3.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                        ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                    >
                      {st === 'loading' && <Radio className={`w-3 h-3 ${demoState.status === 'loading' ? 'animate-pulse' : ''}`} />}
                      {st === 'loaded' && <CheckCircle2 className="w-3 h-3" />}
                      {st === 'empty' && <FileQuestion className="w-3 h-3" />}
                      {st === 'error' && <AlertTriangle className="w-3 h-3" />}
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Requirement: Visible "Showing: Loading (auto-resolves in 1.5s)" caption */}
              <div className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-mono text-muted-foreground">
                Showing:{' '}
                <span className="font-semibold text-foreground">
                  {demoState.status === 'loading'
                    ? `Loading (auto-resolves in ${(demoState.durationMs / 1000).toFixed(1)}s)`
                    : demoState.status === 'loaded'
                      ? 'Loaded (6 incidents visible)'
                      : demoState.status === 'empty'
                        ? 'Empty (Zero infractions)'
                        : 'Error (Connection lost)'}
                </span>
              </div>
            </div>

            {/* Right: Auto Cycle Button */}
            <button
              type="button"
              data-testid="btn-auto-cycle"
              onClick={() => dispatch({ type: 'SELECT_STATUS', status: 'loading', durationMs: 1500 })}
              disabled={demoState.status === 'loading'}
              className={`h-9 px-4 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer border ${demoState.status === 'loading'
                ? 'border-brand/40 bg-brand/10 text-brand shadow-sm animate-pulse cursor-wait'
                : 'border-border bg-surface hover:bg-muted text-foreground hover:border-brand/30 shadow-xs'
                }`}
            >
              <Play className={`w-3.5 h-3.5 ${demoState.status === 'loading' ? 'animate-spin' : 'text-brand'}`} />
              <span>{demoState.status === 'loading' ? 'Cycling (1.5s)...' : 'Auto cycle'}</span>
            </button>
          </div>

          {/* Data Card Reacting to Selected State */}
          <div className="rounded-3xl border border-border bg-surface shadow-bento overflow-hidden">
            {/* Card Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground tracking-tight">
                    Active Telemetry Feed — Incident Audit
                  </h4>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    MySQL 8.0 ACID Triggers • Sub-20ms WebSocket Stream
                  </p>
                </div>
              </div>

              {/* Status Chip */}
              <span
                className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${demoState.status === 'loading'
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
                  : demoState.status === 'loaded'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : demoState.status === 'empty'
                      ? 'bg-muted text-muted-foreground border-border'
                      : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                  }`}
              >
                {demoState.status === 'loading'
                  ? 'STREAM BUFFERING'
                  : demoState.status === 'loaded'
                    ? '6 INCIDENTS LOGGED'
                    : demoState.status === 'empty'
                      ? 'ALL CLEAR'
                      : 'DISCONNECTED'}
              </span>
            </div>

            {/* Card Content Area */}
            <div className="p-4 sm:p-6 min-h-[360px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {/* 1. LOADING STATE: 6 row-shaped skeletons with visible moving shimmer */}
                {demoState.status === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3 w-full"
                  >
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        data-testid="interactive-skeleton"
                        className="min-h-[52px] p-3.5 rounded-2xl border border-border/80 bg-surface-elevated/50 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Skeleton variant="circle" className="w-9 h-9 shrink-0" />
                          <div className="space-y-1.5">
                            <Skeleton variant="text" className="w-32 sm:w-44 h-4 rounded-md" />
                            <Skeleton variant="text" className="w-20 sm:w-28 h-2.5 rounded" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <Skeleton variant="rect" className="w-24 sm:w-32 h-6 rounded-lg" />
                          <Skeleton variant="text" className="hidden md:inline-block w-20 h-3 rounded" />
                          <Skeleton variant="rect" className="w-16 h-5 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* 2. LOADED STATE: real sample data rows (Default) */}
                {demoState.status === 'loaded' && (
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2.5 w-full"
                  >
                    {SAMPLE_VIOLATIONS.map((row) => (
                      <div
                        key={row.id}
                        data-testid="interactive-row"
                        style={{ opacity: 1 }}
                        className="min-h-[52px] p-3.5 rounded-2xl border border-border bg-surface-elevated/90 hover:bg-surface-elevated hover:border-brand/40 transition-all flex items-center justify-between gap-4 shadow-2xs font-mono text-xs opacity-100"
                      >
                        {/* Student Name & Email */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-violet-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {row.name.charAt(0)}
                          </div>
                          <div className="min-w-0 truncate">
                            <div className="font-semibold text-foreground truncate">{row.name}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{row.email}</div>
                          </div>
                        </div>

                        {/* Violation Code & Penalty Chip */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="px-2.5 py-1 rounded-lg border border-border bg-background text-[11px] flex items-center gap-1.5 shadow-2xs">
                            <span className="font-bold text-foreground">{row.code}</span>
                            <span className="text-rose-500 font-semibold">{row.penalty}</span>
                          </div>

                          {/* Timestamp */}
                          <div className="hidden md:flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{row.time}</span>
                          </div>

                          {/* Severity Badge */}
                          <SeverityBadge severity={row.severity} size="sm" />

                          {/* Trust % Chip */}
                          <div className="px-2.5 py-1 rounded-lg border border-border bg-background text-[11px] font-mono font-semibold flex items-center gap-1.5 shadow-2xs text-emerald-500">
                            <span>{row.trustScore}%</span>
                            <span className="text-[10px] text-muted-foreground font-normal">Trust</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* 3. EMPTY STATE: illustration/icon, title, explanation, working Refresh button */}
                {demoState.status === 'empty' && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-lg mx-auto py-4"
                  >
                    <EmptyState
                      icon={<ShieldCheck className="w-8 h-8 text-emerald-500" />}
                      title="No Active Violations"
                      description="All candidate telemetry feeds are currently operating within the authorized clean threshold. Zero infractions recorded."
                      action={{
                        label: 'Refresh',
                        onClick: () => dispatch({ type: 'SELECT_STATUS', status: 'loading', durationMs: 1000 }),
                      }}
                    />
                  </motion.div>
                )}

                {/* 4. ERROR STATE: icon, message, working "Retry" button (Loading 1s -> Loaded) */}
                {demoState.status === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="w-full max-w-lg mx-auto py-4"
                  >
                    <ErrorState
                      title="Telemetry Synchronization Failed"
                      description="Lost WebSocket connection to MySQL 8.0 telemetry buffer. Request timed out after 10000ms."
                      onRetry={() => dispatch({ type: 'SELECT_STATUS', status: 'loading', durationMs: 1000 })}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </ComponentPreview>

      {/* ============================================================== */}
      {/* 2. STANDALONE SKELETON LOADERS (SEGMENTED CONTROL + CONTENT)   */}
      {/* ============================================================== */}
      <ComponentPreview
        id="standalone-skeletons"
        title="Standalone Skeleton Loaders"
        description="Dual-theme high-contrast skeleton blocks with continuous moving shimmer gradients. Flip between Skeleton and Content states or replay a simulated 1s load."
        badge="Skeleton"
        code={`import { SkeletonCard, SkeletonText } from '@/components/ui';

// Standalone Skeleton vs Loaded Content toggle:
<SkeletonCard />
<SkeletonText lines={4} />`}
      >
        <div className="w-full space-y-4">
          {/* Segmented Control & Replay Load button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-2xl border border-border bg-surface-elevated/70 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 rounded-xl border border-border bg-background shadow-xs">
              <button
                type="button"
                data-testid="tab-skeleton"
                onClick={() => setStandaloneMode('skeleton')}
                className={`h-7 px-3 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${standaloneMode === 'skeleton'
                  ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Skeleton
              </button>
              <button
                type="button"
                data-testid="tab-content"
                onClick={() => setStandaloneMode('content')}
                className={`h-7 px-3 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${standaloneMode === 'content'
                  ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                Content
              </button>
            </div>

            <button
              type="button"
              data-testid="btn-replay-load"
              onClick={handleReplayLoad}
              disabled={isReplaying}
              className="h-8 px-3 rounded-xl border border-border bg-surface hover:bg-muted text-xs font-mono font-medium text-foreground flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-brand ${isReplaying ? 'animate-spin' : ''}`} />
              <span>{isReplaying ? 'Replaying load...' : 'Replay load (1s)'}</span>
            </button>
          </div>

          {/* Cards Grid: flips conditionally between Skeleton & Content */}
          {standaloneMode === 'skeleton' ? (
            <div data-testid="standalone-skeleton-view" className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <SkeletonCard />
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-bento space-y-4">
                <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Shimmer Text Block
                </h5>
                <SkeletonText lines={4} />
              </div>
            </div>
          ) : (
            <div data-testid="standalone-content-view" className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Real Content Card 1: Exam card with title, candidate name, trust ring, chips */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-bento space-y-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground block">
                        SYS-310: Distributed Systems
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        Elena Kaur
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-muted-foreground border border-border font-semibold">
                      P0011
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      ONLINE
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                  <TrustRing score={98} size={56} />
                  <div>
                    <div className="text-2xl font-extrabold font-mono tracking-tight text-foreground">
                      98% Trust
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min: 50% • 0 Infractions Recorded
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/70 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>MediaPipe Vision v0.10.x</span>
                  <span className="text-emerald-500 font-semibold">99.8% Facial Lock</span>
                </div>
              </div>

              {/* Real Content Card 2: Telemetry block with 4 metric lines */}
              <div className="p-6 rounded-2xl border border-border bg-surface shadow-bento space-y-4 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Zero-Trust Telemetry Engine
                    </h5>
                    <span className="text-[10px] font-mono text-muted-foreground">InnoDB ACID</span>
                  </div>
                  <h4 className="text-base font-bold text-foreground tracking-tight">
                    Authoritative Telemetry Metrics
                  </h4>
                </div>

                {/* 4 Metric Lines */}
                <div className="space-y-2 font-mono text-xs">
                  <div className="p-2 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Radio className="w-3.5 h-3.5 text-brand" /> WebSocket Buffer
                    </span>
                    <span className="font-semibold text-foreground">Sub-15ms Latency</span>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Database className="w-3.5 h-3.5 text-emerald-500" /> ACID Auto-Deduct
                    </span>
                    <span className="font-semibold text-emerald-500">MySQL 8.0 Active</span>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Cpu className="w-3.5 h-3.5 text-violet-500" /> MediaPipe Neural Lock
                    </span>
                    <span className="font-semibold text-foreground">60 FPS Edge Vision</span>
                  </div>
                  <div className="p-2 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="w-3.5 h-3.5 text-amber-500" /> Immutability Ledger
                    </span>
                    <span className="font-semibold text-foreground">SQLSTATE 45000 Guard</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Sub-20ms WebSocket cluster</span>
                  <span className="text-brand font-semibold">Row-level Lock Active</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ComponentPreview>

      {/* ============================================================== */}
      {/* 3. EMPTY & ERROR STATES (WORKING RETRY / REFRESH ACTIONS)       */}
      {/* ============================================================== */}
      <ComponentPreview
        id="empty-and-error-states"
        title="EmptyState & ErrorState Components"
        description="Standardized placeholders featuring centered icons, clear explanatory copy, and functioning remediation actions. Click Refresh or Retry to see loading and resolution."
        badge="Zero-State"
        code={`import { EmptyState, ErrorState } from '@/components/ui';

<EmptyState
  title="No Candidate Records Found"
  description="No students have joined this assessment session yet."
  action={{
    label: 'Refresh Roster',
    onClick: () => handleRefresh(),
  }}
/>

<ErrorState
  title="Database Introspection Error"
  description="Could not query schema information schema table metrics."
  onRetry={() => handleRetry()}
/>`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Empty State Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-center min-h-[280px]">
            {emptyCardLoading ? (
              <div className="space-y-4 py-6">
                <div className="flex justify-center">
                  <Skeleton variant="circle" className="w-12 h-12" />
                </div>
                <div className="space-y-2 text-center max-w-xs mx-auto">
                  <Skeleton variant="text" className="w-40 h-5 mx-auto rounded" />
                  <Skeleton variant="text" className="w-56 h-3 mx-auto rounded" />
                </div>
                <div className="flex justify-center pt-2">
                  <Skeleton variant="rect" className="w-32 h-8 rounded-xl" />
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-8 h-8 text-brand" />}
                title="No Candidate Records Found"
                description="No students have registered for this exam cohort yet."
                action={{
                  label: 'Refresh Roster',
                  onClick: handleEmptyRefresh,
                }}
              />
            )}
          </div>

          {/* Error State Card (Flips between Error, Loading skeleton, and Resolved Data) */}
          <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-center min-h-[280px]">
            {errorCardState === 'loading' ? (
              <div className="space-y-4 py-6">
                <div className="flex justify-center">
                  <Skeleton variant="circle" className="w-12 h-12" />
                </div>
                <div className="space-y-2 text-center max-w-xs mx-auto">
                  <Skeleton variant="text" className="w-48 h-5 mx-auto rounded" />
                  <Skeleton variant="text" className="w-60 h-3 mx-auto rounded" />
                </div>
                <div className="flex justify-center pt-2">
                  <Skeleton variant="rect" className="w-32 h-8 rounded-xl" />
                </div>
              </div>
            ) : errorCardState === 'loaded' ? (
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-bold text-sm text-foreground">Database Introspection Restored</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    200 OK
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Successfully queried MySQL 8.0 information_schema.tables. Found 14 system tables with active row triggers.
                </p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] font-mono text-emerald-500 font-semibold">
                    Latency: 14ms
                  </span>
                  <button
                    type="button"
                    onClick={() => setErrorCardState('error')}
                    className="px-3 py-1.5 text-xs font-mono rounded-xl border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Reset to Error State
                  </button>
                </div>
              </div>
            ) : (
              <ErrorState
                title="Database Introspection Error"
                description="Could not query schema information schema table metrics."
                onRetry={handleErrorRetry}
              />
            )}
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}

export default LoadingEmptySection;
