import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye,
  Radio,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { SeverityBadge } from '../ui/SeverityBadge';
import { LiveDot } from '../ui/LiveDot';
import { isAudioMuted, setAudioMuted } from '../../utils/audioAlert';
import { useState } from 'react';

export interface LiveViolationItem {
  id: string | number;
  logId?: number;
  sessionId: number;
  studentName?: string;
  violationCode: string;
  violationLabel?: string;
  severity: string;
  penaltyApplied?: number;
  trustScore?: number;
  occurredAt?: string;
}

interface LiveFeedSidebarProps {
  items: LiveViolationItem[];
  onReviewSession: (sessionId: number) => void;
  onClearFeed?: () => void;
}

function formatEventTime(isoString?: string): string {
  if (!isoString) return new Date().toLocaleTimeString();
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveFeedSidebar({
  items,
  onReviewSession,
  onClearFeed,
}: LiveFeedSidebarProps) {
  const [muted, setMuted] = useState<boolean>(isAudioMuted());

  const handleToggleAudio = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-[#0C0E1A]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#121526]/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-magenta/15 border border-magenta/40 text-magenta">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                Telemetry Stream
              </h3>
              <LiveDot color="rose" size="sm" pulse />
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Realtime Violation Ingestion
            </p>
          </div>
        </div>

        {/* Audio Mute / Unmute Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleAudio}
            className={`p-1.5 rounded-lg border transition-colors ${
              muted
                ? 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                : 'border-cyan/40 bg-cyan/15 text-cyan hover:bg-cyan/25 shadow-glow-cyan-sm'
            }`}
            title={muted ? 'Unmute Audio Ping' : 'Mute Audio Ping'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onClearFeed && items.length > 0 && (
            <button
              type="button"
              onClick={onClearFeed}
              className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed Stream List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y-0 scrollbar-thin scrollbar-thumb-white/10">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center text-xs font-mono text-slate-400 space-y-2"
            >
              <Zap className="w-7 h-7 text-cyan/40 mx-auto" />
              <p>Telemetry stream active.</p>
              <p className="text-[10px] text-slate-400">
                Listening for incoming candidate events...
              </p>
            </motion.div>
          ) : (
            items.map((item) => {
              const isCrit = item.severity === 'CRITICAL';
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 28, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -28, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`group relative rounded-xl border p-3 transition-all ${
                    isCrit
                      ? 'border-magenta/60 bg-[#180A14]/90 shadow-[0_0_15px_rgba(244,63,94,0.18)]'
                      : 'border-white/10 bg-[#0F1122]/90 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SeverityBadge severity={item.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} size="sm" />
                      <span className="font-mono text-xs font-bold text-white">
                        {item.violationCode}
                      </span>
                      {item.penaltyApplied ? (
                        <span className="font-mono text-[11px] font-bold text-magenta">
                          -{item.penaltyApplied} PTS
                        </span>
                      ) : null}
                    </div>

                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {formatEventTime(item.occurredAt)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-200 truncate">
                        {item.studentName ?? `Candidate #${item.sessionId}`}
                      </p>
                      {typeof item.trustScore === 'number' && (
                        <p className="text-[10px] font-mono text-slate-400">
                          Trust remaining:{' '}
                          <span
                            className={
                              item.trustScore < 70
                                ? 'text-magenta font-bold'
                                : item.trustScore < 85
                                ? 'text-amber font-bold'
                                : 'text-emerald font-bold'
                            }
                          >
                            {item.trustScore}%
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Review Quick Action */}
                    <button
                      type="button"
                      onClick={() => onReviewSession(item.sessionId)}
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-cyan/40 bg-cyan/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-cyan hover:bg-cyan/20 hover:border-cyan transition-colors shadow-glow-cyan-sm"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Review</span>
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Feed Footer */}
      <div className="border-t border-white/10 bg-[#090A14] p-2.5 text-center text-[10px] font-mono text-slate-400">
        Socket Room: <span className="text-cyan font-bold">proctors</span> • Latency:{' '}
        <span className="text-emerald font-bold">&lt;15ms</span>
      </div>
    </div>
  );
}
