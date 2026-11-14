import React, { useState, useRef, useEffect, Suspense } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Home,
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
  Zap,
  Volume2,
  VolumeX,
  User,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import { useSocketContext } from '../../context/useSocketContext';
import { LiveDot } from '../ui/LiveDot';
import { SeverityBadge } from '../ui/SeverityBadge';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { OverlayPanel } from '../ui/OverlayPanel';
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

const STYLEGUIDE_NAV_CHILDREN: NavSubItem[] = [
  { to: '/styleguide', label: 'Overview' },
  { to: '/styleguide/tokens', label: 'Design Tokens' },
  { to: '/styleguide/indicators', label: 'Live Indicators' },
  { to: '/styleguide/bento', label: 'Bento Grid & Cards' },
  { to: '/styleguide/buttons', label: 'Buttons' },
  { to: '/styleguide/badges', label: 'Badges & Pills' },
  { to: '/styleguide/stat-cards', label: 'Stat Cards' },
  { to: '/styleguide/trust-ring', label: 'Trust Ring' },
  { to: '/styleguide/tables', label: 'Data Tables' },
  { to: '/styleguide/overlays', label: 'Drawers & Modals' },
  { to: '/styleguide/charts', label: 'Charts' },
  { to: '/styleguide/loading-empty', label: 'Loading & Empty States' },
  { to: '/styleguide/motion', label: 'Motion' },
];

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
  const { setTheme, resolvedTheme } = useTheme();
  type NotifSeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM_LOW';
  const [notifFilter, setNotifFilter] = useState<NotifSeverityFilter>('ALL');

  // Sub-menu expansion states (Phase 13.6 expandable groups readiness)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '/styleguide': true,
  });

  // Dynamic route document.title updates
  useEffect(() => {
    const ROUTE_TITLES: Record<string, string> = {
      '/home': 'Home | ProctorIQ',
      '/admin': 'Mission Overview | ProctorIQ',
      '/admin/exams': 'Exam Catalog | ProctorIQ',
      '/admin/analytics': 'Telemetry & Heatmap | ProctorIQ',
      '/admin/simulator': 'Demo Simulator | ProctorIQ',
      '/proctor': 'Live Monitor | ProctorIQ',
      '/proctor/audit': 'Violation Audit | ProctorIQ',
      '/student': 'Student Examinations | ProctorIQ',
      '/styleguide': 'UI Component Styleguide | ProctorIQ',
      '/styleguide/tokens': 'Design Tokens | UI Styleguide',
      '/styleguide/indicators': 'Live Indicators | UI Styleguide',
      '/styleguide/bento': 'Bento Grid & Cards | UI Styleguide',
      '/styleguide/buttons': 'Buttons | UI Styleguide',
      '/styleguide/badges': 'Badges & Pills | UI Styleguide',
      '/styleguide/stat-cards': 'Stat Cards | UI Styleguide',
      '/styleguide/trust-ring': 'Trust Ring | UI Styleguide',
      '/styleguide/tables': 'Data Tables | UI Styleguide',
      '/styleguide/overlays': 'Drawers & Modals | UI Styleguide',
      '/styleguide/charts': 'Charts | UI Styleguide',
      '/styleguide/loading-empty': 'Loading & Empty States | UI Styleguide',
      '/styleguide/motion': 'Motion | UI Styleguide',
    };

    const matched = ROUTE_TITLES[location.pathname];
    if (matched) {
      document.title = matched;
    } else if (location.pathname.startsWith('/student/results/')) {
      document.title = 'Forensic Exam Results | ProctorIQ';
    } else if (location.pathname.startsWith('/styleguide')) {
      document.title = 'UI Component Styleguide | ProctorIQ';
    }
  }, [location.pathname]);

  // Auto-expand group on initial load and route changes if on styleguide
  useEffect(() => {
    if (location.pathname.startsWith('/styleguide')) {
      setExpandedGroups((prev) => ({ ...prev, '/styleguide': true }));
    }
  }, [location.pathname]);

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
    navigate('/');
  };

  // Define role-specific navigation with section labels and sub-menu readiness
  const navItems: NavItem[] = React.useMemo(() => {
    if (!user) return [];

    if (user.role === 'ADMIN') {
      return [
        { to: '/home', label: 'Home', icon: Home, section: 'CORE' },
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
          children: STYLEGUIDE_NAV_CHILDREN,
        },
      ];
    }

    if (user.role === 'PROCTOR') {
      return [
        { to: '/home', label: 'Home', icon: Home, section: 'CORE' },
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: violationCount > 0 ? violationCount : undefined, section: 'SURVEILLANCE' },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert, section: 'SURVEILLANCE' },
        {
          to: '/styleguide',
          label: 'UI Styleguide',
          icon: Palette,
          section: 'SYSTEM',
          children: STYLEGUIDE_NAV_CHILDREN,
        },
      ];
    }

    // STUDENT
    return [
      { to: '/home', label: 'Home', icon: Home, section: 'CORE' },
      { to: '/student', label: 'Exams & Portal', icon: GraduationCap, section: 'EXAMINATIONS' },
      {
        to: '/styleguide',
        label: 'UI Styleguide',
        icon: Palette,
        section: 'SYSTEM',
        children: STYLEGUIDE_NAV_CHILDREN,
      },
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
            to="/home"
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
                    item.to !== '/home' &&
                    item.to !== '/proctor' &&
                    item.to !== '/admin' &&
                    location.pathname.startsWith(item.to));

                const Icon = item.icon;
                const hasChildren = item.children && item.children.length > 0;
                const isGroupOpen = expandedGroups[item.to] ?? false;

                if (isCollapsed) {
                  // Collapsed 72px square item (44px) with interactive hover/click flyout
                  return (
                    <div key={item.to} className="relative group/navitem flex justify-center py-0.5">
                      <NavLink
                        to={item.to}
                        title={item.label}
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedGroups((prev) => ({ ...prev, [item.to]: true }));
                          }
                        }}
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

                      {/* Interactive Hover Flyout Sub-menu (pointer-events enabled on hover) */}
                      <div className="opacity-0 group-hover/navitem:opacity-100 group-hover/navitem:pointer-events-auto transition-opacity duration-150 absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[80] p-2 rounded-xl border border-border bg-surface dark:bg-[#12131d] text-foreground text-xs shadow-2xl pointer-events-none whitespace-nowrap min-w-[210px] max-h-[80vh] overflow-y-auto space-y-1 before:absolute before:-left-3.5 before:top-0 before:bottom-0 before:w-4 before:content-['']">
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 font-semibold text-xs">
                          <span>{item.label}</span>
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {hasChildren && (
                          <div className="space-y-0.5 pt-1">
                            {item.children?.map((sub) => {
                              const isSubActive =
                                sub.to === '/styleguide'
                                  ? location.pathname === '/styleguide'
                                  : location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');

                              return (
                                <NavLink
                                  key={sub.to}
                                  to={sub.to}
                                  className={`block px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                                    isSubActive
                                      ? 'text-brand font-semibold bg-brand/10'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                  }`}
                                >
                                  {sub.label}
                                </NavLink>
                              );
                            })}
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
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedGroups((prev) => ({ ...prev, [item.to]: true }));
                          }
                        }}
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
                          className="h-10 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
                          aria-label="Toggle sub-menu"
                          title={isGroupOpen ? 'Collapse sub-menu' : 'Expand sub-menu'}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${
                              isGroupOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {/* Indented Children with Vertical Guide Line & Active Dot */}
                    <AnimatePresence initial={false}>
                      {hasChildren && isGroupOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="ml-5 pl-3 border-l-2 border-border/70 space-y-0.5 pt-1 overflow-hidden"
                        >
                          {item.children?.map((sub) => {
                            const isSubActive =
                              sub.to === '/styleguide'
                                ? location.pathname === '/styleguide'
                                : location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');

                            return (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                className={`block px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all relative ${
                                  isSubActive
                                    ? 'text-brand font-semibold bg-brand/10 shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                              >
                                {isSubActive && (
                                  <span className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand shadow-xs" />
                                )}
                                {sub.label}
                              </NavLink>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
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
              className="lg:hidden h-[38px] w-[38px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xl border border-border bg-surface hover:bg-muted focus:outline-none focus:ring-2 focus:ring-brand shadow-xs"
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
                {location.pathname === '/home'
                  ? 'Home'
                  : location.pathname === '/admin'
                  ? 'Mission Overview'
                  : location.pathname === '/admin/exams'
                  ? 'Exam Catalog'
                  : location.pathname === '/admin/analytics'
                  ? 'Telemetry & Heatmap'
                  : location.pathname === '/admin/simulator'
                  ? 'Demo Simulator'
                  : location.pathname === '/proctor'
                  ? 'Live Monitor'
                  : location.pathname === '/proctor/audit'
                  ? 'Violation Audit'
                  : location.pathname === '/student'
                  ? 'Exams & Portal'
                  : location.pathname.startsWith('/student/results')
                  ? 'Exam Results'
                  : location.pathname === '/styleguide'
                  ? 'UI Styleguide'
                  : location.pathname.startsWith('/styleguide/')
                  ? `Styleguide / ${location.pathname.split('/')[2].replace(/-/g, ' ')}`
                  : location.pathname.replace('/', '').replace(/-/g, ' ') || 'Overview'}
              </span>
            </div>
          </div>

          {/* Center: Search / Cmd+K Trigger Button */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden lg:flex items-center justify-between flex-1 max-w-md mx-6 h-[38px] px-3.5 rounded-xl border border-border bg-surface-elevated/70 hover:bg-muted text-xs text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-brand shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Search candidates, exams, actions...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Right: Theme Toggle, Audio Toggle, Bell, Profile Menu */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle (Light / Dark / System) with 38px height */}
            <ThemeToggle className="h-[38px] px-2.5" />

            {/* Audio Alert Pings Toggle - Subtle 38px Icon Button with Tooltip */}
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`h-[38px] w-[38px] rounded-xl border flex items-center justify-center text-xs transition-all cursor-pointer shadow-xs ${
                audioMuted
                  ? 'border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted'
                  : 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/15 shadow-sm'
              }`}
              title={audioMuted ? 'Audio alerts muted (Click to enable)' : 'Audio alerts active (Click to mute)'}
              aria-label={audioMuted ? 'Muted, click to enable sound alerts' : 'Audio On, click to mute sound alerts'}
            >
              {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Notification Bell with 38px height */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (userMenuOpen) setUserMenuOpen(false);
                }}
                className="relative h-[38px] w-[38px] rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-brand/40 transition-all shadow-xs flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                aria-label="Notifications"
                title="Violation Telemetry Feed"
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

              <OverlayPanel
                isOpen={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                ariaLabel="Violation Telemetry Feed"
                className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-[420px] max-h-[70vh] flex flex-col"
              >
                {/* Header with Title + LiveDot + Count Chip + Close button */}
                <div className="flex items-center justify-between p-3.5 border-b border-border bg-surface-elevated/40 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <LiveDot
                      color={violationCount > 0 ? 'rose' : 'emerald'}
                      size="sm"
                      pulse={violationCount > 0}
                    />
                    <span className="text-sm font-bold text-foreground tracking-tight">
                      Violation Telemetry Feed
                    </span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20">
                      {violationCount} Active
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
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand"
                      aria-label="Close notification panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Segmented Control Tabs */}
                <div className="px-3 py-2 border-b border-border bg-surface dark:bg-[#12131d] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  {[
                    { key: 'ALL', label: 'All', count: recentAlerts.length },
                    { key: 'CRITICAL', label: 'Critical', count: recentAlerts.filter((a) => a.severity === 'CRITICAL').length },
                    { key: 'HIGH', label: 'High', count: recentAlerts.filter((a) => a.severity === 'HIGH').length },
                    { key: 'MEDIUM_LOW', label: 'Med/Low', count: recentAlerts.filter((a) => a.severity === 'MEDIUM' || a.severity === 'LOW').length },
                  ].map((tab) => {
                    const isSelected = notifFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setNotifFilter(tab.key as NotifSeverityFilter)}
                        className={`h-8 px-3 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-brand-gradient text-white font-semibold shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                        }`}
                      >
                        <span className="truncate max-w-[100px]">{tab.label}</span>
                        {tab.count > 0 && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-semibold ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-surface-elevated text-muted-foreground border border-border'
                            }`}
                          >
                            {tab.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Feed Items (Scrollable internal view) */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {recentAlerts.filter((alert) => {
                    if (notifFilter === 'ALL') return true;
                    if (notifFilter === 'CRITICAL') return alert.severity === 'CRITICAL';
                    if (notifFilter === 'HIGH') return alert.severity === 'HIGH';
                    if (notifFilter === 'MEDIUM_LOW') return alert.severity === 'MEDIUM' || alert.severity === 'LOW';
                    return true;
                  }).length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 my-auto">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-1">
                        <Shield className="w-6 h-6 opacity-90" />
                      </div>
                      <p className="font-bold text-sm text-foreground">All Clear</p>
                      <p className="text-xs text-muted-foreground max-w-[240px]">
                        No active telemetry alerts logged in this segment. Telemetry stream is operating within clean parameters.
                      </p>
                    </div>
                  ) : (
                    recentAlerts
                      .filter((alert) => {
                        if (notifFilter === 'ALL') return true;
                        if (notifFilter === 'CRITICAL') return alert.severity === 'CRITICAL';
                        if (notifFilter === 'HIGH') return alert.severity === 'HIGH';
                        if (notifFilter === 'MEDIUM_LOW') return alert.severity === 'MEDIUM' || alert.severity === 'LOW';
                        return true;
                      })
                      .map((alert) => (
                        <div
                          key={alert.id}
                          onClick={() => markAlertRead(alert.id)}
                          className="p-3 rounded-xl border border-border bg-surface-elevated/70 dark:bg-[#181926] hover:bg-muted text-xs space-y-1.5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <SeverityBadge severity={alert.severity || 'MEDIUM'} size="sm" />
                            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(alert.occurredAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-foreground font-semibold text-xs">{alert.studentName}</p>
                          <p className="text-muted-foreground text-[11px] truncate">{alert.examTitle}</p>
                        </div>
                      ))
                  )}
                </div>

                {/* Footer with "View all violations" link */}
                <div className="p-3 border-t border-border bg-surface-elevated/40 flex items-center justify-between shrink-0 text-xs">
                  <span className="text-[11px] text-muted-foreground font-mono">
                    WSS Live Realtime Feed
                  </span>
                  <NavLink
                    to="/proctor/audit"
                    onClick={() => setNotificationsOpen(false)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline transition-colors"
                  >
                    <span>View all violations</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </NavLink>
                </div>
              </OverlayPanel>
            </div>

            {/* User Profile Menu with Defined z-50 Popover and Solid Opaque Background */}
            {user ? (
              <div className="relative" ref={userRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    if (notificationsOpen) setNotificationsOpen(false);
                  }}
                  className="h-[38px] flex items-center gap-2.5 pl-1.5 pr-3 rounded-xl border border-border bg-surface hover:bg-muted/70 transition-all focus:outline-none focus:ring-2 focus:ring-brand shadow-xs cursor-pointer select-none"
                  aria-label="User account menu"
                  title="Operator Menu"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand to-violet-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col text-left leading-tight">
                    <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">
                      {user.fullName}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground leading-tight">
                      {user.role}
                    </span>
                  </div>
                </button>

                <OverlayPanel
                  isOpen={userMenuOpen}
                  onClose={() => setUserMenuOpen(false)}
                  ariaLabel="User account menu"
                  className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-72 max-w-sm p-2.5"
                >
                  {/* Top user card: avatar + full name + email + role & ID badges */}
                  <div className="p-3 bg-surface-elevated/50 dark:bg-[#181926]/70 rounded-xl border border-border/70 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-fuchsia-500/20 border border-brand/40 flex items-center justify-center font-bold text-sm text-foreground shrink-0 shadow-sm">
                      {user.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate leading-tight">
                        {user.fullName}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                        {user.email}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span
                          className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold ${roleBadgeStyle}`}
                        >
                          {user.role}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-md border border-border bg-surface text-muted-foreground font-semibold">
                          ID: #{user.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-border/80 my-1.5 mx-1" />

                  {/* 40px Navigation Items */}
                  <div className="space-y-0.5">
                    {/* 1. Profile */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'PROCTOR' ? '/proctor' : '/student');
                      }}
                      className="w-full h-10 px-3 flex items-center gap-2.5 rounded-xl text-xs font-medium text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand text-left"
                    >
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">Operator Profile</span>
                    </button>

                    {/* 2. Settings */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/styleguide');
                      }}
                      className="w-full h-10 px-3 flex items-center gap-2.5 rounded-xl text-xs font-medium text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand text-left"
                    >
                      <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">System Preferences</span>
                    </button>

                    {/* 3. Theme Toggle */}
                    <button
                      type="button"
                      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                      className="w-full h-10 px-3 flex items-center justify-between rounded-xl text-xs font-medium text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-brand text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        {resolvedTheme === 'dark' ? (
                          <Moon className="w-4 h-4 text-brand shrink-0" />
                        ) : (
                          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                        )}
                        <span>Interface Theme</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground px-2 py-0.5 rounded border border-border bg-surface-elevated">
                        {resolvedTheme}
                      </span>
                    </button>

                    <div className="h-px bg-border/80 my-1.5 mx-1" />

                    {/* 4. Sign Out (Danger color, LogOut icon) */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full h-10 px-3 flex items-center gap-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </OverlayPanel>
              </div>
            ) : (
              <NavLink
                to="/"
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto relative z-0">
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
                  {navItems.map((item) => {
                    const hasChildren = item.children && item.children.length > 0;
                    const isGroupOpen = expandedGroups[item.to] ?? false;

                    return (
                      <div key={item.to} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <NavLink
                            to={item.to}
                            onClick={() => {
                              if (!hasChildren) setMobileMenuOpen(false);
                            }}
                            className={({ isActive }) =>
                              `flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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

                          {hasChildren && (
                            <button
                              type="button"
                              onClick={(e) => toggleGroup(item.to, e)}
                              className="p-2 text-muted-foreground hover:text-foreground"
                              aria-label="Toggle sub-menu"
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isGroupOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>

                        {hasChildren && isGroupOpen && (
                          <div className="pl-9 pr-2 space-y-0.5 border-l-2 border-border/70 ml-4 py-1">
                            {item.children?.map((sub) => (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                onClick={() => setMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                  `block px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                                    isActive
                                      ? 'text-brand font-semibold bg-brand/10'
                                      : 'text-muted-foreground hover:text-foreground'
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
