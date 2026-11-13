import { AnimatePresence, motion } from 'framer-motion';
import { AlertOctagon, ArrowRight, X } from 'lucide-react';
import { useEffect } from 'react';

export interface CriticalViolationEvent {
  logId?: number;
  sessionId: number;
  studentId?: number;
  studentName?: string;
  violationCode: string;
  violationLabel?: string;
  severity: string;
  penaltyApplied?: number;
  trustScore?: number;
  occurredAt?: string;
  examTitle?: string;
}

interface EmergencyBannerProps {
  criticalAlert: CriticalViolationEvent | null;
  onDismiss: () => void;
  onInspect: (sessionId: number) => void;
}

export function EmergencyBanner({
  criticalAlert,
  onDismiss,
  onInspect,
}: EmergencyBannerProps) {
  useEffect(() => {
    if (!criticalAlert) return;
    // Auto-dismiss critical banner after 20 seconds if user doesn't interact
    const timer = setTimeout(() => {
      onDismiss();
    }, 20000);
    return () => clearTimeout(timer);
  }, [criticalAlert, onDismiss]);

  if (!criticalAlert) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0, y: -24 }}
        animate={{ height: 'auto', opacity: 1, y: 0 }}
        exit={{ height: 0, opacity: 0, y: -24 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative z-40 w-full overflow-hidden border-b border-rose-500/40 bg-gradient-to-r from-rose-950/90 via-rose-900/90 to-rose-950/90 shadow-layered-md backdrop-blur-xl"
      >
        {/* Animated Warning Scanline */}
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-rose-500/20 to-transparent pointer-events-none"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-sm">
              <AlertOctagon className="w-5 h-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-500/30 border border-rose-500/40 px-2.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-rose-200">
                  CRITICAL BREACH DETECTED
                </span>
                <span className="font-mono text-xs text-rose-300 font-semibold">
                  [{criticalAlert.violationCode}]
                </span>
                {criticalAlert.penaltyApplied ? (
                  <span className="font-mono text-xs text-rose-300 font-bold">
                    -{criticalAlert.penaltyApplied} PTS
                  </span>
                ) : null}
              </div>

              <p className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5">
                <strong className="text-rose-200 font-bold">
                  {criticalAlert.studentName ?? `Candidate #${criticalAlert.sessionId}`}
                </strong>{' '}
                triggered{' '}
                <span className="text-white underline decoration-rose-400">
                  {criticalAlert.violationLabel ?? criticalAlert.violationCode}
                </span>{' '}
                {criticalAlert.examTitle ? `in ${criticalAlert.examTitle}` : ''}
                {typeof criticalAlert.trustScore === 'number' ? (
                  <span className="text-rose-200/80 text-xs font-normal">
                    {' '}(Score dropped to{' '}
                    <span className="font-mono font-bold text-white">
                      {criticalAlert.trustScore}%
                    </span>)
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => onInspect(criticalAlert.sessionId)}
              className="py-1.5 px-3.5 rounded-xl font-semibold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Inspect Candidate</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-500/20 transition-colors cursor-pointer"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
