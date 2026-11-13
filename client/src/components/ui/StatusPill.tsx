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
    border: 'border-cyan/40',
    bg: 'bg-cyan/10',
    text: 'text-cyan-300',
    dotColor: 'cyan',
    label: 'IN PROGRESS',
  },
  SUBMITTED: {
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    text: 'text-emerald-300',
    dotColor: 'emerald',
    label: 'SUBMITTED',
  },
  TIMED_OUT: {
    border: 'border-amber/40',
    bg: 'bg-amber/10',
    text: 'text-amber-300',
    dotColor: 'amber',
    label: 'TIMED OUT',
  },
  TERMINATED_CHEATING: {
    border: 'border-magenta/50',
    bg: 'bg-magenta/15',
    text: 'text-magenta-300',
    dotColor: 'rose',
    label: 'TERMINATED',
  },

  // Integrity Statuses
  CLEAN: {
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    text: 'text-emerald-300',
    dotColor: 'emerald',
    label: 'CLEAN',
  },
  FLAGGED: {
    border: 'border-amber/40',
    bg: 'bg-amber/10',
    text: 'text-amber-300',
    dotColor: 'amber',
    label: 'FLAGGED',
  },
  DISQUALIFIED: {
    border: 'border-magenta/50',
    bg: 'bg-magenta/15',
    text: 'text-magenta-300',
    dotColor: 'rose',
    label: 'DISQUALIFIED',
  },

  // Review Statuses
  PENDING: {
    border: 'border-amber/40',
    bg: 'bg-amber/10',
    text: 'text-amber-300',
    dotColor: 'amber',
    label: 'PENDING REVIEW',
  },
  CONFIRMED: {
    border: 'border-magenta/50',
    bg: 'bg-magenta/15',
    text: 'text-magenta-300',
    dotColor: 'rose',
    label: 'CONFIRMED',
  },
  DISMISSED: {
    border: 'border-slate-500/40',
    bg: 'bg-slate-500/10',
    text: 'text-slate-300',
    dotColor: 'gray',
    label: 'DISMISSED',
  },

  // Roles
  ADMIN: {
    border: 'border-violet/40',
    bg: 'bg-violet/15',
    text: 'text-violet-300',
    dotColor: 'cyan',
    label: 'ADMIN',
  },
  PROCTOR: {
    border: 'border-cyan/40',
    bg: 'bg-cyan/15',
    text: 'text-cyan-300',
    dotColor: 'cyan',
    label: 'PROCTOR',
  },
  STUDENT: {
    border: 'border-emerald/40',
    bg: 'bg-emerald/15',
    text: 'text-emerald-300',
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
  const norm = status.toUpperCase().replace(/\s+/g, '_');
  const config =
    statusConfig[norm] ?? {
      border: 'border-white/15',
      bg: 'bg-white/5',
      text: 'text-slate-300',
      dotColor: 'gray',
      label: status.replace(/_/g, ' '),
    };

  const shouldPulse = pulse !== undefined ? pulse : norm === 'IN_PROGRESS';
  const label = config.label ?? status.replace(/_/g, ' ');

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px] gap-1.5'
      : 'px-2.5 py-1 text-xs gap-2';

  return (
    <span
      className={`inline-flex items-center font-mono font-medium uppercase tracking-wider rounded-full border ${config.border} ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      <LiveDot
        color={config.dotColor}
        size={size === 'sm' ? 'sm' : 'sm'}
        pulse={shouldPulse}
      />
      <span>{label}</span>
    </span>
  );
}

// Backward compatibility alias
export const StatusBadge = StatusPill;

