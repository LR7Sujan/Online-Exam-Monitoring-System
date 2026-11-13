import {
  AlertTriangle,
  Radio,
  ShieldAlert,
  ShieldOff,
} from 'lucide-react';
import { StatCard } from '../ui/StatCard';

export interface ProctorKpiData {
  activeSessions: number;
  violationsLast10Min: number;
  flaggedStudents: number;
  terminatedToday: number;
}

interface KpiStripProps {
  kpis: ProctorKpiData;
  isLoading?: boolean;
}

export function KpiStrip({ kpis }: KpiStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Sessions */}
      <StatCard
        label="Active Live Sessions"
        value={kpis.activeSessions}
        accent="cyan"
        icon={<Radio className="w-5 h-5 text-brand animate-pulse" />}
        changeLabel="telemetry streaming"
        sparklineData={[12, 14, 15, 17, 18, 16, kpis.activeSessions]}
      />

      {/* 2. Violations Last 10 Min */}
      <StatCard
        label="Violations (Last 10m)"
        value={kpis.violationsLast10Min}
        accent={kpis.violationsLast10Min > 5 ? 'magenta' : 'amber'}
        icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
        changeLabel="rolling real-time"
        sparklineData={[2, 3, 5, 4, 6, 7, kpis.violationsLast10Min]}
      />

      {/* 3. Flagged Students */}
      <StatCard
        label="Flagged Under Review"
        value={kpis.flaggedStudents}
        accent="violet"
        icon={<ShieldAlert className="w-5 h-5 text-violet-500" />}
        changeLabel="trust score < 100%"
        sparklineData={[3, 4, 3, 5, 4, 6, kpis.flaggedStudents]}
      />

      {/* 4. Terminated Today */}
      <StatCard
        label="Disqualified / Terminated"
        value={kpis.terminatedToday}
        accent="magenta"
        icon={<ShieldOff className="w-5 h-5 text-rose-500" />}
        changeLabel="threshold breached"
        sparklineData={[0, 1, 1, 2, 2, 3, kpis.terminatedToday]}
      />
    </div>
  );
}
