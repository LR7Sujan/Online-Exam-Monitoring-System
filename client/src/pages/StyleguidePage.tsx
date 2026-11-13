import { useState } from 'react';
import {
  GlassCard,
  NeonButton,
  StatCard,
  TrustRing,
  SeverityBadge,
  StatusPill,
  AnimatedTable,
  Column,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  useToast,
  Modal,
  Tabs,
  EmptyState,
  LiveDot,
} from '../components/ui';
import {
  Sparkles,
  Layers,
  Activity,
  Shield,
  Zap,
  Bell,
  Trash2,
  Plus,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Terminal,
} from 'lucide-react';

interface SampleRow {
  id: number;
  candidate: string;
  exam: string;
  trustScore: number;
  status: string;
  violations: number;
}

const INITIAL_ROWS: SampleRow[] = [
  { id: 101, candidate: 'Aarav Mehta', exam: 'CS-401 Algorithms', trustScore: 92, status: 'IN_PROGRESS', violations: 1 },
  { id: 102, candidate: 'Devanshi Sharma', exam: 'CS-302 Operating Systems', trustScore: 45, status: 'TERMINATED_CHEATING', violations: 4 },
  { id: 103, candidate: 'Rohan Gupta', exam: 'CS-401 Algorithms', trustScore: 100, status: 'SUBMITTED', violations: 0 },
  { id: 104, candidate: 'Priya Iyer', exam: 'EE-205 Signal Processing', trustScore: 78, status: 'IN_PROGRESS', violations: 2 },
];

export function StyleguidePage() {
  const toast = useToast();

  // Interactive TrustRing state
  const [trustScore, setTrustScore] = useState<number>(85);
  const [minLimit, setMinLimit] = useState<number>(70);

  // Interactive NeonButton loading state
  const [btnLoading, setBtnLoading] = useState<boolean>(false);

  // Interactive Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Interactive Tabs state
  const [activeTab, setActiveTab] = useState<string>('tab-1');
  const [activeUnderlineTab, setActiveUnderlineTab] = useState<string>('all');

  // Interactive AnimatedTable state
  const [tableData, setTableData] = useState<SampleRow[]>(INITIAL_ROWS);
  const [nextId, setNextId] = useState<number>(105);

  const handleAddRow = () => {
    const candidates = ['Karan Verma', 'Ananya Roy', 'Vikram Patel', 'Sneha Nair', 'Aditya Joshi'];
    const exams = ['CS-401 Algorithms', 'CS-302 Operating Systems', 'DB-201 MySQL Architecture'];
    const randomScore = Math.floor(Math.random() * 65) + 35;
    const randomStatus = randomScore < 50 ? 'TERMINATED_CHEATING' : randomScore > 90 ? 'SUBMITTED' : 'IN_PROGRESS';

    const newRow: SampleRow = {
      id: nextId,
      candidate: candidates[Math.floor(Math.random() * candidates.length)],
      exam: exams[Math.floor(Math.random() * exams.length)],
      trustScore: randomScore,
      status: randomStatus,
      violations: Math.floor(Math.random() * 5),
    };

    setNextId((c) => c + 1);
    setTableData((prev) => [newRow, ...prev]);
    toast.success('Row Added', `Telemetry record #${newRow.id} generated`);
  };

  const handleRemoveRow = (id: number) => {
    setTableData((prev) => prev.filter((r) => r.id !== id));
    toast.info('Row Removed', `Telemetry row #${id} exited table`);
  };

  const handleResetRows = () => {
    setTableData(INITIAL_ROWS);
    toast.info('Table Reset', 'Sample dataset restored to initial state');
  };

  const tableColumns: Column<SampleRow>[] = [
    {
      key: 'id',
      header: 'Session',
      render: (r) => <span className="font-mono text-cyan">#{r.id}</span>,
      width: '100px',
    },
    {
      key: 'candidate',
      header: 'Candidate Name',
      render: (r) => <span className="font-semibold text-white">{r.candidate}</span>,
    },
    {
      key: 'exam',
      header: 'Exam Title',
      render: (r) => <span className="text-slate-300 text-xs">{r.exam}</span>,
    },
    {
      key: 'trustScore',
      header: 'Trust Score',
      align: 'center',
      render: (r) => (
        <span
          className={`font-mono font-bold ${
            r.trustScore >= 80
              ? 'text-emerald'
              : r.trustScore >= 60
              ? 'text-amber'
              : 'text-magenta'
          }`}
        >
          {r.trustScore}%
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusPill status={r.status} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRemoveRow(r.id);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-magenta hover:bg-magenta/10 transition-colors"
          title="Remove row to test exit animation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="space-y-2 border-b border-white/10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet/40 bg-violet/10 text-violet text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PROCTORIQ DESIGN SYSTEM</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Mission Control Component Styleguide
        </h1>
        <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
          Comprehensive showcase of the ProctorIQ UI library. All components are built with
          Tailwind CSS, Framer Motion, dark glassmorphism, and neon telemetry accents.
        </p>
      </div>

      {/* ============================================================== */}
      {/* 1. PALETTE & LIVE DOTS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>01. Design Tokens & Live Indicators</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Void (Base)', hex: '#0A0B14', bg: 'bg-[#0A0B14]', border: 'border-white/10' },
            { name: 'Cyan (Primary)', hex: '#22D3EE', bg: 'bg-cyan', border: 'border-cyan/40 shadow-glow-cyan-sm' },
            { name: 'Violet (Secondary)', hex: '#8B5CF6', bg: 'bg-violet', border: 'border-violet/40 shadow-glow-violet-sm' },
            { name: 'Magenta (Alert)', hex: '#F43F5E', bg: 'bg-magenta', border: 'border-magenta/40 shadow-glow-magenta-sm' },
            { name: 'Emerald (Safe)', hex: '#10B981', bg: 'bg-emerald', border: 'border-emerald/40 shadow-glow-emerald-sm' },
            { name: 'Amber (Warn)', hex: '#F59E0B', bg: 'bg-amber', border: 'border-amber/40 shadow-glow-amber-sm' },
          ].map((item) => (
            <GlassCard key={item.name} className="p-3.5 space-y-2">
              <div className={`h-12 w-full rounded-lg ${item.bg} border ${item.border}`} />
              <div>
                <p className="text-xs font-semibold text-white">{item.name}</p>
                <p className="text-[11px] font-mono text-slate-400">{item.hex}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* LiveDot variants */}
        <GlassCard className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-white">LiveDot Indicators</h4>
            <p className="text-[11px] text-slate-400 font-mono">Pulsing telemetry state beacons</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <LiveDot color="emerald" size="md" pulse />
              <span className="text-xs font-mono text-slate-300">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="cyan" size="md" pulse />
              <span className="text-xs font-mono text-slate-300">Syncing</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="amber" size="md" pulse />
              <span className="text-xs font-mono text-slate-300">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="rose" size="md" pulse />
              <span className="text-xs font-mono text-slate-300">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="violet" size="md" pulse />
              <span className="text-xs font-mono text-slate-300">Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="gray" size="md" pulse={false} />
              <span className="text-xs font-mono text-slate-400">Offline</span>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 2. GLASSCARD VARIANTS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>02. GlassCard Glow & Border Variants</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <GlassCard glow="none" hoverEffect className="p-5">
            <div className="font-mono text-xs text-slate-400">glow="none" hoverEffect</div>
            <h4 className="text-base font-semibold text-white mt-1">Standard Glass Surface</h4>
            <p className="text-xs text-slate-400 mt-2">
              Subtle border with smooth hover brightness and backdrop blur.
            </p>
          </GlassCard>

          <GlassCard glow="cyan" hoverEffect className="p-5">
            <div className="font-mono text-xs text-cyan">glow="cyan"</div>
            <h4 className="text-base font-semibold text-white mt-1">Cyan Telemetry Glow</h4>
            <p className="text-xs text-slate-400 mt-2">
              Primary mission control highlight with cyan border and ambient bloom.
            </p>
          </GlassCard>

          <GlassCard glow="violet" hoverEffect className="p-5">
            <div className="font-mono text-xs text-violet">glow="violet"</div>
            <h4 className="text-base font-semibold text-white mt-1">Violet Administrative Glow</h4>
            <p className="text-xs text-slate-400 mt-2">
              Privileged security view and administrative command center containers.
            </p>
          </GlassCard>

          <GlassCard glow="magenta" hoverEffect className="p-5">
            <div className="font-mono text-xs text-magenta">glow="magenta"</div>
            <h4 className="text-base font-semibold text-white mt-1">Magenta Alert Glow</h4>
            <p className="text-xs text-slate-400 mt-2">
              Critical violation warnings, lockouts, and penalty threshold triggers.
            </p>
          </GlassCard>

          <GlassCard glow="emerald" hoverEffect className="p-5">
            <div className="font-mono text-xs text-emerald">glow="emerald"</div>
            <h4 className="text-base font-semibold text-white mt-1">Emerald Safe Glow</h4>
            <p className="text-xs text-slate-400 mt-2">
              Clean sessions, verified grading transactions, and compliant candidates.
            </p>
          </GlassCard>

          <GlassCard gradientBorder="cyan" className="p-5">
            <div className="font-mono text-xs text-cyan">gradientBorder="cyan"</div>
            <h4 className="text-base font-semibold text-white mt-1">Gradient Cyber Border</h4>
            <p className="text-xs text-slate-400 mt-2">
              Masked gradient border with high-tech edge highlights.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. NEON BUTTONS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
            <Zap className="w-4 h-4" />
            <span>03. NeonButton Variants & Sizes</span>
          </div>
          <button
            onClick={() => setBtnLoading(!btnLoading)}
            className="text-xs font-mono text-cyan hover:underline flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Toggle Loading State ({btnLoading ? 'ON' : 'OFF'})
          </button>
        </div>

        <GlassCard className="p-6 space-y-6">
          {/* Variants */}
          <div className="space-y-2">
            <h4 className="text-xs font-mono uppercase text-slate-400">Variant Styles</h4>
            <div className="flex flex-wrap items-center gap-3">
              <NeonButton variant="primary" isLoading={btnLoading} leftIcon={<Activity className="w-4 h-4" />}>
                Primary Cyan
              </NeonButton>
              <NeonButton variant="secondary" isLoading={btnLoading} leftIcon={<Shield className="w-4 h-4" />}>
                Secondary Violet
              </NeonButton>
              <NeonButton variant="danger" isLoading={btnLoading} leftIcon={<AlertCircle className="w-4 h-4" />}>
                Danger Magenta
              </NeonButton>
              <NeonButton variant="success" isLoading={btnLoading} leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                Success Emerald
              </NeonButton>
              <NeonButton variant="outline" isLoading={btnLoading}>
                Outline Cyber
              </NeonButton>
              <NeonButton variant="ghost" isLoading={btnLoading}>
                Ghost Action
              </NeonButton>
              <NeonButton variant="primary" disabled>
                Disabled
              </NeonButton>
            </div>
          </div>

          {/* Sizes */}
          <div className="space-y-2 pt-4 border-t border-white/5">
            <h4 className="text-xs font-mono uppercase text-slate-400">Size Scale</h4>
            <div className="flex flex-wrap items-center gap-3">
              <NeonButton variant="primary" size="sm">
                Small (sm)
              </NeonButton>
              <NeonButton variant="primary" size="md">
                Medium (md)
              </NeonButton>
              <NeonButton variant="primary" size="lg">
                Large (lg)
              </NeonButton>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 4. STAT CARD (ANIMATED COUNT-UP & SPARKLINE) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Activity className="w-4 h-4" />
          <span>04. StatCard (Animated Count-Up + Sparklines)</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active Exam Sessions"
            value={42}
            icon={<Activity className="w-5 h-5" />}
            change={14.8}
            changeLabel="vs last hour"
            accent="cyan"
            sparklineData={[15, 22, 18, 30, 28, 38, 42]}
          />

          <StatCard
            label="Average Trust Index"
            value={88.4}
            decimals={1}
            suffix="%"
            icon={<Shield className="w-5 h-5" />}
            change={2.3}
            changeLabel="across 40 cohorts"
            accent="emerald"
            sparklineData={[80, 82, 85, 84, 87, 88, 88.4]}
          />

          <StatCard
            label="Critical Violations"
            value={19}
            icon={<AlertCircle className="w-5 h-5" />}
            change={-12.5}
            changeLabel="auto-terminated"
            accent="magenta"
            sparklineData={[35, 28, 30, 24, 22, 21, 19]}
          />

          <StatCard
            label="InnoDB Query Latency"
            value={14}
            suffix=" ms"
            icon={<Database className="w-5 h-5" />}
            change={-5.0}
            changeLabel="sp_SubmitAndGradeExam"
            accent="violet"
            sparklineData={[22, 19, 18, 16, 15, 14, 14]}
          />
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. TRUSTRING (INTERACTIVE SVG CIRCULAR GAUGE) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>05. TrustRing (Animated Gauge & Critical Pulse)</span>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Shifts: Emerald &gt;= 80 • Amber 50-79 • Red &lt; 50
          </span>
        </div>

        <GlassCard className="p-6 space-y-6">
          {/* Interactive controls */}
          <div className="p-4 rounded-xl border border-white/10 bg-[#0A0B14]/80 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px] space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Simulate Trust Score:</span>
                <span className="font-bold text-cyan">{trustScore}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={trustScore}
                onChange={(e) => setTrustScore(Number(e.target.value))}
                className="w-full accent-cyan cursor-pointer"
              />
            </div>

            <div className="min-w-[150px] space-y-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-300">Lockout Limit:</span>
                <span className="font-bold text-magenta">{minLimit}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="90"
                value={minLimit}
                onChange={(e) => setMinLimit(Number(e.target.value))}
                className="w-full accent-magenta cursor-pointer"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTrustScore(100)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-emerald/40 text-emerald bg-emerald/10 hover:bg-emerald/20"
              >
                100% (Clean)
              </button>
              <button
                onClick={() => setTrustScore(65)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-amber/40 text-amber bg-amber/10 hover:bg-amber/20"
              >
                65% (Warning)
              </button>
              <button
                onClick={() => setTrustScore(35)}
                className="px-2.5 py-1 text-xs font-mono rounded-lg border border-magenta/40 text-magenta bg-magenta/10 hover:bg-magenta/20"
              >
                35% (Critical)
              </button>
            </div>
          </div>

          {/* Size Demonstrations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center justify-items-center py-4">
            <div className="flex flex-col items-center gap-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="sm" />
              <span className="text-xs font-mono text-slate-400">Size: sm (96px)</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="md" />
              <span className="text-xs font-mono text-slate-400">Size: md (144px) [Default]</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="lg" />
              <span className="text-xs font-mono text-slate-400">Size: lg (192px)</span>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 6. SEVERITY BADGES & STATUS PILLS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Terminal className="w-4 h-4" />
          <span>06. SeverityBadge & StatusPill</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Severity Badges */}
          <GlassCard className="p-5 space-y-4">
            <h4 className="text-xs font-mono uppercase text-slate-400">
              SeverityBadge (Violation Levels)
            </h4>
            <div className="flex flex-wrap gap-2.5 items-center">
              <SeverityBadge severity="LOW" />
              <SeverityBadge severity="MEDIUM" />
              <SeverityBadge severity="HIGH" />
              <SeverityBadge severity="CRITICAL" />
            </div>
            <div className="flex flex-wrap gap-2.5 items-center pt-2">
              <SeverityBadge severity="LOW" size="sm" />
              <SeverityBadge severity="MEDIUM" size="sm" />
              <SeverityBadge severity="HIGH" size="sm" />
              <SeverityBadge severity="CRITICAL" size="sm" />
            </div>
          </GlassCard>

          {/* Status Pills */}
          <GlassCard className="p-5 space-y-4">
            <h4 className="text-xs font-mono uppercase text-slate-400">
              StatusPill (Domain Entities)
            </h4>
            <div className="flex flex-wrap gap-2 items-center">
              <StatusPill status="IN_PROGRESS" />
              <StatusPill status="SUBMITTED" />
              <StatusPill status="TERMINATED_CHEATING" />
              <StatusPill status="TIMED_OUT" />
            </div>
            <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-white/5">
              <StatusPill status="CLEAN" size="sm" />
              <StatusPill status="FLAGGED" size="sm" />
              <StatusPill status="DISQUALIFIED" size="sm" />
              <StatusPill status="PENDING" size="sm" />
              <StatusPill status="CONFIRMED" size="sm" />
              <StatusPill status="DISMISSED" size="sm" />
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. ANIMATED TABLE (ROW ENTER/EXIT) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>07. AnimatedTable (Row Enter & Exit Transitions)</span>
          </div>
          <div className="flex items-center gap-2">
            <NeonButton variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddRow}>
              Insert Row
            </NeonButton>
            <NeonButton variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleResetRows}>
              Reset
            </NeonButton>
          </div>
        </div>

        <AnimatedTable
          columns={tableColumns}
          data={tableData}
          getRowKey={(r) => r.id}
          emptyMessage="All candidates removed from telemetry buffer. Click 'Insert Row' to populate."
        />
      </section>

      {/* ============================================================== */}
      {/* 8. TABS COMPONENT */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>08. Tabs (Animated Pill & Underline Sliders)</span>
        </div>

        <GlassCard className="p-6 space-y-6">
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase text-slate-400">Pills Variant</h4>
            <Tabs
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="pills"
              tabs={[
                { id: 'tab-1', label: 'Live Telemetry', badge: '42' },
                { id: 'tab-2', label: 'Violation Audit', badge: '19' },
                { id: 'tab-3', label: 'Schema Triggers' },
                { id: 'tab-4', label: 'Inactive Feed', disabled: true },
              ]}
            />
            <div className="p-3 rounded-xl border border-white/5 bg-[#0A0B14]/60 text-xs font-mono text-cyan">
              Active tab state: <span className="text-white font-bold">{activeTab}</span>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="text-xs font-mono uppercase text-slate-400">Underline Variant</h4>
            <Tabs
              activeTab={activeUnderlineTab}
              onChange={setActiveUnderlineTab}
              variant="underline"
              tabs={[
                { id: 'all', label: 'All Violations' },
                { id: 'critical', label: 'Critical Only', badge: '5' },
                { id: 'appeals', label: 'Pending Appeals', badge: '2' },
              ]}
            />
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 9. TOAST & MODAL INTERACTIVE SYSTEMS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Bell className="w-4 h-4" />
          <span>09. Toast Notification System & Modal Dialog</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Toast Triggers */}
          <GlassCard className="p-6 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Toast Notification System</h4>
              <p className="text-xs text-slate-400 mt-1">
                Trigger animated mission control alerts with automatic timer progress bars.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <NeonButton
                variant="success"
                size="sm"
                onClick={() =>
                  toast.success(
                    'Transaction Graded',
                    'sp_SubmitAndGradeExam executed cleanly with 0 violations.'
                  )
                }
              >
                Trigger Success
              </NeonButton>

              <NeonButton
                variant="danger"
                size="sm"
                onClick={() =>
                  toast.error(
                    'Threshold Breach',
                    'Candidate trust score dropped below 70%. Session terminated.'
                  )
                }
              >
                Trigger Error
              </NeonButton>

              <NeonButton
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.warning(
                    'Tab Switch Warning',
                    'trg_after_violation_insert deducted 15 penalty points.'
                  )
                }
              >
                Trigger Warning
              </NeonButton>

              <NeonButton
                variant="ghost"
                size="sm"
                onClick={() =>
                  toast.info(
                    'Heartbeat Synced',
                    'Socket client joined proctors room.'
                  )
                }
              >
                Trigger Info
              </NeonButton>
            </div>
          </GlassCard>

          {/* Modal Trigger */}
          <GlassCard className="p-6 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Mission Control Modal Dialog</h4>
              <p className="text-xs text-slate-400 mt-1">
                Backdrop blur dialog with keyboard Escape listeners and spring physics.
              </p>
            </div>

            <NeonButton
              variant="secondary"
              size="md"
              leftIcon={<Play className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
            >
              Launch Interactive Modal
            </NeonButton>
          </GlassCard>
        </div>

        {/* Modal Instance */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Manual Proctor Lockout Confirmation"
          description="Initiate emergency termination protocol for candidate session #102."
          footer={
            <>
              <NeonButton variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton
                variant="danger"
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  toast.error('Session Terminated', 'Proctor force-terminated candidate session.');
                }}
              >
                Confirm Lockout
              </NeonButton>
            </>
          }
        >
          <div className="space-y-4 text-xs text-slate-300">
            <p>
              You are about to invoke administrative lockout on student{' '}
              <strong className="text-white">Devanshi Sharma</strong>. This action sets{' '}
              <code className="text-magenta">status = TERMINATED_CHEATING</code> and persists an
              immutable audit record in <code className="text-cyan">Proctoring_Logs</code>.
            </p>
            <div className="p-3 rounded-xl border border-magenta/40 bg-magenta/10 space-y-1">
              <span className="font-mono text-magenta font-semibold uppercase text-[11px]">
                Warning: Trigger Enforced
              </span>
              <p className="text-[11px] text-rose-200">
                The session will be locked immediately and will require explicit reinstatement.
              </p>
            </div>
          </div>
        </Modal>
      </section>

      {/* ============================================================== */}
      {/* 10. SKELETON LOADERS & EMPTY STATE */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>10. Skeleton Loaders & Holographic Empty State</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Skeletons */}
          <GlassCard className="p-5 space-y-4">
            <h4 className="text-xs font-mono uppercase text-slate-400">Skeleton Loaders</h4>
            <Skeleton variant="rect" className="w-full h-8" />
            <SkeletonCard />
            <SkeletonText lines={3} />
          </GlassCard>

          {/* EmptyState */}
          <EmptyState
            title="No Active Candidate Violations"
            description="The automated monitoring feed is quiet. All candidates are currently operating above their configured minimum trust threshold."
            action={{
              label: 'Trigger Synthetic Telemetry',
              onClick: () => toast.info('Telemetry Simulation', 'Dispatched simulated heartbeat.'),
              icon: <Activity className="w-3.5 h-3.5" />,
            }}
          />
        </div>
      </section>
    </div>
  );
}
