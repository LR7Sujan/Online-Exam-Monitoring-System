import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  Lock,
  ArrowRight,
  Camera,
  Info,
} from 'lucide-react';
import { TrustRing } from '../ui/TrustRing';
import { EvidenceImage } from '../ui/EvidenceImage';
import type { ViolationReportResponse } from '../../hooks/useProctoring';

interface ViolationWarningOverlayProps {
  warning: ViolationReportResponse | null;
  onDismiss: () => void;
  onProceedToResult?: () => void;
}

function getPlainReason(code?: string, defaultMsg?: string): string {
  switch (code) {
    case 'MULTIPLE_FACES':
      return 'Multiple faces were detected for more than 5 seconds';
    case 'PHONE_DETECTED':
      return 'A mobile phone was detected';
    case 'VOICE_DETECTED':
      return 'Talking was detected';
    case 'NO_FACE':
      return 'No face was detected in camera view';
    case 'TAB_SWITCH':
      return 'You navigated away from the exam tab or window';
    case 'FULLSCREEN_EXIT':
      return 'You exited fullscreen examination mode';
    case 'DEVTOOLS_OPEN':
      return 'Developer inspection tools were detected';
    case 'COPY_PASTE':
      return 'Clipboard copy or paste actions were detected';
    default:
      return defaultMsg || 'An integrity violation was detected by proctoring';
  }
}

export function ViolationWarningOverlay({
  warning,
  onDismiss,
  onProceedToResult,
}: ViolationWarningOverlayProps) {
  const [countdown, setCountdown] = useState<number>(3);
  const [ackCountdown, setAckCountdown] = useState<number>(2);
  const ackButtonRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isTerminated =
    warning?.isTerminated || warning?.status === 'TERMINATED_CHEATING';

  // 2-second mandatory delay for acknowledgment button to avoid accidental dismissal
  useEffect(() => {
    if (!warning || isTerminated) return;
    setAckCountdown(2);
    const timer = setInterval(() => {
      setAckCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [warning, isTerminated]);

  // Focus trap & focus button once countdown expires
  useEffect(() => {
    if (warning && !isTerminated && ackCountdown === 0) {
      ackButtonRef.current?.focus();
    }
  }, [warning, isTerminated, ackCountdown]);

  // Lockscreen auto-redirect timer for TERMINATED_CHEATING
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

  // Prevent Escape key from dismissing warning dialog
  useEffect(() => {
    if (!warning) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Let nested modals/lightboxes handle Escape first
        if (document.querySelector('[data-testid="evidence-image-lightbox"]')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [warning]);

  // Lock page scrolling while warning overlay is active so the page does not scroll behind the modal
  useEffect(() => {
    if (!warning) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [warning]);

  if (!warning) return null;

  const warningCount =
    warning.warning?.warningCount ||
    (typeof (warning as unknown as { warningCount?: number }).warningCount === 'number'
      ? (warning as unknown as { warningCount?: number }).warningCount
      : 1);

  const penaltyPoints =
    warning.penaltyApplied ??
    warning.warning?.penaltyPoints ??
    (typeof (warning as unknown as { penalty_applied?: number }).penalty_applied === 'number'
      ? (warning as unknown as { penalty_applied?: number }).penalty_applied
      : 15);

  const trustScore = warning.trustScore ?? warning.warning?.trustScoreAfter ?? 100;
  const minThreshold = warning.minTrustScore ?? 50;

  const snapshotUrl =
    (warning as unknown as { snapshotUrl?: string | null }).snapshotUrl ??
    (warning as unknown as { snapshot_url?: string | null }).snapshot_url ??
    null;

  const plainReason = getPlainReason(
    warning.violationCode,
    warning.warning?.message
  );

  // Render into document.fullscreenElement (if not <html>) so it shows during fullscreen, else document.body
  const mountTarget =
    typeof document !== 'undefined'
      ? (document.fullscreenElement && document.fullscreenElement !== document.documentElement
          ? document.fullscreenElement
          : document.body)
      : null;

  if (!mountTarget) return null;

  const modalContent = (
    <AnimatePresence>
      <div
        ref={containerRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="warning-dialog-title"
        aria-describedby="warning-dialog-desc"
        data-testid="violation-warning-overlay"
        tabIndex={-1}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto outline-none select-none"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Fullscreen Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 backdrop-blur-2xl transition-all duration-300 ${
            isTerminated
              ? 'bg-black/90 shadow-[inset_0_0_150px_rgba(244,63,94,0.45)]'
              : 'bg-black/85 shadow-[inset_0_0_120px_rgba(245,158,11,0.25)]'
          }`}
        />

        {/* Modal Window Container (fits comfortably on 390px screens and 1366x768 without page scroll) */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            x: isTerminated ? 0 : [-6, 6, -4, 4, -2, 2, 0],
          }}
          exit={{ scale: 0.94, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={`relative z-10 w-full max-w-[460px] my-auto max-h-[calc(100vh-2rem)] flex flex-col rounded-3xl border p-4 sm:p-6 text-center shadow-2xl backdrop-blur-3xl overflow-hidden ${
            isTerminated
              ? 'border-rose-500/50 bg-surface/98 shadow-rose-950/40 text-foreground'
              : 'border-amber-500/50 bg-surface/98 shadow-amber-950/30 text-foreground'
          }`}
        >
          {/* Top Edge Neon Accent Line */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isTerminated
                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600'
                : 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-600'
            }`}
          />

          {isTerminated ? (
            /* ========================================================== */
            /* LOCK-SCREEN OVERLAY: TERMINATED_CHEATING */
            /* ========================================================== */
            <div className="space-y-4 pt-1 overflow-y-auto max-h-full pr-1">
              <div className="relative mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.65, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-full bg-rose-500/25 blur-xl"
                />
                <div className="relative z-10 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-500 shadow-lg">
                  <Lock className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-rose-500 inline-block">
                  SECURITY PROTOCOL ENGAGED
                </span>
                <h2
                  id="warning-dialog-title"
                  className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground"
                >
                  Exam Terminated: Cheating Limit Breached
                </h2>
                <p
                  id="warning-dialog-desc"
                  className="text-xs text-muted-foreground leading-relaxed px-1"
                >
                  Your trust score dropped to{' '}
                  <strong className="text-foreground font-mono font-bold">{trustScore}%</strong>,
                  falling below the authoritative minimum requirement of{' '}
                  <strong className="text-rose-500 font-mono font-bold">{minThreshold}%</strong>.
                </p>
              </div>

              {/* Trust Score Gauge */}
              <div className="py-0.5 flex justify-center">
                <TrustRing
                  score={trustScore}
                  minThreshold={minThreshold}
                  size="sm"
                  sublabel="DISQUALIFIED"
                />
              </div>

              <div className="rounded-2xl border border-border bg-surface-elevated/70 p-3 space-y-1.5 text-left text-xs font-mono">
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
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-md shadow-rose-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Integrity Report ({countdown}s)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* ========================================================== */
            /* FULL-SCREEN WARNING OVERLAY: REPEATABLE VIOLATION */
            /* ========================================================== */
            <div className="space-y-3.5 pt-0.5 text-center overflow-y-auto max-h-full pr-1">
              {/* Header Icon + Badges */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-500 shadow-md">
                  <ShieldAlert className="h-6 w-6 sm:h-7 sm:w-7 animate-bounce" />
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
                    Warning {warningCount}
                  </span>
                  <span className="rounded-full border border-border bg-surface-elevated/80 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    Min Required: {minThreshold}%
                  </span>
                </div>
              </div>

              {/* Title & Plain-Language Reason */}
              <div className="space-y-1 px-1">
                <h2
                  id="warning-dialog-title"
                  className="text-base sm:text-lg font-extrabold tracking-tight text-foreground leading-snug"
                >
                  A penalty has occurred and a warning has been issued
                </h2>
                <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-foreground leading-relaxed">
                  {plainReason}
                </div>
              </div>

              {/* Penalty Points & Trust Score Display */}
              <div className="grid grid-cols-2 gap-2.5 items-center rounded-2xl border border-border bg-surface-elevated/70 p-2.5">
                <div className="flex flex-col items-center justify-center border-r border-border pr-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Penalty Deducted
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-black text-rose-500 mt-0.5">
                    -{penaltyPoints} pts
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Trust Penalty
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center pl-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-0.5">
                    New Trust Score
                  </span>
                  <TrustRing
                    score={trustScore}
                    minThreshold={minThreshold}
                    size="sm"
                  />
                </div>
              </div>

              {/* Evidence Snapshot (if available, max 220px height) */}
              {snapshotUrl && (
                <div className="rounded-2xl border border-border bg-surface-elevated/60 p-2 text-left">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-1 px-1">
                    <Camera className="w-3 h-3 text-brand" />
                    <span>Evidence Snapshot:</span>
                  </div>
                  <div className="flex justify-center w-full">
                    <EvidenceImage
                      src={snapshotUrl}
                      violationCode={warning.violationCode}
                      alt="Violation Evidence Snapshot"
                      maxHeight={220}
                      containerClassName="max-h-[220px]"
                      aspectRatio="auto"
                      enableLightbox={true}
                    />
                  </div>
                </div>
              )}

              {/* Rules Reminder */}
              <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-elevated/50 p-2 text-left text-[11px] text-muted-foreground leading-relaxed">
                <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <p id="warning-dialog-desc">
                  <strong className="text-foreground">Rules reminder:</strong> Remain seated, look directly at the screen, avoid talking, and keep all secondary devices away. Dropping below {minThreshold}% will immediately terminate and submit your assessment.
                </p>
              </div>

              {/* Primary Action Button (Enabled after 2 seconds) */}
              <div className="pt-0.5">
                <button
                  ref={ackButtonRef}
                  type="button"
                  data-testid="warning-ack-btn"
                  disabled={ackCountdown > 0}
                  onClick={onDismiss}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                    ackCountdown > 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed border border-border opacity-70'
                      : 'text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 active:scale-[0.99] cursor-pointer shadow-accent/20'
                  }`}
                >
                  <span>
                    {ackCountdown > 0
                      ? `OK, I understand (${ackCountdown}s)`
                      : 'OK, I understand'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, mountTarget);
}
