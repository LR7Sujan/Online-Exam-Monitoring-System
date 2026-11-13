import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Send,
  Shield,
  Video,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { TrustRing } from '../components/ui/TrustRing';
import { LiveDot } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useProctoring, type ViolationReportResponse } from '../hooks/useProctoring';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { ViolationWarningOverlay } from '../components/student/ViolationWarningOverlay';
import { FullscreenExitOverlay } from '../components/student/FullscreenExitOverlay';
import { CameraDeniedBlocker } from '../components/student/CameraDeniedBlocker';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import type {
  AnswerOption,
  ExamSession,
  QuestionItem,
  SessionStatus,
} from '../types/domain';

interface SessionQuestionsResponse {
  sessionId: number;
  examId: number;
  status: SessionStatus;
  questions: QuestionItem[];
  responses: Array<{ question_id: number; selected_option: AnswerOption; answered_at: string }>;
}

interface TimeLeftResponse {
  sessionId: number;
  status: SessionStatus;
  trustScore: number;
  secondsLeft: number;
  serverDeadline: string;
  serverNow: string;
}

interface QueuedAnswer {
  questionId: number;
  selectedOption: AnswerOption;
  timestamp: number;
}

function formatExamTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function StudentExamPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const numericSessionId = Number(sessionId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  // Core Exam State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, AnswerOption>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [trustScore, setTrustScore] = useState<number>(100);
  const [minTrustScore, setMinTrustScore] = useState<number>(50);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('IN_PROGRESS');

  // Autosave & Offline Queue State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'queued'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('All changes synced');
  const retryQueueRef = useRef<QueuedAnswer[]>([]);

  // Submit confirmation modal
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);

  // 1. Fetch Session & Questions
  const sessionQuery = useQuery({
    queryKey: ['session-questions', numericSessionId],
    queryFn: () => api.get<SessionQuestionsResponse>(`/sessions/${numericSessionId}/questions`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
    staleTime: 60000,
  });

  // Fetch Session Meta (for min trust score)
  const metaQuery = useQuery({
    queryKey: ['session-meta', numericSessionId],
    queryFn: () => api.get<{ session: ExamSession }>(`/sessions/${numericSessionId}`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
    staleTime: 60000,
  });

  useEffect(() => {
    if (metaQuery.data?.session) {
      const s = metaQuery.data.session;
      setTrustScore(s.trust_score);
      setSessionStatus(s.status);
      if (s.min_trust_score) setMinTrustScore(s.min_trust_score);
    }
  }, [metaQuery.data]);

  // Sync initial answers and questions
  useEffect(() => {
    if (!sessionQuery.data) return;
    const { status, responses } = sessionQuery.data;
    setSessionStatus(status);

    const map: Record<number, AnswerOption> = {};
    for (const r of responses) {
      map[r.question_id] = r.selected_option;
    }
    setAnswers(map);
  }, [sessionQuery.data]);

  // 2. Offline Retry Queue Flushing
  const flushRetryQueue = useCallback(async () => {
    if (retryQueueRef.current.length === 0) return;
    const items = [...retryQueueRef.current];
    retryQueueRef.current = [];

    setSaveStatus('saving');
    for (const item of items) {
      try {
        await api.put(`/sessions/${numericSessionId}/answer`, {
          questionId: item.questionId,
          selectedOption: item.selectedOption,
        });
      } catch {
        // Re-queue if still failing
        retryQueueRef.current.push(item);
      }
    }

    if (retryQueueRef.current.length === 0) {
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
    } else {
      setSaveStatus('queued');
    }
  }, [numericSessionId]);

  useEffect(() => {
    const handleOnline = () => {
      flushRetryQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flushRetryQueue]);

  // 3. Answer Selection with Instant Optimistic Update + Autosave
  const handleSelectOption = async (questionId: number, option: AnswerOption) => {
    if (sessionStatus !== 'IN_PROGRESS') return;

    // Optimistic local state update
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setSaveStatus('saving');

    try {
      await api.put(`/sessions/${numericSessionId}/answer`, {
        questionId,
        selectedOption: option,
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
    } catch {
      // Network hiccup or offline: append to retry queue
      retryQueueRef.current.push({
        questionId,
        selectedOption: option,
        timestamp: Date.now(),
      });
      setSaveStatus('queued');
    }
  };

  // 4. Submit Examination Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ result: unknown }>(`/sessions/${numericSessionId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-result', numericSessionId] });
      navigate(`/student/results/${numericSessionId}`);
    },
    onError: () => {
      // Fallback: even if submit errored, check result endpoint
      navigate(`/student/results/${numericSessionId}`);
    },
  });

  // 5. Proctoring Listeners Hook
  const {
    isFullscreen,
    activeWarning,
    clearWarning,
    reportViolation,
    requestFullscreen,
  } = useProctoring({
    sessionId: numericSessionId,
    sessionStatus,
    enabled: sessionStatus === 'IN_PROGRESS',
    onViolationRecorded: (data: ViolationReportResponse) => {
      setTrustScore(data.trustScore);
      setSessionStatus(data.status);
    },
    onTerminated: async () => {
      setSessionStatus('TERMINATED_CHEATING');
      try {
        await api.post(`/sessions/${numericSessionId}/submit`);
      } catch (err) {
        void err;
      }
    },
  });

  // 6. Client-Side Face Detection Hook (~1 frame/sec, 0 faces for 5s -> NO_FACE, 2+ faces -> MULTIPLE_FACES)
  const {
    videoRef,
    canvasRef,
    cameraActive,
    cameraDenied,
    faceOk,
    statusText,
    retryCamera,
  } = useFaceDetection({
    enabled: sessionStatus === 'IN_PROGRESS',
    onViolation: (code, snapshot, meta) => {
      reportViolation(code, meta, snapshot);
    },
  });

  // 7. Realtime Socket Listeners for Proctor Adjustments
  useEffect(() => {
    const socket = getSocket(token);
    if (!socket || !numericSessionId) return;

    socket.emit('session:join', numericSessionId);

    const onViolation = (payload: { sessionId: number; trustScore?: number; trust_score?: number; sessionStatus?: SessionStatus; status?: SessionStatus }) => {
      if (payload.sessionId !== numericSessionId) return;
      const score = payload.trustScore ?? payload.trust_score;
      if (typeof score === 'number') setTrustScore(score);
      const st = payload.sessionStatus ?? payload.status;
      if (st) setSessionStatus(st);
    };

    const onTerminated = (payload: { sessionId: number; trustScore?: number }) => {
      if (payload.sessionId !== numericSessionId) return;
      if (typeof payload.trustScore === 'number') setTrustScore(payload.trustScore);
      setSessionStatus('TERMINATED_CHEATING');
    };

    socket.on('violation:new', onViolation);
    socket.on('session:update', onViolation);
    socket.on('session:terminated', onTerminated);

    return () => {
      socket.off('violation:new', onViolation);
      socket.off('session:update', onViolation);
      socket.off('session:terminated', onTerminated);
    };
  }, [numericSessionId, token]);

  // 8. Server-Authoritative Timer Sync & Countdown
  useEffect(() => {
    if (sessionStatus !== 'IN_PROGRESS') return;

    const fetchTimeLeft = async () => {
      try {
        const data = await api.get<TimeLeftResponse>(`/sessions/${numericSessionId}/time-left`);
        setSecondsLeft(Math.max(0, data.secondsLeft));
        setTrustScore(data.trustScore);
        if (data.status) setSessionStatus(data.status);
      } catch (err) {
        void err;
      }
    };

    fetchTimeLeft();
    const interval = setInterval(fetchTimeLeft, 15000);

    return () => clearInterval(interval);
  }, [numericSessionId, sessionStatus]);

  // Local second ticker
  useEffect(() => {
    if (sessionStatus !== 'IN_PROGRESS' || secondsLeft === null) return;

    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(tick);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [sessionStatus, secondsLeft]);

  // Auto-submit when time expires
  useEffect(() => {
    if (secondsLeft === 0 && sessionStatus === 'IN_PROGRESS') {
      submitMutation.mutate();
    }
  }, [secondsLeft, sessionStatus, submitMutation]);

  const questions = sessionQuery.data?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = secondsLeft !== null && secondsLeft <= 300; // Last 5 minutes

  return (
    <div className="relative min-h-screen bg-void text-slate-100 flex flex-col select-none overflow-x-hidden">
      {/* ============================================================== */}
      {/* TOP KIOSK HUD BAR */}
      {/* ============================================================== */}
      <header className="h-16 border-b border-white/10 bg-[#0C0E1B]/95 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Exam title & Question Counter */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan shadow-glow-cyan-sm flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-xs">
                {metaQuery.data?.session.exam_title ?? 'Active Assessment'}
              </span>
              <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
                SESSION #{numericSessionId}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Progress: <span className="text-cyan font-semibold">{answeredCount}</span> /{' '}
              {questions.length} Answered
            </div>
          </div>
        </div>

        {/* Center: Server-Synced Countdown Timer (turns red in last 5m) */}
        <div className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm tracking-wider font-bold transition-all ${
              isTimeCritical
                ? 'border-magenta bg-magenta/15 text-magenta shadow-glow-magenta animate-pulse'
                : 'border-white/10 bg-[#101222]/80 text-cyan'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-magenta animate-spin' : 'text-cyan'}`} />
            <span className="telemetry-num">
              {secondsLeft !== null ? formatExamTimer(secondsLeft) : '--:--'}
            </span>
            {isTimeCritical && (
              <span className="text-[10px] uppercase font-mono tracking-widest text-magenta hidden sm:inline">
                CRITICAL
              </span>
            )}
          </div>
        </div>

        {/* Right: Autosave status & Submit Action */}
        <div className="flex items-center gap-3">
          {/* Autosave Indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 font-mono text-xs text-slate-400"
            title={`Autosave: ${lastSavedTime}`}
          >
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald">
                <Check className="w-3.5 h-3.5" />
                <span className="text-[11px]">Saved</span>
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-cyan animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan" />
                <span className="text-[11px]">Syncing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="text-[11px]">
                  Queued ({retryQueueRef.current.length})
                </span>
              </span>
            )}
          </div>

          <NeonButton
            variant="success"
            size="sm"
            leftIcon={<Send className="w-3.5 h-3.5" />}
            onClick={() => setConfirmSubmitOpen(true)}
          >
            Submit Exam
          </NeonButton>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN EXAM WORKSPACE */}
      {/* ============================================================== */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Question & Radio Options (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          <AnimatePresence mode="wait">
            {currentQuestion ? (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Question Header Card */}
                <GlassCard className="p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 font-mono text-xs text-slate-400">
                    <span className="text-cyan font-bold tracking-wider">
                      QUESTION {currentIndex + 1} OF {questions.length}
                    </span>
                    <span>{currentQuestion.marks} Marks</span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-semibold text-white leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>
                </GlassCard>

                {/* Radio Options Grid */}
                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as AnswerOption[]).map((optKey) => {
                    const optText =
                      optKey === 'A'
                        ? currentQuestion.option_a
                        : optKey === 'B'
                        ? currentQuestion.option_b
                        : optKey === 'C'
                        ? currentQuestion.option_c
                        : currentQuestion.option_d;

                    const isSelected = answers[currentQuestion.id] === optKey;

                    return (
                      <motion.button
                        key={optKey}
                        type="button"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => handleSelectOption(currentQuestion.id, optKey)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 select-none ${
                          isSelected
                            ? 'border-cyan bg-cyan/10 shadow-glow-cyan-sm text-white font-medium'
                            : 'border-white/10 bg-[#101222]/70 hover:border-white/20 hover:bg-[#16192E]/80 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Option Badge */}
                          <div
                            className={`w-8 h-8 rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-cyan text-void shadow-glow-cyan-sm'
                                : 'bg-white/5 border border-white/10 text-slate-400'
                            }`}
                          >
                            {optKey}
                          </div>
                          <span className="text-sm leading-relaxed">{optText}</span>
                        </div>

                        {/* Radio selection circle indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-cyan bg-cyan'
                              : 'border-white/20 bg-transparent'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-void"
                            />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <GlassCard className="p-10 text-center text-slate-400 font-mono">
                No question available.
              </GlassCard>
            )}
          </AnimatePresence>

          {/* Question Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <NeonButton
              variant="ghost"
              size="sm"
              disabled={currentIndex === 0}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
            >
              Previous Question
            </NeonButton>

            <span className="font-mono text-xs text-slate-400">
              {currentIndex + 1} / {questions.length}
            </span>

            <NeonButton
              variant={currentIndex === questions.length - 1 ? 'success' : 'primary'}
              size="sm"
              rightIcon={
                currentIndex === questions.length - 1 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )
              }
              onClick={() => {
                if (currentIndex === questions.length - 1) {
                  setConfirmSubmitOpen(true);
                } else {
                  setCurrentIndex((c) => Math.min(questions.length - 1, c + 1));
                }
              }}
            >
              {currentIndex === questions.length - 1 ? 'Review & Submit' : 'Next Question'}
            </NeonButton>
          </div>
        </div>

        {/* Right Column: Palette & Proctoring Telemetry HUD (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Persistent TrustRing HUD */}
          <GlassCard
            glow={trustScore < minTrustScore ? 'magenta' : trustScore < 80 ? 'amber' : 'cyan'}
            className="p-5 flex flex-col items-center justify-center text-center space-y-3"
          >
            <div className="w-full flex items-center justify-between pb-2 border-b border-white/5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
                Integrity Index HUD
              </span>
              <span className="font-mono text-[10px] text-cyan">Live DBMS Trigger</span>
            </div>

            <TrustRing
              score={trustScore}
              minThreshold={minTrustScore}
              size="md"
              sublabel={trustScore < minTrustScore ? 'THRESHOLD BREACH' : undefined}
            />

            <div className="text-[11px] text-slate-400 font-mono">
              Minimum Threshold: <span className="text-magenta font-bold">{minTrustScore}%</span>
            </div>
          </GlassCard>

          {/* Webcam Preview Thumbnail with LiveDot, Bounding Box HUD, & Face OK Status */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LiveDot
                  color={cameraActive && faceOk ? 'emerald' : 'rose'}
                  size="sm"
                  pulse={cameraActive}
                />
                <span className="font-mono text-[11px] font-semibold text-slate-200">
                  {cameraActive ? statusText : 'CAMERA OFFLINE'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-cyan">FACIAL TELEMETRY</span>
            </div>

            <div className="relative aspect-video w-full rounded-xl border border-white/10 bg-[#0A0B14] overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none ${
                  cameraActive ? 'block' : 'hidden'
                }`}
              />
              {!cameraActive && (
                <div className="text-center p-4">
                  <Video className="w-6 h-6 text-slate-400 mx-auto" />
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Sensor unavailable
                  </span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Question Palette Grid */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="font-mono text-xs font-semibold text-white uppercase tracking-wider">
                Question Palette
              </span>
              <span className="text-[11px] font-mono text-cyan">
                {answeredCount}/{questions.length}
              </span>
            </div>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentIndex;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center relative select-none ${
                      isCurrent
                        ? 'border-2 border-cyan bg-cyan/20 text-cyan shadow-glow-cyan-sm z-10'
                        : isAnswered
                        ? 'bg-emerald/20 border border-emerald/50 text-emerald-300'
                        : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald/30 border border-emerald/60" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-white/5 border border-white/20" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded border border-cyan bg-cyan/30" />
                <span>Current</span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ============================================================== */}
      {/* PROCTORING OVERLAYS */}
      {/* ============================================================== */}

      {/* Violation Warning / Lockscreen Overlay */}
      <ViolationWarningOverlay
        warning={activeWarning}
        onDismiss={clearWarning}
        onProceedToResult={() => navigate(`/student/results/${numericSessionId}`)}
      />

      {/* Fullscreen Exit Blocking Overlay */}
      <FullscreenExitOverlay
        isOpen={!isFullscreen && sessionStatus === 'IN_PROGRESS'}
        onReEnter={requestFullscreen}
      />

      {/* Manual Submit Confirmation Modal */}
      <Modal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        title="Finalize & Grade Assessment"
        description="Submit your exam session for transactional SQL evaluation."
        footer={
          <>
            <NeonButton variant="ghost" size="sm" onClick={() => setConfirmSubmitOpen(false)}>
              Continue Working
            </NeonButton>
            <NeonButton
              variant="success"
              size="sm"
              isLoading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Confirm & Submit
            </NeonButton>
          </>
        }
      >
        <div className="space-y-3 text-xs text-slate-300 font-mono">
          <p>
            You have answered <strong className="text-cyan font-bold">{answeredCount}</strong> of{' '}
            <strong className="text-white font-bold">{questions.length}</strong> questions.
          </p>
          {answeredCount < questions.length && (
            <div className="p-3 rounded-xl border border-amber/30 bg-amber/10 text-amber">
              Warning: You have {questions.length - answeredCount} unanswered questions remaining.
            </div>
          )}
          <p className="text-slate-400">
            Once submitted, your session is locked via <code className="text-cyan">SELECT ... FOR UPDATE</code>{' '}
            and evaluated by stored procedure <code className="text-cyan">sp_SubmitAndGradeExam</code>.
          </p>
        </div>
      </Modal>

      {/* Camera Denied Blocker Overlay */}
      {cameraDenied && <CameraDeniedBlocker onRetry={retryCamera} />}
    </div>
  );
}
