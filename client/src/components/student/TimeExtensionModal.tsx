import { useState, useEffect } from 'react';
import { Clock, Send, ShieldAlert, XCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { NeonButton } from '../ui/NeonButton';
import { ApiClientError } from '../../lib/api';
import type { TimeExtensionRequest } from '../../types/domain';

interface TimeExtensionModalProps {
  isOpen: boolean;
  maxExtensionMins: number;
  existingRequest?: TimeExtensionRequest | null;
  onSubmitExam: () => void;
  onRequestExtension: (minutes: number, reason?: string) => Promise<void>;
  isSubmittingExam?: boolean;
  onClose?: () => void;
  canClose?: boolean;
}

export function TimeExtensionModal({
  isOpen,
  maxExtensionMins,
  existingRequest,
  onSubmitExam,
  onRequestExtension,
  isSubmittingExam = false,
  onClose,
  canClose = false,
}: TimeExtensionModalProps) {
  const [requestedMinutes, setRequestedMinutes] = useState<number>(
    Math.min(10, Math.max(1, maxExtensionMins))
  );
  const [reason, setReason] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear errors when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setErrorCode(null);
    }
  }, [isOpen]);

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
    setErrorCode(null);
    if (requestedMinutes < 1 || requestedMinutes > maxExtensionMins) {
      setError(`Please request between 1 and ${maxExtensionMins} minutes.`);
      return;
    }
    try {
      setIsSending(true);
      await onRequestExtension(requestedMinutes, reason.trim() || undefined);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorCode(err.code);
        if (err.code === 'SESSION_TIMED_OUT' || err.code === 'SESSION_NOT_IN_PROGRESS') {
          setError('Your exam session has timed out. Extension requests cannot be accepted. Please submit your assessment now.');
        } else if (err.code === 'NOT_ELIGIBLE_FOR_EXTENSION') {
          setError('Time extensions can only be requested when 10 minutes or fewer remain in your exam.');
        } else if (err.code === 'EXCEEDS_MAX_EXTENSION') {
          setError(`Requested time exceeds maximum allowed extension (${maxExtensionMins} minutes).`);
        } else if (err.code === 'EXTENSIONS_DISABLED') {
          setError('Time extensions are not enabled for this examination.');
        } else if (err.code === 'EXTENSION_ALREADY_REQUESTED') {
          setError('You have already submitted an extension request for this examination.');
        } else {
          setError(err.message || 'Failed to submit extension request.');
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit extension request.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleModalClose = () => {
    if (canClose && onClose) {
      onClose();
    } else {
      onSubmitExam();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      size="md"
      showCloseButton={canClose}
      closeOnBackdropClick={canClose}
    >
      <div className="relative overflow-hidden space-y-5">
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
          /* 3. STATE: INITIAL PROMPT ("Time is up. Do you need extra time?" or HUD proactive request) */
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-amber-500 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">
                  {canClose ? 'Request Extra Time' : 'Time is up. Do you need extra time?'}
                </h3>
                <p className="text-xs text-muted-foreground font-mono leading-relaxed">
                  {canClose
                    ? `You may request up to ${maxExtensionMins} minutes of additional time from your proctor before your window closes.`
                    : `Your regular time has expired. You may submit your assessment now, or request up to ${maxExtensionMins} minutes of additional time from your proctor.`}
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-mono text-rose-500 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                {(errorCode === 'SESSION_TIMED_OUT' || errorCode === 'SESSION_NOT_IN_PROGRESS') && (
                  <div className="pt-1">
                    <NeonButton
                      variant="primary"
                      size="sm"
                      onClick={onSubmitExam}
                      isLoading={isSubmittingExam}
                      className="w-full sm:w-auto"
                    >
                      Submit Exam Now
                    </NeonButton>
                  </div>
                )}
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-colors cursor-pointer ${
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
              {canClose ? (
                <NeonButton
                  variant="secondary"
                  size="md"
                  onClick={handleModalClose}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </NeonButton>
              ) : (
                <NeonButton
                  variant="secondary"
                  size="md"
                  onClick={onSubmitExam}
                  isLoading={isSubmittingExam}
                  className="w-full sm:w-auto"
                >
                  Submit Now
                </NeonButton>
              )}
              <NeonButton
                variant="primary"
                size="md"
                leftIcon={<Send className="w-4 h-4" />}
                onClick={handleSend}
                isLoading={isSending}
                disabled={Boolean(errorCode === 'SESSION_TIMED_OUT' || errorCode === 'SESSION_NOT_IN_PROGRESS')}
                className="w-full sm:w-auto"
              >
                Request Extra Time
              </NeonButton>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
