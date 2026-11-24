import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  CameraOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { StatusPill } from '../components/ui/StatusPill';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { TrustRing } from '../components/ui/TrustRing';
import { EvidenceImage } from '../components/ui/EvidenceImage';
import { SkeletonCard } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/EmptyState';
import { ChartTooltip, useChartTheme } from '../components/charts/shared';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { mediaSession } from '../proctoring/mediaSession';
import { api } from '../lib/api';
import type {
  ExamSession,
  IntegrityStatus,
  ResultRecord,
  ViolationAuditRow,
  SessionWarning,
} from '../types/domain';

interface ResultResponse {
  session: ExamSession;
  result: ResultRecord;
  violations: ViolationAuditRow[];
}

export function StudentResultPage() {
  useDocumentTitle('Forensic Exam Results | ProctorIQ');
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);
  const navigate = useNavigate();
  const chartTheme = useChartTheme();

  const [animatedPercentage, setAnimatedPercentage] = useState<number>(0);

  const query = useQuery({
    queryKey: ['session-result', numericSessionId],
    queryFn: () => api.get<ResultResponse>(`/sessions/${numericSessionId}/result`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
  });

  const warningsQuery = useQuery<SessionWarning[]>({
    queryKey: ['session-warnings', numericSessionId],
    queryFn: () => api.get<SessionWarning[]>(`/sessions/${numericSessionId}/warnings`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
  });
  const warnings = warningsQuery.data ?? [];

  const percentage = Number(query.data?.result?.percentage ?? 0);

  useEffect(() => {
    mediaSession.stopAll();
  }, []);

  useEffect(() => {
    if (query.data) {
      const timer = setTimeout(() => {
        setAnimatedPercentage(Math.round(percentage));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [query.data, percentage]);

  if (query.isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <SkeletonCard className="h-80" />
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <ErrorState
          title="Integrity Report Unavailable"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'This exam session has not been submitted or graded yet.'
          }
          onRetry={() => query.refetch()}
        />
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="py-2.5 px-5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95 shadow-sm transition-all cursor-pointer"
          >
            Return to Candidate Console
          </button>
        </div>
      </div>
    );
  }

  const { session, result, violations } = query.data;
  const rawScore = Number(result.raw_score ?? 0);
  const totalMarks = Number(result.total_marks ?? 100);
  const integrityStatus = (result.integrity_status ?? 'CLEAN') as IntegrityStatus;
  const minThreshold = result.min_trust_score ?? session.min_trust_score ?? 50;
  const finalTrust = Number(result.final_trust_score ?? session.trust_score ?? 100);

  // Donut Chart Data
  const wrongOrLostMarks = Math.max(0, totalMarks - rawScore);
  const chartData = [
    { name: 'Marks Awarded', value: rawScore, color: '#10B981' },
    { name: 'Marks Deducted/Lost', value: wrongOrLostMarks, color: '#F43F5E' },
  ];
  const isAllZero = chartData.every((d) => d.value === 0);
  const displayChartData = isAllZero
    ? [{ name: 'No data', value: 1, color: '#3f3f46' }]
    : chartData;
  const earnedPct = totalMarks > 0 ? Math.round((rawScore / totalMarks) * 100) : 0;
  const lostPct = totalMarks > 0 ? Math.round((wrongOrLostMarks / totalMarks) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 pb-20">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/student"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Candidate Dashboard</span>
        </Link>

        <div className="flex items-center gap-3">
          <div
            data-testid="camera-off-indicator"
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border border-border bg-surface-elevated text-muted-foreground shadow-sm"
          >
            <CameraOff className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Exam ended, camera off</span>
          </div>

          <span className="font-mono text-xs text-brand font-semibold tracking-wide">
            OFFICIAL INNODB TRANSACTION EVALUATION
          </span>
        </div>
      </div>

      {/* Hero Result Banner */}
      <div>
        <div className="p-6 sm:p-8 rounded-3xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-md relative overflow-hidden space-y-6">
          {/* Top highlight bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              integrityStatus === 'DISQUALIFIED'
                ? 'bg-gradient-to-r from-rose-500 to-red-600'
                : integrityStatus === 'FLAGGED'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500'
            }`}
          />

          {/* Celebratory or Warning Atmospheric Aura */}
          {integrityStatus === 'CLEAN' && (
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          )}
          {integrityStatus === 'DISQUALIFIED' && (
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />
          )}

          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-border/70">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-brand" />
                <span className="font-mono text-xs uppercase tracking-widest text-brand font-semibold">
                  Examination Result & Integrity Certificate
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                {result.exam_title ?? session.exam_title ?? 'Assessment Evaluation'}
              </h1>
              <p className="text-xs font-mono text-muted-foreground">
                SESSION #{result.session_id} • GRADED VIA{' '}
                <span className="text-brand font-semibold">sp_SubmitAndGradeExam</span> •{' '}
                {new Date(result.graded_at).toLocaleString()}
              </p>
            </div>

            {/* Integrity Status Badge & Paper Code */}
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Official Integrity Rating
              </span>
              <div className="flex items-center gap-2">
                {(result.paper_code || session?.paper_code) && (
                  <span
                    data-testid="result-paper-code"
                    className="font-mono text-xs font-bold text-brand bg-brand/10 border border-brand/30 px-2.5 py-0.5 rounded-md shadow-sm"
                  >
                    {result.paper_code || session?.paper_code}
                  </span>
                )}
                <StatusPill status={integrityStatus} size="md" />
              </div>
            </div>
          </div>

          {/* Core Metrics: Score Reveal, Donut, and TrustRing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center py-2">
            {/* 1. Animated Score Reveal */}
            <div className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-border bg-surface-elevated/70 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Grade Percentage
              </span>
              <div className="flex items-baseline justify-center">
                <span
                  className={`font-mono text-5xl font-black tracking-tight ${
                    percentage >= 70
                      ? 'text-emerald-500'
                      : percentage >= 50
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                >
                  {animatedPercentage}
                </span>
                <span className="font-mono text-lg text-muted-foreground ml-1">%</span>
              </div>
              <div className="text-xs font-mono text-foreground">
                Score: <strong className="text-foreground">{rawScore}</strong> / {totalMarks} Marks
              </div>
            </div>

            {/* 2. Donut Breakdown Chart */}
            <div
              role="region"
              aria-label={`Performance breakdown chart: ${rawScore} marks earned (${earnedPct}%), ${wrongOrLostMarks} marks lost (${lostPct}%) out of ${totalMarks} total marks`}
              className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-border bg-surface-elevated/70 space-y-3"
            >
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Performance Breakdown
              </span>
              <div className="w-44 h-44 relative" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={displayChartData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={66}
                      paddingAngle={isAllZero ? 0 : 4}
                      cornerRadius={isAllZero ? 0 : 6}
                    >
                      {displayChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTheme.tooltipProps}
                      offset={24}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length && !isAllZero) {
                          const data = payload[0];
                          const val = Number(data.value ?? 0);
                          const pct = totalMarks > 0 ? Math.round((val / totalMarks) * 100) : 0;
                          const color = (data.payload as { color?: string })?.color ?? chartTheme.series.emerald;
                          return (
                            <ChartTooltip
                              active={active}
                              payload={[
                                {
                                  name: data.name,
                                  value: `${val} Marks`,
                                  color,
                                  payload: { percent: pct },
                                },
                              ]}
                              showPercent
                            />
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center score label (large bold tabular number + PTS caption, always visible) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  {isAllZero ? (
                    <span className="text-xs font-mono font-medium text-muted-foreground">No data</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground leading-none">
                        {rawScore}
                      </span>
                      <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase mt-0.5">
                        PTS
                      </span>
                    </>
                  )}
                </div>
              </div>
              {/* Screen reader summary */}
              <div className="sr-only">
                {rawScore} marks earned ({earnedPct}%), {wrongOrLostMarks} marks lost ({lostPct}%).
              </div>
              {/* 14px High-Contrast Legend */}
              <div className="flex items-center gap-4 text-sm font-sans font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                  <span>Earned {rawScore} ({earnedPct}%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true" />
                  <span>Lost {wrongOrLostMarks} ({lostPct}%)</span>
                </span>
              </div>
            </div>

            {/* 3. Final Trust Index */}
            <div className="flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-border bg-surface-elevated/70 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Final Trust Index
              </span>
              <TrustRing
                score={finalTrust}
                minThreshold={minThreshold}
                size="md"
                sublabel={integrityStatus}
              />
              <span className="text-[11px] font-mono text-muted-foreground">
                {integrityStatus === 'DISQUALIFIED'
                  ? 'Locked: Threshold Breached'
                  : 'Authenticated Record'}
              </span>
            </div>
          </div>

          {/* Assessment Verdict Explanation */}
          <div className="mt-4 p-4 rounded-2xl border border-border bg-surface-elevated/70 text-xs font-mono flex items-start gap-3">
            {integrityStatus === 'CLEAN' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-foreground">
                  <span className="text-emerald-500 font-bold">CLEAN INTEGRITY VERDICT:</span>{' '}
                  No persistent threshold violations occurred. Stored procedure{' '}
                  <code className="text-brand font-semibold">sp_SubmitAndGradeExam</code> verified full academic
                  compliance.
                </div>
              </>
            ) : integrityStatus === 'FLAGGED' ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-foreground">
                  <span className="text-amber-500 font-bold">FLAGGED INTEGRITY VERDICT:</span> Minor
                  violations were recorded during your examination. Your score has been calculated
                  pending manual proctor review of flagged telemetry.
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-foreground">
                  <span className="text-rose-500 font-bold">DISQUALIFIED VERDICT:</span> Multiple
                  critical infractions dropped your trust index below the minimum threshold of{' '}
                  {minThreshold}%. The session was terminated via trigger{' '}
                  <code className="text-brand font-semibold">trg_after_violation_insert</code>.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warning History Section */}
      {warnings.length > 0 && (
        <div className="space-y-4" data-testid="student-result-warnings-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Session Warnings & Acknowledgments
              </h2>
            </div>
            <span className="font-mono text-xs text-amber-500 font-bold">
              {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'} issued
            </span>
          </div>

          <div className="space-y-3">
            {warnings.map((w, idx) => {
              const penalty = w.penalty_points ?? w.penaltyPoints ?? 15;
              const trustAfter = w.trust_score_after ?? w.trustScoreAfter ?? 100;
              const code = (w.violation_code ?? w.violationCode ?? '') as string;
              const issued = w.issued_at ?? w.issuedAt;
              const acked = w.acknowledged_at ?? w.acknowledgedAt;
              const isAcked = Boolean(acked);

              return (
                <div
                  key={w.warning_id ?? w.warningId ?? idx}
                  data-testid="student-result-warning-item"
                  className="p-4 rounded-2xl border border-border bg-surface/80 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                        Warning #{idx + 1}
                      </span>
                      <span className="font-mono text-sm font-bold text-foreground">
                        {code.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono text-xs text-rose-500 font-semibold">
                        -{penalty} PTS
                      </span>
                    </div>
                    {w.message && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {w.message}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Issued: {issued ? new Date(issued).toLocaleTimeString() : 'N/A'} • Trust remaining: {trustAfter}%
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    {isAcked ? (
                      <span className="flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Acknowledged at {new Date(acked!).toLocaleTimeString()}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Pending Acknowledgment</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Violation Audit History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Proctoring Incident Audit Ledger
            </h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {violations.length} {violations.length === 1 ? 'event' : 'events'} recorded
          </span>
        </div>

        {violations.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-border bg-surface/80 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="text-sm font-semibold text-foreground">Clean Examination Log</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Zero proctoring violations recorded in MySQL <code className="text-brand">Proctoring_Logs</code>.
              Your trust score remained at 100% throughout the session.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {violations.map((v) => {
              const snap = (v as unknown as { snapshot_url?: string; snapshotUrl?: string }).snapshot_url ||
                (v as unknown as { snapshot_url?: string; snapshotUrl?: string }).snapshotUrl;

              return (
                <div
                  key={v.log_id}
                  className="p-4 rounded-2xl border border-border bg-surface/80 hover:bg-surface transition-colors flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {snap && (
                      <EvidenceImage
                        src={snap}
                        violationCode={v.violation_code}
                        timestamp={v.occurred_at}
                        containerClassName="h-14 w-20 shrink-0"
                        aspectRatio="auto"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <SeverityBadge severity={v.severity} size="sm" />
                        <span className="font-mono text-sm font-bold text-foreground">
                          {v.violation_code}
                        </span>
                        <span className="font-mono text-xs text-rose-500 font-semibold">
                          -{v.penalty_applied} PTS
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {v.violation_label} • Timestamp: {new Date(v.occurred_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-muted-foreground block uppercase">
                        Proctor Review
                      </span>
                      <StatusPill status={v.proctor_review_status} size="sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Return Action */}
      <div className="text-center pt-4">
        <Link
          to="/student"
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl text-xs font-semibold text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors shadow-sm"
        >
          Return to Candidate Dashboard
        </Link>
      </div>
    </div>
  );
}
