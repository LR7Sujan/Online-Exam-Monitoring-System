import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Activity,
  ShieldAlert,
  FileText,
  BarChart3,
  GraduationCap,
  Palette,
  Search,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Radio,
  Clock,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocketContext } from '../../context/useSocketContext';
import { LiveDot } from '../ui/LiveDot';
import { SeverityBadge } from '../ui/SeverityBadge';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { isAudioMuted, setAudioMuted, playPingSound } from '../../utils/audioAlert';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();

  const { isConnected, violationCount, recentAlerts, clearAlerts, markAlertRead } =
    useSocketContext();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [audioMuted, setAudioMutedState] = useState<boolean>(isAudioMuted());

  const handleToggleAudio = () => {
    const next = !audioMuted;
    setAudioMutedState(next);
    setAudioMuted(next);
    if (!next) {
      playPingSound('confirm');
    }
  };

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Global shortcut: Cmd/Ctrl+K to open Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Define role-specific navigation exactly as specified
  const navItems: NavItem[] = React.useMemo(() => {
    if (!user) return [];

    if (user.role === 'ADMIN') {
      return [
        { to: '/admin', label: 'Mission Overview', icon: Activity },
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: violationCount > 0 ? violationCount : undefined },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert },
        { to: '/admin/exams', label: 'Exam Catalog', icon: FileText },
        { to: '/admin/analytics', label: 'Telemetry & Heatmap', icon: BarChart3 },
        { to: '/admin/simulator', label: 'Demo Simulator', icon: Zap },
        { to: '/styleguide', label: 'UI Styleguide', icon: Palette },
      ];
    }

    if (user.role === 'PROCTOR') {
      return [
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: violationCount > 0 ? violationCount : undefined },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert },
        { to: '/styleguide', label: 'UI Styleguide', icon: Palette },
      ];
    }

    // STUDENT
    return [
      { to: '/student', label: 'Exams & Portal', icon: GraduationCap },
      { to: '/styleguide', label: 'UI Styleguide', icon: Palette },
    ];
  }, [user, violationCount]);

  const roleBadgeStyle =
    user?.role === 'ADMIN'
      ? 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40'
      : user?.role === 'PROCTOR'
      ? 'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40'
      : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40';

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-x-hidden relative">
      {/* Aurora Ambient Blur Layer */}
      <div className="aurora-backdrop" aria-hidden="true" />
      {/* Dotted Grid Background */}
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none z-0" aria-hidden="true" />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* ============================================================== */}
      {/* SIDEBAR (DESKTOP) - Slim icon rail that expands on hover      */}
      {/* ============================================================== */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-surface/95 backdrop-blur-2xl transition-all duration-300 ease-out z-30 sticky top-0 h-screen group/sidebar ${
          isCollapsed ? 'w-20 hover:w-64' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <NavLink
            to="/"
            className="flex items-center gap-3 group overflow-hidden"
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 border border-brand/40 flex items-center justify-center text-brand shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Shield className="w-5 h-5 text-brand" />
            </div>
            <div
              className={`flex flex-col transition-opacity duration-200 ${
                isCollapsed ? 'opacity-0 group-hover/sidebar:opacity-100' : 'opacity-100'
              }`}
            >
              <span className="font-bold tracking-tight text-base text-foreground flex items-center gap-1.5">
                Proctor<span className="text-brand">IQ</span>
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-brand/10 text-brand border border-brand/20">
                  2.0
                </span>
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                Surveillance Engine
              </span>
            </div>
          </NavLink>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={isCollapsed ? 'Pin expanded' : 'Collapse to rail'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Operating Role Indicator */}
        {user && (
          <div
            className={`px-4 py-3 border-b border-border bg-surface-elevated/40 transition-opacity duration-200 ${
              isCollapsed ? 'opacity-0 group-hover/sidebar:opacity-100' : 'opacity-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                Operating Role
              </span>
              <span
                className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${roleBadgeStyle}`}
              >
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links with sliding active pill */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== '/' && item.to !== '/proctor' && item.to !== '/admin' && location.pathname.startsWith(item.to));

            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group select-none ${
                  isActive
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {/* Active Sliding Brand Gradient Pill */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/15 via-violet-500/15 to-fuchsia-500/15 border border-brand/30 shadow-sm"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                {/* Left Active Brand Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}

                <motion.div
                  whileHover={{ scale: 1.15 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 z-10"
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-brand' : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                  />
                </motion.div>

                <span
                  className={`truncate flex-1 tracking-wide z-10 transition-opacity duration-200 ${
                    isCollapsed ? 'opacity-0 group-hover/sidebar:opacity-100' : 'opacity-100'
                  }`}
                >
                  {item.label}
                </span>

                {item.badge !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30 z-10 transition-opacity duration-200 ${
                      isCollapsed ? 'opacity-0 group-hover/sidebar:opacity-100' : 'opacity-100'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Telemetry / Live Status Footer */}
        <div className="p-3 border-t border-border bg-surface-elevated/40">
          <div
            className={`flex items-center rounded-xl p-2.5 border border-border bg-surface/80 ${
              isCollapsed ? 'justify-center group-hover/sidebar:justify-between' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2">
              <LiveDot
                color={isConnected ? 'emerald' : 'rose'}
                size="sm"
                pulse={isConnected}
              />
              <div
                className={`flex flex-col transition-opacity duration-200 ${
                  isCollapsed ? 'hidden group-hover/sidebar:flex' : 'flex'
                }`}
              >
                <span className="text-[11px] font-mono text-foreground font-medium">
                  {isConnected ? 'NODE ONLINE' : 'DISCONNECTED'}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  MYSQL 8.0 • WSS
                </span>
              </div>
            </div>
            <span
              className={`text-[10px] font-mono text-brand font-semibold transition-opacity duration-200 ${
                isCollapsed ? 'hidden group-hover/sidebar:inline' : 'inline'
              }`}
            >
              v2.0
            </span>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN CONTAINER                                                 */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Sticky Header with Glass Blur */}
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">
                PROCTORIQ
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">/</span>
              <span className="font-semibold text-sm text-foreground tracking-tight capitalize">
                {location.pathname.replace('/', '').replace(/-/g, ' ') || 'Overview'}
              </span>
            </div>
          </div>

          {/* Center: Search / Cmd+K Trigger Button */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden lg:flex items-center justify-between flex-1 max-w-md mx-6 px-3.5 py-1.5 rounded-xl border border-border bg-surface-elevated/70 hover:bg-muted text-xs text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Search candidates, exams, actions...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Right: Quick actions, Theme Toggle, Bell, Profile Menu */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/styleguide"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface-elevated/60 text-foreground hover:bg-muted text-xs font-mono transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand" />
              <span>Styleguide</span>
            </NavLink>

            {/* Theme Toggle (Light / Dark / System) */}
            <ThemeToggle />

            {/* Audio Alert Pings Toggle (off by default) */}
            <button
              onClick={handleToggleAudio}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                audioMuted
                  ? 'border-border bg-surface text-muted-foreground hover:text-foreground'
                  : 'border-brand/40 bg-brand/10 text-brand shadow-sm'
              }`}
              title={audioMuted ? 'Sound Alerts: Disabled (Click to Enable)' : 'Sound Alerts: Active'}
              aria-label={audioMuted ? 'Enable Sound Alerts' : 'Mute Sound Alerts'}
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[11px] font-medium">{audioMuted ? 'Muted' : 'Audio On'}</span>
            </button>

            {/* Notification Bell with Live Violation Badge */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-brand/40 transition-all shadow-sm"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {violationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-mono font-bold text-white items-center justify-center">
                      {violationCount > 9 ? '9+' : violationCount}
                    </span>
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-surface/95 backdrop-blur-2xl shadow-bento-xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-brand" />
                        <span className="text-sm font-semibold text-foreground">
                          Violation Telemetry Feed
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {recentAlerts.length > 0 && (
                          <button
                            onClick={clearAlerts}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono"
                          >
                            Clear
                          </button>
                        )}
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                          {violationCount} Active
                        </span>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {recentAlerts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                          <Shield className="w-8 h-8 text-emerald-500 mx-auto opacity-70 mb-2" />
                          <p className="font-semibold text-foreground">All Clear</p>
                          <p className="text-[11px]">No active telemetry alerts logged</p>
                        </div>
                      ) : (
                        recentAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            onClick={() => markAlertRead(alert.id)}
                            className="p-2.5 rounded-xl border border-border bg-surface-elevated/60 hover:bg-muted text-xs space-y-1 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <SeverityBadge severity={alert.severity || 'MEDIUM'} size="sm" />
                              <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.occurredAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-foreground font-medium">{alert.studentName}</p>
                            <p className="text-muted-foreground text-[11px]">{alert.examTitle}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Menu */}
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl border border-border bg-surface hover:border-brand/40 transition-all select-none shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 border border-brand/30 flex items-center justify-center font-bold text-xs text-foreground">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-foreground leading-tight">
                      {user.fullName}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground leading-tight">
                      {user.role}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-surface/95 backdrop-blur-2xl shadow-bento-xl p-3 z-50 space-y-2"
                    >
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-xs font-semibold text-foreground">
                          {user.fullName}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {user.email}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${roleBadgeStyle}`}
                          >
                            {user.role}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground">
                            ID: #{user.id}
                          </span>
                        </div>
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-medium text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold shadow-sm hover:opacity-95"
              >
                Sign In
              </NavLink>
            )}
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex"
            >
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="w-72 bg-surface border-r border-border p-5 flex flex-col justify-between h-full"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-6 h-6 text-brand" />
                      <span className="font-bold text-lg text-foreground">
                        Proctor<span className="text-brand">IQ</span>
                      </span>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <nav className="space-y-1.5 pt-4">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <item.icon className="w-5 h-5 text-brand" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {user && (
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============================================================== */}
        {/* PAGE CONTENT WITH FADE + SLIGHT RISE TRANSITIONS               */}
        {/* ============================================================== */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
