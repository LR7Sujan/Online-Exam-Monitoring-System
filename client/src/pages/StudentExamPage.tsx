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
  ShieldAlert,
  Video,
  WifiOff,
  Mic,
  Smartphone,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TrustRing } from '../components/ui/TrustRing';
import { LiveDot, Skeleton, ErrorState } from '../components/ui';
import { Modal } from '../components/ui/Modal';
import { useProctoring, type ViolationReportResponse } from '../hooks/useProctoring';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { usePhoneDetection } from '../hooks/usePhoneDetection';
import { useVoiceDetection } from '../hooks/useVoiceDetection';
import { ViolationWarningOverlay } from '../components/student/ViolationWarningOverlay';
import { WarningHistoryDrawer } from '../components/student/WarningHistoryDrawer';
import { FullscreenExitOverlay } from '../components/student/FullscreenExitOverlay';
import { CameraDeniedBlocker } from '../components/student/CameraDeniedBlocker';
import { TimeExtensionModal } from '../components/student/TimeExtensionModal';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../store/authStore';
import { mediaSession } from '../proctoring/mediaSession';
import type {
  AnswerOption,
  ExamSession,
  QuestionItem,
  SessionStatus,
  TimeExtensionRequest,
  ViolationCode,
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
  useDocumentTitle('Live Kiosk Examination | ProctorIQ');
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
  const [maxExtensionMins, setMaxExtensionMins] = useState<number>(30);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('IN_PROGRESS');
  const [extensionRequest, setExtensionRequest] = useState<TimeExtensionRequest | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState<boolean>(false);
  const [isWarningHistoryOpen, setIsWarningHistoryOpen] = useState<boolean>(false);
  const [inGraceWindow, setInGraceWindow] = useState<boolean>(false);
  const [grantedToast, setGrantedToast] = useState<number | null>(null);

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
    queryFn: () =>
      api.get<{
        session: ExamSession;
        pendingWarning?: Record<string, unknown> | null;
      }>(`/sessions/${numericSessionId}`),
    enabled: Number.isInteger(numericSessionId) && numericSessionId > 0,
    staleTime: 60000,
  });

  useEffect(() => {
    if (metaQuery.data?.session) {
      const s = metaQuery.data.session;
      setTrustScore(s.trust_score);
      setSessionStatus(s.status);
      if (s.min_trust_score) setMinTrustScore(s.min_trust_score);
      if (s.max_extension_mins !== undefined) setMaxExtensionMins(s.max_extension_mins);
      if (s.extension_request) {
        setExtensionRequest(s.extension_request);
        if (s.extension_request.status === 'PENDING') {
          setIsExtensionModalOpen(true);
        }
      }
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
    if (sessionStatus !== 'IN_PROGRESS' || activeWarning !== null) return;
    if (extensionRequest?.status === 'PENDING') return;

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
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ['session-result', numericSessionId] });
      navigate(`/student/results/${numericSessionId}`);
    },
    onError: () => {
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      navigate(`/student/results/${numericSessionId}`);
    },
  });

  // 5. Proctoring Listeners Hook
  const {
    isFullscreen,
    activeWarning,
    setActiveWarning,
    clearWarning,
    isDetectionPaused,
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
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      try {
        await api.post(`/sessions/${numericSessionId}/submit`);
      } catch (err) {
        void err;
      }
    },
  });

  // Restore pending warning on page reload
  useEffect(() => {
    const pw =
      metaQuery.data?.pendingWarning ||
      (sessionQuery.data as unknown as { pendingWarning?: unknown })?.pendingWarning;
    if (pw && typeof pw === 'object') {
      const p = pw as Record<string, unknown>;
      const s = metaQuery.data?.session;
      setActiveWarning({
        sessionId: numericSessionId,
        trustScore: (p.trustScoreAfter as number) ?? 100,
        minTrustScore: (s?.min_trust_score as number) ?? 50,
        status: (s?.status as SessionStatus) ?? 'IN_PROGRESS',
        isTerminated: false,
        violationCode: (p.violationCode as ViolationCode) ?? 'UNAUTHORIZED_ACTION',
        violationLabel: p.violationLabel as string | undefined,
        penaltyApplied: p.penaltyPoints as number | undefined,
        snapshotUrl: p.snapshotUrl as string | null | undefined,
        warning: {
          warningId: p.warningId as number,
          sessionId: numericSessionId,
          logId: p.logId as number,
          violationCode: p.violationCode as string,
          violationLabel: p.violationLabel as string | undefined,
          message: p.message as string,
          penaltyPoints: p.penaltyPoints as number,
          trustScoreAfter: p.trustScoreAfter as number,
          warningCount: (p.warningCount as number) ?? 1,
          issuedAt: p.issuedAt as string,
        },
      });
    }
  }, [metaQuery.data, sessionQuery.data, numericSessionId, setActiveWarning]);

  const settingsQuery = useQuery({
    queryKey: ['system-settings'],
    queryFn: () => api.get<Record<string, string>>('/settings'),
    staleTime: 300000,
  });
  const phoneConfidenceThreshold = Number(settingsQuery.data?.phone_confidence_threshold) || 0.6;

  // 6. Client-Side Face Detection Hook (staggered 300ms, off-thread reporting)
  const {
    videoRef,
    canvasRef,
    cameraActive,
    cameraDenied,
    deniedDevice,
    stream,
    faceOk,
    statusText,
    retryCamera,
  } = useFaceDetection({
    enabled: sessionStatus === 'IN_PROGRESS',
    isPaused: isDetectionPaused,
    onViolation: (code, meta, snapshot) => {
      reportViolation(code, meta, snapshot);
    },
  });

  // 7. Client-Side Phone Detection Hook (staggered 250ms, instant single-frame penalty)
  const { phoneStatusText } = usePhoneDetection({
    videoRef,
    enabled: sessionStatus === 'IN_PROGRESS',
    isPaused: isDetectionPaused,
    confidenceThreshold: phoneConfidenceThreshold,
    onViolation: (code, meta, snapshot) => {
      reportViolation(code, meta, snapshot);
    },
  });

  // 8. Client-Side Voice Detection Hook (Web Audio API, 4s speech in 6s window -> VOICE_DETECTED)
  const { micOk } = useVoiceDetection({
    stream,
    videoRef,
    enabled: sessionStatus === 'IN_PROGRESS',
    isPaused: isDetectionPaused,
    onViolation: (code, meta, snapshot) => {
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
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };

    const onExtensionDecided = (payload: {
      sessionId: number;
      decision: 'APPROVED' | 'REJECTED';
      grantedMinutes?: number;
      status?: string;
    }) => {
      if (payload.sessionId !== numericSessionId) return;
      if (payload.decision === 'APPROVED') {
        const mins = Number(payload.grantedMinutes ?? 5);
        setGrantedToast(mins);
        setExtensionRequest(null);
        setIsExtensionModalOpen(false);
        setSecondsLeft(mins * 60);
      } else if (payload.decision === 'REJECTED') {
        setExtensionRequest((prev) =>
          prev
            ? { ...prev, status: 'REJECTED' }
            : {
                request_id: 0,
                session_id: numericSessionId,
                requested_minutes: 0,
                reason: null,
                status: 'REJECTED',
                granted_minutes: 0,
                decided_by: null,
                decided_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              }
        );
        setIsExtensionModalOpen(true);
        setTimeout(() => {
          submitMutation.mutate();
        }, 1500);
      }
    };

    const onWarningIssued = (payload: {
      warningId: number;
      sessionId: number;
      logId: number;
      violationCode: string;
      violationLabel?: string;
      message: string;
      penaltyPoints: number;
      trustScoreAfter: number;
      warningCount: number;
      issuedAt: string;
      snapshotUrl?: string | null;
    }) => {
      if (payload.sessionId !== numericSessionId) return;
      setTrustScore(payload.trustScoreAfter);
      metaQuery.refetch();
      setActiveWarning({
        sessionId: numericSessionId,
        trustScore: payload.trustScoreAfter,
        minTrustScore,
        status: sessionStatus,
        isTerminated: false,
        violationCode: (payload.violationCode as ViolationCode) ?? 'UNAUTHORIZED_ACTION',
        violationLabel: payload.violationLabel,
        penaltyApplied: payload.penaltyPoints,
        snapshotUrl: payload.snapshotUrl,
        warning: payload,
      });
    };

    const onSnapshotReady = (payload: { logId: number; sessionId: number; snapshotUrl: string }) => {
      if (payload.sessionId !== numericSessionId) return;
      setActiveWarning((prev) => {
        if (prev && (prev.logId === payload.logId || prev.warning?.logId === payload.logId)) {
          return {
            ...prev,
            snapshotUrl: payload.snapshotUrl,
            snapshot_url: payload.snapshotUrl,
          };
        }
        return prev;
      });
    };

    socket.on('violation:new', onViolation);
    socket.on('session:update', onViolation);
    socket.on('session:terminated', onTerminated);
    socket.on('extension:decided', onExtensionDecided);
    socket.on('warning:issued', onWarningIssued);
    socket.on('log:snapshot_ready', onSnapshotReady);

    return () => {
      socket.off('violation:new', onViolation);
      socket.off('session:update', onViolation);
      socket.off('session:terminated', onTerminated);
      socket.off('extension:decided', onExtensionDecided);
      socket.off('warning:issued', onWarningIssued);
      socket.off('log:snapshot_ready', onSnapshotReady);
    };
  }, [numericSessionId, token, submitMutation, metaQuery, minTrustScore, sessionStatus, setActiveWarning]);

  // 8. Server-Authoritative Heartbeat & Timer Sync (every 15s)
  useEffect(() => {
    if (sessionStatus !== 'IN_PROGRESS') return;

    const postHeartbeat = async () => {
      try {
        const data = await api.post<
          TimeLeftResponse & {
            secondsRemaining?: number;
            maxExtensionMins?: number;
            extensionRequest?: TimeExtensionRequest | null;
            inGraceWindow?: boolean;
          }
        >(`/sessions/${numericSessionId}/heartbeat`);
        const remaining = data.secondsLeft !== undefined ? data.secondsLeft : (data.secondsRemaining ?? 0);
        setSecondsLeft(Math.max(0, remaining));
        setTrustScore(data.trustScore);
        if (data.status) setSessionStatus(data.status);
        if (data.maxExtensionMins !== undefined) setMaxExtensionMins(data.maxExtensionMins);
        if (data.inGraceWindow !== undefined) setInGraceWindow(data.inGraceWindow);
        if (data.extensionRequest) {
          setExtensionRequest(data.extensionRequest);
          if (data.extensionRequest.status === 'PENDING') {
            setIsExtensionModalOpen(true);
          }
        }
      } catch (err) {
        void err;
      }
    };

    postHeartbeat();
    const interval = setInterval(postHeartbeat, 15000);

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

  // Auto-submit when time expires (or prompt for time extension if permitted)
  useEffect(() => {
    if (secondsLeft === 0 && sessionStatus === 'IN_PROGRESS') {
      const allowsExt = maxExtensionMins > 0;
      if (allowsExt && (!extensionRequest || extensionRequest.status === 'PENDING')) {
        setIsExtensionModalOpen(true);
      } else {
        submitMutation.mutate();
      }
    }
  }, [secondsLeft, sessionStatus, maxExtensionMins, extensionRequest, submitMutation]);

  // Stop all media and exit fullscreen on unmount (leaving route)
  useEffect(() => {
    return () => {
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Stop all media when terminal status reached
  useEffect(() => {
    if (sessionStatus === 'TERMINATED_CHEATING' || sessionStatus === 'SUBMITTED') {
      mediaSession.stopAll();
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [sessionStatus]);

  const handleRequestExtension = async (minutes: number, reasonText?: string) => {
    const res = await api.post<{ requestId: number; status: 'PENDING' }>(
      `/sessions/${numericSessionId}/extension`,
      { requestedMinutes: minutes, reason: reasonText }
    );
    setExtensionRequest({
      request_id: res.requestId,
      session_id: numericSessionId,
      requested_minutes: minutes,
      reason: reasonText ?? null,
      status: 'PENDING',
      granted_minutes: null,
      decided_by: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    });
    setIsExtensionModalOpen(true);
  };

  const questions = sessionQuery.data?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = secondsLeft !== null && secondsLeft <= 300; // Last 5 minutes

  // Screen-edge glow styles based on trust score
  const isCriticalRisk = trustScore < minTrustScore;
  const isWarningRisk = trustScore < 80;

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <ErrorState
            title="Failed to Load Examination Session"
            description="Could not securely initialize assessment telemetry and questions. Please check connection and retry."
            onRetry={() => sessionQuery.refetch()}
          />
        </div>
      </div>
    );
  }

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
              {Boolean(metaQuery.data?.session?.paper_code) && (
                <span
                  data-testid="hud-paper-code"
                  className="font-mono text-[11px] font-bold text-brand bg-brand/10 border border-brand/30 px-2 py-0.5 rounded-md shadow-sm"
                >
                  {metaQuery.data?.session?.paper_code}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              Progress: <span className="text-brand font-semibold">{answeredCount}</span> /{' '}
              {questions.length} Answered
            </div>
          </div>
        </div>

        {/* Center: Server-Synced Countdown Timer & HUD Extension Action */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm tracking-wider font-bold transition-all ${
              isTimeCritical
                ? 'border-rose-500 bg-rose-500/15 text-rose-500 shadow-md animate-pulse'
                : 'border-border bg-surface-elevated/80 text-foreground'
            }`}
          >
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-500 animate-spin' : 'text-brand'}`} />
            <span data-testid="exam-timer">
              {secondsLeft !== null ? formatExamTimer(secondsLeft) : '--:--'}
            </span>
            {isTimeCritical && (
              <span className="text-[10px] uppercase font-mono tracking-widest text-rose-500 hidden sm:inline">
                CRITICAL
              </span>
            )}
          </div>

          {/* Persistent Request Extra Time HUD button (visible when <= 10 mins, in grace window, or request exists) */}
          {maxExtensionMins > 0 &&
            sessionStatus === 'IN_PROGRESS' &&
            ((secondsLeft !== null && secondsLeft <= 600) || inGraceWindow || extensionRequest !== null) && (
              <div>
                {extensionRequest?.status === 'PENDING' ? (
                  <button
                    type="button"
                    disabled
                    data-testid="hud-request-pending-button"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-500 font-mono text-xs font-semibold cursor-not-allowed opacity-90 shadow-sm"
                  >
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Request pending</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsExtensionModalOpen(true)}
                    data-testid="hud-request-extension-button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold transition-all cursor-pointer ${
                      isTimeCritical
                        ? 'border-brand/60 bg-brand/20 text-brand shadow-sm animate-pulse hover:bg-brand/30'
                        : 'border-border bg-surface-elevated/80 hover:bg-muted text-foreground hover:border-brand/40'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    <span>Request extra time</span>
                  </button>
                )}
              </div>
            )}

          {/* Warnings (N) History Button */}
          <button
            type="button"
            onClick={() => setIsWarningHistoryOpen(true)}
            data-testid="hud-warnings-button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface-elevated/80 hover:bg-muted text-foreground font-mono text-xs font-semibold transition-all cursor-pointer hover:border-amber-500/40"
          >
            <ShieldAlert
              className={`w-3.5 h-3.5 ${
                (metaQuery.data?.session?.warning_count ?? 0) > 0
                  ? 'text-amber-500 animate-pulse'
                  : 'text-muted-foreground'
              }`}
            />
            <span>Warnings ({metaQuery.data?.session?.warning_count ?? 0})</span>
          </button>

          {/* Mic Telemetry Status */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border bg-surface-elevated/80 font-mono text-xs text-muted-foreground"
            data-testid="hud-mic-status"
            title="Microphone Analysis: Active & Monitored"
          >
            <Mic className={`w-3.5 h-3.5 ${micOk ? 'text-emerald-500' : 'text-rose-500'}`} />
            <span className="text-[11px] font-semibold">{micOk ? 'Mic OK' : 'Mic Off'}</span>
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
            data-testid="hud-submit-exam-button"
            onClick={() => setConfirmSubmitOpen(true)}
            className="py-2 px-3.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit Exam</span>
          </button>
        </div>
      </header>

      {/* Time Extension Granted Toast */}
      {grantedToast !== null && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 text-xs font-mono px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Extra time approved! +{grantedToast} minutes granted. Your answers are unlocked.</span>
            </span>
            <button
              type="button"
              onClick={() => setGrantedToast(null)}
              className="text-xs font-bold underline hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 5-minute Warning Banner: Request Extra Time */}
      {secondsLeft !== null && secondsLeft <= 300 && secondsLeft > 0 && maxExtensionMins > 0 && !extensionRequest && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3" data-testid="extension-notice-banner">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-mono px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0 animate-pulse" />
              <span>Need more time? Request extra time from your proctor before your window closes.</span>
            </span>
            <button
              type="button"
              onClick={() => setIsExtensionModalOpen(true)}
              className="text-xs font-bold underline hover:opacity-80 cursor-pointer ml-3 shrink-0"
            >
              Request extra time &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Answers Locked / Pending Extension Banner */}
      {extensionRequest?.status === 'PENDING' && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
          <div className="bg-amber-500/15 border border-amber-500/40 text-amber-500 text-xs font-mono px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin shrink-0" />
              <span>Time extension pending proctor review ({extensionRequest.requested_minutes}m requested). Answers are temporarily locked.</span>
            </span>
            <button
              type="button"
              onClick={() => setIsExtensionModalOpen(true)}
              className="text-xs font-bold underline hover:opacity-80"
            >
              View Request
            </button>
          </div>
        </div>
      )}

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
                        disabled={activeWarning !== null}
                        whileHover={activeWarning === null ? { scale: 1.006 } : {}}
                        whileTap={activeWarning === null ? { scale: 0.994 } : {}}
                        onClick={() => {
                          if (activeWarning !== null) return;
                          handleSelectOption(currentQuestion.id, optKey);
                        }}
                        className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 select-none ${
                          activeWarning !== null
                            ? 'opacity-60 cursor-not-allowed border-border bg-surface/50 text-muted-foreground'
                            : isSelected
                            ? 'border-brand bg-brand/10 shadow-sm text-foreground font-medium cursor-pointer'
                            : 'border-border bg-surface/70 hover:border-brand/40 hover:bg-surface text-foreground cursor-pointer'
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

            {/* Phone & Microphone Status Indicators */}
            <div className="flex items-center justify-between pt-2 border-t border-border/70 text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-brand" />
                <span data-testid="hud-phone-check-status">{phoneStatusText || 'Phone check: OK'}</span>
              </span>
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3 text-brand" />
                <span>{micOk ? 'Mic: Monitored' : 'Mic: Offline'}</span>
              </span>
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
              data-testid="confirm-submit-modal-btn"
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
      {cameraDenied && <CameraDeniedBlocker deviceType={deniedDevice} onRetry={retryCamera} />}

      {/* Warning History Side Panel */}
      <WarningHistoryDrawer
        isOpen={isWarningHistoryOpen}
        onClose={() => setIsWarningHistoryOpen(false)}
        sessionId={numericSessionId}
      />

      {/* Time Extension Modal */}
      <TimeExtensionModal
        isOpen={isExtensionModalOpen || (secondsLeft === 0 && maxExtensionMins > 0 && sessionStatus === 'IN_PROGRESS')}
        maxExtensionMins={maxExtensionMins}
        existingRequest={extensionRequest}
        canClose={secondsLeft !== null && secondsLeft > 0}
        onClose={() => setIsExtensionModalOpen(false)}
        onSubmitExam={() => submitMutation.mutate()}
        onRequestExtension={handleRequestExtension}
        isSubmittingExam={submitMutation.isPending}
      />
    </div>
  );
}
