import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import {
  CheckCheck,
  ChevronRight,
  Clock,
  Shield,
  ShieldAlert,
  Trash2,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useNotificationsStore, selectUnreadCount, type AppNotification } from '../../store/notificationsStore';
import { useAuthStore } from '../../store/authStore';
import { SeverityBadge } from '../ui/SeverityBadge';
import { LiveDot } from '../ui/LiveDot';
import { formatTimeAgo } from '../../utils/timeAgo';

export type NotifSeverityFilter = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM_LOW';

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isProctorOrAdmin = user?.role === 'PROCTOR' || user?.role === 'ADMIN';

  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore(selectUnreadCount);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
  const clearAll = useNotificationsStore((s) => s.clearAll);

  const [filter, setFilter] = useState<NotifSeverityFilter>('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'CRITICAL') return item.severity === 'CRITICAL';
    if (filter === 'HIGH') return item.severity === 'HIGH';
    if (filter === 'MEDIUM_LOW') return item.severity === 'MEDIUM' || item.severity === 'LOW';
    return true;
  });

  const handleItemClick = async (item: AppNotification) => {
    if (!item.readAt) {
      await markAsRead(item.id);
    }
    onClose();

    if (item.sessionId) {
      if (isProctorOrAdmin) {
        navigate(`/proctor/students/0/exams/${item.sessionId}`);
      } else {
        navigate(`/student/session/${item.sessionId}`);
      }
    }
  };

  const handleClearAll = async () => {
    await clearAll();
    setShowClearConfirm(false);
  };

  return (
    <div
      data-testid="notification-panel"
      className="flex flex-col h-full max-h-[70vh] bg-surface dark:bg-[#12131d] text-foreground select-none overflow-hidden"
    >
      {/* Header with Title + Unread Count + Actions + Close */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-surface-elevated/80 dark:bg-[#161724] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <LiveDot
            color={unreadCount > 0 ? 'rose' : 'emerald'}
            size="sm"
            pulse={unreadCount > 0}
          />
          <span className="text-sm font-bold text-foreground tracking-tight truncate">
            {isProctorOrAdmin ? 'Violation Telemetry Feed' : 'Activity Notifications'}
          </span>
          <span
            data-testid="notification-panel-unread-chip"
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 shrink-0"
          >
            {unreadCount} Active
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && !showClearConfirm && (
            <>
              {unreadCount > 0 && (
                <button
                  type="button"
                  data-testid="notification-mark-all-btn"
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-mono cursor-pointer px-1.5 py-0.5 rounded hover:bg-muted"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-brand" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                type="button"
                data-testid="notification-clear-all-btn"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-rose-500 transition-colors font-mono cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10"
                title="Clear all notifications"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            </>
          )}

          {showClearConfirm && (
            <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-lg text-[11px] font-mono">
              <span className="text-rose-400 font-semibold mr-1">Clear all?</span>
              <button
                type="button"
                data-testid="notification-confirm-clear-btn"
                onClick={handleClearAll}
                className="text-rose-500 font-bold hover:underline cursor-pointer"
              >
                Yes
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                No
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
            aria-label="Close notification panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Segmented Filter Tabs with Counts */}
      <div className="px-3 py-2 border-b border-border bg-surface dark:bg-[#12131d] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {[
          { key: 'ALL', label: 'All', count: items.length },
          {
            key: 'CRITICAL',
            label: 'Critical',
            count: items.filter((a) => a.severity === 'CRITICAL').length,
          },
          {
            key: 'HIGH',
            label: 'High',
            count: items.filter((a) => a.severity === 'HIGH').length,
          },
          {
            key: 'MEDIUM_LOW',
            label: 'Med/Low',
            count: items.filter((a) => a.severity === 'MEDIUM' || a.severity === 'LOW').length,
          },
        ].map((tab) => {
          const isSelected = filter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              data-testid={`notif-tab-${tab.key}`}
              onClick={() => setFilter(tab.key as NotifSeverityFilter)}
              className={`h-8 px-3 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
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
      <div
        data-testid="notification-list"
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[160px]"
      >
        {filteredItems.length === 0 ? (
          <div
            data-testid="notification-empty-state"
            className="py-12 flex flex-col items-center justify-center text-center space-y-2 my-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-1">
              <Shield className="w-6 h-6 opacity-90" />
            </div>
            <p className="font-bold text-sm text-foreground">
              {filter === 'ALL' ? 'All Clear' : `No ${filter} Alerts`}
            </p>
            <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">
              {filter === 'ALL'
                ? 'No active telemetry alerts logged in this segment. Telemetry stream is operating within clean parameters.'
                : `No notifications match the ${filter.toLowerCase().replace('_', '/')} filter category.`}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isUnread = !item.readAt;
            return (
              <div
                key={item.id}
                data-testid={`notification-item-${item.id}`}
                onClick={() => handleItemClick(item)}
                className={`group relative p-3 rounded-xl border transition-all text-xs space-y-1.5 cursor-pointer ${
                  isUnread
                    ? 'border-brand/40 bg-surface-elevated dark:bg-[#1a1b2b] hover:border-brand/70 shadow-xs'
                    : 'border-border bg-surface dark:bg-[#141520] hover:bg-muted/70 opacity-80'
                }`}
              >
                {/* Top Row: Severity + Icon + Unread Dot + Time Ago */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {item.severity === 'CRITICAL' && (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    {item.severity === 'HIGH' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    {(item.severity === 'MEDIUM' || item.severity === 'LOW') && (
                      <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    )}
                    {item.severity === 'INFO' && (
                      <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                    )}
                    <SeverityBadge severity={item.severity || 'MEDIUM'} size="sm" />
                    {isUnread && (
                      <span
                        data-testid="notification-unread-dot"
                        className="h-2 w-2 rounded-full bg-rose-500 animate-pulse ml-0.5"
                        title="Unread"
                      />
                    )}
                  </div>

                  <span
                    className="text-[10px] text-muted-foreground font-mono flex items-center gap-1"
                    title={new Date(item.createdAt).toLocaleString()}
                  >
                    <Clock className="w-3 h-3 text-muted-foreground/70" />
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <p className="text-foreground font-bold text-xs leading-snug">
                  {item.title}
                </p>

                {/* Readable Message */}
                <p
                  data-testid="notification-message"
                  className="text-foreground/90 text-xs font-mono leading-relaxed"
                >
                  {item.message}
                </p>

                {/* Student / Exam Footer info */}
                {item.examTitle && (
                  <p className="text-muted-foreground text-[10px] truncate font-mono pt-0.5">
                    {item.examTitle}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-3 border-t border-border bg-surface-elevated dark:bg-[#161724] flex items-center justify-between shrink-0 text-xs">
        <span className="text-[11px] text-muted-foreground font-mono">
          {isProctorOrAdmin ? 'WSS Live Realtime Feed' : 'Candidate Audit Stream'}
        </span>
        <NavLink
          to={isProctorOrAdmin ? '/proctor/audit' : '/student'}
          onClick={onClose}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline transition-colors"
        >
          <span>{isProctorOrAdmin ? 'View all violations' : 'View assessments'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>
    </div>
  );
}
