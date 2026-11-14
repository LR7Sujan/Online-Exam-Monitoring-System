import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { BentoGrid, BentoCard, AvatarStack, AvatarItem, GlassCard } from '../../../components/ui';

const SAMPLE_AVATARS: AvatarItem[] = [
  { id: 1, name: 'Aarav Mehta', status: 'online' },
  { id: 2, name: 'Devanshi Sharma', status: 'busy' },
  { id: 3, name: 'Rohan Gupta', status: 'online' },
  { id: 4, name: 'Priya Iyer', status: 'away' },
  { id: 5, name: 'Karan Verma', status: 'offline' },
  { id: 6, name: 'Ananya Roy', status: 'online' },
];

export function BentoSection() {
  const toc = [
    { id: 'bento-grid', label: '12-Column Bento Grid' },
    { id: 'avatar-stacks', label: 'Avatar Stacks' },
  ];

  return (
    <SectionDocPage slug="bento" toc={toc}>
      <ComponentPreview
        id="bento-grid"
        title="12-Column Responsive Bento Grid"
        description="Flexible bento container with cursor-follow ambient spotlight and 20px surface radii."
        badge="BentoGrid & BentoCard"
        code={`import { BentoGrid, BentoCard } from '@/components/ui';

<BentoGrid>
  <BentoCard colSpan={4} className="p-6">
    <h4>Active Surveillance</h4>
  </BentoCard>
  <BentoCard colSpan={8} className="p-6">
    <h4>Institutional Audit Ledger</h4>
  </BentoCard>
</BentoGrid>`}
      >
        <BentoGrid className="w-full">
          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">Active Surveillance</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time facial keypoint telemetry with on-device MediaPipe pipeline.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">SQL Enforced Triggers</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Database-level atomic deduction prevents duplicate execution & guarantees ACID integrity.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">Aurora Ambient Glow</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hover over this card to observe the cursor-follow spotlight effect.
            </p>
          </BentoCard>

          <BentoCard colSpan={8} className="p-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">COL-SPAN 8</span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">Institutional Audit Ledger</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every proctoring incident is logged to an immutable append-only audit table with cryptographic session timestamps.
            </p>
          </BentoCard>

          <BentoCard colSpan={4} className="p-6 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">COL-SPAN 4</span>
            <h4 className="text-base font-semibold text-foreground tracking-tight">Live Avatars</h4>
            <AvatarStack avatars={SAMPLE_AVATARS} max={4} size="md" className="pt-2" />
          </BentoCard>
        </BentoGrid>
      </ComponentPreview>

      <ComponentPreview
        id="avatar-stacks"
        title="AvatarStack Component"
        description="Overlapping participant avatars with online presence indicator rings and overflow chips."
        badge="AvatarStack"
        code={`import { AvatarStack } from '@/components/ui';

<AvatarStack avatars={SAMPLE_AVATARS} max={3} size="sm" />
<AvatarStack avatars={SAMPLE_AVATARS} max={4} size="md" />
<AvatarStack avatars={SAMPLE_AVATARS} max={5} size="lg" />`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-around gap-6 w-full">
          <div className="space-y-1 text-center">
            <span className="text-[10px] font-mono text-muted-foreground uppercase block">Small</span>
            <AvatarStack avatars={SAMPLE_AVATARS} max={3} size="sm" />
          </div>

          <div className="space-y-1 text-center">
            <span className="text-[10px] font-mono text-muted-foreground uppercase block">Medium (Default)</span>
            <AvatarStack avatars={SAMPLE_AVATARS} max={4} size="md" />
          </div>

          <div className="space-y-1 text-center">
            <span className="text-[10px] font-mono text-muted-foreground uppercase block">Large</span>
            <AvatarStack avatars={SAMPLE_AVATARS} max={5} size="lg" />
          </div>
        </GlassCard>
      </ComponentPreview>
    </SectionDocPage>
  );
}
