import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { TrustRing } from '../ui/TrustRing';
import type { ViolationReportResponse } from '../../hooks/useProctoring';

interface ViolationWarningOverlayProps {
  warning: ViolationReportResponse | null;
  onDismiss: () => void;
  onProceedToResult?: () => void;
}

export function ViolationWarningOverlay({
  warning,
  onDismiss,
  onProceedToResult,
}: ViolationWarningOverlayProps) {
  const [countdown, setCountdown] = useState<number>(3);

  const isTerminated =
    warning?.isTerminated || warning?.status === 'TERMINATED_CHEATING';

  useEffect(() => {
    if (!isTerminated) {
      setCountdown(3);
      return;
    }

    if (countdown <= 0) {
      onProceedToResult?.();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTerminated, countdown, onProceedToResult]);

  if (!warning) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Animated Rose Pulse Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 backdrop-blur-xl ${
            isTerminated
              ? 'bg-background/90 shadow-[inset_0_0_120px_rgba(244,63,94,0.4)]'
              : 'bg-background/80 shadow-[inset_0_0_80px_rgba(244,63,94,0.25)]'
          }`}
        />

        {/* Shaking Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            x: isTerminated ? 0 : [-8, 8, -6, 6, -3, 3, 0],
          }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className={`relative z-10 w-full max-w-lg rounded-3xl border p-7 text-center shadow-layered-md backdrop-blur-2xl ${
            isTerminated
              ? 'border-rose-500/50 bg-surface/95 shadow-rose-500/10'
              : 'border-rose-500/40 bg-surface/95 shadow-sm'
          }`}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 rounded-t-3xl" />

          {isTerminated ? (
            /* ========================================================== */
            /* LOCK-SCREEN OVERLAY: TERMINATED_CHEATING */
            /* ========================================================== */
            <div className="space-y-6">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl"
                />
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-500 shadow-md">
                  <Lock className="h-10 w-10 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-500 shadow-sm inline-block">
                  SECURITY PROTOCOL ENGAGED
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  Exam Terminated: Cheating Limit Breached
                </h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Your candidate trust score dropped to{' '}
                  <strong className="text-foreground font-mono">{warning.trustScore}%</strong>,
                  which has fallen below the authoritative minimum requirement of{' '}
                  <strong className="text-rose-500 font-mono">{warning.minTrustScore}%</strong>.
                </p>
              </div>

              {/* Trust Score Display */}
              <div className="py-2 flex justify-center">
                <TrustRing
                  score={warning.trustScore}
                  minThreshold={warning.minTrustScore}
                  size="sm"
                  sublabel="DISQUALIFIED"
                />
              </div>

              <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-2 text-left text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Enforcing Rule:</span>
                  <span className="text-rose-500 font-semibold">trg_after_violation_insert</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Terminal Action:</span>
                  <span className="text-foreground font-semibold">CALL sp_SubmitAndGradeExam()</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Redirecting in:</span>
                  <span className="text-brand font-bold">{countdown}s</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onProceedToResult}
                className="w-full py-3 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Integrity Report ({countdown}s)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ========================================================== */
            /* SHAKING WARNING BANNER: REPEATABLE VIOLATION */
            /* ========================================================== */
            <div className="space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-500 shadow-sm">
                <ShieldAlert className="h-8 w-8 animate-bounce" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-500">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                  <span>Integrity Violation Detected</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground font-mono">
                  {warning.violationCode?.replace(/_/g, ' ') ?? 'UNAUTHORIZED ACTION'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  InnoDB penalty trigger applied:{' '}
                  <span className="font-bold text-rose-500 font-mono">
                    -{warning.penaltyApplied ?? 15} Trust Points
                  </span>
                </p>
              </div>

              {/* Gauge */}
              <div className="flex items-center justify-center py-1">
                <TrustRing
                  score={warning.trustScore}
                  minThreshold={warning.minTrustScore}
                  size="sm"
                />
              </div>

              <p className="text-[11px] text-muted-foreground font-mono">
                Caution: Dropping below {warning.minTrustScore}% results in instant lockout and
                submission of your test.
              </p>

              <button
                type="button"
                onClick={onDismiss}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95 shadow-sm active:scale-[0.99] transition-all cursor-pointer"
              >
                Acknowledge & Resume Exam
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
