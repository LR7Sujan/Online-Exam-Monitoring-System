import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Keyboard,
  RotateCcw,
  Search,
  Shield,
} from 'lucide-react';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusPill } from '../ui/StatusPill';
import { NeonButton } from '../ui/NeonButton';
import { ParticleBurst } from '../ui/ParticleBurst';
import { api } from '../../lib/api';
import { playPingSound } from '../../utils/audioAlert';
import type { ReviewStatus, ViolationAuditRow } from '../../types/domain';

interface ReviewQueueTableProps {
  onInspectStudent?: (sessionId: number) => void;
}

export function ReviewQueueTable({ onInspectStudent }: ReviewQueueTableProps) {
  const queryClient = useQueryClient();

  // Filters & Search
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'DISMISSED'>('PENDING');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected IDs for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Recently Restored Score Animation tracker (map of sessionId -> score)
  const [animatingScores, setAnimatingScores] = useState<Record<number, { before: number; after: number }>>({});

  // Fetch from vw_ViolationAuditReport
  const auditQuery = useQuery({
    queryKey: ['proctor-audit-report', reviewFilter, severityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (reviewFilter !== 'ALL') params.set('reviewStatus', reviewFilter);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      params.set('limit', '100');
      return api.get<ViolationAuditRow[]>(`/proctor/audit-report?${params.toString()}`);
    },
    refetchInterval: 12000,
  });

  const logs = auditQuery.data ?? [];

  // Filter logs locally by search query
  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.student_name.toLowerCase().includes(q) ||
      log.student_email.toLowerCase().includes(q) ||
      log.violation_code.toLowerCase().includes(q) ||
      log.exam_title.toLowerCase().includes(q)
    );
  });

  // Single review mutation
  const reviewMutation = useMutation({
    mutationFn: (vars: { logId: number; reviewStatus: ReviewStatus }) =>
      api.patch(`/proctor/logs/${vars.logId}/review`, {
        reviewStatus: vars.reviewStatus,
        reviewNotes: `Reviewed via Queue (${vars.reviewStatus})`,
      }),
    onSuccess: (data: unknown, vars) => {
      const updated = data as ViolationAuditRow;
      if (vars.reviewStatus === 'CONFIRMED') {
        playPingSound('confirm');
      } else {
        playPingSound('reinstate');
        if (updated?.session_id && typeof updated.current_trust_score === 'number') {
          // Track animated score increase
          setAnimatingScores((prev) => ({
            ...prev,
            [updated.session_id]: {
              before: Math.max(0, updated.current_trust_score - updated.penalty_applied),
              after: updated.current_trust_score,
            },
          }));
        }
      }
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    },
  });

  // Bulk review mutation
  const bulkReviewMutation = useMutation({
    mutationFn: (vars: { logIds: number[]; status: ReviewStatus }) =>
      api.post('/proctor/logs/bulk-review', {
        logIds: vars.logIds,
        status: vars.status,
      }),
    onSuccess: (_, vars) => {
      if (vars.status === 'CONFIRMED') {
        playPingSound('confirm');
      } else {
        playPingSound('reinstate');
      }
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['proctor-audit-report'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
    },
  });

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredLogs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLogs.map((l) => l.log_id));
    }
  };

  const handleToggleRow = (logId: number) => {
    setSelectedIds((prev) =>
      prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]
    );
  };

  // Keyboard Shortcuts Handler: C = confirm, D = dismiss, Up/Down = navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing into an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (filteredLogs.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveRowIndex((prev) => Math.min(filteredLogs.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveRowIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'c' || e.key === 'C') {
        const activeLog = filteredLogs[activeRowIndex];
        if (activeLog && activeLog.proctor_review_status === 'PENDING') {
          e.preventDefault();
          reviewMutation.mutate({ logId: activeLog.log_id, reviewStatus: 'CONFIRMED' });
        }
      } else if (e.key === 'd' || e.key === 'D') {
        const activeLog = filteredLogs[activeRowIndex];
        if (activeLog && activeLog.proctor_review_status !== 'DISMISSED') {
          e.preventDefault();
          reviewMutation.mutate({ logId: activeLog.log_id, reviewStatus: 'DISMISSED' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredLogs, activeRowIndex, reviewMutation]);

  return (
    <div className="space-y-4" data-source="vw_ViolationAuditReport">
      {/* Top Filter Bar + Search + Keyboard Legend */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        {/* Review Status Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['PENDING', 'ALL', 'CONFIRMED', 'DISMISSED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setReviewFilter(st);
                setSelectedIds([]);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                reviewFilter === st
                  ? 'bg-brand text-white shadow-sm'
                  : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
              }`}
            >
              {st === 'PENDING' ? 'Pending Audit' : st}
            </button>
          ))}

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {/* Search Input & Keyboard Hint */}
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, exam, or code..."
              className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-[11px] font-mono text-brand shadow-sm shrink-0">
            <Keyboard className="w-3.5 h-3.5" />
            <span title="SQL View: vw_ViolationAuditReport">
              <strong>[C]</strong> Confirm • <strong>[D]</strong> Dismiss • <strong>[↑/↓]</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Action Strip when items selected */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/10 p-3 text-xs font-mono text-foreground shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand">{selectedIds.length}</span>
              <span>incidents selected for bulk adjudication</span>
            </div>

            <div className="flex items-center gap-2">
              <NeonButton
                variant="primary"
                size="sm"
                isLoading={bulkReviewMutation.isPending}
                onClick={() =>
                  bulkReviewMutation.mutate({
                    logIds: selectedIds,
                    status: 'CONFIRMED',
                  })
                }
              >
                Confirm Selected ({selectedIds.length})
              </NeonButton>
              <NeonButton
                variant="ghost"
                size="sm"
                isLoading={bulkReviewMutation.isPending}
                onClick={() =>
                  bulkReviewMutation.mutate({
                    logIds: selectedIds,
                    status: 'DISMISSED',
                  })
                }
              >
                Dismiss & Restore Points ({selectedIds.length})
              </NeonButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit Table */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface-elevated text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredLogs.length > 0 &&
                      selectedIds.length === filteredLogs.length
                    }
                    onChange={handleToggleSelectAll}
                    className="accent-brand cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Candidate</th>
                <th className="p-3.5">Exam</th>
                <th className="p-3.5">Violation</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5 text-center">Penalty</th>
                <th className="p-3.5 text-center">Trust After</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-muted-foreground">
                    <Shield className="w-8 h-8 mx-auto mb-2 text-brand/40" />
                    No violations match the specified queue filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isSelected = selectedIds.includes(log.log_id);
                  const isFocused = idx === activeRowIndex;
                  const isPending = log.proctor_review_status === 'PENDING';
                  const isDismissed = log.proctor_review_status === 'DISMISSED';
                  const trust = Number(log.current_trust_score ?? 100);

                  const animScore = animatingScores[log.session_id];

                  return (
                    <tr
                      key={log.log_id}
                      onClick={() => setActiveRowIndex(idx)}
                      className={`transition-colors cursor-pointer ${
                        isFocused
                          ? 'bg-brand/10 ring-1 ring-inset ring-brand/40'
                          : isSelected
                          ? 'bg-brand/5'
                          : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(log.log_id)}
                          className="accent-brand cursor-pointer"
                        />
                      </td>

                      {/* Candidate Name & Link */}
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectStudent?.(log.session_id);
                          }}
                          className="font-medium text-foreground hover:text-brand text-left underline decoration-brand/30 cursor-pointer"
                        >
                          {log.student_name}
                        </button>
                        <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                          {log.student_email}
                        </div>
                      </td>

                      {/* Exam */}
                      <td className="p-3.5 text-muted-foreground truncate max-w-xs" title={log.exam_title}>
                        {log.exam_title}
                      </td>

                      {/* Violation Code & Label */}
                      <td className="p-3.5">
                        <span className="font-medium text-foreground">{log.violation_code}</span>
                        <div className="text-[10px] text-muted-foreground truncate max-w-xs">
                          {log.violation_label}
                        </div>
                      </td>

                      {/* Severity */}
                      <td className="p-3.5">
                        <SeverityBadge severity={log.severity} size="sm" />
                      </td>

                      {/* Penalty */}
                      <td className="p-3.5 text-center font-bold font-mono text-rose-500">
                        -{log.penalty_applied}
                      </td>

                      {/* Trust Score with Animated Restore indicator */}
                      <td className="p-3.5 text-center font-mono tabular-nums relative">
                        {animScore && <ParticleBurst count={16} />}
                        <motion.span
                          key={trust}
                          animate={
                            animScore
                              ? { scale: [1, 1.35, 1], color: ['#10B981', '#6366F1', '#10B981'] }
                              : {}
                          }
                          className={`font-bold ${
                            trust < log.min_trust_score
                              ? 'text-rose-500'
                              : trust < 85
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        >
                          {trust}%
                        </motion.span>
                      </td>

                      {/* Timestamp */}
                      <td className="p-3.5 text-muted-foreground text-[11px] whitespace-nowrap">
                        {new Date(log.occurred_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      {/* Status */}
                      <td className="p-3.5">
                        <StatusPill status={log.proctor_review_status} size="sm" />
                      </td>

                      {/* Row Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                reviewMutation.mutate({
                                  logId: log.log_id,
                                  reviewStatus: 'CONFIRMED',
                                })
                              }
                              className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                              title="Confirm Violation (Key: C)"
                            >
                              Confirm [C]
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                reviewMutation.mutate({
                                  logId: log.log_id,
                                  reviewStatus: 'DISMISSED',
                                })
                              }
                              className="rounded-lg bg-muted border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                              title="Dismiss & Restore Points via DB trigger (Key: D)"
                            >
                              Dismiss [D]
                            </button>
                          </div>
                        ) : isDismissed ? (
                          <span className="text-[10px] text-emerald-500 flex items-center justify-end gap-1 font-medium">
                            <RotateCcw className="w-3 h-3" /> Restored
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">Confirmed</span>
                        )}
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
