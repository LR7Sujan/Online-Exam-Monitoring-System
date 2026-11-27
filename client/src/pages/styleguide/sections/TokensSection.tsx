import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { GlassCard } from '../../../components/ui';
import { AccentPicker } from '../../../components/ui/AccentPicker';
import { useTheme, ACCENT_COLORS, AccentColor } from '../../../context/ThemeContext';
import { ShieldCheck, AlertTriangle, AlertOctagon, Info, Check } from 'lucide-react';

const ACCENT_METADATA: Record<AccentColor, { name: string; gradient: string; previewHex: string }> = {
  indigo: { name: 'Indigo (Default)', gradient: 'from-[#6366F1] via-[#8B5CF6] to-[#D946EF]', previewHex: '#6366F1' },
  cyan: { name: 'Cyan', gradient: 'from-[#06B6D4] via-[#0EA5E9] to-[#3B82F6]', previewHex: '#0EA5E9' },
  emerald: { name: 'Emerald', gradient: 'from-[#10B981] via-[#14B8A6] to-[#22C55E]', previewHex: '#10B981' },
  amber: { name: 'Amber', gradient: 'from-[#F59E0B] via-[#F97316] to-[#EAB308]', previewHex: '#F59E0B' },
  rose: { name: 'Rose', gradient: 'from-[#F43F5E] via-[#EC4899] to-[#F97316]', previewHex: '#F43F5E' },
};

export function TokensSection() {
  const { accent, setAccent, resolvedTheme } = useTheme();

  const toc = [
    { id: 'accent-switcher', label: 'Interactive Accent System' },
    { id: 'accent-tokens', label: 'Accent Tokens' },
    { id: 'semantic-separation', label: 'Status Color Separation' },
    { id: 'semantic-tokens', label: 'Semantic System Tokens' },
  ];

  return (
    <SectionDocPage slug="tokens" toc={toc}>
      {/* 1. Interactive Accent Switcher */}
      <ComponentPreview
        id="accent-switcher"
        title="Interactive Accent Switcher"
        description="Switch the global data-accent attribute on <html> to test full UI theme adaptability across all components."
        badge="Active Accent"
        code={`// Switch global accent via ThemeContext:
const { accent, setAccent } = useTheme();
setAccent('emerald'); // updates <html data-accent="emerald">`}
      >
        <div className="space-y-4 w-full">
          <div className="p-3.5 rounded-xl border border-border bg-surface-elevated/40 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground">Interactive Accent Swatches</span>
              <p className="text-[11px] text-muted-foreground">Select an accent color with 28px swatches and arrow-key navigation.</p>
            </div>
            <AccentPicker variant="inline" />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENT_COLORS.map((col) => {
              const meta = ACCENT_METADATA[col];
              const isSelected = accent === col;
              return (
                <button
                  key={col}
                  type="button"
                  data-testid={`accent-switch-${col}`}
                  onClick={() => setAccent(col)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-foreground shadow-sm ring-2 ring-accent/30'
                      : 'border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${meta.gradient} shadow-xs flex items-center justify-center`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <span className="capitalize">{meta.name}</span>
                </button>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-surface-elevated/60 text-xs font-mono flex items-center justify-between">
            <span className="text-muted-foreground">Active data-accent:</span>
            <span className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground font-bold uppercase tracking-wider">
              {accent}
            </span>
          </div>
        </div>
      </ComponentPreview>

      {/* 2. Accent Tokens */}
      <ComponentPreview
        id="accent-tokens"
        title="Active Accent Design Tokens"
        description="Dynamic brand tokens derived from the current accent. Contrast calibrated for both dark and cream light surfaces."
        badge="CSS Variables"
        code={`/* Current Active Tokens (Resolved for ${resolvedTheme}) */
--accent-from: var(--accent-from);
--accent-via: var(--accent-via);
--accent-to: var(--accent-to);
--accent: var(--accent);
--accent-foreground: var(--accent-foreground);
--accent-soft: var(--accent-soft);
--accent-border: var(--accent-border);
--ring: var(--ring);
--accent-glow: var(--accent-glow);`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full">
          {[
            { name: 'Accent Solid', token: 'var(--accent)', bg: 'bg-accent', border: 'border-accent' },
            { name: 'Accent Soft', token: 'var(--accent-soft)', bg: 'bg-accent-soft', border: 'border-accent/40' },
            { name: 'Accent From', token: 'var(--accent-from)', bg: 'bg-[var(--accent-from)]', border: 'border-transparent' },
            { name: 'Accent Via', token: 'var(--accent-via)', bg: 'bg-[var(--accent-via)]', border: 'border-transparent' },
            { name: 'Accent To', token: 'var(--accent-to)', bg: 'bg-[var(--accent-to)]', border: 'border-transparent' },
            { name: 'Brand Gradient', token: 'var(--accent-from) -> to', bg: 'bg-gradient-to-r from-accent-from via-accent-via to-accent-to', border: 'border-transparent' },
            { name: 'Accent Border', token: 'var(--accent-border)', bg: 'bg-surface', border: 'border-accent' },
            { name: 'Focus Ring', token: 'var(--ring)', bg: 'bg-surface', border: 'border-[var(--ring)] ring-2 ring-accent' },
          ].map((item) => (
            <GlassCard key={item.name} className="p-3.5 space-y-2">
              <div className={`h-12 w-full rounded-xl ${item.bg} border ${item.border} shadow-sm`} />
              <div>
                <p className="text-xs font-semibold text-foreground">{item.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground truncate">{item.token}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </ComponentPreview>

      {/* 3. Status Color Separation Rule & Note */}
      <ComponentPreview
        id="semantic-separation"
        title="Status Color Separation Policy"
        description="Architectural safety invariant: semantic forensic statuses are strictly decoupled from the accent system."
        badge="Safety Invariant"
        code={`/* Safe, Caution, Danger, Info NEVER follow --accent */
--semantic-emerald: Safe / Clean
--semantic-amber: Caution / Warning
--semantic-rose: Danger / Critical Violation
--semantic-sky: Info / Network Telemetry`}
      >
        <div className="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/10 space-y-2 w-full">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>CRITICAL ARCHITECTURAL SAFETY RULE</span>
          </div>
          <p className="text-xs sm:text-sm text-foreground leading-relaxed">
            <strong>Semantic status colors (Safe Emerald, Caution Amber, Danger Rose, Info Sky) remain strictly invariant across all accents.</strong> They must NEVER follow or adapt to the brand accent.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Exam proctors, auditing systems, and candidates rely on deterministic visual beacons:
            emerald always signifies clean telemetry and active verification, amber signifies pending acknowledgments or grace periods, rose signifies active infractions or score auto-deductions, and sky signifies neutral system events. Tying status colors to decorative accents would create catastrophic proctoring confusion.
          </p>
        </div>
      </ComponentPreview>

      {/* 4. Semantic System Tokens */}
      <ComponentPreview
        id="semantic-tokens"
        title="Invariant Semantic Status Tokens"
        description="Fixed forensic status tokens guaranteed never to mutate with brand accent changes."
        badge="Semantic Invariants"
        code={`<div className="bg-safe text-white">Safe / Verified (Emerald)</div>
<div className="bg-caution text-white">Caution / Warning (Amber)</div>
<div className="bg-danger text-white">Danger / Critical (Rose)</div>
<div className="bg-info text-white">Info / Telemetry (Sky)</div>`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
          <div data-status-type="safe" className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 space-y-1">
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>SAFE / VERIFIED</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Normal telemetry, 100% trust, zero infractions.</p>
          </div>

          <div data-status-type="caution" className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 space-y-1">
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>CAUTION / WARNING</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Minor alerts, grace window active, time requests.</p>
          </div>

          <div data-status-type="danger" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 space-y-1">
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              <span>DANGER / INFRACTION</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Point deductions, multiple faces, lockdown breach.</p>
          </div>

          <div data-status-type="info" className="p-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 space-y-1">
            <div className="flex items-center gap-2 font-mono font-bold text-xs">
              <Info className="w-4 h-4 text-sky-500" />
              <span>INFO / TELEMETRY</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Network pings, connection state, system notes.</p>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
