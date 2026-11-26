interface StatusBadgeProps {
  value: string;
}

const badgeStyles: Record<string, string> = {
  // Session statuses
  IN_PROGRESS: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300',
  SUBMITTED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  TIMED_OUT: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  TERMINATED_CHEATING: 'border-rose-500/50 bg-rose-500/15 text-rose-300',

  // Integrity statuses
  CLEAN: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  FLAGGED: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  DISQUALIFIED: 'border-rose-500/50 bg-rose-500/15 text-rose-300',

  // Review statuses
  PENDING: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  CONFIRMED: 'border-rose-500/50 bg-rose-500/15 text-rose-300',
  DISMISSED: 'border-slate-500/40 bg-slate-500/10 text-slate-300',

  // Severities
  LOW: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  MEDIUM: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  HIGH: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  CRITICAL: 'border-rose-500/60 bg-rose-500/20 text-rose-200',

  // Roles
  ADMIN: 'border-violet-400/40 bg-violet-400/15 text-violet-200',
  PROCTOR: 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200',
  STUDENT: 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200',
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

