import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Check,
  X,
  AlertTriangle,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api';
import { playPingSound } from '../../utils/audioAlert';
import { NeonButton } from '../ui/NeonButton';
import { Modal } from '../ui/Modal';
import type { TimeExtensionRequest } from '../../types/domain';

interface TimeExtensionRequestsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession?: (sessionId: number) => void;
}

export function TimeExtensionRequestsDrawer({
  isOpen,
  onClose,
  onSelectSession,
}: TimeExtensionRequestsDrawerProps) {
  const queryClient = useQueryClient();

  // Custom time inputs: requestId -> customMinutes
  const [customMinutesMap, setCustomMinutesMap] = useState<Record<number, number>>({});
  const [showCustomInputMap, setShowCustomInputMap] = useState<Record<number, boolean>>({});

  // Reject confirmation modal
  const [rejectModalReq, setRejectModalReq] = useState<TimeExtensionRequest | null>(null);

  // Tab: 'pending' | 'history'
  const [tab, setTab] = useState<'pending' | 'history'>('pending');

  const extensionsQuery = useQuery({
    queryKey: ['proctor-extensions'],
    queryFn: () => api.get<TimeExtensionRequest[]>('/monitor/extensions'),
    enabled: isOpen,
    refetchInterval: 5000,
  });

  const allRequests = extensionsQuery.data ?? [];
  const pendingRequests = allRequests.filter((r) => r.status === 'PENDING');
  const historyRequests = allRequests.filter((r) => r.status !== 'PENDING');

  // Decide Mutation
  const decideMutation = useMutation({
    mutationFn: (vars: { requestId: number; decision: 'APPROVED' | 'REJECTED'; grantedMinutes?: number }) =>
      api.post(`/extensions/${vars.requestId}/decide`, {
        decision: vars.decision,
        grantedMinutes: vars.grantedMinutes,
      }),
    onSuccess: (_, vars) => {
      if (vars.decision === 'APPROVED') {
        playPingSound('reinstate');
      } else {
        playPingSound('confirm');
      }
      queryClient.invalidateQueries({ queryKey: ['proctor-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-live-monitor'] });
      queryClient.invalidateQueries({ queryKey: ['proctor-kpis'] });
      setRejectModalReq(null);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to decide extension request';
      alert(msg);
    },
  });

  // Real-time expiry ticker for pending requests
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen || pendingRequests.length === 0) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isOpen, pendingRequests.length]);

  if (!isOpen) return null;

  const formatExpiry = (req: TimeExtensionRequest) => {
    const created = new Date(req.created_at).getTime();
    const elapsed = Math.floor((Date.now() - created) / 1000);
    const remaining = Math.max(0, 180 - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div role="presentation" className="fixed inset-0 z-60 overflow-hidden bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="w-screen max-w-md bg-surface border-l border-border flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span>Time Extension Requests</span>
                  {pendingRequests.length > 0 && (
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.2 text-[10px] font-mono font-bold text-amber-500">
                      {pendingRequests.length} PENDING
                    </span>
                  )}
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground">
                  Proctor review deck for exam duration extensions
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="grid grid-cols-2 p-2 border-b border-border/80 bg-surface-elevated/40 gap-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setTab('pending')}
              className={`py-1.5 px-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                tab === 'pending'
                  ? 'bg-surface border border-border text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Pending</span>
              {pendingRequests.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`py-1.5 px-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                tab === 'history'
                  ? 'bg-surface border border-border text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>History ({historyRequests.length})</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tab === 'pending' ? (
              pendingRequests.length === 0 ? (
                <div className="py-16 text-center space-y-2 text-muted-foreground font-mono text-xs">
                  <Clock className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-foreground font-semibold">No Pending Requests</p>
                  <p className="text-[11px]">When students run out of time and request extra minutes, they appear here live.</p>
                </div>
              ) : (
                pendingRequests.map((req) => {
                  const score = Number(req.trust_score ?? 100);
                  const isCustomOpen = Boolean(showCustomInputMap[req.request_id]);
                  const customMins = customMinutesMap[req.request_id] ?? req.requested_minutes;

                  return (
                    <div
                      key={req.request_id}
                      data-testid="extension-request-card"
                      className="rounded-2xl border border-amber-500/40 bg-surface-elevated/90 p-4 space-y-3.5 shadow-sm relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => onSelectSession?.(req.session_id)}
                            className="font-bold text-sm text-foreground hover:text-brand transition-colors text-left flex items-center gap-1.5 group"
                          >
                            <span>{req.student_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-brand" />
                          </button>
                          <p className="text-[11px] font-mono text-muted-foreground truncate max-w-[240px]">
                            {req.exam_title}
                          </p>
                        </div>

                        {/* Live 3-min Expiry Countdown */}
                        <div className="text-right font-mono">
                          <span className="text-[10px] text-muted-foreground block uppercase">Auto-Expires</span>
                          <span className="text-xs font-bold text-amber-500 tabular-nums">
                            {formatExpiry(req)}
                          </span>
                        </div>
                      </div>

                      {/* Metrics: Trust Score & Infractions */}
                      <div className="grid grid-cols-2 gap-2 p-2 rounded-xl border border-border bg-background/60 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Shield className={`w-3.5 h-3.5 ${score < 60 ? 'text-rose-500' : score < 80 ? 'text-amber-500' : 'text-emerald-500'}`} />
                          <span className="text-muted-foreground">Trust:</span>
                          <span className="font-bold text-foreground">{score}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${Number(req.total_violations || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          <span className="text-muted-foreground">Infractions:</span>
                          <span className="font-bold text-foreground">{req.total_violations ?? 0}</span>
                        </div>
                      </div>

                      {/* Reason (if provided) */}
                      {req.reason && (
                        <div className="text-xs font-mono text-foreground bg-surface border border-border/70 p-2.5 rounded-xl">
                          <span className="text-muted-foreground block text-[10px] uppercase">Student Reason:</span>
                          <p className="mt-0.5 italic">"{req.reason}"</p>
                        </div>
                      )}

                      {/* Custom Time Input Toggle */}
                      {isCustomOpen && (
                        <div className="p-3 rounded-xl border border-border bg-background/80 space-y-2">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-muted-foreground">Custom Minutes to Grant:</span>
                            <span className="font-bold text-brand">{customMins}m</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={req.max_extension_mins ?? 30}
                              value={customMins}
                              onChange={(e) =>
                                setCustomMinutesMap((prev) => ({
                                  ...prev,
                                  [req.request_id]: Math.max(1, parseInt(e.target.value, 10) || 1),
                                }))
                              }
                              className="w-20 rounded-lg border border-border bg-surface p-1.5 text-xs text-foreground font-mono focus:border-brand focus:outline-none text-center"
                            />
                            <div className="flex items-center gap-1 flex-1">
                              {[5, 10, 15, 20].map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() =>
                                    setCustomMinutesMap((prev) => ({ ...prev, [req.request_id]: preset }))
                                  }
                                  className={`px-2 py-1 rounded text-[10px] font-mono font-medium ${
                                    customMins === preset
                                      ? 'bg-brand text-brand-foreground'
                                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                                  }`}
                                >
                                  {preset}m
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                        {isCustomOpen ? (
                          <NeonButton
                            variant="primary"
                            size="sm"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() =>
                              decideMutation.mutate({
                                requestId: req.request_id,
                                decision: 'APPROVED',
                                grantedMinutes: customMins,
                              })
                            }
                            isLoading={decideMutation.isPending}
                            className="flex-1"
                          >
                            Approve {customMins}m
                          </NeonButton>
                        ) : (
                          <NeonButton
                            variant="primary"
                            size="sm"
                            leftIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() =>
                              decideMutation.mutate({
                                requestId: req.request_id,
                                decision: 'APPROVED',
                                grantedMinutes: req.requested_minutes,
                              })
                            }
                            isLoading={decideMutation.isPending}
                            className="flex-1"
                          >
                            Approve ({req.requested_minutes}m)
                          </NeonButton>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setShowCustomInputMap((prev) => ({
                              ...prev,
                              [req.request_id]: !prev[req.request_id],
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-xl border border-border bg-surface text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Set custom granted minutes"
                        >
                          {isCustomOpen ? 'Reset' : 'Custom'}
                        </button>

                        <button
                          type="button"
                          data-testid="reject-request-btn"
                          onClick={() => setRejectModalReq(req)}
                          className="px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs font-mono text-rose-500 hover:bg-rose-500/20 transition-colors font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* History Tab */
              historyRequests.length === 0 ? (
                <div className="py-16 text-center space-y-2 text-muted-foreground font-mono text-xs">
                  <p>No historical requests recorded.</p>
                </div>
              ) : (
                historyRequests.map((req) => (
                  <div
                    key={req.request_id}
                    className="rounded-xl border border-border bg-surface-elevated/60 p-3.5 font-mono text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-foreground">{req.student_name}</strong>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {req.status}
                        {req.status === 'APPROVED' && ` (+${req.granted_minutes}m)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{req.exam_title}</p>
                    {req.decided_by_name && (
                      <p className="text-[10px] text-muted-foreground">
                        Decided by {req.decided_by_name} •{' '}
                        {req.decided_at ? new Date(req.decided_at).toLocaleTimeString() : ''}
                      </p>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </motion.div>
      </div>

      {/* Reject Confirmation Modal */}
      {rejectModalReq && (
        <Modal
          isOpen={Boolean(rejectModalReq)}
          onClose={() => setRejectModalReq(null)}
          title="Reject Extension and Conclude Exam?"
          description="Declining this request will immediately finalize and grade the candidate's exam."
          footer={
            <>
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="py-2 px-3.5 rounded-xl text-xs font-mono font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={decideMutation.isPending}
                onClick={() =>
                  decideMutation.mutate({
                    requestId: rejectModalReq.request_id,
                    decision: 'REJECTED',
                  })
                }
                className="py-2 px-4 rounded-xl text-xs font-mono font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all cursor-pointer"
              >
                {decideMutation.isPending ? 'Ending Exam...' : 'Reject & Conclude Exam'}
              </button>
            </>
          }
        >
          <div className="space-y-3 font-mono text-xs text-foreground">
            <p>
              Candidate: <strong className="text-foreground">{rejectModalReq.student_name}</strong>
            </p>
            <p>
              Requested: <strong className="text-foreground">{rejectModalReq.requested_minutes} minutes</strong>
            </p>
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-[11px] leading-relaxed">
              <strong>Notice:</strong> The candidate will NOT be marked as cheating/disqualified. The examination status will be set to <code className="font-bold">TIMED_OUT</code> and evaluated by <code className="font-bold">sp_SubmitAndGradeExam</code> using all submitted answers.
            </div>
          </div>
        </Modal>
      )}
    </div>,
    document.body
  );
}
