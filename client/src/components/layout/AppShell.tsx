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
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Define role-specific navigation
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

  const roleColor =
    user?.role === 'ADMIN'
      ? 'text-violet-400 border-violet-500/40 bg-violet-500/10'
      : user?.role === 'PROCTOR'
      ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
      : 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';

  return (
    <div className="min-h-screen flex bg-void text-slate-100 overflow-x-hidden relative">
      {/* Subtle Animated Aurora Layer with Low GPU Cost */}
      <div className="aurora-backdrop" aria-hidden="true" />
      {/* ============================================================== */}
      {/* SIDEBAR (DESKTOP) */}
      {/* ============================================================== */}
      <aside
        className={`hidden md:flex flex-col border-r border-white/10 bg-[#0C0E1B]/95 backdrop-blur-2xl transition-all duration-300 z-30 sticky top-0 h-screen ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <NavLink
            to="/"
            className="flex items-center gap-3 group overflow-hidden"
          >
            <div className="h-10 w-10 rounded-xl bg-cyan/10 border border-cyan/40 flex items-center justify-center text-cyan shadow-glow-cyan-sm group-hover:scale-105 transition-transform flex-shrink-0">
              <Shield className="w-5 h-5 text-cyan" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold tracking-wider text-base text-white group-hover:text-cyan transition-colors flex items-center gap-1.5">
                  Proctor<span className="text-cyan">IQ</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan/20 text-cyan border border-cyan/30">
                    2.0
                  </span>
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                  Mission Control
                </span>
              </div>
            )}
          </NavLink>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* User Role Indicator pill */}
        {!isCollapsed && user && (
          <div className="px-4 py-3 border-b border-white/5 bg-[#101222]/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Operating Role
              </span>
              <span
                className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${roleColor}`}
              >
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Navigation Links */}
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
                title={isCollapsed ? item.label : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group select-none ${
                  isActive
                    ? 'text-cyan font-semibold bg-cyan/10 border border-cyan/30 shadow-glow-cyan-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan rounded-r-full shadow-[0_0_8px_rgba(34,211,238,1)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <motion.div
                  whileHover={{ scale: 1.18, rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 0.25 }}
                  className="flex-shrink-0"
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-cyan' : 'text-slate-400 group-hover:text-cyan'
                    }`}
                  />
                </motion.div>
                {!isCollapsed && (
                  <span className="truncate flex-1 tracking-wide">{item.label}</span>
                )}
                {!isCollapsed && item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-magenta/20 text-magenta border border-magenta/40">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Telemetry / Live Status footer */}
        <div className="p-3 border-t border-white/10 bg-[#101222]/80">
          <div
            className={`flex items-center rounded-xl p-2.5 border border-white/5 bg-[#16192E]/60 ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2">
              <LiveDot
                color={isConnected ? 'emerald' : 'rose'}
                size="sm"
                pulse={isConnected}
              />
              {!isCollapsed && (
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-slate-300 font-medium">
                    {isConnected ? 'NODE ONLINE' : 'DISCONNECTED'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    MYSQL 8.0 • WSS
                  </span>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <span className="text-[10px] font-mono text-cyan">v2.0</span>
            )}
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN CONTAINER */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-white/10 bg-[#0A0B14]/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 hidden sm:inline">
                PROCTORIQ //
              </span>
              <span className="font-semibold text-sm text-white tracking-wide capitalize">
                {location.pathname.replace('/', '').replace(/-/g, ' ') || 'Overview'}
              </span>
            </div>
          </div>

          {/* Center: Search input */}
          <div className="hidden lg:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates, exams, violation codes... [Ctrl+K]"
                className="w-full bg-[#101222]/80 border border-white/10 rounded-xl pl-10 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan/50 focus:shadow-glow-cyan-sm transition-all"
              />
            </div>
          </div>

          {/* Right: Quick links, Notifications & User Menu */}
          <div className="flex items-center gap-3">
            <NavLink
              to="/styleguide"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 text-xs font-mono transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Styleguide</span>
            </NavLink>

            {/* Audio Alert Pings Toggle (off by default) */}
            <button
              onClick={handleToggleAudio}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                audioMuted
                  ? 'border-white/10 bg-[#101222]/80 text-slate-400 hover:text-white'
                  : 'border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/25 shadow-glow-cyan-sm'
              }`}
              title={audioMuted ? 'Sound Alerts: Disabled (Click to Enable)' : 'Sound Alerts: Active'}
              aria-label={audioMuted ? 'Enable Sound Alerts' : 'Mute Sound Alerts'}
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[11px] font-semibold">{audioMuted ? 'Muted' : 'Audio On'}</span>
            </button>

            {/* Notification Bell with live count badge */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl border border-white/10 bg-[#101222]/80 text-slate-300 hover:text-white hover:border-cyan/40 transition-all"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {violationCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-magenta opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-magenta text-[9px] font-mono font-bold text-white items-center justify-center">
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
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#101222]/95 backdrop-blur-2xl shadow-2xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-magenta" />
                        <h4 className="text-sm font-semibold text-white tracking-wide">
                          Live Violation Alerts
                        </h4>
                      </div>
                      {recentAlerts.length > 0 && (
                        <button
                          onClick={clearAlerts}
                          className="text-[11px] text-cyan hover:underline font-mono"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {recentAlerts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 font-mono">
                          // No active violation alerts.
                        </div>
                      ) : (
                        recentAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-2.5 rounded-xl border border-white/5 bg-[#16192E]/70 hover:bg-[#16192E] transition-colors flex items-start justify-between gap-2"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <SeverityBadge
                                  severity={alert.severity ?? 'MEDIUM'}
                                  size="sm"
                                />
                                <span className="font-mono text-xs text-white font-medium">
                                  {alert.violationCode}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300">
                                {alert.studentName ? (
                                  <span className="font-semibold text-cyan">
                                    {alert.studentName}:{' '}
                                  </span>
                                ) : null}
                                Session #{alert.sessionId}
                              </p>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {new Date(alert.occurredAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => markAlertRead(alert.id)}
                              className="text-slate-400 hover:text-white p-1"
                              title="Dismiss"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {user?.role === 'PROCTOR' || user?.role === 'ADMIN' ? (
                      <NavLink
                        to="/proctor/audit"
                        onClick={() => setNotificationsOpen(false)}
                        className="block text-center text-xs font-mono text-cyan hover:underline pt-2 border-t border-white/5"
                      >
                        Open Full Audit Log →
                      </NavLink>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Menu */}
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl border border-white/10 bg-[#101222]/80 hover:border-cyan/40 transition-all select-none"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan/30 to-violet/30 border border-white/20 flex items-center justify-center font-bold text-xs text-white">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-white leading-tight">
                      {user.fullName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 leading-tight">
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
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#101222]/95 backdrop-blur-2xl shadow-2xl p-3 z-50 space-y-2"
                    >
                      <div className="px-3 py-2 border-b border-white/10">
                        <p className="text-xs font-semibold text-white">
                          {user.fullName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {user.email}
                        </p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${roleColor}`}
                          >
                            {user.role}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <NavLink
                          to="/styleguide"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors font-medium"
                        >
                          <Palette className="w-4 h-4 text-violet-400" />
                          <span>Component Styleguide</span>
                        </NavLink>

                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-magenta-300 hover:bg-magenta/10 rounded-xl transition-colors font-medium text-left"
                        >
                          <LogOut className="w-4 h-4 text-magenta" />
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
                className="px-3.5 py-1.5 rounded-xl bg-cyan text-void text-xs font-semibold shadow-glow-cyan"
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
              className="md:hidden fixed inset-0 z-50 bg-[#0A0B14]/80 backdrop-blur-md flex"
            >
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                className="w-72 bg-[#0C0E1B] border-r border-white/10 p-5 flex flex-col justify-between h-full"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-6 h-6 text-cyan" />
                      <span className="font-bold text-lg text-white">
                        Proctor<span className="text-cyan">IQ</span>
                      </span>
                    </div>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="p-1.5 text-slate-400 hover:text-white"
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
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5"
                      >
                        <item.icon className="w-5 h-5 text-cyan" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </nav>
                </div>

                {user && (
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-magenta hover:bg-magenta/10 rounded-xl"
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
        {/* PAGE CONTENT WITH ANIMATED TRANSITIONS */}
        {/* ============================================================== */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
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
