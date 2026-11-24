import {
  AlertTriangle,
  Clock,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { StatCard } from '../ui/StatCard';

export interface ProctorKpiData {
  activeSessions: number;
  violationsLast10Min: number;
  warningsPending?: number;
  timeRequestsWaiting?: number;
  flaggedStudents?: number;
  terminatedToday?: number;
}

interface KpiStripProps {
  kpis: ProctorKpiData;
  isLoading?: boolean;
}

export function KpiStrip({ kpis }: KpiStripProps) {
  const warningsCount = kpis.warningsPending ?? kpis.flaggedStudents ?? 0;
  const timeRequestsCount = kpis.timeRequestsWaiting ?? 0;

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
        changeLabel="live sessions only"
        sparklineData={[2, 3, 5, 4, 6, 7, kpis.violationsLast10Min]}
      />

      {/* 3. Warnings Pending Acknowledgment */}
      <StatCard
        label="Warnings Pending"
        value={warningsCount}
        accent="violet"
        icon={<ShieldAlert className="w-5 h-5 text-violet-500" />}
        changeLabel="pending acknowledgment"
        sparklineData={[1, 2, 2, 3, 2, 4, warningsCount]}
      />

      {/* 4. Time Requests Waiting */}
      <StatCard
        label="Time Requests Waiting"
        value={timeRequestsCount}
        accent="amber"
        icon={<Clock className="w-5 h-5 text-amber-500" />}
        changeLabel="awaiting decision"
        sparklineData={[0, 1, 1, 2, 1, 2, timeRequestsCount]}
      />
    </div>
  );
}
