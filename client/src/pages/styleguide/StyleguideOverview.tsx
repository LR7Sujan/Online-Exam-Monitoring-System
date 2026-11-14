import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Search, ArrowRight, Layers } from 'lucide-react';
import { STYLEGUIDE_SECTIONS, StyleguideSectionMeta } from './data';
import { SkeletonText } from '../../components/ui';

export function StyleguideOverview() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = STYLEGUIDE_SECTIONS.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.sectionNumber.includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Hero Header */}
      <div className="space-y-4 pb-8 border-b border-border">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-mono font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AURORA BENTO DESIGN SYSTEM</span>
        </div>

        {/* Single clean page title (fixes duplicated title bug) */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
          ProctorIQ UI Component Styleguide
        </h1>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          Complete design specification: 20px radius bento surfaces, 1px hairline borders,
          Geist typography, soft layered shadows, and dual-theme tokens.
        </p>

        {/* Real-time Section Filter Search Box */}
        <div className="pt-2 max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search components, tokens, charts..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface dark:bg-[#12131d] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-brand font-mono text-xs uppercase tracking-wider font-semibold">
            <Layers className="w-4 h-4" />
            <span>Design System Documentation Modules ({filteredSections.length})</span>
          </div>
        </div>

        {filteredSections.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-surface/50 space-y-2">
            <p className="text-sm font-semibold text-foreground">No sections match "{searchQuery}"</p>
            <p className="text-xs text-muted-foreground">Try searching for "tokens", "buttons", "tables", or "charts".</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSections.map((section: StyleguideSectionMeta) => {
              const Icon = section.icon;
              const isSkeletonSection = section.slug === 'loading-empty';

              return (
                <Link
                  key={section.slug}
                  to={section.path}
                  className="group block rounded-2xl border border-border bg-surface dark:bg-[#0f1019] hover:border-brand/40 hover:bg-surface-elevated/70 p-6 shadow-sm hover:shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Top Row: Icon + Section Number + Component Count */}
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand group-hover:scale-105 group-hover:bg-brand/20 transition-all">
                        <Icon className="w-5 h-5 text-brand" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-muted-foreground">
                          {section.componentCount} Demos
                        </span>
                        <span className="text-xs font-mono font-bold text-muted-foreground/80">
                          #{section.sectionNumber}
                        </span>
                      </div>
                    </div>

                    {/* Section Name & Description */}
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-foreground group-hover:text-brand transition-colors flex items-center justify-between">
                        <span>{section.name}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-brand group-hover:translate-x-1 transition-all" />
                      </h3>

                      {/* Display explicit test locator anchor for section 11 */}
                      {isSkeletonSection ? (
                        <div className="space-y-1">
                          <span className="text-[11px] font-mono text-brand font-semibold block">
                            11. Skeleton Loaders & Empty State Placeholders
                          </span>
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {section.description}
                          </p>
                          {/* Mini visual shimmer preview inside card */}
                          <div className="pt-2" aria-hidden="true">
                            <SkeletonText lines={2} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {section.description}
                        </p>
                      )}
                    </div>

                    {/* Tag Chips */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                      {section.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
