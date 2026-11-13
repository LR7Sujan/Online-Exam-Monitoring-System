import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, AlertOctagon } from 'lucide-react';
import { NeonButton } from '../ui/NeonButton';

interface FullscreenExitOverlayProps {
  isOpen: boolean;
  onReEnter: () => void;
}

export function FullscreenExitOverlay({ isOpen, onReEnter }: FullscreenExitOverlayProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#0A0B14]/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="w-full max-w-md rounded-3xl border border-amber-500/50 bg-[#101222]/95 p-7 text-center shadow-glow-amber space-y-5"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber/40 bg-amber/10 text-amber shadow-glow-amber-sm">
            <AlertOctagon className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber font-semibold px-2.5 py-0.5 rounded bg-amber/10 border border-amber/30">
              KIOSK CONTAINER BREACH
            </span>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Fullscreen Mode Required
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Exiting fullscreen mode violates proctoring integrity rules. A{' '}
              <strong className="text-magenta font-mono">FULLSCREEN_EXIT</strong> penalty has been
              logged. You must re-enter fullscreen immediately to proceed with your answers.
            </p>
          </div>

          <NeonButton
            variant="primary"
            size="md"
            className="w-full"
            leftIcon={<Maximize2 className="w-4 h-4" />}
            onClick={onReEnter}
          >
            Re-enter Fullscreen & Continue
          </NeonButton>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
