import React, { useState } from 'react';
import { Copy, Check, Eye, Code, Sun, Moon } from 'lucide-react';

interface ComponentPreviewProps {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  code: string;
  children: React.ReactNode;
  defaultTab?: 'preview' | 'code';
}

export function ComponentPreview({
  id,
  title,
  description,
  badge,
  code,
  children,
  defaultTab = 'preview',
}: ComponentPreviewProps) {
  const [tab, setTab] = useState<'preview' | 'code'>(defaultTab);
  const [copied, setCopied] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'auto' | 'light' | 'dark'>('auto');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code to clipboard', err);
    }
  };

  const previewThemeClass =
    previewTheme === 'light'
      ? 'bg-surface text-foreground border-border'
      : previewTheme === 'dark'
      ? 'bg-[#0b0c13] text-slate-100 border-border'
      : 'bg-surface-elevated/40 text-foreground border-border';

  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface dark:bg-[#0f1019] shadow-sm overflow-hidden transition-all"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-border bg-surface-elevated/60 dark:bg-[#12131f] gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
            {badge && (
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-brand/10 text-brand border border-brand/20 font-medium">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground leading-normal">{description}</p>
          )}
        </div>

        {/* Controls: Preview / Code tabs + Light/Dark simulation toggle + Copy */}
        <div className="flex items-center gap-2 shrink-0">
          {tab === 'preview' && (
            <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border border-border text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setPreviewTheme('auto')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  previewTheme === 'auto'
                    ? 'bg-surface text-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="System theme"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme('light')}
                className={`p-1 rounded transition-colors ${
                  previewTheme === 'light'
                    ? 'bg-surface text-foreground shadow-xs border border-border/80'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Force Light preview"
              >
                <Sun className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme('dark')}
                className={`p-1 rounded transition-colors ${
                  previewTheme === 'dark'
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Force Dark preview"
              >
                <Moon className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Segmented Tab: Preview / Code */}
          <div className="flex items-center bg-muted/80 rounded-lg p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                tab === 'preview'
                  ? 'bg-surface text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('code')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                tab === 'code'
                  ? 'bg-surface text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          {tab === 'code' && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              title="Copy code"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="font-mono text-[11px]">Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body Area */}
      {tab === 'preview' ? (
        <div
          className={`p-6 sm:p-8 border-b-0 min-h-[140px] flex items-center justify-center relative overflow-hidden transition-colors ${previewThemeClass}`}
        >
          <div className="w-full flex items-center justify-center">{children}</div>
        </div>
      ) : (
        <div className="relative bg-surface-elevated text-foreground dark:bg-[#090a10] dark:text-slate-100 p-4 font-mono text-xs overflow-x-auto leading-relaxed border-t border-border max-h-[360px] overflow-y-auto">
          <pre className="selection:bg-brand/30">
            <code>{code.trim()}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
