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
} from 'recharts';
import { StatCard } from '../ui/StatCard';
import { StatusPill } from '../ui/StatusPill';
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

const DONUT_COLORS = ['#F43F5E', '#8B5CF6', '#22D3EE', '#F59E0B', '#10B981', '#38BDF8'];

export function AdminOverviewDashboard() {
  const [daysWindow, setDaysWindow] = useState<number>(7);

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
    { range: '85-99%', count: Number(data?.trustHistogram?.bucket_85_99 ?? 0), fill: '#22D3EE' },
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
      {/* 1. TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Curated Exams"
          value={kpis.totalExams}
          accent="cyan"
          icon={<GraduationCap className="w-5 h-5 text-cyan" />}
          changeLabel="proctoring active"
          sparklineData={[1, 2, 2, 3, 4, 4, kpis.totalExams]}
        />
        <StatCard
          label="Registered Students"
          value={kpis.totalStudents}
          accent="violet"
          icon={<Users className="w-5 h-5 text-violet" />}
          changeLabel="biometric verified"
          sparklineData={[40, 45, 52, 55, 58, 60, kpis.totalStudents]}
        />
        <StatCard
          label="Monitored Sessions"
          value={kpis.totalSessions}
          accent="emerald"
          icon={<Activity className="w-5 h-5 text-emerald" />}
          changeLabel="audit logged"
          sparklineData={[25, 28, 32, 35, 38, 40, kpis.totalSessions]}
        />
        <StatCard
          label="Cheating Disqualification Rate"
          value={kpis.cheatingRate}
          suffix="%"
          decimals={1}
          accent="magenta"
          icon={<ShieldAlert className="w-5 h-5 text-magenta" />}
          changeLabel="threshold breaches"
          sparklineData={[4.2, 5.0, 6.1, 7.2, 7.0, 7.5, kpis.cheatingRate]}
        />
      </div>

      {/* 2. VIOLATIONS OVER TIME + VIOLATION TYPE DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area Chart: Violations Over Time with 7/30 Day Toggle */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan" />
                <span>Violations Telemetry Over Time</span>
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Incident velocity across active candidate assessment windows
              </p>
            </div>

            {/* 7/30 Day Toggle Button */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#080914] p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDaysWindow(7)}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  daysWindow === 7
                    ? 'bg-cyan text-void shadow-glow-cyan-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setDaysWindow(30)}
                className={`rounded-lg px-3 py-1 font-bold transition-all ${
                  daysWindow === 30
                    ? 'bg-cyan text-void shadow-glow-cyan-sm'
                    : 'text-slate-400 hover:text-white'
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
                    <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#22D3EE" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0B0D1B]/95 p-3 text-xs font-mono shadow-2xl">
                          <p className="text-white font-bold">{item.date}</p>
                          <p className="text-cyan font-semibold">
                            Violations: {item.violation_count}
                          </p>
                          <p className="text-magenta text-[11px]">
                            Points Deducted: -{item.total_penalty} PTS
                          </p>
                          <p className="text-slate-400 text-[10px]">
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
                  stroke="#22D3EE"
                  strokeWidth={2}
                  fill="url(#violationsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Animated Donut: Violation Type Distribution */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-violet" />
              <span>Violation Distribution</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Breakdown by infraction category
            </p>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.violationDistribution ?? []}
                  dataKey="count"
                  nameKey="code"
                  cx="50%"
                  cy="50%"
                  innerRadius={46}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {(data?.violationDistribution ?? []).map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0B0D1B]/95 p-2.5 text-xs font-mono shadow-xl">
                          <p className="text-white font-bold">{item.label}</p>
                          <p className="text-cyan">{item.code}: {item.count} incidents</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 text-xs font-mono max-h-24 overflow-y-auto scrollbar-thin">
            {(data?.violationDistribution ?? []).map((item, idx) => (
              <div key={item.code} className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <span className="font-bold text-white pl-2">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. VIOLATION HEATMAP (hour of day x violation type) FROM vw_ViolationHeatmap */}
      <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber" />
              <span>Circadian Incident Heatmap (vw_ViolationHeatmap)</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Aggregated frequency matrix: Hour of Day (0–23) × Infraction Type
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">SQL View Driven</span>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[700px] space-y-1.5 font-mono text-[10px]">
            {/* Hour Headers */}
            <div className="grid grid-cols-25 gap-1 text-center text-slate-400">
              <div className="text-left font-bold text-slate-300">TYPE</div>
              {heatmapHours.map((h) => (
                <div key={h}>{String(h).padStart(2, '0')}h</div>
              ))}
            </div>

            {/* Matrix Rows */}
            {heatmapCodes.length === 0 ? (
              <div className="py-6 text-center text-slate-400">No heatmap telemetry available.</div>
            ) : (
              heatmapCodes.map((code) => (
                <div key={code} className="grid grid-cols-25 gap-1 items-center">
                  <div className="truncate text-left text-slate-300 font-semibold pr-1" title={code}>
                    {code}
                  </div>
                  {heatmapHours.map((h) => {
                    const cnt = getHeatmapCount(h, code);
                    const intensity = cnt / maxHeatmapVal;
                    let bg = 'bg-white/5';
                    if (cnt > 0) {
                      if (intensity > 0.6) bg = 'bg-magenta text-white font-bold shadow-glow-magenta-sm';
                      else if (intensity > 0.3) bg = 'bg-amber text-void font-bold shadow-glow-amber-sm';
                      else bg = 'bg-cyan/40 text-white';
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
        <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald" />
              <span>Integrity Status Split by Assessment</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Clean vs Flagged vs Disqualified candidates per exam
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.integritySplit ?? []}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="exam_title"
                  stroke="#475569"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(t: string) => t.slice(0, 12) + '...'}
                />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0B0D1B]/95 p-3 text-xs font-mono shadow-xl space-y-1">
                          <p className="text-white font-bold">{item.exam_title}</p>
                          <p className="text-emerald">Clean: {item.clean_count}</p>
                          <p className="text-amber">Flagged: {item.flagged_count}</p>
                          <p className="text-magenta">Disqualified: {item.disqualified_count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Bar dataKey="clean_count" name="Clean" stackId="a" fill="#10B981" />
                <Bar dataKey="flagged_count" name="Flagged" stackId="a" fill="#F59E0B" />
                <Bar dataKey="disqualified_count" name="Disqualified" stackId="a" fill="#F43F5E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Histogram: Average Trust Score Distribution */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan" />
              <span>Candidate Trust Score Distribution</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Population distribution across integrity tiers
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={histogramData}
                margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="range" stroke="#475569" fontSize={10} tickLine={false} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#0B0D1B]/95 p-2.5 text-xs font-mono shadow-xl">
                          <p className="text-white font-bold">Bucket: {item.range}</p>
                          <p className="text-cyan">{item.count} Candidates</p>
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
        </div>
      </div>

      {/* 5. TOP 10 MOST-FLAGGED SESSIONS LEADERBOARD */}
      <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-magenta" />
              <span>Top 10 High-Risk Flagged Candidate Leaderboard</span>
            </h3>
            <p className="text-[11px] font-mono text-slate-400">
              Candidate sessions with the highest incident frequencies and lowest integrity ratings
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Real-time Ranking</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-white/10 bg-[#121528] text-[11px] uppercase tracking-wider text-slate-400">
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
            <tbody className="divide-y divide-white/5">
              {(data?.leaderboard ?? []).map((row, idx) => (
                <tr key={row.session_id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3 text-center font-bold text-magenta">
                    #{idx + 1}
                  </td>
                  <td className="p-3 font-semibold text-white">
                    {row.student_name}
                    <div className="text-[10px] text-slate-400">{row.student_email}</div>
                  </td>
                  <td className="p-3 text-slate-300 truncate max-w-xs">{row.exam_title}</td>
                  <td className="p-3 text-center font-bold">
                    <span
                      className={
                        row.trust_score < 70
                          ? 'text-magenta'
                          : row.trust_score < 85
                          ? 'text-amber'
                          : 'text-emerald'
                      }
                    >
                      {row.trust_score}%
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-magenta">
                    {row.total_violations}
                    {Number(row.pending_violations) > 0 && (
                      <span className="text-[10px] text-amber ml-1">
                        ({row.pending_violations} pending)
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusPill status={row.status} size="sm" />
                  </td>
                  <td className="p-3 text-slate-400 text-[11px]">
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
