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
import { SkeletonCard } from '../ui/Skeleton';
import { ErrorState } from '../ui/EmptyState';
import { ChartTooltip, useChartTheme } from '../charts/shared';
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
  const [hoveredDonutCode, setHoveredDonutCode] = useState<string | null>(null);
  const chartTheme = useChartTheme();

  const query = useQuery({
    queryKey: ['admin-overview-dashboard', daysWindow],
    queryFn: () => api.get<DashboardData>(`/analytics/dashboard?days=${daysWindow}`),
    refetchInterval: 20000,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-80" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Failed to Load Operational Telemetry"
        description="Could not aggregate metrics from MySQL telemetry views. Please verify database connection and retry."
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  const violationDistribution = data?.violationDistribution ?? [];
  const totalAlerts = violationDistribution.reduce((acc, v) => acc + Number(v.count || 0), 0);
  const activeDonutItem = hoveredDonutCode
    ? violationDistribution.find((v) => v.code === hoveredDonutCode) || null
    : null;
  const activePercent = activeDonutItem && totalAlerts > 0
    ? Math.round((Number(activeDonutItem.count || 0) / totalAlerts) * 100)
    : 0;
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridlines} opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke={chartTheme.axisLine}
                  tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }}
                  tickLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }} tickLine={false} />
                <Tooltip
                  {...chartTheme.lineTooltipProps}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <ChartTooltip
                          active={active}
                          title={item.date}
                          payload={[
                            { name: 'Incidents Logged', value: item.violation_count, color: chartTheme.series.indigo },
                            { name: 'Points Deducted', value: `-${item.total_penalty} PTS`, color: chartTheme.series.rose },
                            { name: 'Impacted Candidates', value: item.impacted_sessions, color: chartTheme.series.amber },
                          ]}
                        />
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

          <div className="h-56 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    totalAlerts === 0
                      ? [{ code: 'NO_DATA', label: 'No data', count: 1, isPlaceholder: true }]
                      : violationDistribution
                  }
                  dataKey="count"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={80}
                  paddingAngle={totalAlerts === 0 ? 0 : 3}
                  cornerRadius={totalAlerts === 0 ? 0 : 6}
                  onMouseEnter={(entry: unknown) => {
                    const code = (entry as { code?: string })?.code;
                    if (code && code !== 'NO_DATA') {
                      setHoveredDonutCode(code);
                    }
                  }}
                  onMouseLeave={() => setHoveredDonutCode(null)}
                >
                  {totalAlerts === 0 ? (
                    <Cell fill={chartTheme.isDark ? '#27272a' : '#e4e4e7'} stroke="none" />
                  ) : (
                    violationDistribution.map((item, idx) => {
                      const isHovered = hoveredDonutCode === item.code;
                      const isAnyHovered = hoveredDonutCode !== null;
                      return (
                        <Cell
                          key={`cell-${item.code || idx}`}
                          fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                          opacity={isAnyHovered ? (isHovered ? 1 : 0.4) : 1}
                          stroke={isHovered ? (chartTheme.isDark ? '#ffffff' : '#09090b') : 'none'}
                          strokeWidth={isHovered ? 2 : 0}
                          className="transition-all duration-150 cursor-pointer focus:outline-none"
                          tabIndex={0}
                          aria-label={`${item.label}: ${item.count} alerts`}
                          onMouseEnter={() => setHoveredDonutCode(item.code)}
                          onMouseLeave={() => setHoveredDonutCode(null)}
                          onFocus={() => setHoveredDonutCode(item.code)}
                          onBlur={() => setHoveredDonutCode(null)}
                        />
                      );
                    })
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Interactive Center Hole Label */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none px-2"
              aria-live="polite"
            >
              <div className="w-[104px] max-w-[104px] text-center flex flex-col items-center justify-center overflow-hidden">
                {totalAlerts === 0 ? (
                  <span className="text-xs font-semibold text-muted-foreground">
                    No data
                  </span>
                ) : activeDonutItem ? (
                  <>
                    <span
                      className="text-[11px] font-semibold text-foreground truncate w-full leading-tight text-center px-1"
                      title={activeDonutItem.label}
                    >
                      {activeDonutItem.label}
                    </span>
                    <span className="text-xl font-bold font-mono tracking-tight tabular-nums text-foreground leading-tight mt-0.5">
                      {activeDonutItem.count}
                    </span>
                    <span className="text-[10px] font-mono text-brand font-semibold leading-tight">
                      {activePercent}%
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground leading-none">
                      {totalAlerts}
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                      ALERTS
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Legend: No scrollbar, all rows, 2 columns on wide / 1 on narrow, keyboard focusable */}
          {violationDistribution.length === 0 ? (
            <div className="pt-3 border-t border-border/50 text-center py-2 text-xs text-muted-foreground">
              No violations recorded
            </div>
          ) : (
            <div
              role="list"
              aria-label="Violation categories breakdown"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-1.5 pt-3 border-t border-border/50 text-sm font-sans"
            >
              {violationDistribution.map((item, idx) => {
                const pct = totalAlerts > 0 ? Math.round((Number(item.count || 0) / totalAlerts) * 100) : 0;
                const isSelected = hoveredDonutCode === item.code;
                const isAnySelected = hoveredDonutCode !== null;
                return (
                  <button
                    key={item.code}
                    type="button"
                    tabIndex={0}
                    onMouseEnter={() => setHoveredDonutCode(item.code)}
                    onMouseLeave={() => setHoveredDonutCode(null)}
                    onFocus={() => setHoveredDonutCode(item.code)}
                    onBlur={() => setHoveredDonutCode(null)}
                    className={`flex items-center justify-between gap-1.5 p-1.5 rounded-lg text-left transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand ${
                      isSelected
                        ? 'bg-surface-elevated text-foreground shadow-sm ring-1 ring-border'
                        : isAnySelected
                          ? 'opacity-40 text-muted-foreground hover:opacity-80'
                          : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated/40'
                    }`}
                    aria-label={`${item.label}: ${item.count} incidents, ${pct} percent`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                        style={{
                          backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length],
                          transform: isSelected ? 'scale(1.25)' : 'scale(1)',
                        }}
                      />
                      <span className="truncate text-xs font-medium text-foreground">
                        {item.label}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] shrink-0 pl-1">
                      <strong className="text-foreground font-semibold">{item.count}</strong>{' '}
                      <span className="text-muted-foreground">({pct}%)</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridlines} opacity={0.6} vertical={false} />
                <XAxis
                  dataKey="exam_title"
                  stroke={chartTheme.axisLine}
                  tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }}
                  tickLine={false}
                  tickFormatter={(t: string) => t.slice(0, 12) + '...'}
                />
                <YAxis stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }} tickLine={false} />
                <Tooltip
                  {...chartTheme.barTooltipProps}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <ChartTooltip
                          active={active}
                          title={item.exam_title}
                          payload={[
                            { name: 'Clean', value: item.clean_count, color: chartTheme.series.emerald },
                            { name: 'Flagged', value: item.flagged_count, color: chartTheme.series.amber },
                            { name: 'Disqualified', value: item.disqualified_count, color: chartTheme.series.rose },
                          ]}
                        />
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'sans-serif' }} />
                <Bar dataKey="clean_count" name="Clean" stackId="a" fill={chartTheme.series.emerald} />
                <Bar dataKey="flagged_count" name="Flagged" stackId="a" fill={chartTheme.series.amber} />
                <Bar dataKey="disqualified_count" name="Disqualified" stackId="a" fill={chartTheme.series.rose} radius={[4, 4, 0, 0]} />
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
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridlines} opacity={0.6} vertical={false} />
                <XAxis dataKey="range" stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }} tickLine={false} />
                <YAxis stroke={chartTheme.axisLine} tick={{ fill: chartTheme.axisText, fontSize: 10, fontFamily: 'sans-serif' }} tickLine={false} />
                <Tooltip
                  {...chartTheme.barTooltipProps}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <ChartTooltip
                          active={active}
                          title={`Bucket: ${item.range}`}
                          payload={[
                            {
                              name: 'Candidate Count',
                              value: `${item.count} Candidates`,
                              color: item.fill,
                            },
                          ]}
                        />
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
