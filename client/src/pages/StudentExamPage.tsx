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
      await flushRetryQueue();
      return api.post<{ result: unknown }>(`/sessions/${numericSessionId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-result', numericSessionId] });
      navigate(`/student/results/${numericSessionId}`);
    },
    onError: () => {
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

  // Screen-edge glow styles based on trust score
  const isCriticalRisk = trustScore < minTrustScore;
  const isWarningRisk = trustScore < 80;

  return (
    <div
      className={`relative min-h-screen bg-background text-foreground flex flex-col select-none overflow-x-hidden transition-all duration-700 ease-out ${
        isCriticalRisk
          ? 'shadow-[inset_0_0_100px_rgba(244,63,94,0.35)] ring-2 ring-rose-500/50'
          : isWarningRisk
          ? 'shadow-[inset_0_0_70px_rgba(245,158,11,0.22)] ring-1 ring-amber-500/40'
          : ''
      }`}
    >
      {/* Background Dotted Grid */}
      <div className="fixed inset-0 bg-dotted-grid pointer-events-none opacity-30" />

      {/* ============================================================== */}
      {/* MINIMAL TOP HUD BAR */}
      {/* ============================================================== */}
      <header className="h-16 border-b border-border/70 bg-surface/85 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Exam title & Progress */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand shadow-sm flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate max-w-[180px] sm:max-w-xs">
                {metaQuery.data?.session.exam_title ?? 'Active Assessment'}
              </span>
              <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded bg-surface-elevated">
                SESSION #{numericSessionId}
              </span>
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Progress: <span className="text-brand font-semibold">{answeredCount}</span> /{' '}
              {questions.length} Answered
            </div>
          </div>
        </div>

        {/* Center: Server-Synced Countdown Timer & TrustRing */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm tracking-wider font-bold transition-all ${
              isTimeCritical
                ? 'border-rose-500 bg-rose-500/15 text-rose-500 shadow-md animate-pulse'
                : 'border-border bg-surface-elevated/80 text-foreground'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-500 animate-spin' : 'text-brand'}`} />
            <span>
              {secondsLeft !== null ? formatExamTimer(secondsLeft) : '--:--'}
            </span>
            {isTimeCritical && (
              <span className="text-[10px] uppercase font-mono tracking-widest text-rose-500 hidden sm:inline">
                CRITICAL
              </span>
            )}
          </div>
        </div>

        {/* Right: Autosave status & Submit Action */}
        <div className="flex items-center gap-3">
          {/* Autosave Indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 font-mono text-xs text-muted-foreground"
            title={`Autosave: ${lastSavedTime}`}
          >
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-emerald-500">
                <Check className="w-3.5 h-3.5" />
                <span className="text-[11px]">Saved</span>
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="flex items-center gap-1 text-brand animate-pulse">
                <span className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-[11px]">Syncing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-500">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="text-[11px]">
                  Queued ({retryQueueRef.current.length})
                </span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setConfirmSubmitOpen(true)}
            className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Exam</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN EXAM WORKSPACE */}
      {/* ============================================================== */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-28 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        {/* Left / Center Column: Active Question & Radio Options (8 cols) */}
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
                <div className="p-6 sm:p-8 rounded-3xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/70 font-mono text-xs text-muted-foreground">
                    <span className="text-brand font-bold tracking-wider">
                      QUESTION {currentIndex + 1} OF {questions.length}
                    </span>
                    <span className="px-2 py-0.5 rounded-md border border-border bg-surface-elevated">
                      {currentQuestion.marks} Marks
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-2xl font-bold text-foreground leading-relaxed">
                    {currentQuestion.question_text}
                  </h2>
                </div>

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
                        whileHover={{ scale: 1.006 }}
                        whileTap={{ scale: 0.994 }}
                        onClick={() => handleSelectOption(currentQuestion.id, optKey)}
                        className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 select-none cursor-pointer ${
                          isSelected
                            ? 'border-brand bg-brand/10 shadow-sm text-foreground font-medium'
                            : 'border-border bg-surface/70 hover:border-brand/40 hover:bg-surface text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Option Badge */}
                          <div
                            className={`w-8 h-8 rounded-xl font-mono text-xs font-bold flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-sm'
                                : 'bg-surface-elevated border border-border text-muted-foreground'
                            }`}
                          >
                            {optKey}.
                          </div>
                          <span className="text-sm sm:text-base leading-relaxed">{optText}</span>
                        </div>

                        {/* Radio selection circle indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-brand bg-brand'
                              : 'border-border bg-transparent'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <div className="p-10 text-center text-muted-foreground font-mono rounded-2xl border border-border bg-surface">
                No question available.
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Palette & Proctoring Telemetry HUD (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* TrustRing Card */}
          <div className="p-5 rounded-3xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-sm flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-full flex items-center justify-between pb-2 border-b border-border/70">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Integrity Index HUD
              </span>
              <span className="font-mono text-[10px] text-brand font-medium">Live DBMS Trigger</span>
            </div>

            <TrustRing
              score={trustScore}
              minThreshold={minTrustScore}
              size="md"
              sublabel={trustScore < minTrustScore ? 'THRESHOLD BREACH' : undefined}
            />

            <div className="text-[11px] text-muted-foreground font-mono">
              Minimum Threshold: <span className="text-rose-500 font-bold">{minTrustScore}%</span>
            </div>
          </div>

          {/* Webcam Preview Thumbnail with LiveDot & Face OK Status */}
          <div className="p-4 rounded-3xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LiveDot
                  color={cameraActive && faceOk ? 'emerald' : 'rose'}
                  size="sm"
                  pulse={cameraActive}
                />
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {cameraActive ? statusText : 'CAMERA OFFLINE'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-brand font-medium">FACIAL TELEMETRY</span>
            </div>

            <div className="relative aspect-video w-full rounded-2xl border border-border bg-background overflow-hidden flex items-center justify-center shadow-inner">
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
                  <Video className="w-6 h-6 text-muted-foreground mx-auto" />
                  <span className="text-[10px] text-muted-foreground block mt-1">
                    Sensor unavailable
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Question Palette Grid */}
          <div className="p-5 rounded-3xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/70">
              <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">
                Question Palette
              </span>
              <span className="text-[11px] font-mono text-brand font-semibold">
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
                    className={`h-9 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center relative select-none cursor-pointer ${
                      isCurrent
                        ? 'border-2 border-brand bg-brand/20 text-brand shadow-sm z-10'
                        : isAnswered
                        ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-500'
                        : 'bg-surface-elevated border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-2 border-t border-border/70 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500/60" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-surface-elevated border border-border" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded border border-brand bg-brand/30" />
                <span>Current</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FLOATING BOTTOM BAR FOR PREV / NEXT */}
      {/* ============================================================== */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 rounded-2xl border border-border bg-surface/90 backdrop-blur-xl shadow-layered-md">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
          className="py-2 px-3.5 rounded-xl text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous Question</span>
        </button>

        <span className="font-mono text-xs text-muted-foreground px-2 border-x border-border/80">
          Question {currentIndex + 1} of {questions.length}
        </span>

        <button
          type="button"
          onClick={() => {
            if (currentIndex === questions.length - 1) {
              setConfirmSubmitOpen(true);
            } else {
              setCurrentIndex((c) => Math.min(questions.length - 1, c + 1));
            }
          }}
          className={`py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
            currentIndex === questions.length - 1
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95'
              : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 hover:opacity-95'
          }`}
        >
          <span>{currentIndex === questions.length - 1 ? 'Review & Submit' : 'Next Question'}</span>
          {currentIndex === questions.length - 1 ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
        </button>
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
            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(false)}
              className="py-2 px-3.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground border border-border hover:bg-muted transition-colors cursor-pointer"
            >
              Continue Working
            </button>
            <button
              type="button"
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-sm transition-all cursor-pointer"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Confirm & Submit'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs text-foreground font-mono">
          <p>
            You have answered <strong className="text-brand font-bold">{answeredCount}</strong> of{' '}
            <strong className="text-foreground font-bold">{questions.length}</strong> questions.
          </p>
          {answeredCount < questions.length && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500">
              Warning: You have {questions.length - answeredCount} unanswered questions remaining.
            </div>
          )}
          <p className="text-muted-foreground">
            Once submitted, your session is locked via <code className="text-brand font-bold">SELECT ... FOR UPDATE</code>{' '}
            and evaluated by stored procedure <code className="text-brand font-bold">sp_SubmitAndGradeExam</code>.
          </p>
        </div>
      </Modal>

      {/* Camera Denied Blocker Overlay */}
      {cameraDenied && <CameraDeniedBlocker onRetry={retryCamera} />}
    </div>
  );
}
