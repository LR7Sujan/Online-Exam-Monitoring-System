import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { LiveDot, GlassCard } from '../../../components/ui';

export function IndicatorsSection() {
  const [pulseActive, setPulseActive] = useState(true);

  const toc = [
    { id: 'telemetry-beacons', label: 'Telemetry State Beacons' },
    { id: 'sizes-and-pulse', label: 'Sizes & Pulse Animation' },
  ];

  return (
    <SectionDocPage slug="indicators" toc={toc}>
      <ComponentPreview
        id="telemetry-beacons"
        title="LiveDot Status Beacons"
        description="Pulsing radial indicators providing real-time visual feedback on candidate sockets and streaming feeds."
        badge="LiveDot"
        code={`import { LiveDot } from '@/components/ui';

<LiveDot color="emerald" size="md" pulse />
<LiveDot color="cyan" size="md" pulse />
<LiveDot color="amber" size="md" pulse />
<LiveDot color="rose" size="md" pulse />
<LiveDot color="violet" size="md" pulse />
<LiveDot color="gray" size="md" pulse={false} />`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-around gap-6 w-full">
          <div className="flex items-center gap-2">
            <LiveDot color="emerald" size="md" pulse={pulseActive} />
            <span className="text-xs font-mono text-foreground">Online</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot color="cyan" size="md" pulse={pulseActive} />
            <span className="text-xs font-mono text-foreground">Syncing</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot color="amber" size="md" pulse={pulseActive} />
            <span className="text-xs font-mono text-foreground">Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot color="rose" size="md" pulse={pulseActive} />
            <span className="text-xs font-mono text-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot color="violet" size="md" pulse={pulseActive} />
            <span className="text-xs font-mono text-foreground">Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveDot color="gray" size="md" pulse={false} />
            <span className="text-xs font-mono text-muted-foreground">Offline</span>
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="sizes-and-pulse"
        title="Size Scales & Animation Toggle"
        description="Three standardized scale variants (sm: 8px, md: 10px, lg: 14px) with toggleable harmonic ping rings."
        badge="Variants"
        code={`<LiveDot color="emerald" size="sm" pulse />
<LiveDot color="emerald" size="md" pulse />
<LiveDot color="emerald" size="lg" pulse />`}
      >
        <div className="space-y-6 w-full">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setPulseActive((p) => !p)}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono hover:bg-muted transition-colors"
            >
              Toggle Pulse: <strong className="text-brand">{pulseActive ? 'ACTIVE' : 'STATIC'}</strong>
            </button>
          </div>

          <div className="flex items-center justify-around gap-8 pt-4 border-t border-border/60">
            <div className="text-center space-y-2">
              <div className="h-10 flex items-center justify-center">
                <LiveDot color="emerald" size="sm" pulse={pulseActive} />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block">Small (8px)</span>
            </div>
            <div className="text-center space-y-2">
              <div className="h-10 flex items-center justify-center">
                <LiveDot color="emerald" size="md" pulse={pulseActive} />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block">Medium (10px)</span>
            </div>
            <div className="text-center space-y-2">
              <div className="h-10 flex items-center justify-center">
                <LiveDot color="emerald" size="lg" pulse={pulseActive} />
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block">Large (14px)</span>
            </div>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
