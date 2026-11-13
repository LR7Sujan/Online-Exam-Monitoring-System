import { LogOut, Radio, ShieldCheck, Terminal, UserCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { disconnectSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';
import { StatusBadge } from './StatusBadge';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const navLinks =
    user?.role === 'ADMIN'
      ? [
          { to: '/admin', label: 'Command Center' },
          { to: '/proctor', label: 'Live Monitor' },
        ]
      : user?.role === 'PROCTOR'
        ? [{ to: '/proctor', label: 'Mission Control' }]
        : user?.role === 'STUDENT'
          ? [{ to: '/student', label: 'Exam Console' }]
          : [];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A0B14]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-400/10 text-cyan-300 shadow-glow-cyan transition-transform group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">
                Proctor<span className="text-cyan-400">IQ</span>
              </span>
              <span className="hidden rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-300 sm:inline-block">
                SQL-ENFORCED
              </span>
            </div>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              Autonomous Exam Integrity & Telemetry
            </p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          {navLinks.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-300'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Theme Switcher */}
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3 border-l border-white/10 pl-3">
              <div className="hidden items-center gap-2 md:flex">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <UserCheck className="h-3.5 w-3.5 text-cyan-400" />
                    {user.fullName}
                  </div>
                </div>
                <StatusBadge value={user.role} />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-3.5 py-1.5 text-sm font-semibold text-slate-950 shadow-glow-cyan transition-opacity hover:opacity-90"
              >
                <Terminal className="h-3.5 w-3.5" />
                Launch
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

