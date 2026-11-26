import { LiveDot } from './LiveDot';

export interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

const statusConfig: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    dotColor: 'emerald' | 'rose' | 'cyan' | 'amber' | 'gray';
    label?: string;
  }
> = {
  // Session Statuses
  IN_PROGRESS: {
    border: 'border-sky-200 dark:border-sky-800/80',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    dotColor: 'cyan',
    label: 'IN PROGRESS',
  },
  SUBMITTED: {
    border: 'border-emerald-200 dark:border-emerald-800/80',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'emerald',
    label: 'SUBMITTED',
  },
  TIMED_OUT: {
    border: 'border-amber-200 dark:border-amber-800/80',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dotColor: 'amber',
    label: 'TIMED OUT',
  },
  TERMINATED_CHEATING: {
    border: 'border-rose-200 dark:border-rose-800/80',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dotColor: 'rose',
    label: 'TERMINATED',
  },
  DISCONNECTED: {
    border: 'border-amber-400 dark:border-amber-600/80',
    bg: 'bg-amber-500/10 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    dotColor: 'amber',
    label: 'DISCONNECTED',
  },

  // Integrity Statuses
  CLEAN: {
    border: 'border-emerald-200 dark:border-emerald-800/80',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'emerald',
    label: 'CLEAN',
  },
  FLAGGED: {
    border: 'border-amber-200 dark:border-amber-800/80',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dotColor: 'amber',
    label: 'FLAGGED',
  },
  DISQUALIFIED: {
    border: 'border-rose-200 dark:border-rose-800/80',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dotColor: 'rose',
    label: 'DISQUALIFIED',
  },

  // Review Statuses
  PENDING: {
    border: 'border-amber-200 dark:border-amber-800/80',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dotColor: 'amber',
    label: 'PENDING REVIEW',
  },
  CONFIRMED: {
    border: 'border-rose-200 dark:border-rose-800/80',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    dotColor: 'rose',
    label: 'CONFIRMED',
  },
  DISMISSED: {
    border: 'border-border',
    bg: 'bg-zinc-100 dark:bg-zinc-800/60',
    text: 'text-zinc-600 dark:text-zinc-400',
    dotColor: 'gray',
    label: 'DISMISSED',
  },

  // Roles
  ADMIN: {
    border: 'border-indigo-200 dark:border-indigo-800/80',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    text: 'text-indigo-700 dark:text-indigo-300',
    dotColor: 'cyan',
    label: 'ADMINISTRATOR',
  },
  PROCTOR: {
    border: 'border-sky-200 dark:border-sky-800/80',
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    dotColor: 'cyan',
    label: 'PROCTOR',
  },
  STUDENT: {
    border: 'border-emerald-200 dark:border-emerald-800/80',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'emerald',
    label: 'STUDENT',
  },
};

export function StatusPill({
  status,
  size = 'md',
  pulse,
  className = '',
}: StatusPillProps) {
  const norm = (status || '').toUpperCase().replace(/[\s-]/g, '_');
  const cfg = statusConfig[norm] ?? {
    border: 'border-border',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-600 dark:text-zinc-400',
    dotColor: 'gray' as const,
    label: status,
  };

  const isPulsing = pulse ?? (norm === 'IN_PROGRESS' || norm === 'PENDING');

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-full border ${cfg.border} ${cfg.bg} ${cfg.text} ${sizeClasses} ${className}`}
    >
      <LiveDot
        color={cfg.dotColor}
        size={size === 'sm' ? 'sm' : 'md'}
        pulse={isPulsing}
      />
      <span>{cfg.label ?? status}</span>
    </span>
  );
}
