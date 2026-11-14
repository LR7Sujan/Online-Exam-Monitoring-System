import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { TrustRing, GlassCard } from '../../../components/ui';

export function TrustRingSection() {
  const [trustScore, setTrustScore] = useState(85);
  const minLimit = 70;

  const toc = [
    { id: 'interactive-simulator', label: 'Interactive Score Simulator' },
    { id: 'scale-variants', label: 'Scale Variants (LG, MD, SM)' },
  ];

  return (
    <SectionDocPage slug="trust-ring" toc={toc}>
      <ComponentPreview
        id="interactive-simulator"
        title="Dynamic Risk Meter & Score Simulator"
        description="Drag the slider to test real-time SVG stroke-dashoffset transitions and automatic color transitions across thresholds."
        badge="TrustRing"
        code={`import { TrustRing } from '@/components/ui';

<TrustRing
  score={${trustScore}}
  minThreshold={${minLimit}}
  size="lg"
  sublabel="Live Index"
/>`}
      >
        <GlassCard className="p-6 space-y-6 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Integrity Score Controller</h4>
              <p className="text-xs text-muted-foreground">
                Score &gt;= 80%: Safe Emerald | 60-79%: Warning Amber | &lt; 60%: Danger Rose
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs font-mono font-semibold text-muted-foreground">SCORE: {trustScore}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={trustScore}
                onChange={(e) => setTrustScore(Number(e.target.value))}
                className="w-44 accent-indigo-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-center pt-4 border-t border-border">
            <TrustRing score={trustScore} minThreshold={minLimit} size="lg" sublabel="Live Index" />
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="scale-variants"
        title="Standardized Scale Variants"
        description="Three responsive sizes tailored for full dashboard overviews, in-exam student HUDs, and compact table badges."
        badge="Sizes"
        code={`<TrustRing score={${trustScore}} size="lg" sublabel="Live Index" /> // 192px
<TrustRing score={${trustScore}} size="md" sublabel="Exam HUD" />   // 144px
<TrustRing score={${trustScore}} size="sm" />                      // 96px`}
      >
        <div className="flex flex-wrap items-center justify-around gap-8 w-full">
          <div className="text-center space-y-2">
            <TrustRing score={trustScore} minThreshold={minLimit} size="lg" sublabel="Live Index" />
            <span className="text-xs font-mono text-muted-foreground block">Size: LG (192px)</span>
          </div>

          <div className="text-center space-y-2">
            <TrustRing score={trustScore} minThreshold={minLimit} size="md" sublabel="Exam HUD" />
            <span className="text-xs font-mono text-muted-foreground block">Size: MD (144px)</span>
          </div>

          <div className="text-center space-y-2">
            <TrustRing score={trustScore} minThreshold={minLimit} size="sm" />
            <span className="text-xs font-mono text-muted-foreground block">Size: SM (96px)</span>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
