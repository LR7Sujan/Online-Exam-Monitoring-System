import React from 'react';
import { motion } from 'framer-motion';
import { CameraOff, MicOff, ShieldAlert, RefreshCw, Lock } from 'lucide-react';

interface CameraDeniedBlockerProps {
  deviceType?: 'camera' | 'microphone' | 'both';
  onRetry: () => void;
}

export const CameraDeniedBlocker: React.FC<CameraDeniedBlockerProps> = ({
  deviceType = 'camera',
  onRetry,
}) => {
  const isMic = deviceType === 'microphone';
  const isBoth = deviceType === 'both';

  const title = isBoth
    ? 'Camera & Microphone Access Denied'
    : isMic
    ? 'Microphone Access Denied'
    : 'Camera Access Denied';

  const description = isBoth
    ? 'ProctorIQ requires continuous webcam video and microphone telemetry to verify candidate presence and room environment throughout your assessment. Audio is analyzed on-device only and is never stored.'
    : isMic
    ? 'ProctorIQ requires continuous microphone audio telemetry to analyze on-device for talking or speech. Audio is never recorded or uploaded to our servers.'
    : 'ProctorIQ requires continuous optical webcam verification to detect face presence and maintain the integrity of your examination.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative max-w-lg w-full rounded-3xl border border-rose-500/40 bg-surface/95 p-7 shadow-layered-md backdrop-blur-2xl text-center space-y-5 overflow-hidden"
      >
        {/* Top highlight bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />

        {/* Pulsing Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center">
          {isMic ? (
            <MicOff className="w-8 h-8 text-rose-500 animate-pulse" />
          ) : (
            <CameraOff className="w-8 h-8 text-rose-500 animate-pulse" />
          )}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500/75 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <span>{title}</span>
          </h2>
          <p className="text-xs font-mono text-muted-foreground">
            PROCTORING INTEGRITY LOCKOUT // HARDWARE TELEMETRY REQUIRED
          </p>
        </div>

        {/* Message */}
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

        {/* Instructions */}
        <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 text-left space-y-2 text-xs text-foreground">
          <div className="font-semibold text-brand flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>How to unblock permissions:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 font-sans text-muted-foreground pl-1">
            <li>Click the lock or media icon in your browser address bar.</li>
            <li>
              Change Camera & Microphone permission to{' '}
              <strong className="text-emerald-500 font-semibold">"Allow"</strong>.
            </li>
            <li>Click the button below to resume hardware monitoring.</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 px-5 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Hardware Verification</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
