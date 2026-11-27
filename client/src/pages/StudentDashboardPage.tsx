import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Play,
  Award,
  AlertTriangle,
  GraduationCap,
  Calendar,
  Lock,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusPill } from '../components/ui/StatusPill';
import { Tabs } from '../components/ui/Tabs';
import { PreExamChecklistModal } from '../components/student/PreExamChecklistModal';
import { ErrorState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { mediaSession } from '../proctoring/mediaSession';
import type { ExamItem, ExamSession } from '../types/domain';

function formatCountdown(targetDate: string): { label: string; isPast: boolean } {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) {
    return { label: '00:00:00', isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  if (days > 0) {
    return {
      label: `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
      isPast: false,
    };
  }

  return {
    label: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    isPast: false,
  };
}

export function StudentDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<string>('live');
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);
  const [checklistOpen, setChecklistOpen] = useState<boolean>(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Periodic ticker for live countdowns
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const examsQuery = useQuery({
    queryKey: ['student-exams'],
    queryFn: () => api.get<ExamItem[]>('/exams/available'),
    refetchInterval: 10000,
  });

  const startMutation = useMutation({
    mutationFn: (examId: number) =>
      api.post<ExamSession>(`/exams/${examId}/start`, {
        deviceFingerprint: `browser-${navigator.userAgent.slice(0, 40)}`,
      }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['student-exams'] });
      setChecklistOpen(false);
      if (session.status === 'IN_PROGRESS') {
        navigate(`/student/session/${session.id}`);
      } else {
        navigate(`/student/results/${session.id}`);
      }
    },
    onError: (err) => {
      mediaSession.stopAll();
      setStartError(err instanceof Error ? err.message : 'Unable to initialize exam session.');
    },
  });

  const handleStartClick = (exam: ExamItem) => {
    setStartError(null);
    if (exam.session_id && exam.session_status === 'IN_PROGRESS') {
      navigate(`/student/session/${exam.session_id}`);
      return;
    }
    setSelectedExam(exam);
    setChecklistOpen(true);
  };

  const handleChecklistComplete = async () => {
    if (!selectedExam) return;
    await startMutation.mutateAsync(selectedExam.id);
  };

  const exams = examsQuery.data ?? [];

  // Categorize exams
  const now = Date.now();
  const liveExams = exams.filter((e) => {
    const isCompleted = e.session_status && e.session_status !== 'IN_PROGRESS';
    if (isCompleted) return false;

    const start = new Date(e.start_window).getTime();
    const end = new Date(e.end_window).getTime();
    return (now >= start && now <= end) || e.session_status === 'IN_PROGRESS';
  });

  const upcomingExams = exams.filter((e) => {
    const start = new Date(e.start_window).getTime();
    return start > now && (!e.session_status || e.session_status === 'IN_PROGRESS');
  });

  const completedExams = exams.filter((e) => {
    if (e.session_status && e.session_status !== 'IN_PROGRESS') return true;
    const end = new Date(e.end_window).getTime();
    return end < now;
  });

  const filteredExams =
    activeTab === 'live'
      ? liveExams
      : activeTab === 'upcoming'
      ? upcomingExams
      : completedExams;

  return (
    <div className="space-y-8 pb-16">
      {/* Candidate Hero Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand" />
            <span className="font-mono text-xs uppercase tracking-wider text-brand font-semibold">
              Candidate Examination Console
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
            ProctorIQ assesses submissions in real time. Academic trust score starts at 100% and is
            enforced by MySQL triggers with automatic penalty deductions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl border border-border bg-surface/80 shadow-sm text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
              Identity Status
            </span>
            <span className="text-xs font-semibold text-emerald-500 flex items-center justify-end gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              VERIFIED CANDIDATE
            </span>
          </div>
        </div>
      </div>

      {/* Start Error Banner */}
      {startError && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
          <span>{startError}</span>
        </div>
      )}

      {/* Examination Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          tabs={[
            {
              id: 'live',
              label: 'Live Assessments',
              badge: liveExams.length > 0 ? liveExams.length : undefined,
            },
            {
              id: 'upcoming',
              label: 'Upcoming Window',
              badge: upcomingExams.length > 0 ? upcomingExams.length : undefined,
            },
            {
              id: 'completed',
              label: 'Completed & Graded',
              badge: completedExams.length > 0 ? completedExams.length : undefined,
            },
          ]}
        />

        <span className="text-xs font-mono text-muted-foreground">
          Showing {filteredExams.length} examinations
        </span>
      </div>

      {/* Exam Grid */}
      {examsQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-surface p-6 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-6 w-3/4 rounded" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : examsQuery.isError ? (
        <ErrorState
          title="Unable to Load Assessments"
          description="Failed to retrieve examination schedule from server. Please retry."
          onRetry={() => examsQuery.refetch()}
        />
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-border bg-surface/80 space-y-3">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            No examinations in this category
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {activeTab === 'live'
              ? 'No exams currently within their open delivery window. Check the Upcoming tab for scheduled tests.'
              : activeTab === 'upcoming'
              ? 'There are no upcoming scheduled assessments assigned to your cohort.'
              : 'You have not completed any examinations yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredExams.map((exam) => {
            const hasSession = Boolean(exam.session_id);
            const isInProgress = exam.session_status === 'IN_PROGRESS';
            const isClosed = hasSession && exam.session_status && exam.session_status !== 'IN_PROGRESS';
            const isWindowEnded = now > new Date(exam.end_window).getTime();

            const startCountdown = formatCountdown(exam.start_window);
            const endCountdown = formatCountdown(exam.end_window);

            const isWindowOpen =
              (now >= new Date(exam.start_window).getTime() &&
                now <= new Date(exam.end_window).getTime()) ||
              isInProgress;

            const isUpcoming = new Date(exam.start_window).getTime() > now;

            return (
              <div key={exam.id} data-testid={`exam-card-${exam.id}`}>
                <div className="p-6 rounded-2xl border border-border bg-surface/85 hover:bg-surface hover:border-brand/40 shadow-sm hover:shadow-layered-sm transition-all duration-300 flex flex-col justify-between h-full space-y-6">
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-semibold text-brand">
                          EXAM #{exam.id}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {exam.session_status ? (
                            <StatusPill status={exam.session_status} size="sm" />
                          ) : isWindowOpen ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              WINDOW OPEN
                            </span>
                          ) : isUpcoming ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30">
                              SCHEDULED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-surface-elevated text-muted-foreground border border-border">
                              CLOSED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-xl font-bold text-foreground tracking-tight">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {exam.description}
                        </p>
                      )}

                      {/* Exam Specs Table */}
                      <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl border border-border bg-surface-elevated/70 p-3 text-xs font-mono">
                        <div>
                          <span className="text-muted-foreground text-[10px] block uppercase">
                            Duration
                          </span>
                          <span className="font-bold text-foreground">
                            {exam.duration_minutes} Mins
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block uppercase">
                            Questions
                          </span>
                          <span className="font-bold text-foreground">
                            {exam.question_count ?? 20} Qs
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-[10px] block uppercase">
                            Min Trust
                          </span>
                          <span className="font-bold text-rose-500">
                            {exam.min_trust_score ?? 50}%
                          </span>
                        </div>
                      </div>

                      {/* Countdown Timer Display */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand" />
                          {isUpcoming
                            ? 'Starts in:'
                            : isWindowOpen
                            ? 'Window closes in:'
                            : 'Assessment status:'}
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-md text-[11px] border ${
                            isUpcoming
                              ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                              : isWindowOpen
                              ? 'text-brand border-brand/30 bg-brand/10 animate-pulse'
                              : 'text-muted-foreground border-border bg-surface-elevated'
                          }`}
                        >
                          {isUpcoming
                            ? startCountdown.label
                            : isWindowOpen
                            ? endCountdown.label
                            : `Closed on ${new Date(exam.end_window).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      {isClosed ? (
                        <button
                          type="button"
                          className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-foreground bg-surface-elevated hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          onClick={() => navigate(`/student/results/${exam.session_id}`)}
                        >
                          <Award className="w-4 h-4 text-brand" />
                          <span>View Official Integrity Report</span>
                        </button>
                      ) : isInProgress ? (
                        <button
                          type="button"
                          className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                          onClick={() => navigate(`/student/session/${exam.session_id}`)}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Resume Active Session (Trust: {exam.session_trust_score}%)</span>
                        </button>
                      ) : isWindowEnded ? (
                        <button
                          type="button"
                          disabled
                          data-testid="window-closed-button"
                          className="w-full py-2.5 px-4 rounded-xl font-medium text-xs text-muted-foreground bg-surface-elevated border border-border transition-all flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                        >
                          <Lock className="w-4 h-4 text-muted-foreground" />
                          <span>Window closed</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!isWindowOpen}
                          className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-accent-foreground bg-gradient-to-r from-accent-from via-accent-via to-accent-to hover:opacity-95 shadow-md shadow-accent/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => handleStartClick(exam)}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>
                            {isWindowOpen
                              ? 'Launch Pre-Exam Checklist'
                              : `Opens in ${startCountdown.label}`}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Pre-Exam Checklist Modal */}
      <PreExamChecklistModal
        isOpen={checklistOpen}
        exam={selectedExam}
        onClose={() => setChecklistOpen(false)}
        onComplete={handleChecklistComplete}
        isLoading={startMutation.isPending}
      />
    </div>
  );
}
