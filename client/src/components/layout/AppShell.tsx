import React, { useState, useRef, useEffect, Suspense } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  Zap,
  Volume2,
  VolumeX,
  User,
  Users,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../context/ThemeContext';
import {
  useNotificationsStore,
  selectUnreadCount,
  selectLiveViolationCount,
} from '../../store/notificationsStore';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { StudentMessages } from '../notifications/StudentMessages';
import { ThemeToggle } from '../ui/ThemeToggle';
import { CommandPalette } from './CommandPalette';
import { OverlayPanel } from '../ui/OverlayPanel';
import { RouteErrorBoundary } from '../ui/RouteErrorBoundary';
import { PageSkeleton } from '../ui/Skeleton';
import { SidebarStatusCard } from './SidebarStatusCard';
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
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLElement | null>(null);

  // Scroll to top on every route transition
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Fail-safe: force visible any stuck opacity:0 / visibility:hidden elements 600ms after navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mainContentRef.current) return;
      const elements = mainContentRef.current.querySelectorAll<HTMLElement>('*');
      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.opacity === '0' || style.visibility === 'hidden') {
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('visibility', 'visible', 'important');
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const unreadCount = useNotificationsStore(selectUnreadCount);
  const liveViolationCount = useNotificationsStore(selectLiveViolationCount);

  useEffect(() => {
    if (token) {
      void useNotificationsStore.getState().fetchNotifications();
    }
  }, [token]);

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

  // Sub-menu expansion states (Phase 13.6 expandable groups readiness) - default collapsed per Phase 16
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '/styleguide': false,
  });

  // UI Styleguide Popover Flyout states (Solid surface, search, 13 sub-items)
  const [styleguideFlyoutOpen, setStyleguideFlyoutOpen] = useState<boolean>(false);
  const [styleguideSearch, setStyleguideSearch] = useState<string>('');
  const [styleguideFlyoutTop, setStyleguideFlyoutTop] = useState<number>(200);
  const styleguideTriggerRef = useRef<HTMLDivElement | null>(null);
  const styleguideFlyoutRef = useRef<HTMLDivElement | null>(null);
  const sidebarNavRef = useRef<HTMLElement | null>(null);

  // Position and auto-clamp styleguide flyout when open
  useEffect(() => {
    if (styleguideFlyoutOpen && styleguideTriggerRef.current) {
      const rect = styleguideTriggerRef.current.getBoundingClientRect();
      const flyoutHeight = Math.min(window.innerHeight * 0.7, 480);
      let targetTop = rect.top;
      if (targetTop + flyoutHeight > window.innerHeight - 20) {
        targetTop = Math.max(16, window.innerHeight - flyoutHeight - 20);
      }
      setStyleguideFlyoutTop(targetTop);
    }
  }, [styleguideFlyoutOpen]);

  // Outside click & Escape key listener for styleguide flyout
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        styleguideFlyoutRef.current &&
        !styleguideFlyoutRef.current.contains(event.target as Node) &&
        styleguideTriggerRef.current &&
        !styleguideTriggerRef.current.contains(event.target as Node)
      ) {
        setStyleguideFlyoutOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStyleguideFlyoutOpen(false);
      }
    };

    if (styleguideFlyoutOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [styleguideFlyoutOpen]);

  // Keep sidebar nav at scrollTop 0 on route change, unless active item is outside visible area
  useEffect(() => {
    if (!sidebarNavRef.current) return;
    const nav = sidebarNavRef.current;
    const activeEl = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!activeEl) {
      nav.scrollTop = 0;
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    const isVisible = elRect.top >= navRect.top && elRect.bottom <= navRect.bottom;
    if (!isVisible) {
      if (elRect.top < navRect.top) {
        nav.scrollTop -= (navRect.top - elRect.top + 8);
      } else if (elRect.bottom > navRect.bottom) {
        nav.scrollTop += (elRect.bottom - navRect.bottom + 8);
      }
    }
  }, [location.pathname]);

  // Dynamic route document.title updates
  useEffect(() => {
    const ROUTE_TITLES: Record<string, string> = {
      '/home': 'Home | ProctorIQ',
      '/admin': 'Mission Overview | ProctorIQ',
      '/admin/exams': 'Exam Catalog | ProctorIQ',
      '/admin/analytics': 'Telemetry & Heatmap | ProctorIQ',
      '/admin/simulator': 'Demo Simulator | ProctorIQ',
      '/admin/students': 'Student Audit | ProctorIQ',
      '/proctor/students': 'Student Audit | ProctorIQ',
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
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: liveViolationCount > 0 ? (liveViolationCount > 9 ? '9+' : liveViolationCount) : undefined, section: 'SURVEILLANCE' },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert, section: 'SURVEILLANCE' },
        { to: '/admin/students', label: 'Student Audit', icon: Users, section: 'SURVEILLANCE' },
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
        { to: '/proctor', label: 'Live Monitor', icon: Radio, badge: liveViolationCount > 0 ? (liveViolationCount > 9 ? '9+' : liveViolationCount) : undefined, section: 'SURVEILLANCE' },
        { to: '/proctor/audit', label: 'Violation Audit', icon: ShieldAlert, section: 'SURVEILLANCE' },
        { to: '/proctor/students', label: 'Student Audit', icon: Users, section: 'SURVEILLANCE' },
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
  }, [user, liveViolationCount]);

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
      ? 'text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40'
      : user?.role === 'PROCTOR'
        ? 'text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40'
        : 'text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40';

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
            className={`flex items-center gap-3 group w-full overflow-hidden ${isCollapsed ? 'justify-center' : ''
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
        <nav ref={sidebarNavRef} className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 overflow-x-hidden">
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
                  // Collapsed 72px item - Styleguide opens the Popover Flyout
                  if (item.to === '/styleguide') {
                    return (
                      <div key={item.to} ref={styleguideTriggerRef} className="relative flex justify-center py-0.5">
                        <button
                          type="button"
                          data-nav-active={isActive ? 'true' : undefined}
                          title="UI Styleguide (13 Components)"
                          onClick={() => {
                            setStyleguideFlyoutOpen((prev) => !prev);
                            setStyleguideSearch('');
                          }}
                          className={`w-11 h-11 flex items-center justify-center rounded-xl relative transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer ${isActive
                            ? 'bg-brand/15 dark:bg-brand/20 text-brand shadow-sm font-semibold'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                            }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />
                          )}
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand' : 'text-muted-foreground'}`} />
                        </button>
                      </div>
                    );
                  }

                  // Collapsed 72px square item (44px) with interactive hover/click flyout
                  return (
                    <div key={item.to} className="relative group/navitem flex justify-center py-0.5">
                      <NavLink
                        to={item.to}
                        title={item.label}
                        data-nav-active={isActive ? 'true' : undefined}
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedGroups((prev) => ({ ...prev, [item.to]: true }));
                          }
                        }}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl relative transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${isActive
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
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border font-semibold text-xs">
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
                                  className={`block px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${isSubActive
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

                // Expanded 260px item - Styleguide opens the Popover Flyout (Requirement B.2)
                if (item.to === '/styleguide') {
                  return (
                    <div key={item.to} ref={styleguideTriggerRef} className="space-y-0.5">
                      <button
                        type="button"
                        data-nav-active={isActive ? 'true' : undefined}
                        onClick={() => {
                          setStyleguideFlyoutOpen((prev) => !prev);
                          setStyleguideSearch('');
                        }}
                        className={`relative w-full flex items-center gap-3 px-3 h-10 rounded-xl text-xs font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer ${isActive
                          ? 'bg-brand/10 dark:bg-brand/15 text-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />
                        )}
                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'
                            }`}
                        />
                        <span className="truncate flex-1 tracking-wide text-left">{item.label}</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-semibold bg-brand/10 text-brand border border-brand/20 mr-1">
                          13
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${styleguideFlyoutOpen ? 'rotate-90 text-brand' : ''
                            }`}
                        />
                      </button>
                    </div>
                  );
                }

                // Expanded 260px item (40px high, 20px icon)
                return (
                  <div key={item.to} className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <NavLink
                        to={item.to}
                        data-nav-active={isActive ? 'true' : undefined}
                        onClick={() => {
                          if (hasChildren) {
                            setExpandedGroups((prev) => ({ ...prev, [item.to]: true }));
                          }
                        }}
                        className={`relative flex-1 flex items-center gap-3 px-3 h-10 rounded-xl text-xs font-medium transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${isActive
                          ? 'bg-brand/10 dark:bg-brand/15 text-foreground font-semibold shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                          }`}
                      >
                        {/* Active Gradient Left Bar */}
                        {isActive && (
                          <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-gradient" />
                        )}

                        <Icon
                          className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'
                            }`}
                        />

                        <span className="truncate flex-1 tracking-wide">{item.label}</span>

                        {item.badge !== undefined && (
                          <span
                            data-testid={`nav-badge-${item.to.replace(/\//g, '-').replace(/^-/, '')}`}
                            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0"
                          >
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
                            className={`w-3.5 h-3.5 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''
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
                          className="ml-5 pl-3 border-l-2 border-border space-y-0.5 pt-1 overflow-hidden"
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
                                className={`block px-3 py-1.5 rounded-lg text-xs font-mono transition-all relative ${isSubActive
                                  ? 'text-brand font-semibold bg-brand/10 shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                  }`}
                              >
                                {isSubActive && (
                                  <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand-gradient" />
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
          <SidebarStatusCard isCollapsed={isCollapsed} />
        </div>
      </motion.aside>

      {/* ============================================================== */}
      {/* UI STYLEGUIDE POPOVER FLYOUT (Requirement B.2)                  */}
      {/* Solid surface, z-50, max-height 70vh, own scroll, 13 items,    */}
      {/* search box at top, active item highlighted with 2px gradient   */}
      {/* ============================================================== */}
      <AnimatePresence>
        {styleguideFlyoutOpen && (
          <motion.div
            ref={styleguideFlyoutRef}
            initial={{ opacity: 0, x: -8, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              top: styleguideFlyoutTop,
              left: isCollapsed ? 80 : 268,
            }}
            className="fixed z-50 w-72 max-h-[70vh] flex flex-col rounded-2xl border border-border bg-surface dark:bg-[#12131d] shadow-2xl p-3 select-none"
          >
            {/* Flyout Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand/10 border border-brand/20 text-brand">
                  <Palette className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-foreground">UI Styleguide</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-brand/10 text-brand border border-brand/20">
                    13
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStyleguideFlyoutOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close styleguide flyout"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search Box */}
            <div className="relative my-2">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={styleguideSearch}
                onChange={(e) => setStyleguideSearch(e.target.value)}
                placeholder="Search components..."
                className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-brand font-mono text-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {styleguideSearch && (
                <button
                  type="button"
                  onClick={() => setStyleguideSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sub-items List (Scrollable within max-height 70vh) */}
            <div className="overflow-y-auto space-y-0.5 flex-1 pr-1 max-h-[calc(70vh-90px)] scrollbar-thin">
              {STYLEGUIDE_NAV_CHILDREN.filter((sub) =>
                sub.label.toLowerCase().includes(styleguideSearch.toLowerCase())
              ).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No components match &ldquo;{styleguideSearch}&rdquo;
                </div>
              ) : (
                STYLEGUIDE_NAV_CHILDREN.filter((sub) =>
                  sub.label.toLowerCase().includes(styleguideSearch.toLowerCase())
                ).map((sub) => {
                  const isSubActive =
                    sub.to === '/styleguide'
                      ? location.pathname === '/styleguide'
                      : location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');

                  return (
                    <button
                      key={sub.to}
                      type="button"
                      onClick={() => {
                        setStyleguideFlyoutOpen(false);
                        navigate(sub.to);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono relative flex items-center justify-between transition-colors text-left cursor-pointer ${isSubActive
                        ? 'text-brand font-semibold bg-brand/10 dark:bg-brand/15'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                        }`}
                    >
                      {/* Requirement B.3: 2px gradient bar on the left, pill aligned to same left edge */}
                      {isSubActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand-gradient" />
                      )}
                      <span className="truncate">{sub.label}</span>
                      {isSubActive && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-brand/20 text-brand">
                          active
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* MAIN CONTAINER                                                 */}
      {/* ============================================================== */}
      <div ref={scrollContainerRef} className="flex-1 flex flex-col min-w-0 relative z-0 h-dvh overflow-y-auto">
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
                                      ? `Styleguide / ${STYLEGUIDE_NAV_CHILDREN.find((c) => c.to === location.pathname)?.label ||
                                      location.pathname.split('/')[2].replace(/-/g, ' ')
                                      }`
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
              className={`h-[38px] w-[38px] rounded-xl border flex items-center justify-center text-xs transition-all cursor-pointer shadow-xs ${audioMuted
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
                data-testid="notification-bell-btn"
                onClick={() => {
                  setNotificationsOpen(!notificationsOpen);
                  if (userMenuOpen) setUserMenuOpen(false);
                }}
                className="relative h-[38px] w-[38px] rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-brand/40 transition-all shadow-xs flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                aria-label={user?.role === 'STUDENT' ? 'Messages' : 'Notifications'}
                title={user?.role === 'STUDENT' ? 'Messages' : 'Violation Telemetry Feed'}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    data-testid="notification-bell-badge"
                    className="absolute -top-1 -right-1 flex h-4 w-4"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[9px] font-mono font-bold text-white items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </span>
                )}
              </button>

              <OverlayPanel
                isOpen={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                ariaLabel={user?.role === 'STUDENT' ? 'Messages' : 'Violation Telemetry Feed'}
                className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 ${
                  user?.role === 'STUDENT' ? 'sm:w-[380px]' : 'sm:w-[420px]'
                } max-h-[70vh] flex flex-col p-0 overflow-hidden`}
              >
                {user?.role === 'STUDENT' ? (
                  <StudentMessages onClose={() => setNotificationsOpen(false)} />
                ) : (
                  <NotificationPanel onClose={() => setNotificationsOpen(false)} />
                )}
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
                  <div className="p-3 bg-surface-elevated/50 dark:bg-[#181926]/70 rounded-xl border border-border flex items-start gap-3">
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
        <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto relative z-0">
          <div key={location.pathname} className="route-enter w-full">
            <RouteErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
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
                              `flex-1 flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive
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
                                className={`w-4 h-4 transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''
                                  }`}
                              />
                            </button>
                          )}
                        </div>

                        {hasChildren && isGroupOpen && (
                          <div className="pl-6 pr-2 space-y-0.5 border-l-2 border-border ml-4 py-1">
                            {item.children?.map((sub) => (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                onClick={() => setMobileMenuOpen(false)}
                                className={({ isActive }) =>
                                  `block px-3 py-1.5 rounded-lg text-xs font-mono relative transition-colors ${isActive
                                    ? 'text-brand font-semibold bg-brand/10'
                                    : 'text-muted-foreground hover:text-foreground'
                                  }`
                                }
                              >
                                {({ isActive }) => (
                                  <>
                                    {isActive && (
                                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand-gradient" />
                                    )}
                                    <span>{sub.label}</span>
                                  </>
                                )}
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
