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
  SkeletonCard,
  SkeletonText,
  useToast,
  Modal,
  Drawer,
  BentoGrid,
  BentoCard,
  AvatarStack,
  AvatarItem,
  Tabs,
  EmptyState,
  LiveDot,
  ThemeToggle,
} from '../components/ui';
import {
  Sparkles,
  Layers,
  Activity,
  Shield,
  Zap,
  Trash2,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  Terminal,
  Grid,
  Users,
  PanelRight,
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

const SAMPLE_AVATARS: AvatarItem[] = [
  { id: 1, name: 'Aarav Mehta', status: 'online' },
  { id: 2, name: 'Devanshi Sharma', status: 'busy' },
  { id: 3, name: 'Rohan Gupta', status: 'online' },
  { id: 4, name: 'Priya Iyer', status: 'away' },
  { id: 5, name: 'Karan Verma', status: 'offline' },
  { id: 6, name: 'Ananya Roy', status: 'online' },
];

export function StyleguidePage() {
  const toast = useToast();

  // Interactive TrustRing state
  const [trustScore, setTrustScore] = useState<number>(85);
  const minLimit = 70;

  // Interactive NeonButton loading state
  const [btnLoading, setBtnLoading] = useState<boolean>(false);

  // Interactive Modal & Drawer state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Interactive Tabs state
  const [activeTab, setActiveTab] = useState<string>('tab-1');
  const [activeUnderlineTab, setActiveUnderlineTab] = useState<string>('all');

  // Interactive AnimatedTable state
  const [tableData, setTableData] = useState<SampleRow[]>(INITIAL_ROWS);
  const [nextId, setNextId] = useState<number>(105);
  const [sortKey, setSortKey] = useState<string>('trustScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

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
      sortable: true,
      render: (r) => <span className="font-mono text-brand">#{r.id}</span>,
      width: '100px',
    },
    {
      key: 'candidate',
      header: 'Candidate Name',
      sortable: true,
      render: (r) => <span className="font-semibold text-foreground">{r.candidate}</span>,
    },
    {
      key: 'exam',
      header: 'Exam Title',
      render: (r) => <span className="text-muted-foreground text-xs">{r.exam}</span>,
    },
    {
      key: 'trustScore',
      header: 'Trust Score',
      align: 'center',
      sortable: true,
      render: (r) => (
        <span
          className={`font-mono font-bold ${
            r.trustScore >= 80
              ? 'text-emerald-500'
              : r.trustScore >= 60
              ? 'text-amber-500'
              : 'text-rose-500'
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
          className="p-1 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
          title="Remove row"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-12 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="space-y-3 pb-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-mono font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AURORA BENTO DESIGN SYSTEM</span>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl mt-2">
            ProctorIQ UI Component Styleguide
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed mt-1">
            Complete design specification: 20px radius bento surfaces, 1px hairline borders,
            Geist typography, soft layered shadows, and dual-theme tokens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle showLabel />
        </div>
      </div>

      {/* ============================================================== */}
      {/* 1. TOKENS & LIVE INDICATORS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Layers className="w-4 h-4" />
          <span>01. Design Tokens & Live Indicators</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { name: 'Background', hex: 'var(--background)', bg: 'bg-background', border: 'border-border' },
            { name: 'Surface', hex: 'var(--surface)', bg: 'bg-surface', border: 'border-border' },
            { name: 'Brand Indigo', hex: '#6366F1', bg: 'bg-brand-indigo', border: 'border-indigo-400/40' },
            { name: 'Brand Violet', hex: '#8B5CF6', bg: 'bg-brand-violet', border: 'border-violet-400/40' },
            { name: 'Safe (Emerald)', hex: '#10B981', bg: 'bg-safe', border: 'border-emerald-400/40' },
            { name: 'Danger (Rose)', hex: '#F43F5E', bg: 'bg-danger', border: 'border-rose-400/40' },
          ].map((item) => (
            <GlassCard key={item.name} className="p-3.5 space-y-2">
              <div className={`h-12 w-full rounded-xl ${item.bg} border ${item.border} shadow-sm`} />
              <div>
                <p className="text-xs font-semibold text-foreground">{item.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{item.hex}</p>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* LiveDot variants */}
        <GlassCard className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-semibold text-foreground">LiveDot Indicators</h4>
            <p className="text-[11px] text-muted-foreground font-mono">Pulsing telemetry state beacons</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <LiveDot color="emerald" size="md" pulse />
              <span className="text-xs font-mono text-foreground">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="cyan" size="md" pulse />
              <span className="text-xs font-mono text-foreground">Syncing</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="amber" size="md" pulse />
              <span className="text-xs font-mono text-foreground">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="rose" size="md" pulse />
              <span className="text-xs font-mono text-foreground">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="violet" size="md" pulse />
              <span className="text-xs font-mono text-foreground">Processing</span>
            </div>
            <div className="flex items-center gap-2">
              <LiveDot color="gray" size="md" pulse={false} />
              <span className="text-xs font-mono text-muted-foreground">Offline</span>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 2. BENTO GRID & BENTO CARDS (NEW) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Grid className="w-4 h-4" />
          <span>02. BentoGrid & BentoCard (12-Col Responsive)</span>
        </div>

        <BentoGrid>
          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-xs font-mono text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-lg font-semibold text-foreground tracking-tight">Active Surveillance</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time facial keypoint telemetry with on-device MediaPipe pipeline.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-xs font-mono text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-lg font-semibold text-foreground tracking-tight">SQL Enforced Triggers</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Database-level atomic deduction prevents duplicate execution & guarantees ACID integrity.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-xs font-mono text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-lg font-semibold text-foreground tracking-tight">Aurora Ambient Glow</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hover over this card to observe the cursor-follow spotlight effect.
            </p>
          </BentoCard>

          <BentoCard colSpan={8} className="p-6 space-y-2">
            <span className="text-xs font-mono text-muted-foreground">COL-SPAN 8</span>
            <h4 className="text-lg font-semibold text-foreground tracking-tight">Institutional Audit Ledger</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every proctoring incident is logged to an immutable append-only audit table with cryptographic session timestamps.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-xs font-mono text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-lg font-semibold text-foreground tracking-tight">Live Avatars</h4>
            <AvatarStack avatars={SAMPLE_AVATARS} max={4} size="md" className="pt-2" />
          </BentoCard>
        </BentoGrid>
      </section>

      {/* ============================================================== */}
      {/* 3. AVATAR STACK (NEW) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Users className="w-4 h-4" />
          <span>03. AvatarStack Component</span>
        </div>

        <GlassCard className="p-6 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Candidate & Proctor Stacks</h4>
            <p className="text-xs text-muted-foreground">Overlapping avatars with presence indicator rings</p>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-1 text-center">
              <span className="text-[10px] font-mono text-muted-foreground">SMALL</span>
              <AvatarStack avatars={SAMPLE_AVATARS} max={3} size="sm" />
            </div>

            <div className="space-y-1 text-center">
              <span className="text-[10px] font-mono text-muted-foreground">MEDIUM (DEFAULT)</span>
              <AvatarStack avatars={SAMPLE_AVATARS} max={4} size="md" />
            </div>

            <div className="space-y-1 text-center">
              <span className="text-[10px] font-mono text-muted-foreground">LARGE</span>
              <AvatarStack avatars={SAMPLE_AVATARS} max={5} size="lg" />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 4. STATCARDS WITH SPARKLINES & COUNT-UPS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Activity className="w-4 h-4" />
          <span>04. StatCard Metrics & Sparklines</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Candidates"
            value={142}
            change={8.4}
            changeLabel="vs 1h ago"
            accent="cyan"
            icon={<Activity className="w-5 h-5" />}
            sparklineData={[80, 95, 110, 105, 125, 138, 142]}
          />
          <StatCard
            label="Violations (10m)"
            value={27}
            change={-14.2}
            changeLabel="vs last window"
            accent="magenta"
            icon={<AlertCircle className="w-5 h-5" />}
            sparklineData={[42, 38, 35, 31, 29, 28, 27]}
          />
          <StatCard
            label="Flagged Sessions"
            value={12}
            change={0}
            changeLabel="stable"
            accent="amber"
            icon={<Shield className="w-5 h-5" />}
            sparklineData={[10, 11, 12, 12, 12, 12, 12]}
          />
          <StatCard
            label="Mean Integrity"
            value={94.6}
            suffix="%"
            decimals={1}
            change={2.1}
            changeLabel="vs cohort avg"
            accent="emerald"
            icon={<CheckCircle2 className="w-5 h-5" />}
            sparklineData={[88, 90, 89, 92, 93, 94, 95]}
          />
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. TRUSTRING SVG GAUGE (INTERACTIVE) */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Shield className="w-4 h-4" />
          <span>05. TrustRing Gauge (Interactive Score Simulator)</span>
        </div>

        <GlassCard className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Dynamic Risk Meter</h4>
              <p className="text-xs text-muted-foreground">
                Drag the slider to observe emerald $\rightarrow$ amber $\rightarrow$ rose color transitions and critical pulse.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-mono text-muted-foreground">SCORE: {trustScore}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={trustScore}
                onChange={(e) => setTrustScore(Number(e.target.value))}
                className="w-40 accent-indigo-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-around gap-8 pt-4 border-t border-border">
            <div className="text-center space-y-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="lg" sublabel="Live Index" />
              <span className="text-xs font-mono text-muted-foreground block">Size: LG (192px)</span>
            </div>

            <div className="text-center space-y-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="md" sublabel="Exam HUD" />
              <span className="text-xs font-mono text-muted-foreground block">Size: MD (144px)</span>
            </div>

            <div className="text-center space-y-2">
              <TrustRing score={trustScore} minThreshold={minLimit} size="sm" />
              <span className="text-xs font-mono text-muted-foreground block">Size: SM (96px)</span>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 6. NEONBUTTONS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Zap className="w-4 h-4" />
          <span>06. NeonButton Variants & Micro-Interactions</span>
        </div>

        <GlassCard className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <NeonButton variant="primary">Brand Primary</NeonButton>
            <NeonButton variant="secondary">Solid Secondary</NeonButton>
            <NeonButton variant="outline">Outline</NeonButton>
            <NeonButton variant="ghost">Ghost Action</NeonButton>
            <NeonButton variant="danger">Critical Danger</NeonButton>
            <NeonButton variant="success">Safe Confirmation</NeonButton>
            <NeonButton
              variant="primary"
              isLoading={btnLoading}
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 2000);
              }}
            >
              {btnLoading ? 'Saving...' : 'Click to Load'}
            </NeonButton>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 7. BADGES & STATUS PILLS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Shield className="w-4 h-4" />
          <span>07. Severity Badges & Status Pills</span>
        </div>

        <GlassCard className="p-6 space-y-6">
          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Violation Severity Levels
            </h5>
            <div className="flex flex-wrap items-center gap-3">
              <SeverityBadge severity="LOW" />
              <SeverityBadge severity="MEDIUM" />
              <SeverityBadge severity="HIGH" />
              <SeverityBadge severity="CRITICAL" />
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Candidate & Assessment Statuses
            </h5>
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill status="IN_PROGRESS" />
              <StatusPill status="SUBMITTED" />
              <StatusPill status="TIMED_OUT" />
              <StatusPill status="TERMINATED_CHEATING" />
              <StatusPill status="CLEAN" />
              <StatusPill status="FLAGGED" />
              <StatusPill status="DISQUALIFIED" />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 8. ANIMATEDTABLE / DATATABLE */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
            <Database className="w-4 h-4" />
            <span>08. AnimatedTable / DataTable (Sortable, Sticky Header)</span>
          </div>

          <div className="flex items-center gap-2">
            <NeonButton variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddRow}>
              Add Row
            </NeonButton>
            <NeonButton variant="secondary" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={handleResetRows}>
              Reset
            </NeonButton>
          </div>
        </div>

        <AnimatedTable
          columns={tableColumns}
          data={tableData}
          getRowKey={(r) => r.id}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          stickyHeader
        />
      </section>

      {/* ============================================================== */}
      {/* 9. MODAL & DRAWER OVERLAYS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <PanelRight className="w-4 h-4" />
          <span>09. Modal & Drawer Overlay Primitives</span>
        </div>

        <GlassCard className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Interactive Overlays</h4>
            <p className="text-xs text-muted-foreground">Centered bento dialog and right slide-over drawer with glass backdrops</p>
          </div>

          <div className="flex items-center gap-3">
            <NeonButton variant="secondary" onClick={() => setIsModalOpen(true)}>
              Launch Modal
            </NeonButton>
            <NeonButton variant="primary" onClick={() => setIsDrawerOpen(true)}>
              Launch Drawer
            </NeonButton>
          </div>
        </GlassCard>

        {/* Modal Instance */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Candidate Verification"
          description="Confirm identity and biometric telemetry prior to session start."
          footer={
            <>
              <NeonButton variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
                Confirm Identity
              </NeonButton>
            </>
          }
        >
          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              ProctorIQ employs on-device client face tracking and database-level trigger enforcement.
            </p>
            <div className="p-4 rounded-xl bg-surface-elevated border border-border">
              <span className="font-mono text-xs text-brand">SHA-256 System Fingerprint Verified</span>
            </div>
          </div>
        </Modal>

        {/* Drawer Instance */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          title="Session Forensics"
          description="Detailed inspection ledger and telemetry breakdown."
          footer={
            <>
              <NeonButton variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>
                Close
              </NeonButton>
              <NeonButton variant="danger" size="sm" onClick={() => setIsDrawerOpen(false)}>
                Force Terminate
              </NeonButton>
            </>
          }
        >
          <div className="space-y-4 text-xs text-muted-foreground">
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
                TELEMETRY
              </span>
              <p className="font-mono text-xs text-foreground">Candidate IP: 192.168.1.104</p>
              <p className="font-mono text-xs text-foreground">Active Focus: Locked</p>
            </div>
          </div>
        </Drawer>
      </section>

      {/* ============================================================== */}
      {/* 10. TABS & NOTIFICATIONS */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Terminal className="w-4 h-4" />
          <span>10. Animated Tabs & Sonner Toasts</span>
        </div>

        <GlassCard className="p-6 space-y-6">
          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Sliding Pill Tabs
            </h5>
            <Tabs
              variant="pills"
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'tab-1', label: 'Surveillance Grid' },
                { id: 'tab-2', label: 'Adjudication Queue', badge: 3 },
                { id: 'tab-3', label: 'Forensic Audit' },
              ]}
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Sliding Underline Tabs
            </h5>
            <Tabs
              variant="underline"
              activeTab={activeUnderlineTab}
              onChange={setActiveUnderlineTab}
              tabs={[
                { id: 'all', label: 'All Violations' },
                { id: 'critical', label: 'Critical Only', badge: 1 },
                { id: 'dismissed', label: 'Dismissed Logs' },
              ]}
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Toast Notifications (Sonner)
            </h5>
            <div className="flex flex-wrap items-center gap-3">
              <NeonButton variant="outline" size="sm" onClick={() => toast.info('System Check', 'Websocket heartbeat received.')}>
                Trigger Info
              </NeonButton>
              <NeonButton variant="success" size="sm" onClick={() => toast.success('Exam Submitted', 'Answers encrypted and uploaded.')}>
                Trigger Success
              </NeonButton>
              <NeonButton variant="secondary" size="sm" onClick={() => toast.warning('Network Degraded', 'Packet jitter detected.')}>
                Trigger Warning
              </NeonButton>
              <NeonButton variant="danger" size="sm" onClick={() => toast.error('Security Breach', 'Multiple faces detected in frame.')}>
                Trigger Error
              </NeonButton>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ============================================================== */}
      {/* 11. SKELETONS & EMPTY STATES */}
      {/* ============================================================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
          <Layers className="w-4 h-4" />
          <span>11. Skeletons & Empty State Placeholders</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <GlassCard className="p-6 space-y-4">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Shimmer Text Block
            </h5>
            <SkeletonText lines={4} />
          </GlassCard>
          <EmptyState
            title="No Active Violations"
            description="All candidate telemetry feeds are currently operating within the authorized clean threshold."
            action={{
              label: 'Refresh Stream',
              onClick: () => toast.info('Refreshed', 'Telemetry streams reconnected'),
            }}
          />
        </div>
      </section>
    </div>
  );
}
