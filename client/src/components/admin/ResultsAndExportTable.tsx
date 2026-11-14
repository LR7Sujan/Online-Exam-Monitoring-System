import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Shield,
} from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';
import { NeonButton } from '../ui/NeonButton';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState, ErrorState } from '../ui/EmptyState';
import { api, axiosInstance } from '../../lib/api';
import type { ExamItem, ResultRecord } from '../../types/domain';

export function ResultsAndExportTable() {
  const [selectedExamId, setSelectedExamId] = useState<string>('ALL');
  const [integrityFilter, setIntegrityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Exams for Filter Dropdown
  const examsQuery = useQuery({
    queryKey: ['admin-exams-list'],
    queryFn: () => api.get<ExamItem[]>('/exams'),
  });

  // 2. Fetch Graded Results from /api/admin/results
  const resultsQuery = useQuery({
    queryKey: ['admin-results-table'],
    queryFn: () => api.get<ResultRecord[]>('/admin/results'),
    refetchInterval: 15000,
  });

  const exams = examsQuery.data ?? [];
  const results = resultsQuery.data ?? [];

  // Filter Results
  const filteredResults = results.filter((r) => {
    // Filter by Exam ID
    if (selectedExamId !== 'ALL' && String(r.exam_title ?? '') !== selectedExamId) {
      const ex = exams.find((e) => String(e.id) === selectedExamId);
      if (ex && r.exam_title !== ex.title) return false;
    }

    // Filter by Integrity Status
    if (integrityFilter !== 'ALL' && r.integrity_status !== integrityFilter) {
      return false;
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (r.student_name ?? '').toLowerCase();
      const email = (r.student_email ?? '').toLowerCase();
      const title = (r.exam_title ?? '').toLowerCase();
      return name.includes(q) || email.includes(q) || title.includes(q);
    }

    return true;
  });

  // CSV Export Trigger
  const handleExportCsv = async () => {
    try {
      const response = await axiosInstance.get('/admin/audit-report/export', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `proctoriq-audit-report-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // PDF Export Trigger (Invokes dedicated printable layout)
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Action Bar: Filters + CSV & PDF Export Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Exam Selector */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
          >
            <option value="ALL">All Examinations ({exams.length})</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>

          {/* Integrity Filter Tabs */}
          {(['ALL', 'CLEAN', 'FLAGGED', 'DISQUALIFIED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setIntegrityFilter(st)}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                integrityFilter === st
                  ? st === 'CLEAN'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : st === 'FLAGGED'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                    : st === 'DISQUALIFIED'
                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm'
                    : 'bg-brand text-white shadow-sm'
                  : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search & Export Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
            />
          </div>

          {/* CSV Export Button */}
          <NeonButton
            variant="primary"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
            onClick={handleExportCsv}
          >
            Export CSV
          </NeonButton>

          {/* PDF Export Button */}
          <NeonButton
            variant="secondary"
            size="sm"
            leftIcon={<Printer className="w-4 h-4" />}
            onClick={handlePrintPdf}
          >
            Print / PDF
          </NeonButton>
        </div>
      </div>

      {/* Graded Results Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Printable Header for PDF */}
        <div className="hidden print:block p-6 border-b border-black text-black">
          <h1 className="text-2xl font-bold">ProctorIQ — Candidate Integrity & Examination Audit Report</h1>
          <p className="text-xs text-gray-600">Generated: {new Date().toLocaleString()} • Authoritative MySQL DBMS Ledger</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface-elevated text-[11px] uppercase tracking-wider text-muted-foreground print:text-black print:bg-gray-100">
              <tr>
                <th className="p-3.5 w-16 text-center">Session</th>
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Assessment</th>
                <th className="p-3.5 text-center">Score / Total</th>
                <th className="p-3.5 text-center">Percentage</th>
                <th className="p-3.5 text-center">Final Trust</th>
                <th className="p-3.5">Integrity Status</th>
                <th className="p-3.5 text-right">Graded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:text-black">
              {resultsQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td className="p-3.5"><Skeleton className="h-4 w-10 mx-auto rounded" /></td>
                    <td className="p-3.5 space-y-1">
                      <Skeleton className="h-4 w-28 rounded" />
                      <Skeleton className="h-3 w-36 rounded" />
                    </td>
                    <td className="p-3.5"><Skeleton className="h-4 w-32 rounded" /></td>
                    <td className="p-3.5 text-center"><Skeleton className="h-4 w-14 mx-auto rounded" /></td>
                    <td className="p-3.5 text-center"><Skeleton className="h-4 w-12 mx-auto rounded" /></td>
                    <td className="p-3.5 text-center"><Skeleton className="h-4 w-12 mx-auto rounded" /></td>
                    <td className="p-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="p-3.5 text-right"><Skeleton className="h-4 w-24 ml-auto rounded" /></td>
                  </tr>
                ))
              ) : resultsQuery.isError ? (
                <tr>
                  <td colSpan={8} className="p-8">
                    <ErrorState
                      title="Failed to Load Graded Results"
                      description="Unable to fetch results ledger from MySQL. Verify connection and retry."
                      onRetry={() => resultsQuery.refetch()}
                    />
                  </td>
                </tr>
              ) : filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8">
                    <EmptyState
                      icon={<Shield className="w-8 h-8 text-brand" />}
                      title="No Graded Results Match Criteria"
                      description="No examination records match the selected assessment or integrity status filter."
                      action={{
                        label: 'Reset Filters',
                        onClick: () => {
                          setSelectedExamId('ALL');
                          setIntegrityFilter('ALL');
                          setSearchQuery('');
                        },
                      }}
                    />
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => {
                  const rawScore = Number(r.raw_score ?? 0);
                  const totalMarks = Number(r.total_marks ?? 100);
                  const trust = Number(r.final_trust_score ?? 100);

                  return (
                    <tr key={r.session_id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3.5 text-center font-bold text-muted-foreground tabular-nums">
                        #{r.session_id}
                      </td>

                      <td className="p-3.5 font-medium text-foreground print:text-black">
                        {r.student_name ?? 'Candidate'}
                        <div className="text-[10px] text-muted-foreground">{r.student_email}</div>
                      </td>

                      <td className="p-3.5 text-muted-foreground truncate max-w-xs print:text-black" title={r.exam_title}>
                        {r.exam_title}
                      </td>

                      <td className="p-3.5 text-center font-medium text-foreground tabular-nums print:text-black">
                        {rawScore} / {totalMarks}
                      </td>

                      <td className="p-3.5 text-center font-bold text-brand tabular-nums print:text-black">
                        {Number(r.percentage).toFixed(1)}%
                      </td>

                      <td className="p-3.5 text-center font-bold tabular-nums">
                        <span
                          className={
                            trust < (r.min_trust_score ?? 50)
                              ? 'text-rose-500'
                              : trust < 85
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }
                        >
                          {trust}%
                        </span>
                      </td>

                      <td className="p-3.5">
                        <StatusPill status={r.integrity_status} size="sm" />
                      </td>

                      <td className="p-3.5 text-muted-foreground text-[11px] text-right whitespace-nowrap">
                        {new Date(r.graded_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
