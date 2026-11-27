import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, AlertOctagon } from 'lucide-react';

interface FullscreenExitOverlayProps {
  isOpen: boolean;
  onReEnter: () => void;
}

export function FullscreenExitOverlay({ isOpen, onReEnter }: FullscreenExitOverlayProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="w-full max-w-md rounded-3xl border border-amber-500/40 bg-surface/95 p-7 text-center shadow-layered-md backdrop-blur-2xl space-y-5 relative overflow-hidden"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-500" />

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-500 shadow-sm">
            <AlertOctagon className="h-8 w-8 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-500 font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 inline-block">
              KIOSK CONTAINER BREACH
            </span>
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              Fullscreen Mode Required
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Exiting fullscreen mode violates proctoring integrity rules. A{' '}
              <strong className="text-rose-500 font-mono">FULLSCREEN_EXIT</strong> penalty has been
              logged. You must re-enter fullscreen immediately to proceed with your answers.
            </p>
          </div>

          <button
            type="button"
            onClick={onReEnter}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Re-enter Fullscreen & Continue</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
