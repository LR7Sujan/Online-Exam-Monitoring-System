import { motion } from 'framer-motion';
import { Radio, ShieldCheck, ScanFace, Database, ArrowUpRight, Sparkles } from 'lucide-react';

interface FeatureItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge: string;
  desc: string;
  detail: string;
  accent: string;
  colSpan?: 1 | 2;
}

const FEATURES: FeatureItem[] = [
  {
    id: 'monitoring',
    icon: Radio,
    title: 'Real-time Monitoring',
    badge: 'WebSocket Engine',
    desc: 'Sub-20ms WebSocket telemetry streaming webcam presence, window focus, clipboard snooping, and DevTools detection live to proctors.',
    detail: 'Bi-directional proctoring socket cluster with automatic reconnection & heartbeat ping.',
    accent: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    colSpan: 1,
  },
  {
    id: 'trust-score',
    icon: ShieldCheck,
    title: 'Trust Score Engine',
    badge: 'InnoDB Triggers',
    desc: 'Authoritative 100-point radial integrity gauge deducted atomically in MySQL triggers upon infractions with dynamic penalty weights.',
    detail: 'Atomic penalty point deductor with instant automatic session termination upon threshold breach.',
    accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    colSpan: 1,
  },
  {
    id: 'face-detection',
    icon: ScanFace,
    title: 'AI Face Detection',
    badge: 'MediaPipe Vision',
    desc: 'Continuous client-side neural tracking for facial presence, 5-second absence (NO_FACE), and unauthorized multi-person flags (MULTIPLE_FACES).',
    detail: 'Zero server video streaming: 100% edge detection protecting student biometric privacy.',
    accent: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    colSpan: 1,
  },
  {
    id: 'audit-trail',
    icon: Database,
    title: 'Audit Trail',
    badge: 'ACID Guaranteed',
    desc: 'Cryptographically verified, immutable event logs and final grade evaluations locked with row-level SELECT ... FOR UPDATE transactions.',
    detail: 'No duplicate grading guarantees, tamper-resistant snapshots, and full viva auditability.',
    accent: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20',
    colSpan: 1,
  },
];

export function FeatureBento() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-brand font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Core Capabilities
          </span>
          <h3 className="text-xl font-bold tracking-tight text-foreground mt-0.5">
            Zero-Trust Architectural Foundation
          </h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground hidden sm:inline">
          MySQL 8.0 + MediaPipe + React 19
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURES.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: idx * 0.1 }}
              whileHover={{ y: -3 }}
              className="group relative p-5 rounded-2xl border border-border bg-surface/80 hover:bg-surface hover:border-brand/40 shadow-sm hover:shadow-layered-sm transition-all duration-300 flex flex-col justify-between overflow-hidden"
            >
              {/* Top ambient spotlight glow */}
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-brand/10 rounded-full blur-2xl group-hover:bg-brand/20 transition-all pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className={`p-2.5 rounded-xl border ${feature.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-border bg-surface-elevated text-muted-foreground font-medium">
                    {feature.badge}
                  </span>
                </div>

                <h4 className="text-base font-semibold text-foreground group-hover:text-brand transition-colors">
                  {feature.title}
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                <span>{feature.detail}</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
