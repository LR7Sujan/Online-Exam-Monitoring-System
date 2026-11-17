import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { TrustRing, TRUST_RING_SIZES, type TrustRingSize, GlassCard } from '../../../components/ui';

export function TrustRingSection() {
  const [trustScore, setTrustScore] = useState<number>(85);
  const [selectedSize, setSelectedSize] = useState<TrustRingSize>('md');
  const [minThreshold, setMinThreshold] = useState<number>(70);

  const sizeKeys: Array<'xs' | 'sm' | 'md' | 'lg' | 'xl'> = ['xs', 'sm', 'md', 'lg', 'xl'];

  const toc = [
    { id: 'interactive-simulator', label: 'Interactive Score & Size Simulator' },
    { id: 'scale-variants', label: 'Standard Scale Matrix (XS to XL)' },
    { id: 'geometry-and-markers', label: 'Arc Geometry & End-Marker Precision' },
    { id: 'verification-matrix', label: 'Visual Geometry Test Matrix' },
  ];

  return (
    <SectionDocPage slug="trust-ring" toc={toc}>
      <ComponentPreview
        id="interactive-simulator"
        title="Interactive Score & Size Simulator"
        description="Test the mathematical alignment of the end-marker dot, stroke-dashoffset transitions, and proportional font scaling across all sizes and score tiers."
        badge="TrustRing"
        code={`import { TrustRing } from '@/components/ui';

<TrustRing
  score={${trustScore}}
  minThreshold={${minThreshold}}
  size="${selectedSize}"
  sublabel="Live HUD"
/>`}
      >
        <GlassCard className="p-6 space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-border">
            {/* Score Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground font-semibold">TRUST SCORE</span>
                <span className="text-brand font-bold px-2 py-0.5 rounded bg-brand/10 border border-brand/30">
                  {trustScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={trustScore}
                onChange={(e) => setTrustScore(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
                data-testid="styleguide-score-slider"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>0 (Track)</span>
                <span>50</span>
                <span>100 (Full)</span>
              </div>
            </div>

            {/* Threshold Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground font-semibold">MIN THRESHOLD</span>
                <span className="text-rose-500 font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30">
                  {minThreshold}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={minThreshold}
                onChange={(e) => setMinThreshold(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>10%</span>
                <span>50%</span>
                <span>90%</span>
              </div>
            </div>

            {/* Size Selector Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground font-semibold">SIZE SELECTION</span>
                <span className="text-cyan font-bold px-2 py-0.5 rounded bg-cyan/10 border border-cyan/30 uppercase">
                  {selectedSize} ({TRUST_RING_SIZES[selectedSize as keyof typeof TRUST_RING_SIZES] ?? selectedSize}px)
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {sizeKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedSize(k)}
                    className={`py-1.5 rounded-lg border text-xs font-mono font-bold uppercase transition-all ${
                      selectedSize === k
                        ? 'border-brand bg-brand/20 text-brand shadow-sm'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <div className="flex flex-col items-center justify-center p-8 bg-background/50 rounded-2xl border border-border/80 min-h-[260px]">
            <TrustRing
              score={trustScore}
              minThreshold={minThreshold}
              size={selectedSize}
              sublabel={trustScore < minThreshold ? 'BREACH' : 'Live HUD'}
            />
            <div className="mt-4 text-xs font-mono text-muted-foreground text-center">
              Tier:{' '}
              <span
                className={`font-bold ${
                  trustScore < 60 || trustScore < minThreshold
                    ? 'text-rose-500'
                    : trustScore < 85
                    ? 'text-amber-500'
                    : 'text-emerald-500'
                }`}
              >
                {trustScore < 60 || trustScore < minThreshold
                  ? 'CRITICAL / DANGER'
                  : trustScore < 85
                  ? 'CAUTION / WARNING'
                  : 'SAFE / CLEAN'}
              </span>{' '}
              • End Marker:{' '}
              <span className="text-foreground font-bold">
                {trustScore > 0 && trustScore < 100 ? 'Visible & Coupled' : 'Hidden (0% or 100%)'}
              </span>
            </div>
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="scale-variants"
        title="Standard Scale Matrix (XS to XL)"
        description="All five standardized sizes: XS (40px, tile slots), SM (56px, mini HUDs), MD (80px, standard dashboards), LG (160px, hero metrics), and XL (220px, kiosk displays)."
        badge="5 Sizes"
        code={`<TrustRing score={${trustScore}} size="xs" /> // 40px
<TrustRing score={${trustScore}} size="sm" /> // 56px
<TrustRing score={${trustScore}} size="md" sublabel="Live" /> // 80px
<TrustRing score={${trustScore}} size="lg" sublabel="Metric" /> // 160px
<TrustRing score={${trustScore}} size="xl" sublabel="Display" /> // 220px`}
      >
        <div className="flex flex-wrap items-end justify-around gap-8 w-full py-4">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center h-56">
              <TrustRing score={trustScore} minThreshold={minThreshold} size="xs" />
            </div>
            <span className="text-xs font-mono text-muted-foreground block font-bold">
              XS (40px)
            </span>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center h-56">
              <TrustRing score={trustScore} minThreshold={minThreshold} size="sm" />
            </div>
            <span className="text-xs font-mono text-muted-foreground block font-bold">
              SM (56px)
            </span>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center h-56">
              <TrustRing score={trustScore} minThreshold={minThreshold} size="md" sublabel="Live" />
            </div>
            <span className="text-xs font-mono text-muted-foreground block font-bold">
              MD (80px)
            </span>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center h-56">
              <TrustRing score={trustScore} minThreshold={minThreshold} size="lg" sublabel="Metric" />
            </div>
            <span className="text-xs font-mono text-muted-foreground block font-bold">
              LG (160px)
            </span>
          </div>

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center h-56">
              <TrustRing score={trustScore} minThreshold={minThreshold} size="xl" sublabel="Kiosk" />
            </div>
            <span className="text-xs font-mono text-muted-foreground block font-bold">
              XL (220px)
            </span>
          </div>
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="geometry-and-markers"
        title="Arc Geometry & End-Marker Precision"
        description="Verified at critical checkpoints (0%, 25%, 50%, 75%, 100%) showing clockwise progression from 12 o'clock and dynamic threshold radial tick."
        badge="Geometry"
        code={`// Verified Geometry:
// Angle: (score / 100) * 2 * PI
// x = 60 + 50 * sin(angle), y = 60 - 50 * cos(angle)
// End dot renders only when 0 < score < 100`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 w-full py-2">
          {[0, 25, 50, 75, 100].map((sampleScore) => (
            <div
              key={sampleScore}
              className="flex flex-col items-center p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-3"
            >
              <TrustRing
                score={sampleScore}
                minThreshold={minThreshold}
                size="md"
              />
              <span className="text-xs font-mono font-bold text-foreground">
                Score: {sampleScore}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {sampleScore === 0
                  ? 'Track Only'
                  : sampleScore === 100
                  ? 'Full Ring'
                  : 'Arc + End Dot'}
              </span>
            </div>
          ))}
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="verification-matrix"
        title="Visual Geometry & Boundary Verification Matrix"
        description="Full matrix testing all required scores (0, 1, 25, 50, 60, 75, 99, 100) across all standardized sizes (XS to XL) to guarantee tail-end marker coupling, inner clearance, and zero font overflow."
        badge="Test Matrix"
        code={`// Test Matrix Verification:
// Scores: 0, 1, 25, 50, 60, 75, 99, 100
// Sizes: XS (40px), SM (56px), MD (80px), LG (160px), XL (220px)`}
      >
        <div className="space-y-8 w-full py-4">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((sz) => (
            <div key={sz} className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand">
                  Size: {sz} ({TRUST_RING_SIZES[sz]}px)
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Clearance: {Math.floor(TRUST_RING_SIZES[sz] * (100 / 120))}px inner circle
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {[0, 1, 25, 50, 60, 75, 99, 100].map((sc) => (
                  <div
                    key={`${sz}-${sc}`}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-surface-elevated/40 min-w-[70px]"
                  >
                    <TrustRing
                      score={sc}
                      size={sz}
                      data-testid={`trust-ring-${sz}-${sc}`}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground mt-2 font-bold">
                      {sc}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
