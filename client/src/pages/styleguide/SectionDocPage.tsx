import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, ArrowRight, Bookmark } from 'lucide-react';
import { getPrevNextSections, getSectionBySlug } from './data';

export interface TocItem {
  id: string;
  label: string;
}

interface SectionDocPageProps {
  slug: string;
  toc?: TocItem[];
  children: React.ReactNode;
}

export function SectionDocPage({ slug, toc = [], children }: SectionDocPageProps) {
  const meta = getSectionBySlug(slug);
  const { prev, next } = getPrevNextSections(slug);

  if (!meta) {
    return <div className="p-8 text-center text-muted-foreground">Section not found.</div>;
  }

  const Icon = meta.icon;

  const scrollToAnchor = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${id}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumb Bar */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Link to="/styleguide" className="hover:text-foreground transition-colors">
          Styleguide
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-foreground font-semibold flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-brand shrink-0" />
          {meta.name}
        </span>
      </nav>

      {/* Section Header */}
      <div className="space-y-3 pb-6 border-b border-border">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-mono font-medium">
          <span>{meta.sectionNumber}</span>
          <span>•</span>
          <span>{meta.name.toUpperCase()}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          {meta.name}
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          {meta.description}
        </p>
      </div>

      {/* Main Layout Grid: Content + Right-hand "On this page" TOC */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 items-start">
        {/* Left/Center Demos (col-span-3) */}
        <div className="xl:col-span-3 space-y-8 min-w-0">
          {children}

          {/* Previous / Next Section Pagination Links */}
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            {prev ? (
              <Link
                to={prev.path}
                className="w-full sm:w-auto group flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface hover:bg-muted/60 transition-all text-left"
              >
                <ArrowLeft className="w-4 h-4 text-brand group-hover:-translate-x-1 transition-transform" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Previous</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors">
                    {prev.name}
                  </span>
                </div>
              </Link>
            ) : (
              <div />
            )}

            {next ? (
              <Link
                to={next.path}
                className="w-full sm:w-auto group flex items-center justify-end gap-3 p-3.5 rounded-xl border border-border bg-surface hover:bg-muted/60 transition-all text-right ml-auto"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">Next</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors">
                    {next.name}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-brand group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Right Sticky TOC (XL wide screens only) */}
        {toc.length > 0 && (
          <aside className="hidden xl:block xl:col-span-1 sticky top-20 space-y-3 p-4 rounded-2xl border border-border bg-surface-elevated/40 text-xs">
            <div className="flex items-center gap-2 font-mono uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
              <Bookmark className="w-3.5 h-3.5 text-brand" />
              <span>On this page</span>
            </div>
            <ul className="space-y-1.5 border-l border-border/80 pl-3">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => scrollToAnchor(e, item.id)}
                    className="block text-muted-foreground hover:text-brand text-xs font-medium transition-colors truncate py-0.5"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
