import {
  ArrowRight,
  Cpu,
  Layers,
  Terminal,
  Zap,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { LiveDot } from '../components/ui/LiveDot';
import { MockDashboardCard } from '../components/landing/MockDashboardCard';
import { FeatureBento } from '../components/landing/FeatureBento';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const VIOLATION_MATRIX = [
  { code: 'COPY_PASTE', penalty: '-10 pts', severity: 'LOW' as const, desc: 'Clipboard snooping attempt intercepted' },
  { code: 'TAB_SWITCH', penalty: '-15 pts', severity: 'MEDIUM' as const, desc: 'Window blur / focus loss detected' },
  { code: 'FULLSCREEN_EXIT', penalty: '-15 pts', severity: 'MEDIUM' as const, desc: 'Proctor kiosk container breach' },
  { code: 'NO_FACE', penalty: '-20 pts', severity: 'HIGH' as const, desc: 'Candidate absent from video feed (>5s)' },
  { code: 'MULTIPLE_FACES', penalty: '-35 pts', severity: 'HIGH' as const, desc: 'Secondary person in candidate camera' },
  { code: 'DEVTOOLS_OPEN', penalty: '-50 pts', severity: 'CRITICAL' as const, desc: 'Debugger inspection console detected' },
];

const STEPS = [
  {
    step: '01',
    title: 'Configure Assessment',
    desc: 'Instructors define question pools, time limits, penalty weights, and minimum integrity thresholds.',
    icon: Layers,
    badge: 'Admin Architect',
  },
  {
    step: '02',
    title: 'Neural Live Surveillance',
    desc: 'Candidates launch the locked kiosk. Client-side MediaPipe AI tracks face presence and streams sub-20ms WebSocket telemetry.',
    icon: Zap,
    badge: 'Edge AI + WSS',
  },
  {
    step: '03',
    title: 'ACID Auto-Adjudication',
    desc: 'MySQL triggers atomically deduct penalties, lock sessions upon breach, and write tamper-evident SQLSTATE 45000 audit trails.',
    icon: Lock,
    badge: 'MySQL 8.0 Engine',
  },
];

const STATS = [
  { value: '99.98%', label: 'Integrity Enforced', detail: 'Zero false-negative pass rate' },
  { value: '< 20ms', label: 'Telemetry Latency', detail: 'Real-time WebSocket event dispatch' },
  { value: '100%', label: 'ACID Guarantees', detail: 'InnoDB FOR UPDATE row locking' },
  { value: '0', label: 'Setup Calibration', detail: 'Zero-install browser edge vision' },
];

export function LandingPage() {
  useDocumentTitle('Home | ProctorIQ');
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const dashboardTarget =
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'PROCTOR'
      ? '/proctor'
      : '/student';

  return (
    <div className="space-y-10 sm:space-y-12 pb-12 w-full max-w-full overflow-x-hidden text-foreground">
      {/* ============================================================== */}
      {/* 1. HERO SECTION (2-Column Grid Aligned to Top)                 */}
      {/* ============================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Headline, Subtitle, Two CTAs, Live DBMS Badges */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {/* System Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border border-brand/30 bg-brand/10 text-brand shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
            </span>
            <span>DBMS-Enforced Zero-Trust Exam Core</span>
          </div>

          {/* Headline */}
          <div className="space-y-2.5">
            <h1 className="text-3xl sm:text-4xl lg:text-[clamp(2rem,3.2vw,3rem)] font-extrabold tracking-tight text-foreground leading-[1.12]">
              Mission Control for{' '}
              <span className="bg-gradient-to-r from-accent-from via-accent-via to-accent-to bg-clip-text text-transparent">
                ProctorIQ
              </span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-[60ch]">
              Authoritative anti-cheating orchestration, client-side neural face tracking, and automatic penalty enforcement executed directly within <span className="font-mono text-foreground font-semibold">MySQL 8.0</span> ACID triggers.
            </p>
          </div>

          {/* Primary Hero CTA: "Open my dashboard" + Secondary Styleguide CTA */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(dashboardTarget)}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Open my dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <Link
              to="/styleguide"
              className="py-2.5 px-4.5 rounded-xl font-medium text-sm text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors flex items-center gap-2"
            >
              <span>Explore UI Styleguide</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </div>

          {/* Live DBMS Tech Badges */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 border-t border-border pt-4">
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-brand">ACID</div>
              <div className="text-xs text-muted-foreground font-mono leading-tight whitespace-normal mt-0.5">
                SELECT ... FOR UPDATE
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-accent">Triggers</div>
              <div className="text-xs text-muted-foreground font-mono leading-tight whitespace-normal mt-0.5">
                Auto-Deduct &amp; Lockout
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500">&lt;20ms</div>
              <div className="text-xs text-muted-foreground font-mono leading-tight whitespace-normal mt-0.5">
                Real-time Telemetry
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Compact Mock Dashboard Card with Live-Ticking Numbers */}
        <div className="lg:col-span-5 w-full">
          <MockDashboardCard />
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. STATS STRIP                                                 */}
      {/* ============================================================== */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {STATS.map((stat, i) => (
            <div key={i} className="space-y-1 text-center sm:text-left">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm font-semibold text-foreground">{stat.label}</div>
              <div className="text-xs font-mono text-muted-foreground">{stat.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 3. FEATURE BENTO SECTION                                       */}
      {/* ============================================================== */}
      <section id="features" className="space-y-4 pt-2">
        <FeatureBento />
      </section>

      {/* ============================================================== */}
      {/* 4. 3-STEP "HOW IT WORKS"                                       */}
      {/* ============================================================== */}
      <section id="how-it-works" className="space-y-6 pt-2">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
            Streamlined Pipeline
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            How ProctorIQ Secures Exams in 3 Steps
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            From assessment setup to authoritative certification in seconds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.step}
                className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-3.5 hover:border-brand/40 transition-all shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-mono font-extrabold text-foreground/30 select-none" aria-hidden="true">
                      {step.step}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono border border-border bg-surface-elevated text-muted-foreground font-semibold">
                      {step.badge}
                    </span>
                  </div>

                  <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-sm">
                    <Icon className="w-5 h-5" />
                  </div>

                  <h3 className="text-base font-bold text-foreground tracking-tight">
                    {step.title}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-border text-[11px] font-mono text-brand flex items-center gap-1">
                  <span>Automated Protocol</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 5. SECURITY & VIOLATION MATRIX                                 */}
      {/* ============================================================== */}
      <section id="security" className="space-y-5 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-accent font-semibold">
              <Cpu className="h-4 w-4" />
              <span>Deterministic Enforcement</span>
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Authoritative Violation Penalty Matrix
            </h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-md">
            Penalties are read strictly from MySQL <code className="text-brand font-mono font-bold">Violation_Types</code> on insert. Client-supplied penalty points are ignored.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VIOLATION_MATRIX.map((item) => (
            <div
              key={item.code}
              className="p-4 sm:p-5 rounded-2xl border border-border bg-surface hover:border-brand/40 shadow-sm transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-mono text-sm font-semibold text-foreground">
                    {item.code}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <span className="text-base sm:text-lg font-bold font-mono text-rose-500">
                  {item.penalty}
                </span>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between">
                <SeverityBadge severity={item.severity} size="sm" />
                <span className="text-[10px] font-mono text-muted-foreground">
                  Auto-Deduct
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 6. FINAL CTA SECTION                                           */}
      {/* ============================================================== */}
      <section className="p-6 sm:p-8 rounded-2xl border border-brand/40 bg-gradient-to-r from-surface via-surface-elevated to-surface shadow-sm text-center max-w-4xl mx-auto space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-from via-accent-via to-accent-to" />
        <div className="h-10 w-10 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto shadow-sm">
          <Terminal className="w-5 h-5 animate-pulse" />
        </div>

        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
          Ready to Initialize Assessment Session?
        </h2>

        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Test candidate workflows, live proctoring telemetry, or administrative schema views with seeded demo credentials in one click.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate(dashboardTarget)}
            className="py-2.5 px-5 rounded-xl font-semibold text-sm text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Open my dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <Link
            to="/styleguide"
            className="py-2.5 px-5 rounded-xl font-medium text-sm text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors"
          >
            Explore UI Styleguide
          </Link>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 7. FOOTER                                                      */}
      {/* ============================================================== */}
      <footer className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
        <div className="flex items-center gap-2">
          <LiveDot color="emerald" size="sm" />
          <span>All systems nominal • MySQL 8.0 • WSS cluster</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-foreground transition-colors">Workflow</a>
          <a href="#security" className="hover:text-foreground transition-colors">Security</a>
          <Link to="/styleguide" className="hover:text-foreground transition-colors">Styleguide</Link>
        </div>

        <p>© 2026 ProctorIQ Inc. Zero-Trust Assessment Systems.</p>
      </footer>
    </div>
  );
}
