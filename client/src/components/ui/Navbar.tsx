import { LogOut, Radio, ShieldCheck, UserCheck } from 'lucide-react';
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
    navigate('/');
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
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to={user ? '/home' : '/'} className="flex items-center gap-3 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-foreground">
                Proctor<span className="text-brand">IQ</span>
              </span>
              <span className="hidden rounded-full border border-border bg-surface-elevated px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                SQL-ENFORCED
              </span>
            </div>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border border-brand/40 bg-brand/10 text-brand'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Theme Switcher */}
          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3 border-l border-border pl-3">
              <div className="hidden items-center gap-2 md:flex">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500" />
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-brand" />
                    {user.fullName}
                  </div>
                </div>
                <StatusBadge value={user.role} />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand"
              >
                Operator Login
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
