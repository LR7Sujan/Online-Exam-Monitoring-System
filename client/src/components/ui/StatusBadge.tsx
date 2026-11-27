interface StatusBadgeProps {
  value: string;
}

const badgeStyles: Record<string, string> = {
  // Session statuses
  IN_PROGRESS: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-300',
  SUBMITTED: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300',
  TIMED_OUT: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300',
  TERMINATED_CHEATING: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300',

  // Integrity statuses
  CLEAN: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300',
  FLAGGED: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300',
  DISQUALIFIED: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300',

  // Review statuses
  PENDING: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300',
  CONFIRMED: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-300',
  DISMISSED: 'border-border bg-surface-elevated text-muted-foreground',

  // Severities
  LOW: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-300',
  MEDIUM: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-300',
  HIGH: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300',
  CRITICAL: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/60 dark:bg-rose-500/20 dark:text-rose-200',

  // Roles
  ADMIN: 'border-accent/30 bg-accent-soft text-accent dark:border-accent/40 dark:bg-accent-soft dark:text-accent',
  PROCTOR: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-cyan-400/40 dark:bg-cyan-400/15 dark:text-cyan-200',
  STUDENT: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-400/15 dark:text-emerald-200',
};

export function StatusBadge({ value }: StatusBadgeProps) {
  const style =
    badgeStyles[value] ?? 'border-border bg-surface-elevated text-muted-foreground';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" />
      {value.replace(/_/g, ' ')}
    </span>
  );
}

