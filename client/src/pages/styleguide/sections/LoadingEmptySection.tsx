import { useState, useRef, useEffect } from 'react';
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
  useToast,
} from '../../../components/ui';

type DemoState = 'loading' | 'loaded' | 'empty' | 'error';

interface SampleViolation {
  id: number;
  name: string;
  email: string;
  code: string;
  penalty: string;
  time: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
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
  },
  {
    id: 2,
    name: 'Sarah Chen',
    email: 's.chen@university.edu',
    code: 'MULTIPLE_FACES',
    penalty: '-35 pts',
    time: '10:41:03 AM',
    severity: 'HIGH',
  },
  {
    id: 3,
    name: 'Marcus Vance',
    email: 'm.vance@university.edu',
    code: 'DEVTOOLS_OPEN',
    penalty: '-50 pts',
    time: '10:39:50 AM',
    severity: 'CRITICAL',
  },
  {
    id: 4,
    name: 'Priya Sharma',
    email: 'p.sharma@university.edu',
    code: 'NO_FACE',
    penalty: '-20 pts',
    time: '10:37:22 AM',
    severity: 'HIGH',
  },
  {
    id: 5,
    name: "Liam O'Connor",
    email: 'l.oconnor@university.edu',
    code: 'COPY_PASTE',
    penalty: '-10 pts',
    time: '10:35:10 AM',
    severity: 'LOW',
  },
];

export function LoadingEmptySection() {
  const toast = useToast();
  const [activeState, setActiveState] = useState<DemoState>('loading');
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(false);
  const autoCycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoCycleTimeoutRef.current) {
        clearTimeout(autoCycleTimeoutRef.current);
      }
    };
  }, []);

  const handleAutoCycle = () => {
    if (autoCycleTimeoutRef.current) {
      clearTimeout(autoCycleTimeoutRef.current);
    }
    setIsAutoCycling(true);
    setActiveState('loading');

    autoCycleTimeoutRef.current = setTimeout(() => {
      setActiveState('loaded');
      setIsAutoCycling(false);
      toast.info('Auto Cycle Complete', 'Transitioned from Loading (1.5s) to Loaded state');
    }, 1500);
  };

  const handleRetry = () => {
    setActiveState('loading');
    setTimeout(() => {
      setActiveState('loaded');
      toast.success('Connection Restored', 'Telemetry stream re-established and loaded 5 records');
    }, 1200);
  };

  const toc = [
    { id: 'interactive-state-machine', label: 'Interactive State Machine (Loading | Loaded | Empty | Error)' },
    { id: 'standalone-skeletons', label: 'Standalone Skeleton Loaders' },
    { id: 'empty-and-error-states', label: 'Empty & Error Actionable States' },
  ];

  return (
    <SectionDocPage slug="loading-empty" toc={toc}>
      {/* ============================================================== */}
      {/* 1. INTERACTIVE STATE MACHINE DEMO (REQUIREMENT 1, 2, 3)         */}
      {/* ============================================================== */}
      <ComponentPreview
        id="interactive-state-machine"
        title="11. Interactive State Machine Demo"
        description="Four-state interactive data card demonstrating row-shaped moving shimmer skeletons, loaded real telemetry data, zero-state empty illustration, and error state with functioning retry."
        badge="State Machine"
        code={`// Interactive State Machine pattern:
type DemoState = 'loading' | 'loaded' | 'empty' | 'error';

// 1. Loading: row-shaped skeletons with moving shimmer
// 2. Loaded: real sample data rows with metrics
// 3. Empty: illustration, explanation & actionable button
// 4. Error: alert banner & Retry button (Loading -> Loaded)`}
      >
        <div className="w-full space-y-5">
          {/* Controls Bar: Segmented Control + Auto Cycle Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-surface-elevated/70 shadow-xs">
            {/* Segmented Control */}
            <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-background shadow-xs">
              {(['loading', 'loaded', 'empty', 'error'] as const).map((st) => {
                const isSelected = activeState === st;
                const label = st.charAt(0).toUpperCase() + st.slice(1);

                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      if (autoCycleTimeoutRef.current) {
                        clearTimeout(autoCycleTimeoutRef.current);
                        setIsAutoCycling(false);
                      }
                      setActiveState(st);
                    }}
                    className={`h-8 px-3.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    {st === 'loading' && <Radio className="w-3 h-3 animate-pulse" />}
                    {st === 'loaded' && <CheckCircle2 className="w-3 h-3" />}
                    {st === 'empty' && <FileQuestion className="w-3 h-3" />}
                    {st === 'error' && <AlertTriangle className="w-3 h-3" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Auto Cycle Button */}
            <button
              type="button"
              onClick={handleAutoCycle}
              disabled={isAutoCycling}
              className={`h-9 px-4 rounded-xl text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer border ${
                isAutoCycling
                  ? 'border-brand/40 bg-brand/10 text-brand shadow-sm animate-pulse cursor-wait'
                  : 'border-border bg-surface hover:bg-muted text-foreground hover:border-brand/30 shadow-xs'
              }`}
            >
              <Play className={`w-3.5 h-3.5 ${isAutoCycling ? 'animate-spin' : 'text-brand'}`} />
              <span>{isAutoCycling ? 'Cycling (1.5s)...' : 'Auto cycle'}</span>
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
                className={`text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full border ${
                  activeState === 'loading'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 animate-pulse'
                    : activeState === 'loaded'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : activeState === 'empty'
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                }`}
              >
                {activeState === 'loading'
                  ? 'STREAM BUFFERING'
                  : activeState === 'loaded'
                  ? '5 INCIDENTS LOGGED'
                  : activeState === 'empty'
                  ? 'ALL CLEAR'
                  : 'DISCONNECTED'}
              </span>
            </div>

            {/* Card Content Area */}
            <div className="p-4 sm:p-6 min-h-[360px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {/* 1. LOADING STATE: 5 row-shaped skeletons with visible moving shimmer */}
                {activeState === 'loading' && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 w-full"
                  >
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl border border-border/80 bg-surface-elevated/50 flex items-center justify-between gap-4"
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

                {/* 2. LOADED STATE: real sample data rows */}
                {activeState === 'loaded' && (
                  <motion.div
                    key="loaded"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2.5 w-full"
                  >
                    {SAMPLE_VIOLATIONS.map((row) => (
                      <div
                        key={row.id}
                        className="p-3.5 rounded-2xl border border-border bg-surface-elevated/60 hover:bg-surface-elevated hover:border-brand/40 transition-all flex items-center justify-between gap-4 shadow-2xs font-mono text-xs"
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
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* 3. EMPTY STATE: illustration/icon, title, explanation, action button */}
                {activeState === 'empty' && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-lg mx-auto py-4"
                  >
                    <EmptyState
                      icon={<ShieldCheck className="w-8 h-8 text-emerald-500" />}
                      title="No Active Violations"
                      description="All candidate telemetry feeds are currently operating within the authorized clean threshold. Zero infractions recorded."
                      action={{
                        label: 'Simulate Candidate Infraction',
                        onClick: () => {
                          toast.info('Simulated Infraction', 'Switched to Loaded state with 5 incidents');
                          setActiveState('loaded');
                        },
                      }}
                    />
                  </motion.div>
                )}

                {/* 4. ERROR STATE: icon, message, "Retry" button (returns to Loading then Loaded) */}
                {activeState === 'error' && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-lg mx-auto py-4"
                  >
                    <ErrorState
                      title="Telemetry Synchronization Failed"
                      description="Lost WebSocket connection to MySQL 8.0 telemetry buffer. Request timed out after 10000ms."
                      onRetry={handleRetry}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </ComponentPreview>

      {/* ============================================================== */}
      {/* 2. STANDALONE SKELETON LOADERS (CARDS, TEXT & TABLES)          */}
      {/* ============================================================== */}
      <ComponentPreview
        id="standalone-skeletons"
        title="Standalone Skeleton Loaders"
        description="Dual-theme high-contrast skeleton blocks with continuous moving shimmer gradients. Respects prefers-reduced-motion with static styling."
        badge="Skeleton"
        code={`import { SkeletonCard, SkeletonText } from '@/components/ui';

<SkeletonCard />
<SkeletonText lines={4} />`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <SkeletonCard />
          <div className="p-6 rounded-2xl border border-border bg-surface shadow-bento space-y-4">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Shimmer Text Block
            </h5>
            <SkeletonText lines={4} />
          </div>
        </div>
      </ComponentPreview>

      {/* ============================================================== */}
      {/* 3. EMPTY & ERROR STATES                                        */}
      {/* ============================================================== */}
      <ComponentPreview
        id="empty-and-error-states"
        title="EmptyState & ErrorState Components"
        description="Standardized placeholders featuring centered icons, clear explanatory copy, and remediation actions."
        badge="Zero-State"
        code={`import { EmptyState, ErrorState } from '@/components/ui';

<EmptyState
  title="No Candidate Records Found"
  description="No students have joined this assessment session yet."
  action={{
    label: 'Invite Candidates',
    onClick: () => handleInvite(),
  }}
/>

<ErrorState
  title="Connection Interrupted"
  description="Failed to connect to the telemetry service."
  onRetry={() => handleRetry()}
/>`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <EmptyState
            icon={<Users className="w-8 h-8 text-brand" />}
            title="No Candidate Records Found"
            description="No students have registered for this exam cohort yet."
            action={{
              label: 'Refresh Roster',
              onClick: () => toast.info('Refreshed', 'Candidate roster re-synced'),
            }}
          />

          <ErrorState
            title="Database Introspection Error"
            description="Could not query schema information schema table metrics."
            onRetry={() => toast.success('Retrying', 'Executing query again...')}
          />
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}

export default LoadingEmptySection;
