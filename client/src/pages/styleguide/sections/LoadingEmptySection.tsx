import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { SkeletonCard, SkeletonText, EmptyState, GlassCard, useToast } from '../../../components/ui';

export function LoadingEmptySection() {
  const toast = useToast();

  const toc = [
    { id: 'skeleton-shimmer', label: 'Skeleton Loaders & Shimmer' },
    { id: 'empty-states', label: 'Empty State Placeholders' },
  ];

  return (
    <SectionDocPage slug="loading-empty" toc={toc}>
      <ComponentPreview
        id="skeleton-shimmer"
        title="11. Skeleton Loaders & Empty State Placeholders"
        description="Dual-theme high-contrast skeleton blocks with continuous moving shimmer gradients to represent pending asynchronous state."
        badge="Skeleton"
        code={`import { SkeletonCard, SkeletonText } from '@/components/ui';

<SkeletonCard />
<SkeletonText lines={4} />`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <SkeletonCard />
          <GlassCard className="p-6 space-y-4">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Shimmer Text Block
            </h5>
            <SkeletonText lines={4} />
          </GlassCard>
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="empty-states"
        title="EmptyState Actionable Placeholder"
        description="Zero-state message featuring centered icon, clear explanation, and primary remediation action button."
        badge="EmptyState"
        code={`import { EmptyState, useToast } from '@/components/ui';

<EmptyState
  title="No Active Violations"
  description="All candidate telemetry feeds are currently operating within the authorized clean threshold."
  action={{
    label: 'Refresh Stream',
    onClick: () => toast.info('Refreshed', 'Telemetry streams reconnected'),
  }}
/>`}
      >
        <div className="w-full max-w-md mx-auto">
          <EmptyState
            title="No Active Violations"
            description="All candidate telemetry feeds are currently operating within the authorized clean threshold."
            action={{
              label: 'Refresh Stream',
              onClick: () => toast.info('Refreshed', 'Telemetry streams reconnected'),
            }}
          />
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
