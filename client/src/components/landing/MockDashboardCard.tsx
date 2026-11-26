import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Eye, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { LiveDot } from '../ui/LiveDot';

interface MockEvent {
  id: string;
  code: string;
  label: string;
  candidate: string;
  penalty: string;
  type: 'clean' | 'warning' | 'critical';
  time: string;
}

const STREAM_EVENTS: MockEvent[] = [
  {
    id: 'e1',
    code: 'FACE_OK',
    label: 'Biometric verification confirmed',
    candidate: 'Candidate #1042',
    penalty: '0 pts',
    type: 'clean',
    time: 'Just now',
  },
  {
    id: 'e2',
    code: 'TAB_SWITCH',
    label: 'Focus blur window loss intercepted',
    candidate: 'Candidate #812',
    penalty: '-15 pts',
    type: 'warning',
    time: '3s ago',
  },
  {
    id: 'e3',
    code: 'NO_FACE',
    label: 'Webcam absence detected (5.2s)',
    candidate: 'Candidate #304',
    penalty: '-20 pts',
    type: 'critical',
    time: '7s ago',
  },
  {
    id: 'e4',
    code: 'COPY_PASTE',
    label: 'Clipboard snooping attempt blocked',
    candidate: 'Candidate #919',
    penalty: '-10 pts',
    type: 'warning',
    time: '11s ago',
  },
  {
    id: 'e5',
    code: 'FACE_OK',
    label: 'Single face anchor verified (99.4%)',
    candidate: 'Candidate #551',
    penalty: '0 pts',
    type: 'clean',
    time: '14s ago',
  },
];

export function MockDashboardCard() {
  const [candidates, setCandidates] = useState(1436);
  const [trustScore, setTrustScore] = useState(98.6);
  const [violations, setViolations] = useState(45);
  const [latency, setLatency] = useState(13);
  const [eventIndex, setEventIndex] = useState(0);

  // Live ticking simulation
  useEffect(() => {
    const timer = setInterval(() => {
      // Gentle jitter for live feel
      setCandidates((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.min(Math.max(prev + delta, 1420), 1445);
      });

      setTrustScore((prev) => {
        const delta = (Math.random() * 0.2 - 0.1);
        return parseFloat(Math.min(Math.max(prev + delta, 97.8), 99.4).toFixed(1));
      });

      setLatency((prev) => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.min(Math.max(prev + delta, 11), 18);
      });

      if (Math.random() > 0.6) {
        setViolations((prev) => prev + 1);
      }

      setEventIndex((prev) => (prev + 1) % STREAM_EVENTS.length);
    }, 2800);

    return () => clearInterval(timer);
  }, []);

  const currentEvent = STREAM_EVENTS[eventIndex];

  return (
    <div className="relative rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm overflow-hidden select-none w-full">
      {/* Subtle top brand glow accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-80" />

      {/* Header telemetry pill */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <LiveDot color="emerald" size="sm" />
          <span className="text-xs font-mono font-semibold tracking-wide text-foreground">
            Live Telemetry Cluster
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-surface-elevated text-muted-foreground flex items-center gap-1">
          <Wifi className="w-3 h-3 text-emerald-500" />
          {latency}ms ws
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-2 py-3 border-b border-border text-center">
        <div className="p-2 rounded-xl bg-surface-elevated/60 border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Examinees</div>
          <motion.div
            key={candidates}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-lg font-bold font-mono text-foreground tracking-tight"
          >
            {candidates.toLocaleString()}
          </motion.div>
          <div className="text-[9px] text-emerald-500 font-medium">● 100% active</div>
        </div>

        <div className="p-2 rounded-xl bg-surface-elevated/60 border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Avg Trust</div>
          <motion.div
            key={trustScore}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-lg font-bold font-mono text-emerald-500 tracking-tight"
          >
            {trustScore}%
          </motion.div>
          <div className="text-[9px] text-muted-foreground">Radial gauge</div>
        </div>

        <div className="p-2 rounded-xl bg-surface-elevated/60 border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Deflected</div>
          <motion.div
            key={violations}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="text-base sm:text-lg font-bold font-mono text-rose-500 tracking-tight"
          >
            {violations}
          </motion.div>
          <div className="text-[9px] text-rose-400 font-semibold">Auto-deducted</div>
        </div>

        <div className="p-2 rounded-xl bg-surface-elevated/60 border border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">DB Lock</div>
          <div className="text-base sm:text-lg font-bold font-mono text-indigo-400 dark:text-indigo-400 tracking-tight">ACID</div>
          <div className="text-[9px] text-muted-foreground font-mono">FOR UPDATE</div>
        </div>
      </div>

      {/* Live Webcam & Biometric Target HUD */}
      <div className="pt-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-[11px] text-muted-foreground tracking-wide flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-brand" />
            Active surveillance feed
          </span>
          <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
            Face detect: OK
          </span>
        </div>

        {/* Mini simulated camera box with HUD overlay */}
        <div className="relative rounded-xl border border-border bg-background/90 p-2.5 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/30 border border-brand/30 flex items-center justify-center text-brand font-bold text-xs shrink-0">
                AI
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5 truncate">
                  MediaPipe Vision 0.10.x
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  1 face detected • 0 infractions • Confidence: 99.2%
                </div>
              </div>
            </div>
            <div className="text-right font-mono text-[10px] text-muted-foreground shrink-0 pl-2">
              FPS: 30.0
            </div>
          </div>
        </div>

        {/* Live event stream notification ticker */}
        <div className="mt-1">
          <div className="text-[10px] font-mono text-muted-foreground tracking-wide mb-1">
            Real-time interception stream
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentEvent.id + eventIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="flex items-center justify-between p-2 rounded-xl border border-border bg-surface-elevated/80 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {currentEvent.type === 'clean' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : currentEvent.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-semibold text-foreground mr-1.5">
                    {currentEvent.candidate}:
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {currentEvent.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2 font-mono text-[10px]">
                <span
                  className={
                    currentEvent.type === 'clean'
                      ? 'text-emerald-500 font-semibold'
                      : currentEvent.type === 'warning'
                      ? 'text-amber-500 font-semibold'
                      : 'text-rose-500 font-semibold'
                  }
                >
                  {currentEvent.penalty}
                </span>
                <span className="text-muted-foreground">{currentEvent.time}</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
