import { SectionDocPage } from '../SectionDocPage';
import { ComponentPreview } from '../ComponentPreview';
import { GlassCard } from '../../../components/ui';

export function TokensSection() {
  const toc = [
    { id: 'theme-colors', label: 'Core Theme Colors' },
    { id: 'semantic-tokens', label: 'Semantic Tokens' },
  ];

  return (
    <SectionDocPage slug="tokens" toc={toc}>
      <ComponentPreview
        id="theme-colors"
        title="Core Theme Palette Swatches"
        description="Authoritative design tokens defined via CSS custom variables supporting both Dark & Light modes."
        badge="CSS Variables"
        code={`/* CSS Theme Variables in src/index.css */
:root {
  --background: #f8fafc;
  --surface: #ffffff;
  --border: rgba(15, 23, 42, 0.08);
  --brand: #6366f1;
}

.dark {
  --background: #090a10;
  --surface: #0f1019;
  --border: rgba(255, 255, 255, 0.08);
  --brand: #818cf8;
}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
          {[
            { name: 'Background', hex: 'var(--background)', bg: 'bg-background', border: 'border-border' },
            { name: 'Surface', hex: 'var(--surface)', bg: 'bg-surface', border: 'border-border' },
            { name: 'Brand Indigo', hex: '#6366F1', bg: 'bg-brand-indigo', border: 'border-indigo-400/40' },
            { name: 'Brand Violet', hex: '#8B5CF6', bg: 'bg-brand-violet', border: 'border-violet-400/40' },
            { name: 'Safe (Emerald)', hex: '#10B981', bg: 'bg-safe', border: 'border-emerald-400/40' },
            { name: 'Danger (Rose)', hex: '#F43F5E', bg: 'bg-danger', border: 'border-rose-400/40' },
          ].map((item) => (
            <GlassCard key={item.name} className="p-3.5 space-y-2">
              <div className={`h-12 w-full rounded-xl ${item.bg} border ${item.border} shadow-sm`} />
              <div>
                <p className="text-xs font-semibold text-foreground">{item.name}</p>
                <p className="text-[11px] font-mono text-muted-foreground">{item.hex}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </ComponentPreview>

      <ComponentPreview
        id="semantic-tokens"
        title="Semantic System Accents"
        description="High-contrast state beacons for safe operations, security warnings, and terminal critical alerts."
        badge="Tailwind Utilities"
        code={`<div className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Clean</div>
<div className="bg-amber-500/10 text-amber-500 border border-amber-500/20">Warning</div>
<div className="bg-rose-500/10 text-rose-500 border border-rose-500/20">Critical</div>`}
      >
        <div className="flex flex-wrap items-center gap-4 w-full justify-around">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-center w-36">
            <span className="text-xs font-mono font-bold block">SAFE / CLEAN</span>
            <span className="text-[10px] font-mono text-muted-foreground">#10B981</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-center w-36">
            <span className="text-xs font-mono font-bold block">WARNING</span>
            <span className="text-[10px] font-mono text-muted-foreground">#F59E0B</span>
          </div>
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-center w-36">
            <span className="text-xs font-mono font-bold block">DANGER</span>
            <span className="text-[10px] font-mono text-muted-foreground">#F43F5E</span>
          </div>
        </div>
      </ComponentPreview>
    </SectionDocPage>
  );
}
