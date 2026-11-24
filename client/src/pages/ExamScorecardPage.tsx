import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Printer,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Calendar,
  AlertTriangle,
  Video,
  FileText,
  ExternalLink,
  Check,
  X,
  Maximize2,
} from 'lucide-react';
import { api } from '../lib/api';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/EmptyState';
import { TrustRing } from '../components/ui/TrustRing';
import { StatusPill } from '../components/ui/StatusPill';
import { EvidenceImage } from '../components/ui/EvidenceImage';
import { RecordingPlayer } from '../components/recording/RecordingPlayer';
import { Modal } from '../components/ui/Modal';
import type { ScorecardData } from '../types/domain';

export function ExamScorecardPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const studentId = Number(id);
  const sessId = Number(sessionId);
  const isProctor = location.pathname.startsWith('/proctor');
  const basePath = isProctor ? `/proctor/students` : `/admin/students`;
  const auditPath = isProctor ? `/proctor/audit` : `/proctor/audit`;

  // State
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);

  // Fetch Scorecard
  const { data: scorecard, isLoading, isError, error } = useQuery<ScorecardData>({
    queryKey: ['session-scorecard', sessId],
    queryFn: () => api.get<ScorecardData>(`/sessions/${sessId}/scorecard`),
    enabled: sessId > 0,
  });

  // Proctor Review Mutation
  const reviewMutation = useMutation({
    mutationFn: ({ logId, status }: { logId: number; status: 'CONFIRMED' | 'DISMISSED' }) =>
      api.patch(`/proctor/logs/${logId}/review`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-scorecard', sessId] });
      toast.success('Violation review status updated');
    },
    onError: (err: Error) => {
      toast.error(`Review update failed: ${err.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full font-mono">
        <PageSkeleton />
      </div>
    );
  }

  if (isError || !scorecard) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full font-mono">
        <ErrorState
          title="Scorecard Not Available"
          description={error instanceof Error ? error.message : 'Unable to locate examination scorecard.'}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['session-scorecard', sessId] })}
        />
      </div>
    );
  }

  const { header, score, integrity, questions, timeline, extensionHistory, recording } = scorecard;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full font-mono print:p-0 print:max-w-none">
      {/* Breadcrumbs & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/80 print:hidden">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider flex-wrap">
          <button
            type="button"
            onClick={() => navigate(basePath)}
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Student Audit
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigate(`${basePath}/${studentId}`)}
            className="hover:text-foreground transition-colors cursor-pointer truncate max-w-[150px]"
          >
            {header.studentName}
          </button>
          <span>/</span>
          <span className="text-foreground font-semibold truncate max-w-[220px]" data-testid="scorecard-exam-title">
            {header.examTitle}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`${auditPath}?sessionId=${header.paperCode}`)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-brand" />
            <span>Open in Violation Audit</span>
          </button>

          <button
            type="button"
            data-testid="print-scorecard-btn"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-brand/40 bg-brand/10 hover:bg-brand/20 text-xs font-bold text-brand transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF Export</span>
          </button>
        </div>
      </div>

      {/* Main Examination Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border/80 bg-surface shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs px-2.5 py-0.5 rounded-md font-bold border border-brand/40 bg-brand/10 text-brand">
              {header.paperCode}
            </span>
            <StatusPill status={header.status} />
            <span className="text-xs text-muted-foreground font-mono">
              Session #{sessId}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight truncate">
            {header.examTitle}
          </h1>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="text-foreground font-bold">{header.studentName}</span>
            <span>({header.studentEmail})</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Started {new Date(header.startedAt).toLocaleString()}</span>
            </span>
            {header.endedAt && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Ended {new Date(header.endedAt).toLocaleTimeString()}</span>
              </span>
            )}
            <span>• Duration: {header.durationUsedMinutes}m used</span>
            {header.extraMinutesGranted > 0 && (
              <span className="text-brand font-bold">
                (+{header.extraMinutesGranted}m extension)
              </span>
            )}
          </div>
        </div>

        {/* Final Trust Score Display */}
        <div className="flex items-center gap-4 shrink-0 bg-surface-elevated/70 p-3.5 rounded-2xl border border-border">
          <TrustRing
            score={integrity.finalTrustScore}
            minThreshold={integrity.minRequiredScore}
            size={56}
            showLabel={true}
          />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Integrity Audit</span>
            <div className="mt-0.5">
              {integrity.integrityStatus === 'DISQUALIFIED' ? (
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Disqualified
                </span>
              ) : integrity.integrityStatus === 'FLAGGED' ? (
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Flagged for Review
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Clean Integrity
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              Min Required: {integrity.minRequiredScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Score & Ranking Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Score / Total</span>
          <div className="text-2xl font-black text-foreground mt-1">
            {score.rawScore} <span className="text-sm font-normal text-muted-foreground">/ {score.totalMarks}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Raw points scored</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Percentage</span>
          <div className={`text-2xl font-black mt-1 ${
            score.percentage >= 75 ? 'text-emerald-400' : score.percentage >= 50 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {score.percentage}%
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Exam Average: {score.examAverage}%</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Cohort Rank</span>
          <div className="text-2xl font-black text-brand mt-1">
            #{score.examRank} <span className="text-sm font-normal text-muted-foreground">/ {score.totalAttendees}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Among all candidates</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Correct Answers</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {score.correctCount}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Validated correct</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Wrong Answers</span>
          <div className="text-2xl font-black text-rose-400 mt-1 flex items-center gap-1.5">
            <XCircle className="w-5 h-5 text-rose-400" />
            {score.wrongCount}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Incorrect selections</span>
        </div>

        <div className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Unanswered</span>
          <div className="text-2xl font-black text-muted-foreground mt-1 flex items-center gap-1.5">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
            {score.unansweredCount}
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Skipped questions</span>
        </div>
      </div>

      {/* Question-by-Question Forensic Table */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            <span>Question-by-Question Evaluation ({questions.length})</span>
          </h2>
          <span className="text-xs text-muted-foreground">Mapped through student's unique shuffled paper layout</span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-md">
          <table className="w-full text-left text-xs text-foreground border-collapse" data-testid="scorecard-questions-table">
            <thead>
              <tr className="border-b border-border bg-surface-elevated/70 text-muted-foreground uppercase tracking-wider text-[11px]">
                <th scope="col" className="p-3.5 pl-4 w-12 text-center">#</th>
                <th scope="col" className="p-3.5">Question & Answer Options</th>
                <th scope="col" className="p-3.5">Selected Answer</th>
                <th scope="col" className="p-3.5">Correct Answer</th>
                <th scope="col" className="p-3.5 text-center">Marks</th>
                <th scope="col" className="p-3.5 pr-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {questions.map((q) => (
                <tr key={q.questionId} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3.5 pl-4 font-bold text-center text-muted-foreground">
                    {q.displayedNumber}
                  </td>
                  <td className="p-3.5 max-w-lg">
                    <div className="font-semibold text-foreground">{q.questionText}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground bg-surface-elevated/50 p-2 rounded-lg border border-border/40">
                      <div><strong className="text-brand">A:</strong> {q.options.A}</div>
                      <div><strong className="text-brand">B:</strong> {q.options.B}</div>
                      <div><strong className="text-brand">C:</strong> {q.options.C}</div>
                      <div><strong className="text-brand">D:</strong> {q.options.D}</div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    {q.studentAnswer ? (
                      <span className={`font-bold flex items-center gap-1.5 ${q.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {q.studentAnswer}: {q.studentAnswerText}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic font-normal">Unanswered</span>
                    )}
                  </td>
                  <td className="p-3.5 font-bold text-emerald-400">
                    {q.correctAnswer}: {q.correctAnswerText}
                  </td>
                  <td className="p-3.5 text-center font-bold">
                    <span className={q.isCorrect ? 'text-emerald-400' : 'text-muted-foreground'}>
                      {q.marksGained} / {q.totalMarks}
                    </span>
                  </td>
                  <td className="p-3.5 pr-4 text-right">
                    {q.isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Correct
                      </span>
                    ) : q.isUnanswered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-border bg-surface text-muted-foreground">
                        <HelpCircle className="w-3 h-3" /> Skipped
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/40 bg-rose-500/10 text-rose-400">
                        <XCircle className="w-3 h-3" /> Incorrect
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violations & Warnings Timeline */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Infractions & Optical Evidence Timeline ({timeline.length})</span>
        </h2>

        {timeline.length === 0 ? (
          <div className="p-6 rounded-2xl border border-border/80 bg-surface shadow-xs flex items-center justify-center text-xs text-muted-foreground">
            Zero violations or warnings detected for this examination session.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timeline.map((item) => {
              const logIdNum = Number(item.id.replace('violation-', ''));
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-foreground">{item.label}</span>
                        {item.type === 'VIOLATION' && item.penalty > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold border border-rose-500/30 bg-rose-500/10 text-rose-400">
                            -{item.penalty} pts
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        At {new Date(item.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === 'CONFIRMED'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                          : item.status === 'DISMISSED'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {item.status || 'PENDING'}
                    </span>
                  </div>

                  {/* Optical Evidence Snapshot */}
                  {item.snapshotUrl ? (
                    <div
                      className="cursor-pointer group relative"
                      onClick={() => setSelectedSnapshot(item.snapshotUrl ?? null)}
                      title="Click to expand optical evidence"
                    >
                      <EvidenceImage
                        src={item.snapshotUrl}
                        alt="Violation snapshot"
                        className="h-32 w-full rounded-xl border border-border object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                        <Maximize2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="h-20 rounded-xl border border-border/50 bg-surface-elevated flex items-center justify-center text-[11px] text-muted-foreground italic">
                      No snapshot capture
                    </div>
                  )}

                  {/* Proctor Actions */}
                  {item.type === 'VIOLATION' && item.status === 'PENDING' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => reviewMutation.mutate({ logId: logIdNum, status: 'CONFIRMED' })}
                        className="flex-1 py-1 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewMutation.mutate({ logId: logIdNum, status: 'DISMISSED' })}
                        className="flex-1 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Time Extension Request History */}
      {extensionHistory.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand" />
            <span>Time Extension Request History ({extensionHistory.length})</span>
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border/80 bg-surface shadow-xs">
            <table className="w-full text-left text-xs text-foreground border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-elevated/70 text-muted-foreground uppercase text-[11px]">
                  <th className="p-3 pl-4">Requested At</th>
                  <th className="p-3">Requested Minutes</th>
                  <th className="p-3">Granted Minutes</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 pr-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {extensionHistory.map((ext) => (
                  <tr key={ext.requestId}>
                    <td className="p-3 pl-4 text-muted-foreground">
                      {new Date(ext.requestedAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-bold">+{ext.requestedMinutes} min</td>
                    <td className="p-3 font-bold text-brand">
                      {ext.grantedMinutes ? `+${ext.grantedMinutes} min` : '--'}
                    </td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{ext.reason}</td>
                    <td className="p-3 pr-4 text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ext.status === 'APPROVED'
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                            : ext.status === 'REJECTED'
                              ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {ext.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECORDING SECTION */}
      <div className="flex flex-col gap-3 print:hidden">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Video className="w-4 h-4 text-brand" />
          <span>Webcam Exam Recording</span>
        </h2>

        {recording.hasRecording && recording.recordingId ? (
          <div className="p-5 rounded-2xl border border-border/80 bg-surface shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-foreground">Continuous Webcam Video Capture</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Synchronized video recording captured throughout the exam session.
                </p>
              </div>
              <button
                type="button"
                data-testid="launch-recording-player-btn"
                onClick={() => setPlayerModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-brand bg-brand/10 hover:bg-brand/20 text-brand text-xs font-bold transition-colors cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Open Full Player</span>
              </button>
            </div>

            {/* Embedded Player View */}
            <div className="h-[420px] rounded-xl overflow-hidden border border-border">
              <RecordingPlayer
                recordingId={recording.recordingId}
                mode="fullpage"
              />
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-border/80 bg-surface shadow-xs flex flex-col items-center justify-center text-center gap-2">
            <Video className="w-8 h-8 text-muted-foreground/60 mb-1" />
            <span className="font-bold text-sm text-foreground">No Video Recording Available</span>
            <span className="text-xs text-muted-foreground max-w-md">{recording.message}</span>
          </div>
        )}
      </div>

      {/* Full Player Modal */}
      {recording.hasRecording && recording.recordingId && (
        <RecordingPlayer
          recordingId={recording.recordingId}
          isOpen={playerModalOpen}
          onClose={() => setPlayerModalOpen(false)}
          mode="modal"
        />
      )}

      {/* Lightbox Snapshot Modal */}
      {selectedSnapshot && (
        <Modal
          isOpen={Boolean(selectedSnapshot)}
          onClose={() => setSelectedSnapshot(null)}
          title="Optical Evidence Forensic Inspection"
        >
          <div className="flex flex-col gap-4">
            <EvidenceImage
              src={selectedSnapshot}
              alt="Expanded forensic evidence"
              className="w-full max-h-[75vh] object-contain rounded-xl border border-border bg-black"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 rounded-xl border border-border bg-surface text-xs font-bold hover:bg-muted transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
