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
    <div className="relative min-h-screen lg:h-screen lg:overflow-hidden bg-background text-foreground flex flex-col justify-between overflow-x-hidden selection:bg-brand/20">
      {/* Background Aurora Blobs & Dotted Grid - Continuous across whole viewport */}
      <div className="aurora-backdrop pointer-events-none" />
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-40" />

      {/* Top ambient decorative glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

      {/* Theme Toggle in Top Right */}
      <div className="absolute top-4 right-4 sm:top-5 sm:right-6 lg:top-6 lg:right-8 z-30">
        <ThemeToggle />
      </div>

      {/* Centered Main Content Container (max-w-[1200px]) */}
      <main className="flex-1 flex items-center justify-center w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-3 z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 xl:gap-12 items-center">
          {/* Left Column: Brand, Headline, Description, Features, Testimonial */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center space-y-3 xl:space-y-3.5 max-w-xl mx-auto lg:mx-0">
            {/* Top Brand Logo */}
            <div>
              <Link to="/" className="inline-flex items-center gap-2.5 group">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md shadow-brand/20 transition-transform group-hover:scale-105">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold tracking-tight text-foreground">
                    Proctor<span className="text-brand">IQ</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border border-border bg-surface-elevated text-muted-foreground">
                    ZERO-TRUST
                  </span>
                </div>
              </Link>
            </div>

            {/* Badge */}
            <div className="pt-0.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-medium border border-brand/30 bg-brand/10 text-brand shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                </span>
                <span>DBMS-ENFORCED ACADEMIC INTEGRITY ENGINE</span>
              </div>
            </div>

            {/* Heading & Subtitle */}
            <div className="space-y-1.5">
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

            {/* 3 Feature Rows (Visible on desktop >= 1024px) */}
            <div className="hidden lg:flex flex-col space-y-2 pt-0.5">
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

            {/* Testimonial Card (Visible on desktop >= 1024px) */}
            <div className="hidden lg:block p-3 rounded-2xl border border-border bg-surface/70 backdrop-blur-md shadow-sm space-y-1">
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

          {/* Right Column: The Sign-in / Create Account Card as a floating glass card */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center lg:justify-end w-full">
            <div className="w-full max-w-[420px]">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Centered Single Line Footer Across Full Page */}
      <footer className="w-full py-2.5 sm:py-3 border-t border-border text-[11px] font-mono text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 gap-y-1 text-center z-10 px-4">
        <div className="flex items-center gap-1.5">
          <LiveDot color="emerald" size="sm" />
          <span>NODE ONLINE • MYSQL 8.0 ACID</span>
        </div>
        <span className="hidden sm:inline text-border">•</span>
        <span>v2.0 AURORA BENTO</span>
        <span className="hidden sm:inline text-border">•</span>
        <span>© 2026 ProctorIQ Inc. Zero-Trust Assessment Systems.</span>
      </footer>
    </div>
  );
}
