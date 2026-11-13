import React from 'react';
import { motion } from 'framer-motion';
import { CameraOff, ShieldAlert, RefreshCw, Lock } from 'lucide-react';
import { NeonButton } from '../ui/NeonButton';

interface CameraDeniedBlockerProps {
  onRetry: () => void;
}

export const CameraDeniedBlocker: React.FC<CameraDeniedBlockerProps> = ({ onRetry }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05060E]/95 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative max-w-lg w-full rounded-2xl border border-rose/30 bg-[#0A0B16] p-6 shadow-[0_0_50px_rgba(244,63,94,0.25)] text-center space-y-5"
      >
        {/* Pulsing Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-rose/10 border border-rose/40 flex items-center justify-center">
          <CameraOff className="w-8 h-8 text-rose animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose/75 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-rose"></span>
          </span>
        </div>

        {/* Heading */}
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose" />
            <span>Camera Access Denied</span>
          </h2>
          <p className="text-xs font-mono text-slate-400">
            PROCTORING INTEGRITY LOCKOUT // HARDWARE TELEMETRY REQUIRED
          </p>
        </div>

        {/* Message */}
        <p className="text-sm text-slate-300 leading-relaxed">
          ProctorIQ requires continuous optical webcam verification to detect face presence and maintain
          the integrity of your examination. The browser has blocked or denied camera access.
        </p>

        {/* Instructions */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left space-y-2 text-xs text-slate-300">
          <div className="font-semibold text-cyan flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>How to unblock your camera:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 font-sans text-slate-400 pl-1">
            <li>Click the lock or camera icon in your browser address bar.</li>
            <li>Change Camera permission to <strong className="text-emerald">"Allow"</strong>.</li>
            <li>Click the button below to resume optical monitoring.</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="pt-2 flex justify-center">
          <NeonButton
            variant="primary"
            size="md"
            onClick={onRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Camera Verification</span>
          </NeonButton>
        </div>
      </motion.div>
    </div>
  );
};
