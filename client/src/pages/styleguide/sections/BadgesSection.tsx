import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { SeverityBadge, StatusPill, GlassCard } from '../../../components/ui';

export function BadgesSection() {
  const toc = [
    { id: 'severity-badges', label: 'Violation Severity Badges' },
    { id: 'status-pills', label: 'Candidate & Session Status Pills' },
  ];

  return (
    <SectionDocPage slug="badges" toc={toc}>
      <ComponentPreview
        id="severity-badges"
        title="Violation Severity Badges"
        description="Standardized severity levels mapped directly to database violation rule classifications."
        badge="SeverityBadge"
        code={`import { SeverityBadge } from '@/components/ui';

<SeverityBadge severity="LOW" />
<SeverityBadge severity="MEDIUM" />
<SeverityBadge severity="HIGH" />
<SeverityBadge severity="CRITICAL" />`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-around gap-4 w-full">
          <div className="text-center space-y-1">
            <SeverityBadge severity="LOW" />
            <span className="text-[10px] font-mono text-muted-foreground block">LOW (0 pts)</span>
          </div>
          <div className="text-center space-y-1">
            <SeverityBadge severity="MEDIUM" />
            <span className="text-[10px] font-mono text-muted-foreground block">MEDIUM (10 pts)</span>
          </div>
          <div className="text-center space-y-1">
            <SeverityBadge severity="HIGH" />
            <span className="text-[10px] font-mono text-muted-foreground block">HIGH (20 pts)</span>
          </div>
          <div className="text-center space-y-1">
            <SeverityBadge severity="CRITICAL" />
            <span className="text-[10px] font-mono text-muted-foreground block">CRITICAL (Terminating)</span>
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="status-pills"
        title="Session State StatusPills"
        description="Authoritative status indicators for exam sessions, submissions, and proctoring adjudication."
        badge="StatusPill"
        code={`import { StatusPill } from '@/components/ui';

<StatusPill status="IN_PROGRESS" />
<StatusPill status="SUBMITTED" />
<StatusPill status="TIMED_OUT" />
<StatusPill status="TERMINATED_CHEATING" />
<StatusPill status="CLEAN" />
<StatusPill status="FLAGGED" />
<StatusPill status="DISQUALIFIED" />`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-around gap-4 w-full">
          <StatusPill status="IN_PROGRESS" />
          <StatusPill status="SUBMITTED" />
          <StatusPill status="TIMED_OUT" />
          <StatusPill status="TERMINATED_CHEATING" />
          <StatusPill status="CLEAN" />
          <StatusPill status="FLAGGED" />
          <StatusPill status="DISQUALIFIED" />
        </GlassCard>
      </ComponentPreview>
    </SectionDocPage>
  );
}
