import { useState, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  ShieldAlert,
  GraduationCap,
  ArrowRight,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/layout/AuthLayout';
import { FloatingInput } from '../components/ui/FloatingInput';
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
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  // If already logged in, redirect immediately to role dashboard
  useEffect(() => {
    if (user) {
      navigate(redirectByRole(user.role), { replace: true });
    }
  }, [user, navigate]);

  const [activeRole, setActiveRole] = useState<RoleTab>('ADMIN');
  const [email, setEmail] = useState('admin@proctoriq.io');
  const [password, setPassword] = useState('ProctorIQ#2026');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(true);

  // Validation & Error states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);

    if (!email.trim()) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    if (!validate()) return;

    setLoading(true);
    try {
      const data = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      setAuth(data.token, data.user);
      navigate(redirectByRole(data.user.role));
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleTabClick = (role: RoleTab) => {
    setActiveRole(role);
    setEmail(ROLE_DEMOS[role].email);
    setPassword('ProctorIQ#2026');
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);
  };

  return (
    <AuthLayout>
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
                Welcome back
              </h2>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">ProctorIQ Access</span> — Sign in to console
              </p>
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

        {/* General Error Alert */}
        <AnimatePresence>
          {generalError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-200"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span>{generalError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form with Floating Labels & Inline Validation */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <FloatingInput
              id="login-email"
              type="email"
              autoFocus
              autoComplete="email"
              required
              label="Operator Identity (Email)"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              icon={<User className="w-4 h-4" />}
            />
            {emailError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{emailError}</p>
            )}
          </div>

          <div className="space-y-1">
            <FloatingInput
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              label="Credential (Password)"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
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
            {passwordError && (
              <p className="text-[11px] text-rose-500 font-mono pl-1">{passwordError}</p>
            )}
          </div>

          {/* Remember me & Forgot Password */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border text-brand focus:ring-brand accent-brand cursor-pointer"
              />
              <span>Remember me</span>
            </label>

            <span className="text-muted-foreground font-mono text-[11px]">
              Active Session
            </span>
          </div>

          {/* Submit Button */}
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

        {/* Collapsible Demo Accounts Section */}
        <div className="pt-3 border-t border-border/70 space-y-2.5">
          <button
            type="button"
            onClick={() => setIsDemoOpen(!isDemoOpen)}
            className="w-full flex items-center justify-between text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1.5 uppercase tracking-wider font-semibold">
              <span>DEMO ACCOUNTS (ONE-CLICK FILL)</span>
            </div>
            <div className="flex items-center gap-1 text-brand">
              <span className="text-[10px]">Seeded DB</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isDemoOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          <AnimatePresence>
            {isDemoOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-3 gap-2 overflow-hidden"
              >
                {(['ADMIN', 'PROCTOR', 'STUDENT'] as RoleTab[]).map((role) => {
                  const demo = ROLE_DEMOS[role];
                  const isSelected = activeRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleTabClick(role)}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Link: Don't have an account? Sign up */}
        <div className="pt-3 border-t border-border/60 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-brand hover:underline">
            Sign up here →
          </Link>
        </div>
      </motion.div>
    </AuthLayout>
  );
}
