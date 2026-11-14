import { useState } from 'react';
import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { Modal, Drawer, NeonButton, GlassCard } from '../../../components/ui';

export function OverlaysSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toc = [
    { id: 'modal-primitive', label: 'Centered Modal Dialog' },
    { id: 'drawer-primitive', label: 'Slide-Over Forensics Drawer' },
  ];

  return (
    <SectionDocPage slug="overlays" toc={toc}>
      <ComponentPreview
        id="modal-primitive"
        title="Modal Overlay Primitive"
        description="Centered bento dialog with layered backdrop blur, focus trap, Escape key dismissal, and animated entrance."
        badge="Modal"
        code={`import { Modal, NeonButton } from '@/components/ui';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Candidate Verification"
  description="Confirm identity and biometric telemetry prior to session start."
  footer={
    <>
      <NeonButton variant="ghost" size="sm" onClick={() => setIsOpen(false)}>Cancel</NeonButton>
      <NeonButton variant="primary" size="sm" onClick={() => setIsOpen(false)}>Confirm</NeonButton>
    </>
  }
>
  <div>Modal Content</div>
</Modal>`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Interactive Centered Dialog</h4>
            <p className="text-xs text-muted-foreground">Launches a 16px radius modal with focus trap and keyboard dismissal.</p>
          </div>
          <NeonButton variant="secondary" onClick={() => setIsModalOpen(true)}>
            Launch Modal Dialog
          </NeonButton>
        </GlassCard>
      </ComponentPreview>

      <ComponentPreview
        id="drawer-primitive"
        title="Drawer Slide-Over Primitive"
        description="Right-aligned slide-over panel for inspectable logs, candidate telemetry details, and manual adjudication."
        badge="Drawer"
        code={`import { Drawer, NeonButton } from '@/components/ui';

<Drawer
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  title="Session Forensics"
  description="Detailed inspection ledger and telemetry breakdown."
  footer={
    <>
      <NeonButton variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>Close</NeonButton>
      <NeonButton variant="danger" size="sm" onClick={() => setIsDrawerOpen(false)}>Terminate</NeonButton>
    </>
  }
>
  <div>Drawer Forensics Ledger</div>
</Drawer>`}
      >
        <GlassCard className="p-6 flex flex-wrap items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Interactive Slide-Over Drawer</h4>
            <p className="text-xs text-muted-foreground">Smooth spring right slide-in with internal scroll and action footer.</p>
          </div>
          <NeonButton variant="primary" onClick={() => setIsDrawerOpen(true)}>
            Launch Side Drawer
          </NeonButton>
        </GlassCard>
      </ComponentPreview>

      {/* Modal Dialog Instance */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Candidate Verification"
        description="Confirm identity and biometric telemetry prior to session start."
        footer={
          <>
            <NeonButton variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </NeonButton>
            <NeonButton variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
              Confirm Identity
            </NeonButton>
          </>
        }
      >
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>
            ProctorIQ employs on-device client face tracking and database-level trigger enforcement.
          </p>
          <div className="p-4 rounded-xl bg-surface-elevated border border-border">
            <span className="font-mono text-xs text-brand">SHA-256 System Fingerprint Verified</span>
          </div>
        </div>
      </Modal>

      {/* Drawer Instance */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Session Forensics"
        description="Detailed inspection ledger and telemetry breakdown."
        footer={
          <>
            <NeonButton variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Close
            </NeonButton>
            <NeonButton variant="danger" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Force Terminate
            </NeonButton>
          </>
        }
      >
        <div className="space-y-4 text-xs text-muted-foreground">
          <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
              TELEMETRY
            </span>
            <p className="font-mono text-xs text-foreground">Candidate IP: 192.168.1.104</p>
            <p className="font-mono text-xs text-foreground">Active Focus: Locked</p>
          </div>
        </div>
      </Drawer>
    </SectionDocPage>
  );
}
