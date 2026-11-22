import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api';
import { EvidenceImage } from '../ui/EvidenceImage';
import type { SessionWarning } from '../../types/domain';

interface WarningHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: number;
}

function formatPlainReason(code?: string, defaultMsg?: string): string {
  switch (code) {
    case 'MULTIPLE_FACES':
      return 'Multiple faces detected (>5s)';
    case 'PHONE_DETECTED':
      return 'Mobile phone detected';
    case 'VOICE_DETECTED':
      return 'Talking / speech detected';
    case 'NO_FACE':
      return 'No face detected in camera';
    case 'TAB_SWITCH':
      return 'Tab switched or window blurred';
    case 'FULLSCREEN_EXIT':
      return 'Exited fullscreen examination';
    case 'DEVTOOLS_OPEN':
      return 'Developer inspection tools opened';
    case 'COPY_PASTE':
      return 'Clipboard copy / paste action';
    default:
      return defaultMsg || 'Integrity violation detected';
  }
}

export function WarningHistoryDrawer({
  isOpen,
  onClose,
  sessionId,
}: WarningHistoryDrawerProps) {
  const { data: warnings = [], isLoading } = useQuery<SessionWarning[]>({
    queryKey: ['session-warnings', sessionId],
    queryFn: () => api.get<SessionWarning[]>(`/sessions/${sessionId}/warnings`),
    enabled: isOpen && Number.isInteger(sessionId) && sessionId > 0,
    refetchInterval: isOpen ? 3000 : false,
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Session Warning History"
          data-testid="warning-history-drawer"
          className="fixed inset-0 z-50 overflow-hidden"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-screen max-w-md bg-surface border-l border-border shadow-2xl flex flex-col overflow-hidden text-foreground"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-elevated/70">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>Warning History</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        {warnings.length}
                      </span>
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono">
                      Session #{sessionId} Proctoring Log
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="warning-history-close-btn"
                  onClick={onClose}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label="Close Warning History"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {isLoading ? (
                  <div className="py-12 text-center text-xs text-muted-foreground font-mono animate-pulse">
                    Loading warning records...
                  </div>
                ) : warnings.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        No Warnings Recorded
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        Your assessment session is clean. Adhere to proctoring guidelines to maintain academic integrity.
                      </p>
                    </div>
                  </div>
                ) : (
                  warnings.map((w, idx) => {
                    const penalty = w.penalty_points ?? w.penaltyPoints ?? 15;
                    const trustAfter = w.trust_score_after ?? w.trustScoreAfter ?? 100;
                    const code = (w.violation_code ?? w.violationCode ?? '') as string;
                    const issued = w.issued_at ?? w.issuedAt;
                    const acked = w.acknowledged_at ?? w.acknowledgedAt;
                    const isAcked = Boolean(acked);

                    return (
                      <div
                        key={w.warning_id ?? w.warningId ?? idx}
                        data-testid="warning-history-item"
                        className="p-4 rounded-2xl border border-border bg-surface-elevated/80 shadow-sm space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                            Warning #{idx + 1}
                          </span>
                          <span className="font-mono text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                            -{penalty} pts
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-foreground">
                            {formatPlainReason(code, w.message)}
                          </div>
                          {w.message && (
                            <div className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                              {w.message}
                            </div>
                          )}
                        </div>

                        {/* Evidence Snapshot (if present) */}
                        {(w.snapshot_url || w.snapshotUrl) && (
                          <div className="pt-1">
                            <EvidenceImage
                              src={w.snapshot_url || w.snapshotUrl}
                              violationCode={code}
                              alt={`Warning #${idx + 1} evidence snapshot`}
                              containerClassName="max-h-32"
                              aspectRatio="video"
                            />
                          </div>
                        )}

                        <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[11px] font-mono">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {issued ? new Date(issued).toLocaleTimeString() : 'Recorded'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-muted-foreground mr-1">Score:</span>
                            <span className="font-bold text-foreground">{trustAfter}%</span>
                          </div>
                        </div>

                        {/* Acknowledgment Status */}
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] font-mono">
                          {isAcked ? (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>
                                Acknowledged at {new Date(acked!).toLocaleTimeString()}
                              </span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Pending Student Acknowledgment</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border bg-surface-elevated/70 text-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Close Warning History
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
