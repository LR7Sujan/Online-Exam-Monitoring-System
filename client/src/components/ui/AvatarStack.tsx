export interface AvatarItem {
  id: string | number;
  name: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

export interface AvatarStackProps {
  avatars: AvatarItem[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: {
    avatar: 'w-7 h-7 text-[10px]',
    dot: 'w-2 h-2',
    ring: 'ring-2',
    offset: '-space-x-2',
  },
  md: {
    avatar: 'w-9 h-9 text-xs',
    dot: 'w-2.5 h-2.5',
    ring: 'ring-2',
    offset: '-space-x-2.5',
  },
  lg: {
    avatar: 'w-11 h-11 text-sm',
    dot: 'w-3 h-3',
    ring: 'ring-2',
    offset: '-space-x-3',
  },
};

const statusColors = {
  online: 'bg-emerald-500',
  offline: 'bg-zinc-400',
  busy: 'bg-rose-500',
  away: 'bg-amber-500',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AvatarStack({
  avatars,
  max = 4,
  size = 'md',
  className = '',
}: AvatarStackProps) {
  const cfg = sizeConfig[size] ?? sizeConfig.md;
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={`flex items-center ${cfg.offset} ${className}`}>
      {visible.map((av) => (
        <div
          key={av.id}
          className={`relative inline-flex items-center justify-center rounded-full ${cfg.ring} ring-background bg-surface-elevated font-mono font-semibold text-foreground border border-border shadow-sm shrink-0 select-none ${cfg.avatar}`}
          title={av.name}
        >
          {av.avatarUrl ? (
            <img
              src={av.avatarUrl}
              alt={av.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span>{getInitials(av.name)}</span>
          )}

          {av.status && (
            <span
              className={`absolute bottom-0 right-0 rounded-full ring-2 ring-background ${statusColors[av.status]} ${cfg.dot}`}
            />
          )}
        </div>
      ))}

      {remaining > 0 && (
        <div
          className={`relative inline-flex items-center justify-center rounded-full ${cfg.ring} ring-background bg-muted text-muted-foreground font-mono font-medium border border-border shadow-sm shrink-0 select-none ${cfg.avatar}`}
          title={`${remaining} more`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
