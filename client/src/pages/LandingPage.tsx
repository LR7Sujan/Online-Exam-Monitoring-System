import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  Zap,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { LiveDot } from '../components/ui/LiveDot';
import { MockDashboardCard } from '../components/landing/MockDashboardCard';
import { FeatureBento } from '../components/landing/FeatureBento';

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
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // If user is already logged in, redirect them to their role dashboard
  useEffect(() => {
    if (user) {
      const target =
        user.role === 'ADMIN'
          ? '/admin'
          : user.role === 'PROCTOR'
          ? '/proctor'
          : '/student';
      navigate(target, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand/20">
      {/* Background Aurora Blobs & Dotted Grid */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* ============================================================== */}
      {/* 1. STICKY HEADER                                               */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-foreground">
                Proctor<span className="text-brand">IQ</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-surface-elevated text-muted-foreground">
                ZERO-TRUST
              </span>
            </div>
          </Link>

          {/* Nav Links (Features, How it works, Security) */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-mono font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#security" className="hover:text-foreground transition-colors">
              Security
            </a>
            <Link to="/styleguide" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-brand" />
              <span>Styleguide</span>
            </Link>
          </nav>

          {/* Action Buttons: Sign In (ghost), Get Started (gradient), ThemeToggle */}
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />

            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-foreground hover:bg-surface-elevated transition-colors border border-transparent hover:border-border"
            >
              Sign in
            </Link>

            <Link
              to="/register"
              className="py-1.5 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              <span>Get started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. HERO SECTION                                                */}
      {/* ============================================================== */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 pb-24 pt-8 sm:px-6 lg:pt-14 space-y-24 sm:space-y-32">
        <section className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Headline, Subtitle, Two CTAs, Live DBMS Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* System Status Pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border border-brand/30 bg-brand/10 text-brand shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
              </span>
              <span>DBMS-ENFORCED ZERO-TRUST EXAM CORE</span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Mission Control for{' '}
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  ProctorIQ
                </span>
              </h1>
              {/* One-sentence subtitle per specification */}
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Authoritative anti-cheating orchestration, client-side neural face tracking, and automatic penalty enforcement executed directly within <span className="font-mono text-foreground font-semibold">MySQL 8.0</span> ACID triggers.
              </p>
            </div>

            {/* Two CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/register"
                className="py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <span>Get started free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/login"
                className="py-3 px-5 rounded-xl font-medium text-sm text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors flex items-center gap-2"
              >
                <span>Operator Sign in</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>

            {/* Live DBMS Tech Badges */}
            <div className="grid grid-cols-3 gap-4 border-t border-border/70 pt-6">
              <div>
                <div className="text-2xl font-bold font-mono text-brand">ACID</div>
                <div className="text-xs text-muted-foreground font-mono">SELECT ... FOR UPDATE</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-violet-500">Triggers</div>
                <div className="text-xs text-muted-foreground font-mono">Auto-Deduct & Lockout</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-500">&lt;20ms</div>
                <div className="text-xs text-muted-foreground font-mono">Real-time Telemetry</div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Floating Mock Dashboard Card with Live-Ticking Numbers */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <MockDashboardCard />
          </motion.div>
        </section>

        {/* ============================================================== */}
        {/* 3. STATS STRIP                                                 */}
        {/* ============================================================== */}
        <section className="rounded-3xl border border-border bg-surface/70 backdrop-blur-xl p-6 sm:p-8 shadow-bento">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="space-y-1 text-center sm:text-left">
                <div className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-foreground">{stat.label}</div>
                <div className="text-xs font-mono text-muted-foreground">{stat.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 4. FEATURE BENTO SECTION                                       */}
        {/* ============================================================== */}
        <section id="features" className="space-y-6 pt-4">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-brand">
              CORE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Built for High-Stakes Evaluation Integrity
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Eliminate subjective proctor disputes with deterministic, database-enforced integrity contracts.
            </p>
          </div>

          <FeatureBento />
        </section>

        {/* ============================================================== */}
        {/* 5. 3-STEP "HOW IT WORKS"                                       */}
        {/* ============================================================== */}
        <section id="how-it-works" className="space-y-10 pt-4">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-violet-500">
              STREAMLINED PIPELINE
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              How ProctorIQ Secures Exams in 3 Steps
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              From assessment setup to authoritative certification in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="rounded-3xl border border-border bg-surface/80 p-6 sm:p-8 space-y-4 hover:border-brand/40 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-mono font-extrabold text-brand/30">
                        {step.step}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono border border-border bg-surface-elevated text-muted-foreground font-semibold">
                        {step.badge}
                      </span>
                    </div>

                    <div className="h-12 w-12 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-sm">
                      <Icon className="w-6 h-6" />
                    </div>

                    <h3 className="text-lg font-bold text-foreground tracking-tight">
                      {step.title}
                    </h3>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border/50 text-[11px] font-mono text-brand flex items-center gap-1">
                    <span>Automated Protocol</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 6. SECURITY & VIOLATION MATRIX                                 */}
        {/* ============================================================== */}
        <section id="security" className="space-y-6 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-indigo-400 font-semibold">
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
            {VIOLATION_MATRIX.map((item, idx) => (
              <motion.div
                key={item.code}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="p-5 rounded-2xl border border-border bg-surface/80 hover:bg-surface hover:border-brand/40 shadow-sm transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-mono text-sm font-semibold text-foreground">
                      {item.code}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <span className="text-lg font-bold font-mono text-rose-500">
                    {item.penalty}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                  <SeverityBadge severity={item.severity} size="sm" />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Auto-Deduct
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============================================================== */}
        {/* 7. FINAL CTA SECTION                                           */}
        {/* ============================================================== */}
        <section className="p-8 sm:p-12 rounded-3xl border border-brand/40 bg-gradient-to-r from-surface via-surface-elevated to-surface shadow-layered-md text-center max-w-4xl mx-auto space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div className="h-12 w-12 rounded-2xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mx-auto shadow-sm">
            <Terminal className="w-6 h-6 animate-pulse" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Ready to Initialize Assessment Session?
          </h2>

          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Test candidate workflows, live proctoring telemetry, or administrative schema views with seeded demo credentials in one click.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/register"
              className="py-3 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 transition-all flex items-center gap-2"
            >
              <span>Get started free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/login"
              className="py-3 px-6 rounded-xl font-medium text-sm text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors"
            >
              Operator Sign in
            </Link>
          </div>
        </section>

        {/* ============================================================== */}
        {/* 8. FOOTER                                                      */}
        {/* ============================================================== */}
        <footer className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <LiveDot color="emerald" size="sm" />
            <span>ALL SYSTEMS NOMINAL • MYSQL 8.0 • WSS CLUSTER</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">Workflow</a>
            <a href="#security" className="hover:text-foreground transition-colors">Security</a>
            <Link to="/styleguide" className="hover:text-foreground transition-colors">Styleguide</Link>
          </div>

          <p>© 2026 ProctorIQ Inc. Zero-Trust Assessment Systems.</p>
        </footer>
      </main>
    </div>
  );
}
