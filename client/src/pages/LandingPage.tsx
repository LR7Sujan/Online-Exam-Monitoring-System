import { motion } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  ShieldCheck,
  Terminal,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { ThemeToggle } from '../components/ui/ThemeToggle';
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

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const dashboardRoute =
    user?.role === 'ADMIN'
      ? '/admin'
      : user?.role === 'PROCTOR'
      ? '/proctor'
      : user?.role === 'STUDENT'
      ? '/student'
      : '/login';

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand/20">
      {/* Background Aurora Blobs & Dotted Grid */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* Top Header Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-foreground">
                Proctor<span className="text-brand">IQ</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-surface-elevated text-muted-foreground">
                SQL-ENFORCED
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/styleguide"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border hover:border-brand/40 bg-surface-elevated transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Styleguide</span>
            </Link>

            <ThemeToggle />

            {user ? (
              <Link
                to={dashboardRoute}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95 shadow-sm transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Console ({user.role})</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95 shadow-sm transition-all"
              >
                <span>Operator Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 pb-24 pt-8 sm:px-6 lg:pt-14 space-y-20 sm:space-y-24">
        {/* ========================================================== */}
        {/* HERO SPLIT SECTION */}
        {/* ========================================================== */}
        <section className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Headline, Copy, CTA, DBMS Badges */}
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

            {/* Gradient Headline "ProctorIQ" */}
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Mission Control for{' '}
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  ProctorIQ
                </span>
              </h1>
              <p className="text-lg sm:text-xl font-mono text-muted-foreground">
                Authoritative Anti-Cheating & Integrity Orchestration
              </p>
            </div>

            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              ProctorIQ enforces automatic penalty deductions, lockout thresholds,
              server-authoritative deadlines, and ACID exam grading directly inside{' '}
              <span className="font-mono text-foreground font-semibold">MySQL 8.0</span> triggers
              and stored procedures — streamed live to proctors over real-time WebSockets.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to={dashboardRoute}
                className="py-3 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center gap-2"
              >
                <span>{user ? 'Open Mission Console' : 'Launch Mission Control'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {!user && (
                <Link
                  to="/register"
                  className="py-3 px-5 rounded-xl font-medium text-sm text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors flex items-center gap-2"
                >
                  Register Candidate
                </Link>
              )}

              <Link
                to="/styleguide"
                className="py-3 px-4 rounded-xl font-medium text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-brand" />
                <span>Explore UI Styleguide</span>
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

          {/* Right Column: Floating Mock Dashboard Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <MockDashboardCard />
          </motion.div>
        </section>

        {/* ========================================================== */}
        {/* SCROLL-REVEAL FEATURE BENTO */}
        {/* ========================================================== */}
        <section className="pt-8">
          <FeatureBento />
        </section>

        {/* ========================================================== */}
        {/* VIOLATION PENALTY MATRIX */}
        {/* ========================================================== */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-brand font-semibold">
                <Cpu className="h-4 w-4" />
                Database Rule Table
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Authoritative Violation Penalty Matrix
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              Penalties are read strictly from MySQL <code className="text-brand font-mono">Violation_Types</code> on insert.
              Client-supplied penalty points are ignored.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VIOLATION_MATRIX.map((item, idx) => (
              <motion.div
                key={item.code}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                whileHover={{ y: -3 }}
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

        {/* ========================================================== */}
        {/* QUICK ACCESS CTA */}
        {/* ========================================================== */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="p-8 sm:p-10 rounded-3xl border border-brand/30 bg-gradient-to-r from-surface via-surface-elevated to-surface shadow-layered-md text-center max-w-4xl mx-auto space-y-4 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <Terminal className="w-10 h-10 text-brand mx-auto animate-pulse" />
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Ready to Initialize Assessment Session?
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Test candidate workflows, live proctoring telemetry, or administrative schema views with
            seeded demo credentials in one click.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="py-2.5 px-5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95 shadow-sm transition-all"
            >
              Enter Operator Login
            </Link>
            <Link
              to="/styleguide"
              className="py-2.5 px-5 rounded-xl font-medium text-sm text-muted-foreground hover:text-foreground bg-surface-elevated border border-border hover:border-brand/40 transition-colors"
            >
              View Styleguide
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
