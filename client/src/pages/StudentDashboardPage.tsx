import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Play,
  Award,
  AlertTriangle,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { StatusPill } from '../components/ui/StatusPill';
import { NeonButton } from '../components/ui/NeonButton';
import { Tabs } from '../components/ui/Tabs';
import { PreExamChecklistModal } from '../components/student/PreExamChecklistModal';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
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
      setStartError(err instanceof Error ? err.message : 'Unable to initialize exam session.');
    },
  });

  const handleStartClick = (exam: ExamItem) => {
    setStartError(null);
    if (exam.session_id && exam.session_status === 'IN_PROGRESS') {
      // Resume active session directly
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
    const isCompleted =
      e.session_status &&
      e.session_status !== 'IN_PROGRESS';
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
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan" />
            <span className="font-mono text-xs uppercase tracking-wider text-cyan font-semibold">
              Candidate Examination Console
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome, {user?.fullName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
            ProctorIQ assesses submissions in real time. Academic trust score starts at 100% and is
            enforced by MySQL triggers with automatic penalty deductions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl border border-white/10 bg-[#101222]/80 text-right">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Identity Status
            </span>
            <span className="text-xs font-semibold text-emerald flex items-center justify-end gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
              VERIFIED CANDIDATE
            </span>
          </div>
        </div>
      </div>

      {/* Start Error Banner */}
      {startError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 rounded-xl border border-magenta/40 bg-magenta/10 p-3.5 text-xs text-rose-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-magenta mt-0.5" />
          <span>{startError}</span>
        </motion.div>
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

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredExams.length} examinations
        </span>
      </div>

      {/* Exam Grid */}
      {examsQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card h-64 animate-pulse p-6" />
          ))}
        </div>
      ) : filteredExams.length === 0 ? (
        <GlassCard className="p-12 text-center space-y-3">
          <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-white">
            No examinations in this category
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'live'
              ? 'No exams currently within their open delivery window. Check the Upcoming tab for scheduled tests.'
              : activeTab === 'upcoming'
              ? 'There are no upcoming scheduled assessments assigned to your cohort.'
              : 'You have not completed any examinations yet.'}
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {filteredExams.map((exam, idx) => {
              const hasSession = Boolean(exam.session_id);
              const isInProgress = exam.session_status === 'IN_PROGRESS';
              const isClosed =
                hasSession && exam.session_status && exam.session_status !== 'IN_PROGRESS';

              const startCountdown = formatCountdown(exam.start_window);
              const endCountdown = formatCountdown(exam.end_window);

              const isWindowOpen =
                (now >= new Date(exam.start_window).getTime() &&
                  now <= new Date(exam.end_window).getTime()) ||
                isInProgress;

              const isUpcoming = new Date(exam.start_window).getTime() > now;

              const cardGlow =
                exam.session_status === 'TERMINATED_CHEATING'
                  ? 'magenta'
                  : isInProgress
                  ? 'cyan'
                  : isClosed
                  ? 'emerald'
                  : 'none';

              return (
                <motion.div
                  key={exam.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <GlassCard
                    glow={cardGlow}
                    hoverEffect
                    className="p-6 flex flex-col justify-between h-full space-y-6"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="font-mono text-xs font-semibold text-cyan">
                          EXAM #{exam.id}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {exam.session_status ? (
                            <StatusPill status={exam.session_status} size="sm" />
                          ) : isWindowOpen ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan/15 text-cyan border border-cyan/30 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
                              WINDOW OPEN
                            </span>
                          ) : isUpcoming ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber/15 text-amber border border-amber/30">
                              SCHEDULED
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
                              CLOSED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-xl font-bold text-white tracking-tight">
                        {exam.title}
                      </h3>
                      {exam.description && (
                        <p className="mt-2 text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {exam.description}
                        </p>
                      )}

                      {/* Exam Specs Table */}
                      <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl border border-white/5 bg-[#0A0B14]/70 p-3 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 text-[10px] block uppercase">
                            Duration
                          </span>
                          <span className="font-bold text-white">
                            {exam.duration_minutes} Mins
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block uppercase">
                            Questions
                          </span>
                          <span className="font-bold text-white">
                            {exam.question_count ?? 20} Qs
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block uppercase">
                            Min Trust
                          </span>
                          <span className="font-bold text-magenta">
                            {exam.min_trust_score ?? 50}%
                          </span>
                        </div>
                      </div>

                      {/* Countdown Timer Display */}
                      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-cyan" />
                          {isUpcoming
                            ? 'Starts in:'
                            : isWindowOpen
                            ? 'Window closes in:'
                            : 'Assessment status:'}
                        </span>
                        <span
                          className={`font-bold ${
                            isUpcoming
                              ? 'text-amber'
                              : isWindowOpen
                              ? 'text-cyan animate-pulse'
                              : 'text-slate-400'
                          }`}
                        >
                          {isUpcoming
                            ? startCountdown.label
                            : isWindowOpen
                            ? endCountdown.label
                            : 'Window Closed'}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      {isClosed ? (
                        <NeonButton
                          variant="outline"
                          size="md"
                          className="w-full"
                          leftIcon={<Award className="w-4 h-4 text-cyan" />}
                          onClick={() => navigate(`/student/results/${exam.session_id}`)}
                        >
                          View Official Integrity Report
                        </NeonButton>
                      ) : isInProgress ? (
                        <NeonButton
                          variant="primary"
                          size="md"
                          className="w-full"
                          leftIcon={<Play className="w-4 h-4" />}
                          onClick={() => navigate(`/student/session/${exam.session_id}`)}
                        >
                          Resume Active Session (Trust: {exam.session_trust_score}%)
                        </NeonButton>
                      ) : (
                        <NeonButton
                          variant="primary"
                          size="md"
                          className="w-full"
                          disabled={!isWindowOpen}
                          leftIcon={<Play className="w-4 h-4" />}
                          onClick={() => handleStartClick(exam)}
                        >
                          {isWindowOpen
                            ? 'Launch Pre-Exam Checklist'
                            : `Opens in ${startCountdown.label}`}
                        </NeonButton>
                      )}
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
