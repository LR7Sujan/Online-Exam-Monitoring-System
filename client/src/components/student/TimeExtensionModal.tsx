import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Send, ShieldAlert, XCircle } from 'lucide-react';
import { NeonButton } from '../ui/NeonButton';
import type { TimeExtensionRequest } from '../../types/domain';

interface TimeExtensionModalProps {
  isOpen: boolean;
  maxExtensionMins: number;
  existingRequest?: TimeExtensionRequest | null;
  onSubmitExam: () => void;
  onRequestExtension: (minutes: number, reason?: string) => Promise<void>;
  isSubmittingExam?: boolean;
}

export function TimeExtensionModal({
  isOpen,
  maxExtensionMins,
  existingRequest,
  onSubmitExam,
  onRequestExtension,
  isSubmittingExam = false,
}: TimeExtensionModalProps) {
  const [requestedMinutes, setRequestedMinutes] = useState<number>(
    Math.min(10, Math.max(1, maxExtensionMins))
  );
  const [reason, setReason] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 180s auto-expiry countdown for pending state
  const [secondsRemainingInExpiry, setSecondsRemainingInExpiry] = useState<number>(180);

  useEffect(() => {
    if (!existingRequest || existingRequest.status !== 'PENDING') return;

    const calcExpiry = () => {
      const created = new Date(existingRequest.created_at).getTime();
      const elapsedSecs = Math.floor((Date.now() - created) / 1000);
      const remaining = Math.max(0, 180 - elapsedSecs);
      setSecondsRemainingInExpiry(remaining);
      if (remaining === 0) {
        onSubmitExam();
      }
    };

    calcExpiry();
    const interval = setInterval(calcExpiry, 1000);
    return () => clearInterval(interval);
  }, [existingRequest, onSubmitExam]);

  if (!isOpen) return null;

  const isPending = existingRequest?.status === 'PENDING';
  const isRejected = existingRequest?.status === 'REJECTED';

  const handleSend = async () => {
    setError(null);
    if (requestedMinutes < 1 || requestedMinutes > maxExtensionMins) {
      setError(`Please request between 1 and ${maxExtensionMins} minutes.`);
      return;
    }
    try {
      setIsSending(true);
      await onRequestExtension(requestedMinutes, reason.trim() || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit extension request.';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl relative overflow-hidden space-y-5"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* 1. STATE: PENDING PROCTOR DECISION */}
        {isPending ? (
          <div className="space-y-5 text-center py-2">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500/20" />
              <div className="relative rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-500">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                Request Sent to Your Proctor
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Awaiting proctor review. Your answers are securely locked.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-surface-elevated/70 p-4 font-mono text-xs space-y-2 text-left">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Requested Additional Time:</span>
                <span className="font-bold text-foreground">{existingRequest.requested_minutes} minutes</span>
              </div>
              {existingRequest.reason && (
                <div className="flex justify-between items-start text-muted-foreground pt-1 border-t border-border/50">
                  <span>Reason:</span>
                  <span className="text-foreground max-w-[65%] text-right truncate">{existingRequest.reason}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-amber-500 pt-1 border-t border-border/50 font-semibold">
                <span>Auto-Expiry Countdown:</span>
                <span className="tabular-nums font-bold text-sm">
                  {formatCountdown(secondsRemainingInExpiry)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">
              If approved, extra minutes will be added automatically and answers will unlock.
            </p>

            <div className="pt-2 flex justify-center">
              <NeonButton
                variant="secondary"
                size="sm"
                onClick={onSubmitExam}
                isLoading={isSubmittingExam}
              >
                Submit Examination Now
              </NeonButton>
            </div>
          </div>
        ) : isRejected ? (
          /* 2. STATE: REJECTED */
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto w-14 h-14 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-rose-500 flex items-center justify-center">
              <XCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                Extension Request Declined
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                Your proctor did not approve extra time. Your exam is now being finalized and graded.
              </p>
            </div>

            <div className="pt-2">
              <NeonButton
                variant="primary"
                size="md"
                onClick={onSubmitExam}
                isLoading={isSubmittingExam}
              >
                View Examination Results
              </NeonButton>
            </div>
          </div>
        ) : (
          /* 3. STATE: INITIAL PROMPT ("Time is up. Do you need extra time?") */
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-500 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  Time is up. Do you need extra time?
                </h3>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                  Your regular time has expired. You may submit your assessment now, or request up to{' '}
                  <strong className="text-foreground">{maxExtensionMins} minutes</strong> of additional time from your proctor.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-500 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted-foreground font-semibold mb-2">
                  REQUESTED TIME (MAX {maxExtensionMins} MINS)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {[5, 10, 15]
                    .filter((mins) => mins <= maxExtensionMins)
                    .map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setRequestedMinutes(mins)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-colors ${
                          requestedMinutes === mins
                            ? 'bg-brand text-brand-foreground shadow-sm'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        +{mins} mins
                      </button>
                    ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs font-mono text-muted-foreground">Custom:</span>
                    <input
                      type="number"
                      min={1}
                      max={maxExtensionMins}
                      value={requestedMinutes}
                      onChange={(e) => setRequestedMinutes(parseInt(e.target.value, 10) || 1)}
                      className="w-16 rounded-xl border border-border bg-background p-1.5 text-xs text-foreground font-mono focus:border-brand focus:outline-none text-center"
                    />
                    <span className="text-xs font-mono text-muted-foreground">m</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted-foreground font-semibold mb-1">
                  REASON (OPTIONAL)
                </label>
                <textarea
                  rows={2}
                  maxLength={255}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Need extra minutes to review final code responses..."
                  className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground font-mono placeholder:text-muted-foreground focus:border-brand focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2 border-t border-border">
              <NeonButton
                variant="secondary"
                size="md"
                onClick={onSubmitExam}
                isLoading={isSubmittingExam}
                className="w-full sm:w-auto"
              >
                Submit Now
              </NeonButton>
              <NeonButton
                variant="primary"
                size="md"
                leftIcon={<Send className="w-4 h-4" />}
                onClick={handleSend}
                isLoading={isSending}
                className="w-full sm:w-auto"
              >
                Request Extra Time
              </NeonButton>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
