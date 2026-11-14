import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { Tabs, NeonButton, GlassCard, useToast, ParticleBurst } from '../../../components/ui';
import { Sparkles } from 'lucide-react';

export function MotionSection() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('tab-1');
  const [activeUnderlineTab, setActiveUnderlineTab] = useState('all');
  const [burstKey, setBurstKey] = useState(0);

  const toc = [
    { id: 'sliding-tabs', label: 'Sliding Pill & Underline Tabs' },
    { id: 'toast-notifications', label: 'Toast Notification System' },
    { id: 'particle-burst', label: 'Particle Burst Micro-Interaction' },
  ];

  return (
    <SectionDocPage slug="motion" toc={toc}>
      <ComponentPreview
        id="sliding-tabs"
        title="Sliding Pill & Underline Tabs"
        description="Framer-motion layoutId driven sliding background pill and active underline indicators."
        badge="Tabs"
        code={`import { Tabs } from '@/components/ui';

<Tabs
  variant="pills"
  activeTab={activeTab}
  onChange={setActiveTab}
  tabs={[
    { id: 'tab-1', label: 'Surveillance Grid' },
    { id: 'tab-2', label: 'Adjudication Queue', badge: 3 },
    { id: 'tab-3', label: 'Forensic Audit' },
  ]}
/>

<Tabs
  variant="underline"
  activeTab={activeTab}
  onChange={setActiveTab}
  tabs={[...]}
/>`}
      >
        <GlassCard className="p-6 space-y-6 w-full">
          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Sliding Pill Tabs (variant="pills")
            </h5>
            <Tabs
              variant="pills"
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'tab-1', label: 'Surveillance Grid' },
                { id: 'tab-2', label: 'Adjudication Queue', badge: 3 },
                { id: 'tab-3', label: 'Forensic Audit' },
              ]}
            />
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <h5 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Sliding Underline Tabs (variant="underline")
            </h5>
            <Tabs
              variant="underline"
              activeTab={activeUnderlineTab}
              onChange={setActiveUnderlineTab}
              tabs={[
                { id: 'all', label: 'All Violations' },
                { id: 'critical', label: 'Critical Only', badge: 1 },
                { id: 'dismissed', label: 'Dismissed Logs' },
              ]}
            />
          </div>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="toast-notifications"
        title="Sonner Toast Notification System"
        description="System status toast alerts triggered across websocket lifecycle events and user actions."
        badge="Toast"
        code={`import { useToast } from '@/components/ui';

const toast = useToast();
toast.info('System Check', 'Websocket heartbeat received.');
toast.success('Exam Submitted', 'Answers encrypted and uploaded.');
toast.warning('Network Degraded', 'Packet jitter detected.');
toast.error('Security Breach', 'Multiple faces detected in frame.');`}
      >
        <div className="flex flex-wrap items-center justify-center gap-3 w-full py-2">
          <NeonButton
            variant="outline"
            size="sm"
            onClick={() => toast.info('System Check', 'Websocket heartbeat received.')}
          >
            Trigger Info
          </NeonButton>
          <NeonButton
            variant="success"
            size="sm"
            onClick={() => toast.success('Exam Submitted', 'Answers encrypted and uploaded.')}
          >
            Trigger Success
          </NeonButton>
          <NeonButton
            variant="secondary"
            size="sm"
            onClick={() => toast.warning('Network Degraded', 'Packet jitter detected.')}
          >
            Trigger Warning
          </NeonButton>
          <NeonButton
            variant="danger"
            size="sm"
            onClick={() => toast.error('Security Breach', 'Multiple faces detected in frame.')}
          >
            Trigger Error
          </NeonButton>
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="particle-burst"
        title="Particle Burst Micro-Interaction"
        description="Celebratory particle physics animation for completed clean exams and milestone achievements."
        badge="ParticleBurst"
        code={`import { ParticleBurst, NeonButton } from '@/components/ui';

<ParticleBurst triggerKey={burstKey} count={24} />`}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-4 relative">
          {burstKey > 0 && <ParticleBurst key={burstKey} count={24} />}
          <NeonButton
            variant="primary"
            leftIcon={<Sparkles className="w-4 h-4" />}
            onClick={() => setBurstKey((k) => k + 1)}
          >
            Trigger Particle Burst
          </NeonButton>
          <span className="text-xs font-mono text-muted-foreground">
            Trigger count: {burstKey}
          </span>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
