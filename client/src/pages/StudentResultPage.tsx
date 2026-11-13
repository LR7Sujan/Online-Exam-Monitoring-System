import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
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
import { GlassCard } from '../components/ui/GlassCard';
import { StatusPill } from '../components/ui/StatusPill';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { TrustRing } from '../components/ui/TrustRing';
import { NeonButton } from '../components/ui/NeonButton';
import { api } from '../lib/api';
import type {
  ExamSession,
  IntegrityStatus,
  ResultRecord,
  ViolationAuditRow,
} from '../types/domain';

interface ResultResponse {
  session: ExamSession;
  result: ResultRecord;
  violations: ViolationAuditRow[];
}

export function StudentResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);
  const navigate = useNavigate();

  const [animatedPercentage, setAnimatedPercentage] = useState<number>(0);

  const query = useQuery({
    queryKey: ['session-result', numericSessionId],
    queryFn: () => api.get<ResultResponse>(`/sessions/${numericSessionId}/result`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
  });

  const percentage = Number(query.data?.result?.percentage ?? 0);

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
        <div className="glass-card h-80 animate-pulse p-8" />
        <div className="glass-card h-64 animate-pulse p-8" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <GlassCard className="p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-magenta mx-auto" />
          <h2 className="text-xl font-bold text-white">Integrity Report Unavailable</h2>
          <p className="text-xs text-slate-400">
            {query.error instanceof Error
              ? query.error.message
              : 'This exam session has not been submitted or graded yet.'}
          </p>
          <NeonButton variant="primary" size="md" onClick={() => navigate('/student')}>
            Return to Candidate Console
          </NeonButton>
        </GlassCard>
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

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 pb-20">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/student"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-cyan transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Candidate Dashboard</span>
        </Link>

        <span className="font-mono text-xs text-cyan">
          OFFICIAL INNODB TRANSACTION EVALUATION
        </span>
      </div>

      {/* Hero Result Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <GlassCard
          glow={
            integrityStatus === 'DISQUALIFIED'
              ? 'magenta'
              : integrityStatus === 'FLAGGED'
              ? 'amber'
              : 'emerald'
          }
          className="p-6 sm:p-8 relative overflow-hidden"
        >
          {/* Celebratory or Somber Atmospheric Aura */}
          {integrityStatus === 'CLEAN' && (
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-emerald/10 blur-3xl pointer-events-none" />
          )}
          {integrityStatus === 'DISQUALIFIED' && (
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-magenta/15 blur-3xl pointer-events-none" />
          )}

          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan" />
                <span className="font-mono text-xs uppercase tracking-widest text-cyan font-semibold">
                  Examination Result & Integrity Certificate
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {result.exam_title ?? session.exam_title ?? 'Assessment Evaluation'}
              </h1>
              <p className="text-xs font-mono text-slate-400">
                SESSION #{result.session_id} • GRADED VIA{' '}
                <span className="text-cyan">sp_SubmitAndGradeExam</span> •{' '}
                {new Date(result.graded_at).toLocaleString()}
              </p>
            </div>

            {/* Integrity Status Badge */}
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Official Integrity Rating
              </span>
              <StatusPill status={integrityStatus} size="md" />
            </div>
          </div>

          {/* Core Metrics: Score Reveal, Donut, and TrustRing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center py-6">
            {/* 1. Animated Score Reveal */}
            <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-white/5 bg-[#0A0B14]/60 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Grade Percentage
              </span>
              <div className="flex items-baseline justify-center">
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                  className={`telemetry-num text-5xl font-black tracking-tight ${
                    percentage >= 70
                      ? 'text-emerald'
                      : percentage >= 50
                      ? 'text-amber'
                      : 'text-magenta'
                  }`}
                >
                  {animatedPercentage}
                </motion.span>
                <span className="font-mono text-lg text-slate-400 ml-1">%</span>
              </div>
              <div className="text-xs font-mono text-slate-300">
                Score: <strong className="text-white">{rawScore}</strong> / {totalMarks} Marks
              </div>
            </div>

            {/* 2. Donut Breakdown Chart */}
            <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-white/5 bg-[#0A0B14]/60 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Performance Breakdown
              </span>
              <div className="w-36 h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={56}
                      paddingAngle={4}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#101222',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs font-mono font-bold text-white">{rawScore}</span>
                  <span className="text-[9px] font-mono text-slate-400">PTS</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald" /> Earned
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-magenta" /> Lost
                </span>
              </div>
            </div>

            {/* 3. Final Trust Index */}
            <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl border border-white/5 bg-[#0A0B14]/60 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Final Trust Index
              </span>
              <TrustRing
                score={finalTrust}
                minThreshold={minThreshold}
                size="md"
                sublabel={integrityStatus}
              />
              <span className="text-[11px] font-mono text-slate-400">
                {integrityStatus === 'DISQUALIFIED'
                  ? 'Locked: Threshold Breached'
                  : 'Authenticated Record'}
              </span>
            </div>
          </div>

          {/* Assessment Verdict Explanation */}
          <div className="mt-4 p-4 rounded-2xl border border-white/10 bg-[#0A0B14]/80 text-xs font-mono flex items-start gap-3">
            {integrityStatus === 'CLEAN' ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-emerald shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-300">
                  <span className="text-emerald font-bold">CLEAN INTEGRITY VERDICT:</span>{' '}
                  No persistent threshold violations occurred. Stored procedure{' '}
                  <code className="text-cyan">sp_SubmitAndGradeExam</code> verified full academic
                  compliance.
                </div>
              </>
            ) : integrityStatus === 'FLAGGED' ? (
              <>
                <AlertTriangle className="w-5 h-5 text-amber shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-300">
                  <span className="text-amber font-bold">FLAGGED INTEGRITY VERDICT:</span> Minor
                  violations were recorded during your examination. Your score has been calculated
                  pending manual proctor review of flagged telemetry.
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="w-5 h-5 text-magenta shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-300">
                  <span className="text-magenta font-bold">DISQUALIFIED VERDICT:</span> Multiple
                  critical infractions dropped your trust index below the minimum threshold of{' '}
                  {minThreshold}%. The session was terminated via trigger{' '}
                  <code className="text-cyan">trg_after_violation_insert</code>.
                </div>
              </>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Violation Audit History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-magenta" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Proctoring Incident Audit Ledger
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">
            {violations.length} {violations.length === 1 ? 'event' : 'events'} recorded
          </span>
        </div>

        {violations.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald mx-auto" />
            <h4 className="text-sm font-semibold text-white">Clean Examination Log</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Zero proctoring violations recorded in MySQL <code className="text-cyan">Proctoring_Logs</code>.
              Your trust score remained at 100% throughout the session.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {violations.map((v) => (
              <GlassCard
                key={v.log_id}
                className="p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <SeverityBadge severity={v.severity} size="sm" />
                    <span className="font-mono text-sm font-bold text-white">
                      {v.violation_code}
                    </span>
                    <span className="font-mono text-xs text-magenta font-semibold">
                      -{v.penalty_applied} PTS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {v.violation_label} • Timestamp: {new Date(v.occurred_at).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">
                      Proctor Review
                    </span>
                    <StatusPill status={v.proctor_review_status} size="sm" />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Return Action */}
      <div className="text-center pt-4">
        <Link to="/student">
          <NeonButton variant="outline" size="md">
            Return to Candidate Dashboard
          </NeonButton>
        </Link>
      </div>
    </div>
  );
}
