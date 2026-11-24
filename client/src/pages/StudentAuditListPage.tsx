import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Download,
  ArrowUpDown,
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { NeonButton } from '../components/ui/NeonButton';
import { PageSkeleton } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import type { StudentListResponse } from '../types/domain';

export function StudentAuditListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith('/admin') ? '/admin/students' : '/proctor/students';

  // Filters & State
  const [search, setSearch] = useState('');
  const [integrityStatus, setIntegrityStatus] = useState<'ALL' | 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED'>('ALL');
  const [attendance, setAttendance] = useState<'ALL' | 'ATTENDED' | 'NEVER_ATTENDED'>('ALL');
  const [trustMin, setTrustMin] = useState<number>(0);
  const [trustMax, setTrustMax] = useState<number>(100);
  const [sortBy, setSortBy] = useState<
    'name' | 'email' | 'examsAttended' | 'avgScore' | 'avgTrust' | 'lastExamDate' | 'violations' | 'warnings' | 'createdAt'
  >('name');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Fetch students list
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page,
      limit: pageSize,
      sortBy,
      sortDir,
    };
    if (search.trim()) params.search = search.trim();
    if (integrityStatus !== 'ALL') params.integrityStatus = integrityStatus;
    if (attendance !== 'ALL') params.attendance = attendance;
    if (trustMin > 0) params.trustMin = trustMin;
    if (trustMax < 100) params.trustMax = trustMax;
    return params;
  }, [page, pageSize, sortBy, sortDir, search, integrityStatus, attendance, trustMin, trustMax]);

  const { data, isLoading, isError, error, refetch } = useQuery<StudentListResponse>({
    queryKey: ['students-audit-list', queryParams],
    queryFn: () => api.get<StudentListResponse>('/students', { params: queryParams }),
  });

  const students = data?.students ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // CSV Export
  const handleExportCsv = () => {
    const token = useAuthStore.getState().token;
    const apiBase = import.meta.env.VITE_API_URL ?? '/api';
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (search.trim()) params.set('search', search.trim());
    if (integrityStatus !== 'ALL') params.set('integrityStatus', integrityStatus);
    if (attendance !== 'ALL') params.set('attendance', attendance);
    if (trustMin > 0) params.set('trustMin', String(trustMin));
    if (trustMax < 100) params.set('trustMax', String(trustMax));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    const exportUrl = `${apiBase}/students?${params.toString()}`;
    // Fetch blob with auth headers to trigger secure download
    fetch(exportUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('CSV export failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `student_audit_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Export error:', err);
      });
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setIntegrityStatus('ALL');
    setAttendance('ALL');
    setTrustMin(0);
    setTrustMax(100);
    setSortBy('name');
    setSortDir('ASC');
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full font-mono">
      {/* Top Banner / Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
            <span>Surveillance</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Student Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Users className="w-7 h-7 text-brand" />
            Candidate Intelligence & Audit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Authoritative longitudinal performance, trust histories, and examination telemetry across all registered students.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="export-csv-btn"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-brand" />
            <span>Export CSV</span>
          </button>

          <NeonButton
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </NeonButton>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-border/80 bg-surface shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="student-search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by candidate name or email..."
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand font-mono"
            />
          </div>

          {/* Integrity Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:block" />
            <select
              data-testid="filter-integrity-status"
              value={integrityStatus}
              onChange={(e) => {
                setIntegrityStatus(e.target.value as typeof integrityStatus);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-brand font-mono cursor-pointer"
            >
              <option value="ALL">All Integrity Statuses</option>
              <option value="CLEAN">Clean Only</option>
              <option value="FLAGGED">Flagged In Review</option>
              <option value="DISQUALIFIED">Disqualified / Terminated</option>
            </select>
          </div>

          {/* Attendance Filter */}
          <div>
            <select
              data-testid="filter-attendance"
              value={attendance}
              onChange={(e) => {
                setAttendance(e.target.value as typeof attendance);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs rounded-xl border border-border bg-surface-elevated text-foreground focus:outline-none focus:ring-2 focus:ring-brand font-mono cursor-pointer"
            >
              <option value="ALL">All Attendance States</option>
              <option value="ATTENDED">Attended Exams (&gt;0)</option>
              <option value="NEVER_ATTENDED">Never Attended (0 exams)</option>
            </select>
          </div>

          {/* Trust Threshold Range Filter */}
          <div className="flex items-center gap-2 bg-surface-elevated px-3 rounded-xl border border-border">
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Trust Range:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={trustMin}
              onChange={(e) => {
                setTrustMin(Number(e.target.value));
                setPage(1);
              }}
              className="w-14 h-8 px-1 text-center text-xs rounded border border-border bg-surface text-foreground font-mono"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <input
              type="number"
              min="0"
              max="100"
              value={trustMax}
              onChange={(e) => {
                setTrustMax(Number(e.target.value));
                setPage(1);
              }}
              className="w-14 h-8 px-1 text-center text-xs rounded border border-border bg-surface text-foreground font-mono"
            />
            <span className="text-[11px] text-muted-foreground">%</span>
          </div>
        </div>

        {(search || integrityStatus !== 'ALL' || attendance !== 'ALL' || trustMin > 0 || trustMax < 100) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
            <span className="text-muted-foreground">Active filters applied</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-brand hover:underline font-bold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table / Data View */}
      {isLoading ? (
        <PageSkeleton />
      ) : isError ? (
        <ErrorState
          title="Failed to Load Student Audit Directory"
          description={error instanceof Error ? error.message : 'Database query returned an unexpected failure.'}
          onRetry={() => refetch()}
        />
      ) : students.length === 0 ? (
        <EmptyState
          title="No Candidates Found"
          description="No student records match the active search criteria or filters."
          action={{
            label: 'Clear Filters',
            onClick: resetFilters,
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-md">
            <table className="w-full text-left text-xs text-foreground border-collapse" data-testid="student-audit-table">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/70 text-muted-foreground uppercase tracking-wider text-[11px]">
                  <th scope="col" className="p-3.5 pl-4 cursor-pointer hover:text-foreground" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1.5">
                      <span>Candidate</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('examsAttended')}>
                    <div className="flex items-center gap-1.5">
                      <span>Exams</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('avgScore')}>
                    <div className="flex items-center gap-1.5">
                      <span>Avg Score</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground" onClick={() => handleSort('avgTrust')}>
                    <div className="flex items-center gap-1.5">
                      <span>Avg Trust</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5">
                    Integrity Status
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground hidden md:table-cell" onClick={() => handleSort('lastExamDate')}>
                    <div className="flex items-center gap-1.5">
                      <span>Last Exam</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground text-center" onClick={() => handleSort('violations')}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Violations</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 cursor-pointer hover:text-foreground text-center" onClick={() => handleSort('warnings')}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Warnings</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th scope="col" className="p-3.5 pr-4 text-right">
                    Live Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {students.map((student) => {
                  const worst = student.worstIntegrityStatus;
                  return (
                    <tr
                      key={student.id}
                      data-testid={`student-row-${student.id}`}
                      onClick={() => navigate(`${basePath}/${student.id}`)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      {/* Name & Email & ID */}
                      <td className="p-3.5 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/30 text-brand flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-foreground group-hover:text-brand transition-colors truncate">
                              {student.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
                              <span>{student.email}</span>
                              <span className="text-[10px] text-muted-foreground/60 border-l border-border pl-1.5">
                                ID: #{student.id}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Exams Attended */}
                      <td className="p-3.5 font-bold text-foreground">
                        {student.examsAttended}
                      </td>

                      {/* Avg Score */}
                      <td className="p-3.5">
                        {student.avgScore !== null ? (
                          <span
                            className={`font-bold ${
                              student.avgScore >= 75
                                ? 'text-emerald-400'
                                : student.avgScore >= 50
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {student.avgScore}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Avg Trust */}
                      <td className="p-3.5">
                        {student.avgTrust !== null ? (
                          <span
                            className={`font-bold ${
                              student.avgTrust >= 80
                                ? 'text-emerald-400'
                                : student.avgTrust >= 60
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                            }`}
                          >
                            {student.avgTrust}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </td>

                      {/* Worst Integrity Chip */}
                      <td className="p-3.5">
                        {worst === 'DISQUALIFIED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-400">
                            <ShieldAlert className="w-3 h-3" />
                            Disqualified
                          </span>
                        ) : worst === 'FLAGGED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/40 bg-amber-500/10 text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                          </span>
                        ) : worst === 'CLEAN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Clean
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">No Records</span>
                        )}
                      </td>

                      {/* Last Exam Date */}
                      <td className="p-3.5 text-muted-foreground text-[11px] hidden md:table-cell">
                        {student.lastExamDate ? (
                          <span title={new Date(student.lastExamDate).toLocaleString()}>
                            {new Date(student.lastExamDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Never</span>
                        )}
                      </td>

                      {/* Total Violations */}
                      <td className="p-3.5 text-center font-bold text-foreground">
                        {student.totalViolations > 0 ? (
                          <span className="text-rose-400 font-bold">{student.totalViolations}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      {/* Total Warnings */}
                      <td className="p-3.5 text-center font-bold text-foreground">
                        {student.totalWarnings > 0 ? (
                          <span className="text-amber-400 font-bold">{student.totalWarnings}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>

                      {/* Live Badge */}
                      <td className="p-3.5 pr-4 text-right">
                        {student.isCurrentlyActive ? (
                          <button
                            type="button"
                            data-testid={`live-badge-${student.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/proctor?session=${student.activeSessionId}`);
                            }}
                            title="Candidate currently in active session. Click to view Live Monitor."
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border border-rose-500/60 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-all cursor-pointer shadow-xs animate-pulse"
                          >
                            <Radio className="w-3 h-3 text-rose-400" />
                            <span>Live</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 uppercase">Idle</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-1 text-xs text-muted-foreground font-mono">
            <div>
              Showing <span className="font-bold text-foreground">{students.length}</span> of{' '}
              <span className="font-bold text-foreground">{total}</span> candidates
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-border bg-surface hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground transition-colors cursor-pointer"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 text-xs font-bold text-foreground">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-border bg-surface hover:bg-muted disabled:opacity-40 disabled:pointer-events-none text-foreground transition-colors cursor-pointer"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
