import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  Radio,
  Lock,
} from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { LiveDot } from '../ui/LiveDot';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen lg:h-screen lg:overflow-hidden bg-background text-foreground flex flex-col lg:flex-row overflow-x-hidden selection:bg-brand/20">
      {/* Background Aurora Blobs & Dotted Grid */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* ================================================================ */}
      {/* LEFT BRAND PANEL                                                 */}
      {/* Desktop: Left 1/2 column; Mobile/Tablet: Collapsible top section */}
      {/* ================================================================ */}
      <aside className="w-full lg:w-1/2 xl:w-7/12 flex flex-col justify-between p-5 sm:p-6 lg:p-8 xl:p-10 bg-gradient-to-br from-surface/80 via-surface/40 to-background/90 border-b lg:border-b-0 lg:border-r border-border/70 relative overflow-hidden shrink-0">
        {/* Subtle decorative background gradient circles */}
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-brand/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

        {/* Top Brand Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg xl:text-xl font-bold tracking-tight text-foreground">
                Proctor<span className="text-brand">IQ</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-surface-elevated text-muted-foreground">
                ZERO-TRUST
              </span>
            </div>
          </Link>

          {/* Theme Toggle in Header */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Center Content: Value Statement & 3 Feature Checkmarks */}
        <div className="relative z-10 my-auto py-3 lg:py-4 max-w-xl space-y-4 xl:space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium border border-brand/30 bg-brand/10 text-brand shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
            </span>
            <span>DBMS-ENFORCED ACADEMIC INTEGRITY ENGINE</span>
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              Mission Control for{' '}
              <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                Zero-Trust
              </span>{' '}
              Assessments
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Authoritative anti-cheating orchestration, client-side neural face tracking, and automatic penalty enforcement executed directly within <span className="font-mono text-foreground font-semibold">MySQL 8.0</span> ACID triggers.
            </p>
          </div>

          {/* 3 Feature Checkmarks (compact) */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-foreground">Client-Side Neural Face & Gaze Tracking</h4>
                <p className="text-[11px] text-muted-foreground">MediaPipe edge vision tracking absence and secondary faces with zero server video storage.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shrink-0 mt-0.5">
                <Radio className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-foreground">Sub-20ms WebSocket Telemetry Stream</h4>
                <p className="text-[11px] text-muted-foreground">Instant incident streaming for tab switches, clipboard snooping, and fullscreen violations.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-lg bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-500 shrink-0 mt-0.5">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-foreground">ACID Auto-Deduct Trigger Guarantees</h4>
                <p className="text-[11px] text-muted-foreground">Atomic point deductions, SQLSTATE 45000 tamper-proof audit trails, and automated lockouts.</p>
              </div>
            </div>
          </div>

          {/* Compact Testimonial / Stat Card */}
          <div className="p-3 sm:p-3.5 rounded-xl border border-border bg-surface/80 backdrop-blur-md shadow-sm space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-brand font-semibold">99.98% VERIFIED INTEGRITY</span>
              <span className="text-muted-foreground">50,000+ SESSIONS</span>
            </div>
            <p className="text-[11px] sm:text-xs text-foreground italic leading-relaxed">
              &ldquo;ProctorIQ transformed high-stakes remote evaluations. The DBMS-level guarantees give our faculty 100% confidence with zero subjective disputes.&rdquo;
            </p>
            <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-brand to-violet-500 flex items-center justify-center text-white font-bold text-[8px]">
                EV
              </div>
              <span>Dr. Elena Vance — Chief Academic Officer</span>
            </div>
          </div>
        </div>

        {/* Bottom Pinned Footer */}
        <div className="relative z-10 pt-2 lg:pt-3 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <LiveDot color="emerald" size="sm" />
            <span>NODE ONLINE • MYSQL 8.0 ACID</span>
          </div>
          <span>v2.0 AURORA BENTO</span>
        </div>
      </aside>

      {/* ================================================================ */}
      {/* RIGHT FORM PANEL (Fits in 1440x900 without scrolling)            */}
      {/* ================================================================ */}
      <section className="flex-1 flex flex-col justify-between p-3 sm:p-6 lg:p-6 xl:p-8 relative overflow-y-auto lg:overflow-hidden">
        {/* Mobile-only header space */}
        <div className="lg:hidden w-full max-w-[420px] mx-auto flex items-center justify-end py-1">
          <ThemeToggle />
        </div>

        {/* Center Form Container (max 420px per specification) */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-2">
          {children}
        </div>

        {/* Minimal Bottom Footer */}
        <div className="w-full max-w-[420px] mx-auto pt-2 text-center text-[11px] font-mono text-muted-foreground">
          <p>© 2026 ProctorIQ Inc. Zero-Trust Assessment Systems.</p>
        </div>
      </section>
    </div>
  );
}
