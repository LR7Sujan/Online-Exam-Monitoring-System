import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Sparkles,
  Eye,
  EyeOff,
  User,
  ShieldAlert,
  GraduationCap,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingInput } from '../components/ui/FloatingInput';
import { MockDashboardCard } from '../components/landing/MockDashboardCard';
import { FeatureBento } from '../components/landing/FeatureBento';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types/domain';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

type RoleTab = 'ADMIN' | 'PROCTOR' | 'STUDENT';

const ROLE_DEMOS: Record<
  RoleTab,
  { label: string; email: string; role: RoleTab; icon: typeof ShieldCheck; desc: string }
> = {
  ADMIN: {
    label: 'Admin',
    email: 'admin@proctoriq.io',
    role: 'ADMIN',
    icon: ShieldAlert,
    desc: 'Institution & DB Command',
  },
  PROCTOR: {
    label: 'Proctor',
    email: 'proctor@proctoriq.io',
    role: 'PROCTOR',
    icon: ShieldCheck,
    desc: 'Live Telemetry & Surveillance',
  },
  STUDENT: {
    label: 'Student',
    email: 'student@proctoriq.io',
    role: 'STUDENT',
    icon: GraduationCap,
    desc: 'Candidate Exam Kiosk',
  },
};

function redirectByRole(role: AuthUser['role']): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PROCTOR') return '/proctor';
  return '/student';
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [activeRole, setActiveRole] = useState<RoleTab>('ADMIN');
  const [email, setEmail] = useState('admin@proctoriq.io');
  const [password, setPassword] = useState('ProctorIQ#2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      setAuth(data.token, data.user);
      navigate(redirectByRole(data.user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleTabClick = (role: RoleTab) => {
    setActiveRole(role);
    setEmail(ROLE_DEMOS[role].email);
    setPassword('ProctorIQ#2026');
    setError(null);
  };

  const quickFill = (demoRole: RoleTab) => {
    handleRoleTabClick(demoRole);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Background Aurora Blobs & Dotted Grid */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-xl">
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
                ZERO-TRUST
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/styleguide"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg border border-border hover:border-brand/40 bg-surface-elevated transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Styleguide</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Split Layout Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-14">
        {/*
          Responsive layout:
          - lg+ (1024px+): 12-column grid. Left 7 cols (Hero + Mock Dashboard + Feature Bento), Right 5 cols (Sticky Login Card).
          - mobile & tablet (<1024px down to 390px): single column. Hero header collapses above the card, then Login Card, then Mock Dashboard & Bento below.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-start">
          {/* ======================================================== */}
          {/* LEFT COLUMN: HERO, HEADLINE, MOCK DASHBOARD & BENTO */}
          {/* ======================================================== */}
          <div className="lg:col-span-7 space-y-8">
            {/* System Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-medium border border-brand/30 bg-brand/10 text-brand shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
              </span>
              <span>DBMS-ENFORCED ACADEMIC INTEGRITY ENGINE</span>
            </div>

            {/* Gradient Headline & Tagline */}
            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Mission Control for{' '}
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                  ProctorIQ
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
                Authoritative anti-cheating orchestration, client-side neural face tracking, and
                automatic penalty enforcement executed directly within{' '}
                <span className="font-mono text-foreground font-semibold">MySQL 8.0</span> ACID triggers.
              </p>
            </div>

            {/* Live DBMS Guarantee Badges */}
            <div className="grid grid-cols-3 gap-3 border-y border-border/60 py-4 text-left">
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-brand">ACID</div>
                <div className="text-xs text-muted-foreground font-mono">FOR UPDATE Locks</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-500">Triggers</div>
                <div className="text-xs text-muted-foreground font-mono">Auto-Deduct Engine</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono text-violet-500">&lt;20ms</div>
                <div className="text-xs text-muted-foreground font-mono">Socket.IO Stream</div>
              </div>
            </div>

            {/* Floating Mock Dashboard Card with Live-Ticking Numbers */}
            <div className="pt-2">
              <MockDashboardCard />
            </div>

            {/* Scroll-Reveal Feature Bento */}
            <div className="pt-6">
              <FeatureBento />
            </div>
          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: LOGIN CARD WITH ROLE TABS & DEMO CHIPS */}
          {/* ======================================================== */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl border border-border bg-surface/90 backdrop-blur-xl p-6 sm:p-8 shadow-layered-md space-y-6 relative overflow-hidden"
            >
              {/* Top ambient highlight line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

              {/* Card Header — strictly preserves "ProctorIQ Access" for Playwright */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand shadow-sm">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
                      ProctorIQ Access
                    </h2>
                    <p className="text-xs text-muted-foreground">Mission Control Authentication</p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-muted-foreground font-medium">
                  JWT SECURED
                </span>
              </div>

              {/* Role Selection Tabs with Sliding Active Pill */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  SELECT OPERATOR ROLE
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-elevated border border-border">
                  {(['ADMIN', 'PROCTOR', 'STUDENT'] as RoleTab[]).map((role) => {
                    const isActive = activeRole === role;
                    const demo = ROLE_DEMOS[role];
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleTabClick(role)}
                        className={`relative py-2 px-2 text-xs font-semibold rounded-lg transition-colors select-none text-center ${
                          isActive
                            ? 'text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeRoleTabPill"
                            className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                            transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          />
                        )}
                        <span className="relative z-10 flex items-center justify-center gap-1.5">
                          {demo.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form with Floating Labels */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <FloatingInput
                  id="login-email"
                  type="email"
                  required
                  label="Operator Identity (Email)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<User className="w-4 h-4" />}
                />

                <FloatingInput
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  label="Credential (Password)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-4 h-4" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <>
                      <span>Authenticate & Enter Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* One-Click Demo Credentials Chips */}
              <div className="pt-4 border-t border-border/70 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="uppercase tracking-wider text-muted-foreground font-semibold">
                    ONE-CLICK DEMO CHIPS
                  </span>
                  <span className="text-brand font-medium">Seeded DB</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['ADMIN', 'PROCTOR', 'STUDENT'] as RoleTab[]).map((role) => {
                    const demo = ROLE_DEMOS[role];
                    const isSelected = activeRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => quickFill(role)}
                        className={`p-2 rounded-xl border text-left transition-all duration-200 select-none ${
                          isSelected
                            ? 'border-brand/60 bg-brand/10 shadow-sm'
                            : 'border-border bg-surface-elevated/60 hover:bg-surface-elevated hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-foreground">
                            {demo.label}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
                          {demo.email.split('@')[0]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Footer navigation links */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <Link to="/register" className="text-brand hover:underline font-medium">
                  Register Candidate →
                </Link>
                <Link
                  to="/styleguide"
                  className="hover:text-foreground transition-colors flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-brand" />
                  <span>Styleguide</span>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/register', {
        fullName,
        email,
        password,
      });
      setAuth(data.token, data.user);
      navigate('/student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden flex flex-col justify-between">
      {/* Background Aurora Blobs & Dotted Grid */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* Top Header */}
      <header className="relative z-20 border-b border-border/60 bg-surface/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              Proctor<span className="text-brand">IQ</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Register Bento Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md rounded-3xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-layered-md space-y-6 relative overflow-hidden"
        >
          {/* Top ambient highlight line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 text-brand shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Candidate Registration</h1>
              <p className="text-xs text-muted-foreground">Self-registration provisions a STUDENT role</p>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput
              id="register-fullname"
              type="text"
              required
              minLength={2}
              label="Candidate Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={<User className="w-4 h-4" />}
            />

            <FloatingInput
              id="register-email"
              type="email"
              required
              label="Institutional Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<ShieldCheck className="w-4 h-4" />}
            />

            <FloatingInput
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              label="Password (min 8 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:from-indigo-600 hover:via-violet-600 hover:to-fuchsia-600 shadow-md shadow-brand/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Provisioning...
                </span>
              ) : (
                <>
                  <span>Provision Candidate Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand hover:underline">
              Operator Sign in →
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
