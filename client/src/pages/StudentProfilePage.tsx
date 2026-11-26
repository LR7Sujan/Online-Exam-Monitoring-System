import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Video,
  Award,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../lib/api';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../components/ui/EmptyState';
import { ChartTooltip, useChartTheme } from '../components/charts/shared';
import type { StudentProfileData, StudentAttendedExamItem } from '../types/domain';

const VIOLATION_COLORS = [
  '#f43f5e', // rose-500
  '#fb923c', // orange-400
  '#facc15', // yellow-400
  '#a855f7', // purple-500
  '#38bdf8', // sky-400
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
];

export function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const studentId = Number(id);
  const chartTheme = useChartTheme();

  const isProctor = location.pathname.startsWith('/proctor');
  const basePath = isProctor ? `/proctor/students` : `/admin/students`;

  // Fetch Student Profile Data
  const profileQuery = useQuery<StudentProfileData>({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.get<StudentProfileData>(`/students/${studentId}`),
    enabled: studentId > 0,
  });

  // Fetch Attended Sessions
  const sessionsQuery = useQuery<StudentAttendedExamItem[]>({
    queryKey: ['student-sessions', studentId],
    queryFn: () => api.get<StudentAttendedExamItem[]>(`/students/${studentId}/sessions`),
    enabled: studentId > 0,
  });

  if (profileQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full font-mono">
        <PageSkeleton />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full font-mono">
        <ErrorState
          title="Student Profile Not Found"
          description={profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to locate student records.'}
          onRetry={() => profileQuery.refetch()}
        />
      </div>
    );
  }

  const { student, kpis, progress, violationsByType } = profileQuery.data;
  const sessions = sessionsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full font-mono">
      {/* Breadcrumbs & Header Bar */}
      <div className="flex flex-col gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Student Audit</span>
          </button>
          <span>/</span>
          <span className="text-foreground font-semibold truncate">{student.name}</span>
        </div>

        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand/10 border-2 border-brand/40 text-brand flex items-center justify-center font-bold text-2xl uppercase shrink-0 shadow-sm">
              {student.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight" data-testid="student-profile-name">
                  {student.name}
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full border border-brand/30 bg-brand/10 text-brand font-bold">
                  STUDENT #{student.id}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>{student.email}</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Joined {new Date(student.joinedAt).toLocaleDateString()}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Exams Attended</span>
          <div className="text-2xl font-black text-foreground mt-2">{kpis.examsAttended}</div>
          <span className="text-[10px] text-muted-foreground mt-1">Total recorded attempts</span>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Average Score</span>
          <div className={`text-2xl font-black mt-2 ${
            kpis.avgScore !== null && kpis.avgScore >= 75 ? 'text-emerald-400' : kpis.avgScore !== null && kpis.avgScore >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {kpis.avgScore !== null ? `${kpis.avgScore}%` : 'N/A'}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Across graded papers</span>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Average Trust</span>
          <div className={`text-2xl font-black mt-2 ${
            kpis.avgTrust !== null && kpis.avgTrust >= 80 ? 'text-emerald-400' : kpis.avgTrust !== null && kpis.avgTrust >= 60 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {kpis.avgTrust !== null ? `${kpis.avgTrust}%` : 'N/A'}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Zero-trust baseline</span>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Violations</span>
          <div className={`text-2xl font-black mt-2 ${kpis.totalViolations > 0 ? 'text-rose-400' : 'text-foreground'}`}>
            {kpis.totalViolations}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Logged proctoring events</span>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Clean Rate</span>
          <div className="text-2xl font-black text-emerald-400 mt-2">{kpis.cleanRate}%</div>
          <span className="text-[10px] text-muted-foreground mt-1">Fully unflagged exams</span>
        </div>
      </div>

      {/* Charts Row: Progress Timeline + Violations Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Progress Chart (Score & Trust per exam over time) */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl border border-border bg-surface shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-bold text-foreground">Longitudinal Performance & Trust Trajectory</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">Score % vs Trust %</span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-4">
            {progress.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No examination history recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progress} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="trustGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridlines} />
                  <XAxis
                    dataKey="subjectCode"
                    stroke={chartTheme.axisLines}
                    tick={{ fill: chartTheme.axisText, fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={chartTheme.axisLines}
                    tick={{ fill: chartTheme.axisText, fontSize: 11 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    name="Score %"
                    dataKey="score"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#10b981' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="Trust %"
                    dataKey="trustScore"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#8b5cf6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Violations-by-type Donut Chart */}
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-surface shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-foreground">Violation Breakdown</h2>
            </div>
            <span className="text-[11px] text-muted-foreground">{kpis.totalViolations} logged</span>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2 flex items-center justify-center">
            {violationsByType.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-xs text-muted-foreground gap-1.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mb-1" />
                <span className="font-bold text-emerald-400">Zero Violations Logged</span>
                <span>Candidate maintains a pristine integrity audit.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={violationsByType}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {violationsByType.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.code}`}
                        fill={VIOLATION_COLORS[index % VIOLATION_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    layout="horizontal"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Attended Examinations Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-brand" />
            <span>Attended Examinations ({sessions.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground">Click any examination to open the forensic Scorecard</span>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            title="No Examinations Attended"
            description="Candidate has not participated in any formal proctored examinations yet."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-md">
            <table className="w-full text-left text-xs text-foreground border-collapse" data-testid="attended-exams-table">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/70 text-muted-foreground uppercase tracking-wider text-[11px]">
                  <th scope="col" className="p-3.5 pl-4">Subject & Title</th>
                  <th scope="col" className="p-3.5">Date</th>
                  <th scope="col" className="p-3.5">Score / Total</th>
                  <th scope="col" className="p-3.5">Percent</th>
                  <th scope="col" className="p-3.5">Trust %</th>
                  <th scope="col" className="p-3.5">Integrity Chip</th>
                  <th scope="col" className="p-3.5 text-center">Violations</th>
                  <th scope="col" className="p-3.5 text-center">Warnings</th>
                  <th scope="col" className="p-3.5 pr-4 text-right">Recording</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sessions.map((sess) => {
                  const targetUrl = `${basePath}/${student.id}/exams/${sess.sessionId}`;
                  return (
                    <tr
                      key={sess.sessionId}
                      data-testid={`session-row-${sess.sessionId}`}
                      onClick={() => navigate(targetUrl)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      {/* Subject & Title */}
                      <td className="p-3.5 pl-4">
                        <div className="min-w-0">
                          <div className="font-bold text-foreground group-hover:text-brand transition-colors flex items-center gap-2">
                            <span>{sess.examTitle}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            {sess.subjectCode} • Session #{sess.sessionId}
                          </div>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-muted-foreground text-[11px]">
                        {new Date(sess.date).toLocaleDateString()}
                      </td>

                      {/* Score / Total */}
                      <td className="p-3.5 font-bold text-foreground">
                        {sess.rawScore !== null ? `${sess.rawScore} / ${sess.totalMarks ?? '--'}` : '--'}
                      </td>

                      {/* Percent */}
                      <td className="p-3.5">
                        {sess.percentage !== null ? (
                          <span className={`font-bold ${
                            sess.percentage >= 75 ? 'text-emerald-400' : sess.percentage >= 50 ? 'text-amber-400' : 'text-rose-400'
                          }`}>
                            {sess.percentage}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Trust % */}
                      <td className="p-3.5">
                        <span className={`font-bold ${
                          sess.trustScore >= 80 ? 'text-emerald-400' : sess.trustScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {sess.trustScore}%
                        </span>
                      </td>

                      {/* Integrity Chip */}
                      <td className="p-3.5">
                        {sess.integrityStatus === 'DISQUALIFIED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-400">
                            <ShieldAlert className="w-3 h-3" />
                            Disqualified
                          </span>
                        ) : sess.integrityStatus === 'FLAGGED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/40 bg-amber-500/10 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Clean
                          </span>
                        )}
                      </td>

                      {/* Violations count */}
                      <td className="p-3.5 text-center font-bold text-foreground">
                        {sess.violationsCount > 0 ? (
                          <span className="text-rose-400">{sess.violationsCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      {/* Warnings count */}
                      <td className="p-3.5 text-center font-bold text-foreground">
                        {sess.warningsCount > 0 ? (
                          <span className="text-amber-400">{sess.warningsCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      {/* Recording Icon */}
                      <td className="p-3.5 pr-4 text-right">
                        {sess.hasRecording ? (
                          <span
                            title="Webcam recording available"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-brand/40 bg-brand/10 text-brand text-[10px] font-bold"
                          >
                            <Video className="w-3 h-3 text-brand" />
                            <span>Video</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">No Video</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
