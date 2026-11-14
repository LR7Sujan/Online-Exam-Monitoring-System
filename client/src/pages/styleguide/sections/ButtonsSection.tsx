import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { NeonButton, GlassCard } from '../../../components/ui';
import { Sparkles, Shield, ArrowRight, Save } from 'lucide-react';

export function ButtonsSection() {
  const [btnLoading, setBtnLoading] = useState(false);

  const toc = [
    { id: 'variants', label: 'Button Variants' },
    { id: 'sizes', label: 'Sizes & Icons' },
    { id: 'interactive-state', label: 'Interactive Loading State' },
  ];

  return (
    <SectionDocPage slug="buttons" toc={toc}>
      <ComponentPreview
        id="variants"
        title="NeonButton Semantic Variants"
        description="High-contrast interactive buttons with aurora hover glows, active spring presses, and focus rings."
        badge="NeonButton"
        code={`import { NeonButton } from '@/components/ui';

<NeonButton variant="primary">Brand Primary</NeonButton>
<NeonButton variant="secondary">Solid Secondary</NeonButton>
<NeonButton variant="outline">Outline</NeonButton>
<NeonButton variant="ghost">Ghost Action</NeonButton>
<NeonButton variant="danger">Critical Danger</NeonButton>
<NeonButton variant="success">Safe Confirmation</NeonButton>`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-center gap-3 w-full">
          <NeonButton variant="primary">Brand Primary</NeonButton>
          <NeonButton variant="secondary">Solid Secondary</NeonButton>
          <NeonButton variant="outline">Outline</NeonButton>
          <NeonButton variant="ghost">Ghost Action</NeonButton>
          <NeonButton variant="danger">Critical Danger</NeonButton>
          <NeonButton variant="success">Safe Confirmation</NeonButton>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="sizes"
        title="Scale Variants & Icon Accessories"
        description="Standardized button sizing (sm: 32px, md: 40px, lg: 48px) with leading and trailing icons."
        badge="Sizes & Icons"
        code={`<NeonButton size="sm" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>Small Action</NeonButton>
<NeonButton size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>Default Medium</NeonButton>
<NeonButton size="lg" leftIcon={<Shield className="w-5 h-5" />}>Large Kiosk Action</NeonButton>`}
      >
        <div className="flex flex-wrap items-center justify-around gap-4 w-full">
          <NeonButton size="sm" variant="secondary" leftIcon={<Sparkles className="w-3.5 h-3.5" />}>
            Small (32px)
          </NeonButton>
          <NeonButton size="md" variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Medium (40px)
          </NeonButton>
          <NeonButton size="lg" variant="primary" leftIcon={<Shield className="w-5 h-5" />}>
            Large (48px)
          </NeonButton>
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="interactive-state"
        title="Loading State Simulation"
        description="Automatic SVG spinner replacement and disabled state during network mutations."
        badge="State"
        code={`<NeonButton
  variant="primary"
  isLoading={btnLoading}
  onClick={() => {
    setBtnLoading(true);
    setTimeout(() => setBtnLoading(false), 2000);
  }}
>
  {btnLoading ? 'Saving...' : 'Click to Load'}
</NeonButton>`}
      >
        <div className="flex flex-col items-center justify-center gap-3 w-full py-4">
          <NeonButton
            variant="primary"
            isLoading={btnLoading}
            leftIcon={!btnLoading ? <Save className="w-4 h-4" /> : undefined}
            onClick={() => {
              setBtnLoading(true);
              setTimeout(() => setBtnLoading(false), 2000);
            }}
          >
            {btnLoading ? 'Saving...' : 'Click to Simulate Load (2s)'}
          </NeonButton>
          <span className="text-xs font-mono text-muted-foreground">
            Current status: {btnLoading ? 'MUTATING (Disabled)' : 'IDLE'}
          </span>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
