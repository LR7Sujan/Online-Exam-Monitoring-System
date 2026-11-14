import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Clock,
  Flame,
  GraduationCap,
  Layers,
  PieChart as PieChartIcon,
  ShieldAlert,
  Trophy,
  Users,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { StatCard } from '../ui/StatCard';
import { StatusPill } from '../ui/StatusPill';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../lib/api';

interface DashboardData {
  kpis: {
    totalExams: number;
    totalStudents: number;
    totalSessions: number;
    terminatedSessions: number;
    cheatingRate: number;
  };
  violationsOverTime: Array<{
    date: string;
    violation_count: number;
    total_penalty: number;
    impacted_sessions: number;
  }>;
  violationDistribution: Array<{
    code: string;
    label: string;
    severity: string;
    count: number;
    total_penalty: number;
  }>;
  integritySplit: Array<{
    exam_id: number;
    exam_title: string;
    clean_count: number;
    flagged_count: number;
    disqualified_count: number;
    total_graded: number;
  }>;
  trustHistogram: {
    bucket_0_49?: number;
    bucket_50_69?: number;
    bucket_70_84?: number;
    bucket_85_99?: number;
    bucket_100?: number;
  };
  leaderboard: Array<{
    session_id: number;
    student_id: number;
    student_name: string;
    student_email: string;
    exam_id: number;
    exam_title: string;
    trust_score: number;
    status: string;
    total_violations: number;
    pending_violations: number;
    last_violation_at: string | null;
  }>;
  heatmap: Array<{
    hour_of_day: number;
    violation_code: string;
    violation_label: string;
    severity: string;
    violation_count: number;
    total_penalty_points: number;
  }>;
}

// Brand gradient & semantic donut palette
const DONUT_COLORS = [
  '#6366F1', // Brand Indigo
  '#8B5CF6', // Violet
  '#D946EF', // Fuchsia
  '#0EA5E9', // Sky (Info)
  '#F59E0B', // Amber (Caution)
  '#F43F5E', // Rose (Danger)
  '#10B981', // Emerald (Safe)
];

export function AdminOverviewDashboard() {
  const [daysWindow, setDaysWindow] = useState<number>(7);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const axisStroke = isDark ? '#71717A' : '#A1A1AA';
  const gridStroke = isDark ? '#27272A' : '#E4E4E7';

  const query = useQuery({
    queryKey: ['admin-overview-dashboard', daysWindow],
    queryFn: () => api.get<DashboardData>(`/analytics/dashboard?days=${daysWindow}`),
    refetchInterval: 20000,
  });

  const data = query.data;
  const kpis = data?.kpis ?? {
    totalExams: 4,
    totalStudents: 60,
    totalSessions: 40,
    terminatedSessions: 3,
    cheatingRate: 7.5,
  };

  // Format Trust Score Histogram
  const histogramData = [
    { range: '0-49%', count: Number(data?.trustHistogram?.bucket_0_49 ?? 0), fill: '#F43F5E' },
    { range: '50-69%', count: Number(data?.trustHistogram?.bucket_50_69 ?? 0), fill: '#F59E0B' },
    { range: '70-84%', count: Number(data?.trustHistogram?.bucket_70_84 ?? 0), fill: '#8B5CF6' },
    { range: '85-99%', count: Number(data?.trustHistogram?.bucket_85_99 ?? 0), fill: '#6366F1' },
    { range: '100%', count: Number(data?.trustHistogram?.bucket_100 ?? 0), fill: '#10B981' },
  ];

  // Prepare Heatmap Matrix (24 hours x distinct violation codes)
  const heatmapCodes = Array.from(
    new Set((data?.heatmap ?? []).map((h) => h.violation_code))
  );
  const heatmapHours = Array.from({ length: 24 }, (_, i) => i);

  const getHeatmapCount = (hour: number, code: string): number => {
    const item = data?.heatmap?.find((h) => h.hour_of_day === hour && h.violation_code === code);
    return item ? Number(item.violation_count) : 0;
  };

  const maxHeatmapVal = Math.max(
    1,
    ...((data?.heatmap ?? []).map((h) => Number(h.violation_count)))
  );

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Assessment Telemetry & Integrity Analytics Overview</h2>
      {/* 1. TOP KPI CARDS (Bento Row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Curated Exams"
          value={kpis.totalExams}
          accent="cyan"
          icon={<GraduationCap className="w-5 h-5 text-sky-500" />}
          changeLabel="proctoring active"
          sparklineData={[1, 2, 2, 3, 4, 4, kpis.totalExams]}
        />
        <StatCard
          label="Registered Students"
          value={kpis.totalStudents}
          accent="violet"
          icon={<Users className="w-5 h-5 text-violet-500" />}
          changeLabel="biometric verified"
          sparklineData={[40, 45, 52, 55, 58, 60, kpis.totalStudents]}
        />
        <StatCard
          label="Monitored Sessions"
          value={kpis.totalSessions}
          accent="emerald"
          icon={<Activity className="w-5 h-5 text-emerald-500" />}
          changeLabel="audit logged"
          sparklineData={[25, 28, 32, 35, 38, 40, kpis.totalSessions]}
        />
        <StatCard
          label="Cheating Disqualification Rate"
          value={kpis.cheatingRate}
          suffix="%"
          decimals={1}
          accent="magenta"
          icon={<ShieldAlert className="w-5 h-5 text-rose-500" />}
          changeLabel="threshold breaches"
          sparklineData={[4.2, 5.0, 6.1, 7.2, 7.0, 7.5, kpis.cheatingRate]}
        />
      </div>

      {/* 2. VIOLATIONS OVER TIME (2/3) + VIOLATION TYPE DISTRIBUTION (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Violations Over Time */}
        <div
          role="region"
          aria-label="Violations telemetry timeline area chart"
          className="lg:col-span-2 rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" />
                <span>Violations Telemetry Over Time</span>
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                Incident velocity across active candidate assessment windows
              </p>
            </div>

            {/* 7/30 Day Toggle Button */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-elevated p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDaysWindow(7)}
                className={`rounded-lg px-3 py-1 font-medium transition-all cursor-pointer ${
                  daysWindow === 7
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysWindow(30)}
                className={`rounded-lg px-3 py-1 font-medium transition-all cursor-pointer ${
                  daysWindow === 30
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data?.violationsOverTime ?? []}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="violationsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={axisStroke}
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-surface/98 p-3 text-xs font-mono shadow-xl space-y-1">
                          <p className="text-foreground font-bold">{item.date}</p>
                          <p className="text-brand font-semibold">
                            Violations: {item.violation_count}
                          </p>
                          <p className="text-rose-500 text-[11px] font-medium">
                            Points Deducted: -{item.total_penalty} PTS
                          </p>
                          <p className="text-muted-foreground text-[10px]">
                            Candidates Impacted: {item.impacted_sessions}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="violation_count"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fill="url(#violationsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Animated Donut: Violation Type Distribution */}
        <div
          role="region"
          aria-label="Violation categories distribution chart"
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-violet-500" />
              <span>Violation Distribution</span>
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Breakdown by infraction category
            </p>
          </div>

          <div className="h-52 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    (data?.violationDistribution?.length ?? 0) === 0
                      ? [{ code: 'NO_DATA', label: 'No data', count: 1, isPlaceholder: true }]
                      : data?.violationDistribution
                  }
                  dataKey="count"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={(data?.violationDistribution?.length ?? 0) === 0 ? 0 : 3}
                  cornerRadius={(data?.violationDistribution?.length ?? 0) === 0 ? 0 : 6}
                >
                  {(data?.violationDistribution ?? []).map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                    />
                  ))}
                  {(data?.violationDistribution?.length ?? 0) === 0 && (
                    <Cell fill="#3f3f46" />
                  )}
                </Pie>
                <Tooltip
                  offset={20}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      if (item.isPlaceholder) return null;
                      const total = (data?.violationDistribution ?? []).reduce((acc, v) => acc + Number(v.count || 0), 0);
                      const pct = total > 0 ? Math.round((Number(item.count || 0) / total) * 100) : 0;
                      return (
                        <div className="rounded-xl border border-border bg-surface dark:bg-[#12131d] p-2.5 text-sm font-sans shadow-2xl z-50 pointer-events-none space-y-1">
                          <p className="text-foreground font-semibold text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            <strong className="text-brand font-bold">{item.count}</strong> incidents ({pct}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-xl font-bold font-mono tracking-tight tabular-nums text-foreground">
                {(data?.violationDistribution ?? []).reduce((acc, v) => acc + Number(v.count || 0), 0)}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                ALERTS
              </span>
            </div>
          </div>

          <div className="space-y-2 text-sm font-sans max-h-32 overflow-y-auto scrollbar-thin">
            {(data?.violationDistribution ?? []).map((item, idx) => {
              const total = (data?.violationDistribution ?? []).reduce((acc, v) => acc + Number(v.count || 0), 0);
              const pct = total > 0 ? Math.round((Number(item.count || 0) / total) * 100) : 0;
              return (
                <div key={item.code} className="flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                    />
                    <span className="truncate text-foreground font-medium text-sm">{item.label}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground pl-2 shrink-0">
                    <strong className="text-foreground">{item.count}</strong> ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. VIOLATION HEATMAP (hour of day x violation type) FROM vw_ViolationHeatmap */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Circadian Incident Heatmap (vw_ViolationHeatmap)</span>
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Aggregated frequency matrix: Hour of Day (0–23) × Infraction Type
            </p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">SQL View Driven</span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[700px] space-y-1.5 font-mono text-[10px]">
            {/* Hour Headers */}
            <div className="grid grid-cols-25 gap-1 text-center text-muted-foreground">
              <div className="text-left font-bold text-foreground">TYPE</div>
              {heatmapHours.map((h) => (
                <div key={h}>{String(h).padStart(2, '0')}h</div>
              ))}
            </div>

            {/* Matrix Rows */}
            {heatmapCodes.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground">No heatmap telemetry available.</div>
            ) : (
              heatmapCodes.map((code) => (
                <div key={code} className="grid grid-cols-25 gap-1 items-center">
                  <div className="truncate text-left text-muted-foreground font-semibold pr-1" title={code}>
                    {code}
                  </div>
                  {heatmapHours.map((h) => {
                    const cnt = getHeatmapCount(h, code);
                    const intensity = cnt / maxHeatmapVal;
                    let bg = 'bg-muted/30 dark:bg-muted/20 text-transparent';
                    if (cnt > 0) {
                      if (intensity > 0.6) {
                        bg = 'bg-rose-500/85 text-white font-bold shadow-sm';
                      } else if (intensity > 0.3) {
                        bg = 'bg-amber-500/35 text-amber-700 dark:text-amber-300 font-bold';
                      } else {
                        bg = 'bg-brand/25 text-brand font-medium';
                      }
                    }
                    return (
                      <div
                        key={h}
                        className={`h-7 rounded flex items-center justify-center transition-all ${bg}`}
                        title={`${code} at ${h}:00 — ${cnt} incidents`}
                      >
                        {cnt > 0 ? cnt : ''}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. INTEGRITY STATUS PER EXAM (stacked bars) + TRUST SCORE HISTOGRAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stacked Bar Chart: Integrity Status Split Per Exam */}
        <div
          role="region"
          aria-label="Integrity status split per assessment stacked bar chart"
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-500" />
              <span>Integrity Status Split by Assessment</span>
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Clean vs Flagged vs Disqualified candidates per exam
            </p>
          </div>

          <div className="h-64 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.integritySplit ?? []}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="exam_title"
                  stroke={axisStroke}
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(t: string) => t.slice(0, 12) + '...'}
                />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-surface/98 p-3 text-xs font-mono shadow-xl space-y-1">
                          <p className="text-foreground font-bold">{item.exam_title}</p>
                          <p className="text-emerald-500 font-medium">Clean: {item.clean_count}</p>
                          <p className="text-amber-500 font-medium">Flagged: {item.flagged_count}</p>
                          <p className="text-rose-500 font-medium">Disqualified: {item.disqualified_count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Bar dataKey="clean_count" name="Clean" stackId="a" fill="#10B981" />
                <Bar dataKey="flagged_count" name="Flagged" stackId="a" fill="#F59E0B" />
                <Bar dataKey="disqualified_count" name="Disqualified" stackId="a" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="sr-only">
            {(data?.integritySplit ?? []).map((e) => `${e.exam_title}: ${e.clean_count} clean, ${e.flagged_count} flagged, ${e.disqualified_count} disqualified`).join('; ')}
          </div>
        </div>

        {/* Histogram: Average Trust Score Distribution */}
        <div
          role="region"
          aria-label="Candidate trust score distribution histogram"
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4"
        >
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand" />
              <span>Candidate Trust Score Distribution</span>
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Population distribution across integrity tiers
            </p>
          </div>

          <div className="h-64 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.5} vertical={false} />
                <XAxis dataKey="range" stroke={axisStroke} fontSize={10} tickLine={false} />
                <YAxis stroke={axisStroke} fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-border bg-surface/98 p-2.5 text-xs font-mono shadow-xl">
                          <p className="text-foreground font-bold">Bucket: {item.range}</p>
                          <p className="text-brand font-medium">{item.count} Candidates</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" name="Candidate Count" radius={[6, 6, 0, 0]}>
                  {histogramData.map((entry, idx) => (
                    <Cell key={`hist-${idx}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="sr-only">
            {histogramData.map((h) => `Score ${h.range}: ${h.count} candidates`).join('; ')}
          </div>
        </div>
      </div>

      {/* 5. TOP 10 MOST-FLAGGED SESSIONS LEADERBOARD */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-rose-500" />
              <span>Top 10 High-Risk Flagged Candidate Leaderboard</span>
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Candidate sessions with the highest incident frequencies and lowest integrity ratings
            </p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">Real-time Ranking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface-elevated text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 w-12 text-center">Rank</th>
                <th className="p-3">Candidate</th>
                <th className="p-3">Assessment</th>
                <th className="p-3 text-center">Trust Score</th>
                <th className="p-3 text-center">Incidents</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Infraction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.leaderboard ?? []).map((row, idx) => (
                <tr key={row.session_id} className="hover:bg-muted/40 transition-colors">
                  <td className="p-3 text-center font-bold text-rose-500">
                    #{idx + 1}
                  </td>
                  <td className="p-3 font-medium text-foreground">
                    {row.student_name}
                    <div className="text-[10px] text-muted-foreground">{row.student_email}</div>
                  </td>
                  <td className="p-3 text-muted-foreground truncate max-w-xs">{row.exam_title}</td>
                  <td className="p-3 text-center font-bold tabular-nums">
                    <span
                      className={
                        row.trust_score < 70
                          ? 'text-rose-500'
                          : row.trust_score < 85
                          ? 'text-amber-500'
                          : 'text-emerald-500'
                      }
                    >
                      {row.trust_score}%
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold font-mono text-rose-500">
                    {row.total_violations}
                    {Number(row.pending_violations) > 0 && (
                      <span className="text-[10px] text-amber-500 ml-1">
                        ({row.pending_violations} pending)
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusPill status={row.status} size="sm" />
                  </td>
                  <td className="p-3 text-muted-foreground text-[11px]">
                    {row.last_violation_at ? new Date(row.last_violation_at).toLocaleTimeString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
