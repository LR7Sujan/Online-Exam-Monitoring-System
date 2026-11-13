import { motion } from 'framer-motion';
import { AlertCircle, KeyRound, ShieldCheck, UserPlus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { CanvasNetworkBg } from '../components/ui/CanvasNetworkBg';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import type { AuthUser } from '../types/domain';

interface AuthResponse {
  token: string;
  user: AuthUser;
}

function redirectByRole(role: AuthUser['role']): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'PROCTOR') return '/proctor';
  return '/student';
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const quickFill = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('ProctorIQ#2026');
    setError(null);
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <CanvasNetworkBg />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md relative z-10"
      >
        <GlassCard glow="cyan" hoverEffect className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan/40 bg-cyan/10 text-cyan shadow-glow-cyan-sm">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-1.5">
                  Proctor<span className="text-cyan">IQ</span> Access
                </h1>
                <p className="text-xs text-slate-400">Mission Control Authentication</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
              JWT SECURED
            </span>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-start gap-2.5 rounded-xl border border-magenta/40 bg-magenta/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-magenta" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-mono font-medium text-slate-300">
                OPERATOR IDENTITY (EMAIL)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@proctoriq.io"
                className="w-full rounded-xl border border-white/10 bg-[#0A0B14]/90 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan/50 focus:shadow-glow-cyan-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono font-medium text-slate-300">
                CREDENTIAL (PASSWORD)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-[#0A0B14]/90 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan/50 focus:shadow-glow-cyan-sm"
              />
            </div>

            <NeonButton
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={loading}
            >
              Authenticate & Enter Console
            </NeonButton>
          </form>

          {/* Quick Fill Demo Credentials Panel */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Demo Quick-Fill (ProctorIQ#2026)
              </span>
              <span className="text-[10px] font-mono text-cyan">Seeded DB</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Admin', email: 'admin@proctoriq.io', border: 'hover:border-violet/50 hover:text-violet-300' },
                { label: 'Proctor', email: 'proctor@proctoriq.io', border: 'hover:border-cyan/50 hover:text-cyan-300' },
                { label: 'Student', email: 'student@proctoriq.io', border: 'hover:border-emerald/50 hover:text-emerald-300' },
              ].map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => quickFill(demo.email)}
                  className={`rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 font-mono text-xs text-slate-300 transition-all text-center select-none ${demo.border}`}
                >
                  <div className="font-semibold">{demo.label}</div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">Quick fill</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <Link to="/register" className="text-cyan hover:underline">
              Register Candidate →
            </Link>
            <Link to="/styleguide" className="text-violet hover:underline flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Styleguide</span>
            </Link>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="relative min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <CanvasNetworkBg />

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md relative z-10"
      >
        <GlassCard glow="violet" hoverEffect className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet/40 bg-violet/10 text-violet shadow-glow-violet-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Candidate Registration</h1>
              <p className="text-xs text-slate-400">Self-registration provisions a STUDENT role</p>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-start gap-2 rounded-xl border border-magenta/40 bg-magenta/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-magenta" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-mono font-medium text-slate-300">
                FULL NAME
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Aarav Mehta"
                className="w-full rounded-xl border border-white/10 bg-[#0A0B14]/90 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan/50 focus:shadow-glow-cyan-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono font-medium text-slate-300">
                INSTITUTIONAL EMAIL
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@university.edu"
                className="w-full rounded-xl border border-white/10 bg-[#0A0B14]/90 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan/50 focus:shadow-glow-cyan-sm"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono font-medium text-slate-300">
                PASSWORD (MIN 8 CHARS)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/10 bg-[#0A0B14]/90 px-3.5 py-2.5 text-sm text-white outline-none transition-all focus:border-cyan/50 focus:shadow-glow-cyan-sm"
              />
            </div>

            <NeonButton
              type="submit"
              variant="secondary"
              size="md"
              className="w-full mt-2"
              isLoading={loading}
              leftIcon={<ShieldCheck className="w-4 h-4" />}
            >
              Provision Candidate Account
            </NeonButton>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-cyan hover:underline">
              Operator Sign in →
            </Link>
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
