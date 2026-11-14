import React, { useState, useRef, useEffect, Suspense } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
  ChevronDown,
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
import { RouteErrorBoundary } from '../ui/RouteErrorBoundary';
import { PageSkeleton } from '../ui/Skeleton';
import { isAudioMuted, setAudioMuted, playPingSound } from '../../utils/audioAlert';

interface NavSubItem {
  to: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  section: string;
  children?: NavSubItem[];
}

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const { isConnected, violationCount, recentAlerts, clearAlerts, markAlertRead } =
    useSocketContext();

  // Collapsed state persisted in localStorage (default to false if not set)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('proctoriq-sidebar-collapsed') === 'true';
    } catch (err) {
      console.warn('[AppShell] Unable to read sidebar preference:', err);
      return false;
    }
  });

  const handleToggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('proctoriq-sidebar-collapsed', String(next));
      } catch (err) {
        console.warn('[AppShell] Unable to persist sidebar preference:', err);
      }
      return next;
    });
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [audioMuted, setAudioMutedState] = useState<boolean>(isAudioMuted());

  // Sub-menu expansion states (Phase 13.6 expandable groups readiness)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '/styleguide': true,
  });

  const toggleGroup = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  // Define role-specific navigation with section labels and sub-menu readiness
  const navItems: NavItem[] = React.useMemo(() => {
    if (!user) return [];

    if (user.role === 'ADMIN') {
      return [
        { to: '/admin', label: 'Mission Overview', icon: Activity, section: 'CORE' },
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: violationCount > 0 ? violationCount : undefined, section: 'SURVEILLANCE' },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert, section: 'SURVEILLANCE' },
        { to: '/admin/exams', label: 'Exam Catalog', icon: FileText, section: 'MANAGEMENT' },
        { to: '/admin/analytics', label: 'Telemetry & Heatmap', icon: BarChart3, section: 'MANAGEMENT' },
        { to: '/admin/simulator', label: 'Demo Simulator', icon: Zap, section: 'MANAGEMENT' },
        {
          to: '/styleguide',
          label: 'UI Styleguide',
          icon: Palette,
          section: 'SYSTEM',
          children: [
            { to: '/styleguide', label: 'Bento Tokens & Specs' },
          ],
        },
      ];
    }

    if (user.role === 'PROCTOR') {
      return [
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: violationCount > 0 ? violationCount : undefined, section: 'SURVEILLANCE' },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert, section: 'SURVEILLANCE' },
        { to: '/styleguide', label: 'UI Styleguide', icon: Palette, section: 'SYSTEM' },
      ];
    }

    // STUDENT
    return [
      { to: '/student', label: 'Exams & Portal', icon: GraduationCap, section: 'EXAMINATIONS' },
      { to: '/styleguide', label: 'UI Styleguide', icon: Palette, section: 'SYSTEM' },
    ];
  }, [user, violationCount]);

  // Group items by section
  const navSections = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of navItems) {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    }
    return Array.from(map.entries());
  }, [navItems]);

  const roleBadgeStyle =
    user?.role === 'ADMIN'
      ? 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40'
      : user?.role === 'PROCTOR'
      ? 'text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40'
      : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40';

  return (
    <div className="min-h-screen h-dvh flex bg-background text-foreground overflow-x-hidden relative">
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
      {/* SIDEBAR (DESKTOP / LAPTOP >= 1024px)                          */}
      {/* 260px expanded, 72px collapsed, sticky h-dvh, full height     */}
      {/* ============================================================== */}
      <motion.aside
        animate={{ width: isCollapsed ? 72 : 260 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="hidden lg:flex flex-col border-r border-border bg-surface dark:bg-[#0c0d14] h-dvh sticky top-0 shrink-0 z-40 select-none relative"
      >
        {/* Border Edge Collapse / Expand Circular Toggle Button */}
        <button
          type="button"
          onClick={handleToggleCollapsed}
          className="absolute -right-3.5 top-5 z-50 w-7 h-7 rounded-full border border-border bg-surface dark:bg-[#12131d] hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
          title={isCollapsed ? 'Expand sidebar (260px)' : 'Collapse sidebar (72px)'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Brand / Logo Header (h-16 = 64px) */}
        <div className="h-16 flex items-center px-3.5 border-b border-border shrink-0">
          <NavLink
            to="/"
            className={`flex items-center gap-3 group w-full overflow-hidden ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 border border-brand/40 flex items-center justify-center text-brand shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Shield className="w-5 h-5 text-brand" />
            </div>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col whitespace-nowrap overflow-hidden"
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
              </motion.div>
            )}
          </NavLink>
        </div>

        {/* Operating Role Indicator (Expanded Only) */}
        {!isCollapsed && user && (
          <div className="px-4 py-2.5 border-b border-border bg-surface-elevated/40 dark:bg-[#0c0d14] shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-medium">
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

        {/* Scrollable Nav Container (flex-1, overflow-y-auto, full height) */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 overflow-x-hidden">
          {navSections.map(([sectionName, items]) => (
            <div key={sectionName} className="space-y-1">
              {/* Section Header */}
              {!isCollapsed ? (
                <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold select-none">
                  {sectionName}
                </div>
              ) : (
                <div className="w-8 h-px bg-border/60 mx-auto my-2" />
              )}

              {/* Items in Section */}
              {items.map((item) => {
                const isActive =
                  location.pathname === item.to ||
                  (item.to !== '/' &&
                    item.to !== '/proctor' &&
                    item.to !== '/admin' &&
                    location.pathname.startsWith(item.to));

                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isGroupOpen = expandedGroups[item.to] ?? false;

                if (isCollapsed) {
                  // Collapsed 72px square item (44px) with hover flyout
                  return (
                    <div key={item.to} className="relative group/navitem flex justify-center py-0.5">
                      <NavLink
                        to={item.to}
                        title={item.label}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl relative transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                          isActive
                            ? 'bg-brand/15 dark:bg-brand/20 text-brand shadow-sm font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />
                        )}
                        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand' : 'text-muted-foreground group-hover/navitem:text-foreground'}`} />
                      </NavLink>

                      {/* Hover Flyout Tooltip / Sub-menu */}
                      <div className="opacity-0 group-hover/navitem:opacity-100 transition-opacity absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-[80] px-3 py-2 rounded-xl border border-border bg-surface dark:bg-[#12131d] text-foreground text-xs shadow-2xl pointer-events-none whitespace-nowrap space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          <span>{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {hasChildren && (
                          <div className="pt-1 border-t border-border/60 space-y-1">
                            {item.children?.map((sub) => (
                              <div key={sub.to} className="text-[11px] text-muted-foreground font-mono">
                                • {sub.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Expanded 260px item (40px high, 20px icon)
                return (
                  <div key={item.to} className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <NavLink
                        to={item.to}
                        className={`relative flex-1 flex items-center gap-3 px-3 h-10 rounded-xl text-xs font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                          isActive
                            ? 'bg-brand/10 dark:bg-brand/15 text-foreground font-semibold shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                      >
                        {/* Active Gradient Left Bar */}
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />
                        )}

                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive ? 'text-brand' : 'text-muted-foreground'
                          }`}
                        />

                        <span className="truncate flex-1 tracking-wide">{item.label}</span>

                        {item.badge !== undefined && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </NavLink>

                      {hasChildren && (
                        <button
                          type="button"
                          onClick={(e) => toggleGroup(item.to, e)}
                          className="h-10 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          aria-label="Toggle sub-menu"
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isGroupOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Indented Children for Sub-Menu (Phase 13.6 expandable groups readiness) */}
                    {hasChildren && isGroupOpen && (
                      <div className="pl-8 space-y-1 pt-0.5">
                        {item.children?.map((sub) => (
                          <NavLink
                            key={sub.to}
                            to={sub.to}
                            className={({ isActive: isSubActive }) =>
                              `block px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                                isSubActive
                                  ? 'text-brand font-semibold bg-brand/10'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                              }`
                            }
                          >
                            {sub.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Pinned to Bottom (mt-auto) */}
        <div className="mt-auto p-3 border-t border-border bg-surface dark:bg-[#0c0d14] shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between rounded-xl p-2.5 border border-border bg-surface-elevated/80 dark:bg-[#12131d]">
              <div className="flex items-center gap-2.5">
                <LiveDot
                  color={isConnected ? 'emerald' : 'rose'}
                  size="sm"
                  pulse={isConnected}
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-mono text-foreground font-semibold">
                    {isConnected ? 'NODE ONLINE' : 'DISCONNECTED'}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    MYSQL 8.0 • WSS
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono text-brand font-semibold">
                v2.0
              </span>
            </div>
          ) : (
            // Collapsed Footer: Clean circular status indicator with role initial
            <div
              className="w-10 h-10 mx-auto rounded-full border border-border bg-surface-elevated/80 dark:bg-[#12131d] flex items-center justify-center relative group/status cursor-pointer shadow-sm"
              title={`Node ${isConnected ? 'Online' : 'Disconnected'} | Role: ${user?.role}`}
            >
              <LiveDot
                color={isConnected ? 'emerald' : 'rose'}
                size="sm"
                pulse={isConnected}
              />
              {user && (
                <span
                  className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-mono font-bold flex items-center justify-center border border-border text-white ${
                    user.role === 'ADMIN'
                      ? 'bg-indigo-600'
                      : user.role === 'PROCTOR'
                      ? 'bg-sky-600'
                      : 'bg-emerald-600'
                  }`}
                >
                  {user.role[0]}
                </span>
              )}

              {/* Collapsed Status Tooltip */}
              <div className="opacity-0 group-hover/status:opacity-100 transition-opacity absolute left-full ml-3.5 bottom-0 z-[80] px-3 py-2 rounded-xl border border-border bg-surface dark:bg-[#12131d] text-foreground shadow-2xl pointer-events-none whitespace-nowrap text-xs space-y-0.5">
                <p className="font-semibold text-foreground">
                  {isConnected ? 'Node Online' : 'Disconnected'}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  MySQL 8.0 • WSS (v2.0)
                </p>
                <p className="text-[10px] font-mono text-brand font-medium">
                  Role: {user?.role}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      {/* ============================================================== */}
      {/* MAIN CONTAINER                                                 */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col min-w-0 relative z-0 h-dvh overflow-y-auto">
        {/* Sticky Header with Defined z-30 scale */}
        <header className="h-16 border-b border-border bg-surface/95 dark:bg-[#0c0d14]/95 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shrink-0">
          {/* Left: Mobile hamburger (<1024px) & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand"
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

            {/* Audio Alert Pings Toggle */}
            <button
              onClick={handleToggleAudio}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                audioMuted
                  ? 'border-border bg-surface text-muted-foreground hover:text-foreground'
                  : 'border-brand/40 bg-brand/10 text-brand shadow-sm'
              }`}
              title={audioMuted ? 'Sound Alerts: Disabled (Click to Enable)' : 'Sound Alerts: Active'}
              aria-label={audioMuted ? 'Muted, click to enable sound alerts' : 'Audio On, click to mute sound alerts'}
            >
              {audioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[11px] font-medium">{audioMuted ? 'Muted' : 'Audio On'}</span>
            </button>

            {/* Notification Bell with Defined z-50 Popover and Solid Opaque Background */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-brand/40 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
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

              {/* Notification Popover (Solid Opaque Background, z-50 scale) */}
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-border bg-surface dark:bg-[#12131d] shadow-2xl p-4 z-50 space-y-3"
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
                            className="p-2.5 rounded-xl border border-border bg-surface-elevated/70 dark:bg-[#181926] hover:bg-muted text-xs space-y-1 cursor-pointer transition-colors"
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

            {/* User Profile Menu with Defined z-50 Popover and Solid Opaque Background */}
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-xl border border-border bg-surface hover:border-brand/40 transition-all select-none shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  aria-label="User account menu"
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

                {/* Dropdown Menu (Solid Opaque Background, z-50 scale, prevents background bleed) */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 rounded-2xl border border-border bg-surface dark:bg-[#12131d] shadow-2xl p-3 z-50 space-y-2"
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

        {/* ============================================================== */}
        {/* PAGE CONTENT WITH SKELETON SUSPENSE & ERROR BOUNDARY SAFETY    */}
        {/* ============================================================== */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto relative z-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            >
              <RouteErrorBoundary>
                <Suspense fallback={<PageSkeleton />}>
                  <Outlet />
                </Suspense>
              </RouteErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Off-Canvas Mobile / Tablet Drawer (<1024px) - Native Root z-60 scale */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 z-60 bg-black/60 backdrop-blur-md flex"
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-72 bg-surface dark:bg-[#0c0d14] border-r border-border p-5 flex flex-col justify-between h-dvh z-60 shadow-2xl relative"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 border border-brand/40 flex items-center justify-center text-brand">
                      <Shield className="w-5 h-5 text-brand" />
                    </div>
                    <span className="font-bold text-base text-foreground">
                      Proctor<span className="text-brand">IQ</span>
                    </span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
                    aria-label="Close navigation menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {user && (
                  <div className="px-3 py-2 rounded-xl bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{user.fullName}</span>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${roleBadgeStyle}`}>
                      {user.role}
                    </span>
                  </div>
                )}

                <nav className="space-y-1 pt-2 max-h-[60vh] overflow-y-auto">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-brand/10 text-brand font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 text-brand" />
                      <span>{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </nav>
              </div>

              {user && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors font-medium border border-rose-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
