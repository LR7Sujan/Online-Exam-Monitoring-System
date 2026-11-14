import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { StatCard } from '../../../components/ui';
import { Activity, AlertCircle, Shield, CheckCircle2 } from 'lucide-react';

export function StatCardsSection() {
  const toc = [
    { id: 'kpi-grid', label: 'Telemetry KPI Grid' },
    { id: 'accents', label: 'Color Accents & Trends' },
  ];

  return (
    <SectionDocPage slug="stat-cards" toc={toc}>
      <ComponentPreview
        id="kpi-grid"
        title="Telemetry Metric StatCards"
        description="Bento metric cards featuring animated count-ups, SVG trend sparklines, and directional percentage delta badges."
        badge="StatCard"
        code={`import { StatCard } from '@/components/ui';

<StatCard
  label="Active Candidates"
  value={142}
  change={8.4}
  changeLabel="vs 1h ago"
  accent="cyan"
  icon={<Activity className="w-5 h-5" />}
  sparklineData={[80, 95, 110, 105, 125, 138, 142]}
/>`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <StatCard
            label="Active Candidates"
            value={142}
            change={8.4}
            changeLabel="vs 1h ago"
            accent="cyan"
            icon={<Activity className="w-5 h-5" />}
            sparklineData={[80, 95, 110, 105, 125, 138, 142]}
          />
          <StatCard
            label="Violations (10m)"
            value={27}
            change={-14.2}
            changeLabel="vs last window"
            accent="magenta"
            icon={<AlertCircle className="w-5 h-5" />}
            sparklineData={[42, 38, 35, 31, 29, 28, 27]}
          />
          <StatCard
            label="Flagged Sessions"
            value={12}
            change={0}
            changeLabel="stable"
            accent="amber"
            icon={<Shield className="w-5 h-5" />}
            sparklineData={[10, 11, 12, 12, 12, 12, 12]}
          />
          <StatCard
            label="Mean Integrity"
            value={94.6}
            suffix="%"
            decimals={1}
            change={2.1}
            changeLabel="vs cohort avg"
            accent="emerald"
            icon={<CheckCircle2 className="w-5 h-5" />}
            sparklineData={[88, 90, 89, 92, 93, 94, 95]}
          />
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="accents"
        title="Accent Colors & Trend Indicators"
        description="Four accent channels (cyan, magenta, amber, emerald) dynamically matching system thresholds."
        badge="Accents"
        code={`/* Supported accent props on StatCard */
accent="cyan"    // Realtime streaming
accent="magenta" // Critical violations & penalties
accent="amber"   // Warnings & pending reviews
accent="emerald" // Clean passes & certified scores`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-center">
          <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <span className="font-mono text-xs font-bold block">CYAN</span>
            <span className="text-[10px] text-muted-foreground">Streaming Feed</span>
          </div>
          <div className="p-4 rounded-xl border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-400">
            <span className="font-mono text-xs font-bold block">MAGENTA</span>
            <span className="text-[10px] text-muted-foreground">Violation Spike</span>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <span className="font-mono text-xs font-bold block">AMBER</span>
            <span className="text-[10px] text-muted-foreground">Review Flag</span>
          </div>
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <span className="font-mono text-xs font-bold block">EMERALD</span>
            <span className="text-[10px] text-muted-foreground">Clean Session</span>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
