import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Cpu,
  Database,
  Eye,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Terminal,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { CanvasNetworkBg } from '../components/ui/CanvasNetworkBg';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { SeverityBadge } from '../components/ui/SeverityBadge';

const VIOLATION_MATRIX = [
  { code: 'COPY_PASTE', penalty: '-10 pts', severity: 'LOW', desc: 'Clipboard snooping attempt intercepted' },
  { code: 'TAB_SWITCH', penalty: '-15 pts', severity: 'MEDIUM', desc: 'Window blur / focus loss detected' },
  { code: 'FULLSCREEN_EXIT', penalty: '-15 pts', severity: 'MEDIUM', desc: 'Proctor kiosk container breach' },
  { code: 'NO_FACE', penalty: '-20 pts', severity: 'HIGH', desc: 'Candidate absent from video feed' },
  { code: 'MULTIPLE_FACES', penalty: '-35 pts', severity: 'HIGH', desc: 'Secondary person in candidate camera' },
  { code: 'DEVTOOLS_OPEN', penalty: '-50 pts', severity: 'CRITICAL', desc: 'Debugger inspection console detected' },
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
    <div className="relative min-h-screen">
      {/* Interactive Neural Network Particles Canvas */}
      <CanvasNetworkBg />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:pt-14">
        {/* ========================================================== */}
        {/* HERO SECTION */}
        {/* ========================================================== */}
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 space-y-6"
          >
            {/* System Status Pill */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan/40 bg-cyan/10 px-4 py-1.5 text-xs font-mono text-cyan-300 shadow-glow-cyan-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
              </span>
              <span>DBMS-ENFORCED ZERO-TRUST EXAM CORE</span>
            </div>

            {/* Glitchy Gradient Headline "ProctorIQ" */}
            <div className="space-y-2">
              <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl font-sans leading-[1.1]">
                Mission Control for{' '}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-cyan via-violet to-magenta bg-clip-text text-transparent filter drop-shadow-[0_0_24px_rgba(34,211,238,0.4)]">
                    ProctorIQ
                  </span>
                </span>
              </h1>
              <p className="text-xl sm:text-2xl font-mono text-slate-300">
                Authoritative Anti-Cheating & Integrity Orchestration
              </p>
            </div>

            <p className="max-w-2xl text-base leading-relaxed text-slate-300">
              ProctorIQ enforces automatic penalty deductions, lockout thresholds,
              server-authoritative deadlines, and ACID exam grading directly inside{' '}
              <span className="font-mono text-cyan font-semibold">MySQL 8.0+</span> triggers
              and stored procedures — streamed live to proctors over real-time WebSockets.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to={dashboardRoute}>
                <NeonButton
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  {user ? 'Open Mission Console' : 'Launch Mission Control'}
                </NeonButton>
              </Link>
              {!user && (
                <Link to="/register">
                  <NeonButton variant="outline" size="lg">
                    Register Candidate
                  </NeonButton>
                </Link>
              )}
              <Link to="/styleguide">
                <NeonButton variant="ghost" size="lg" leftIcon={<Sparkles className="w-4 h-4 text-violet" />}>
                  Explore UI Styleguide
                </NeonButton>
              </Link>
            </div>

            {/* Live DBMS Tech Badges */}
            <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <div className="telemetry-num text-2xl font-bold text-cyan">ACID</div>
                <div className="text-xs text-slate-400 font-mono">SELECT ... FOR UPDATE</div>
              </div>
              <div>
                <div className="telemetry-num text-2xl font-bold text-violet">Triggers</div>
                <div className="text-xs text-slate-400 font-mono">Auto-Deduct & Lockout</div>
              </div>
              <div>
                <div className="telemetry-num text-2xl font-bold text-emerald">&lt;20ms</div>
                <div className="text-xs text-slate-400 font-mono">Real-time Telemetry</div>
              </div>
            </div>
          </motion.div>

          {/* Right Hero Graphic: Real-time DB Pipeline Simulator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <GlassCard glow="cyan" hoverEffect animatedBorder className="p-6">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Active DB Enforcement Pipeline
                  </span>
                </div>
                <span className="rounded-full bg-emerald/15 px-2.5 py-0.5 font-mono text-[10px] text-emerald font-semibold border border-emerald/30">
                  MYSQL 8.0 INNODB
                </span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    icon: Eye,
                    title: '1. Real-time Telemetry Stream',
                    sub: 'Webcam face tracking, tab switch, clipboard, DevTools capture',
                    accent: 'text-cyan border-cyan/40 bg-cyan/10',
                  },
                  {
                    icon: ShieldAlert,
                    title: '2. trg_after_violation_insert',
                    sub: 'Atomically deducts penalty points in InnoDB & checks threshold',
                    accent: 'text-violet border-violet/40 bg-violet/10',
                  },
                  {
                    icon: Lock,
                    title: '3. Instant Lockout Trigger',
                    sub: 'trust_score < min_trust_score flips session to TERMINATED_CHEATING',
                    accent: 'text-magenta border-magenta/40 bg-magenta/10',
                  },
                  {
                    icon: Database,
                    title: '4. sp_SubmitAndGradeExam',
                    sub: 'SELECT ... FOR UPDATE locks session, grades answers, issues result',
                    accent: 'text-emerald border-emerald/40 bg-emerald/10',
                  },
                ].map((step, i) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0A0B14]/80 p-3.5 hover:border-cyan/30 transition-colors"
                  >
                    <div className={`rounded-xl border p-2 ${step.accent} flex-shrink-0`}>
                      <step.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-mono text-xs font-semibold text-white">
                        {step.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {step.sub}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* ========================================================== */}
        {/* SCROLL-ANIMATED FEATURE CARDS */}
        {/* ========================================================== */}
        <section className="mt-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="font-mono text-xs uppercase tracking-widest text-cyan font-semibold">
              CORE CAPABILITIES
            </span>
            <h2 className="mt-2 text-3xl font-bold text-white tracking-tight">
              Engineered for Uncompromising Academic Integrity
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Zero client-side trust. All penalties, grading logic, and session state are enforced
              atomically inside MySQL transactions.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: 'Immutable Grading Lock',
                desc: 'sp_SubmitAndGradeExam acquires row-level locks via SELECT ... FOR UPDATE, guaranteeing exactly-once transactional evaluation even under concurrent submissions.',
                accent: 'cyan' as const,
              },
              {
                icon: Zap,
                title: 'Live Triage & Reinstatement',
                desc: 'Proctors inspect vw_ProctorLiveMonitor and audit feeds in real-time. When a false positive is dismissed, trg_after_review_update immediately restores points.',
                accent: 'violet' as const,
              },
              {
                icon: Database,
                title: 'Authoritative Timeouts',
                desc: 'Server cron executes sp_AutoTimeoutExpiredSessions every 60 seconds, preventing local browser clock manipulation or lingering open sessions.',
                accent: 'magenta' as const,
              },
            ].map((card, idx) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
              >
                <GlassCard
                  glow={card.accent}
                  hoverEffect
                  className="p-6 h-full flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-cyan mb-4 shadow-sm">
                      <card.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-semibold text-white tracking-wide">
                      {card.title}
                    </h3>
                    <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5 flex items-center text-xs font-mono text-cyan">
                    <span>Verified in InnoDB</span>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================== */}
        {/* VIOLATION PENALTY MATRIX */}
        {/* ========================================================== */}
        <section className="mt-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan font-semibold">
                <Cpu className="h-4 w-4" />
                Database Rule Table
              </div>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Authoritative Violation Penalty Matrix
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Penalties are read strictly from MySQL <code className="text-cyan">Violation_Types</code> on insert.
              Client-supplied penalty points are ignored.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VIOLATION_MATRIX.map((item, idx) => (
              <motion.div
                key={item.code}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
              >
                <GlassCard hoverEffect className="p-4 flex flex-col justify-between h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-semibold text-white">
                        {item.code}
                      </div>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    <span className="telemetry-num text-xl font-bold text-magenta">
                      {item.penalty}
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <SeverityBadge severity={item.severity} size="sm" />
                    <span className="text-[10px] font-mono text-slate-400">
                      Auto-Deduct
                    </span>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ========================================================== */}
        {/* QUICK ACCESS CTA */}
        {/* ========================================================== */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mt-20 p-8 rounded-3xl border border-cyan/30 bg-gradient-to-r from-[#101222]/90 to-[#16192E]/90 shadow-glow-cyan text-center max-w-4xl mx-auto space-y-4"
        >
          <Terminal className="w-10 h-10 text-cyan mx-auto animate-pulse" />
          <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Ready to Initialize Assessment Session?
          </h3>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            Test candidate workflows, live proctoring telemetry, or administrative schema views with
            seeded demo credentials in one click.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <Link to="/login">
              <NeonButton variant="primary" size="md">
                Enter Operator Login
              </NeonButton>
            </Link>
            <Link to="/styleguide">
              <NeonButton variant="outline" size="md">
                View Styleguide
              </NeonButton>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
