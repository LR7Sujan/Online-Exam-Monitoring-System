import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Bell,
  Calendar,
  CheckCheck,
  ChevronRight,
  Clock,
  Mail,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  useNotificationsStore,
  selectUnreadCount,
  type AppNotification,
} from '../../store/notificationsStore';
import { formatTimeAgo } from '../../utils/timeAgo';

interface StudentMessagesProps {
  onClose: () => void;
}

export function StudentMessages({ onClose }: StudentMessagesProps) {
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore(selectUnreadCount);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
  const clearAll = useNotificationsStore((s) => s.clearAll);

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const handleItemClick = async (item: AppNotification) => {
    if (!item.readAt) {
      await markAsRead(item.id);
    }
    onClose();

    // Navigate to related context
    if (item.sessionId) {
      const titleLower = (item.title || '').toLowerCase();
      const msgLower = (item.message || '').toLowerCase();
      if (
        item.type === 'INFO' &&
        (titleLower.includes('result') || msgLower.includes('result is ready'))
      ) {
        navigate(`/student/results/${item.sessionId}`);
      } else if (item.isSessionLive) {
        navigate(`/student/session/${item.sessionId}`);
      } else {
        navigate('/student');
      }
    } else {
      navigate('/student');
    }
  };

  const handleClearAll = async () => {
    await clearAll();
    setShowClearConfirm(false);
  };

  const getMessageIcon = (item: AppNotification) => {
    const title = (item.title || '').toLowerCase();
    const type = item.type;
    const msg = (item.message || '').toLowerCase();

    if (
      type === 'WARNING' ||
      type === 'TERMINATION' ||
      title.includes('warning') ||
      title.includes('terminated')
    ) {
      return (
        <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/25 flex items-center justify-center shrink-0 text-rose-500">
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    }

    if (type === 'EXTENSION' || title.includes('time') || title.includes('extra minutes')) {
      const isApproved = title.includes('approv') || msg.includes('approved');
      return (
        <div
          className={`w-8 h-8 rounded-full ${
            isApproved
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-500'
              : 'bg-amber-500/15 border-amber-500/25 text-amber-500'
          } border flex items-center justify-center shrink-0`}
        >
          <Clock className="w-4 h-4" />
        </div>
      );
    }

    if (title.includes('result') || (item.type as string) === 'RESULT') {
      return (
        <div className="w-8 h-8 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 text-brand">
          <Award className="w-4 h-4" />
        </div>
      );
    }

    if (
      title.includes('dismissed') ||
      title.includes('restored') ||
      title.includes('review') ||
      msg.includes('dismissed')
    ) {
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-500">
          <ShieldCheck className="w-4 h-4" />
        </div>
      );
    }

    if (title.includes('reminder') || title.includes('opens')) {
      return (
        <div className="w-8 h-8 rounded-full bg-accent-soft border border-accent/25 flex items-center justify-center shrink-0 text-accent">
          <Calendar className="w-4 h-4" />
        </div>
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-brand/15 border border-brand/25 flex items-center justify-center shrink-0 text-brand">
        <Bell className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div
      data-testid="student-messages-panel"
      className="flex flex-col h-full max-h-[70vh] bg-surface text-foreground select-none overflow-hidden"
    >
      {/* Header with Title + Unread Count Chip + Actions */}
      <div className="flex items-center justify-between p-3.5 border-b border-border bg-surface-elevated/70 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-foreground tracking-tight">Messages</span>
          {unreadCount > 0 && (
            <span
              data-testid="student-messages-unread-chip"
              className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 shrink-0"
            >
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && !showClearConfirm && (
            <>
              {unreadCount > 0 && (
                <button
                  type="button"
                  data-testid="student-messages-mark-all-btn"
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark all as read</span>
                </button>
              )}

              <button
                type="button"
                data-testid="student-messages-clear-btn"
                onClick={() => setShowClearConfirm(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Clear all messages"
                aria-label="Clear all messages"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          {showClearConfirm && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Clear all?</span>
              <button
                type="button"
                data-testid="confirm-clear-messages-btn"
                onClick={handleClearAll}
                className="px-2 py-0.5 rounded-md bg-rose-500 text-white font-bold hover:bg-rose-600 transition-colors cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                data-testid="cancel-clear-messages-btn"
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            data-testid="student-messages-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Close messages"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-1">
        {items.length === 0 ? (
          <div
            data-testid="student-messages-empty"
            className="flex flex-col items-center justify-center py-14 px-4 text-center"
          >
            <div className="w-12 h-12 rounded-full bg-muted/60 border border-border flex items-center justify-center mb-3 text-muted-foreground">
              <Mail className="w-6 h-6 opacity-75" />
            </div>
            <p className="text-sm font-semibold text-foreground">You have no messages yet.</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Updates about your exams, warnings, and time requests will appear here.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isUnread = !item.readAt;

            return (
              <div
                key={item.id}
                data-testid={`student-message-item-${item.id}`}
                onClick={() => handleItemClick(item)}
                className={`group flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                  isUnread
                    ? 'bg-surface-elevated/90 border border-brand/20 shadow-xs'
                    : 'hover:bg-muted/40 border border-transparent'
                }`}
              >
                {/* Message Icon */}
                {getMessageIcon(item)}

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs truncate ${
                        isUnread ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                      }`}
                    >
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUnread && (
                        <span
                          data-testid="unread-dot"
                          className="w-2 h-2 rounded-full bg-brand shrink-0"
                          title="Unread"
                        />
                      )}
                      <span className="text-[10px] text-muted-foreground/80 font-mono">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <p
                    className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                      isUnread ? 'text-foreground/90 font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {item.message}
                  </p>
                </div>

                {/* Subtle right chevron on hover */}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground shrink-0 self-center transition-colors" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
