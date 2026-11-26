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
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-sm overflow-hidden">
      {/* Feed Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-elevated/60 p-3.5 sm:p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-sm">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">
                Telemetry Stream
              </h3>
              <LiveDot color="rose" size="sm" pulse />
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              Realtime Violation Ingestion
            </p>
          </div>
        </div>

        {/* Audio Mute / Unmute Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToggleAudio}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              muted
                ? 'border-border bg-surface text-muted-foreground hover:text-foreground'
                : 'border-brand/40 bg-brand/10 text-brand shadow-sm'
            }`}
            title={muted ? 'Unmute Audio Ping' : 'Mute Audio Ping'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onClearFeed && items.length > 0 && (
            <button
              type="button"
              onClick={onClearFeed}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded-md bg-surface-elevated hover:bg-muted transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed Stream List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y-0 scrollbar-thin">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center text-xs font-mono text-muted-foreground space-y-2"
            >
              <Zap className="w-7 h-7 text-brand/40 mx-auto" />
              <p>Telemetry stream active.</p>
              <p className="text-[10px] text-muted-foreground">
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
                  initial={{ opacity: 0, x: 24, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -24, scale: 0.96 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className={`group relative rounded-xl border p-3 transition-all ${
                    isCrit
                      ? 'border-rose-500/50 bg-rose-500/10 shadow-sm'
                      : 'border-border bg-surface-elevated/70 hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <SeverityBadge severity={item.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'} size="sm" />
                      <span className="font-mono text-xs font-bold text-foreground">
                        {item.violationLabel ?? item.violationCode}
                      </span>
                      {item.penaltyApplied ? (
                        <span className="font-mono text-[11px] font-bold text-rose-500">
                          -{item.penaltyApplied} PTS
                        </span>
                      ) : null}
                    </div>

                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {formatEventTime(item.occurredAt)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate text-xs">
                        {item.studentName ?? `Candidate #${item.sessionId}`}
                      </p>
                      {typeof item.trustScore === 'number' && (
                        <p className="text-[10px] font-mono text-muted-foreground">
                          Trust remaining:{' '}
                          <span
                            className={
                              item.trustScore < 70
                                ? 'text-rose-500 font-bold'
                                : item.trustScore < 85
                                ? 'text-amber-500 font-bold'
                                : 'text-emerald-500 font-bold'
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
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-brand hover:bg-brand/20 transition-colors shadow-sm cursor-pointer"
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
      <div className="border-t border-border bg-surface-elevated/40 p-2.5 text-center text-[10px] font-mono text-muted-foreground">
        Socket Room: <span className="text-brand font-bold">proctors</span> • Latency:{' '}
        <span className="text-emerald-500 font-bold">&lt;15ms</span>
      </div>
    </div>
  );
}
