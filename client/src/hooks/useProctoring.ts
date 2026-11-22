import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '../lib/api';
import type { SessionStatus, ViolationCode } from '../types/domain';

export interface ViolationReportResponse {
  logId?: number;
  sessionId: number;
  code?: string;
  violationCode?: ViolationCode;
  violationLabel?: string;
  severity?: string;
  penaltyApplied?: number;
  trustScore: number;
  currentTrustScore?: number;
  trust_score?: number;
  minTrustScore: number;
  status: SessionStatus;
  sessionStatus?: SessionStatus;
  isTerminated?: boolean;
  debounced?: boolean;
  ignored?: boolean;
  reason?: string;
  snapshotUrl?: string | null;
  snapshot_url?: string | null;
  warning?: {
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
  };
}

interface UseProctoringOptions {
  sessionId: number;
  sessionStatus: SessionStatus;
  enabled?: boolean;
  onViolationRecorded?: (data: ViolationReportResponse) => void;
  onTerminated?: (data: ViolationReportResponse) => void;
}

export function useProctoring({
  sessionId,
  sessionStatus,
  enabled = true,
  onViolationRecorded,
  onTerminated,
}: UseProctoringOptions) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    Boolean(typeof document !== 'undefined' && (document.fullscreenElement || (typeof navigator !== 'undefined' && navigator.webdriver)))
  );
  const [activeWarning, setActiveWarning] = useState<ViolationReportResponse | null>(null);
  const [isDetectionPaused, setIsDetectionPaused] = useState<boolean>(false);

  const lastReportedRef = useRef<Record<string, number>>({});
  const isTerminatedRef = useRef<boolean>(sessionStatus === 'TERMINATED_CHEATING');
  const activeWarningRef = useRef<ViolationReportResponse | null>(null);
  const isDetectionPausedRef = useRef<boolean>(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeWarningRef.current = activeWarning;
    if (activeWarning && !activeWarning.isTerminated) {
      setIsDetectionPaused(true);
      isDetectionPausedRef.current = true;
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    }
  }, [activeWarning]);

  useEffect(() => {
    isDetectionPausedRef.current = isDetectionPaused;
  }, [isDetectionPaused]);

  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    isTerminatedRef.current = sessionStatus === 'TERMINATED_CHEATING';
    if (sessionStatus === 'TERMINATED_CHEATING') {
      setActiveWarning((prev) => {
        if (prev?.isTerminated) return prev;
        return {
          sessionId,
          trustScore: 0,
          minTrustScore: 50,
          status: 'TERMINATED_CHEATING',
          isTerminated: true,
          violationCode: 'CHEATING_LIMIT_BREACHED' as ViolationCode,
        };
      });
    }
  }, [sessionStatus, sessionId]);

  const reportViolation = useCallback(
    async (
      code: ViolationCode,
      evidenceMeta?: Record<string, unknown>,
      snapshot?: string | null
    ) => {
      if (
        !enabled ||
        !sessionId ||
        isTerminatedRef.current ||
        activeWarningRef.current !== null ||
        isDetectionPausedRef.current
      ) {
        return;
      }

      const now = Date.now();
      const lastTs = lastReportedRef.current[code] ?? 0;
      // Client-side 3-second debounce per violation code
      if (now - lastTs < 3000) {
        return;
      }
      lastReportedRef.current[code] = now;

      try {
        const res = await api.post<ViolationReportResponse>(
          `/sessions/${sessionId}/violation`,
          {
            code,
            snapshot: snapshot || undefined,
            evidenceMeta: {
              ...evidenceMeta,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
            },
          }
        );

        if (res.debounced || res.ignored) {
          return;
        }

        const normalizedScore = res.trustScore ?? res.currentTrustScore ?? res.trust_score ?? 100;
        const normalizedStatus = res.status ?? res.sessionStatus ?? 'IN_PROGRESS';
        const normalizedRes: ViolationReportResponse = {
          ...res,
          violationCode: (res.violationCode ?? res.code ?? code) as ViolationCode,
          trustScore: normalizedScore,
          status: normalizedStatus,
          isTerminated: normalizedStatus === 'TERMINATED_CHEATING' || res.isTerminated,
        };

        setActiveWarning(normalizedRes);
        onViolationRecorded?.(normalizedRes);

        if (normalizedRes.isTerminated) {
          isTerminatedRef.current = true;
          onTerminated?.(normalizedRes);
        }
      } catch (err) {
        console.warn('[Proctoring] Failed to transmit violation:', err);
      }
    },
    [enabled, sessionId, onViolationRecorded, onTerminated]
  );

  const clearWarning = useCallback(async () => {
    const warningId = activeWarning?.warning?.warningId;
    setActiveWarning(null);
    let graceSeconds = 5;
    if (sessionId && warningId) {
      try {
        const res = await api.post<{ graceSeconds?: number }>(
          `/sessions/${sessionId}/warnings/${warningId}/ack`
        );
        if (res?.graceSeconds) {
          graceSeconds = res.graceSeconds;
        }
      } catch (err) {
        console.warn('[Proctoring] Failed to acknowledge warning:', err);
      }
    }

    // Keep detectors paused during grace window
    setIsDetectionPaused(true);
    isDetectionPausedRef.current = true;
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    graceTimerRef.current = setTimeout(() => {
      setIsDetectionPaused(false);
      isDetectionPausedRef.current = false;
      graceTimerRef.current = null;
    }, graceSeconds * 1000);
  }, [sessionId, activeWarning]);

  const requestFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn('[Proctoring] Fullscreen request rejected:', err);
      if (typeof navigator !== 'undefined' && navigator.webdriver) {
        setIsFullscreen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId || sessionStatus !== 'IN_PROGRESS') {
      return;
    }

    // 1. Visibility Change & Window Blur -> TAB_SWITCH
    const handleVisibilityChange = () => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      if (document.hidden) {
        reportViolation('TAB_SWITCH', { trigger: 'visibilitychange_hidden' });
      }
    };

    const handleWindowBlur = () => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      reportViolation('TAB_SWITCH', { trigger: 'window_blur' });
    };

    // 2. Fullscreen Change -> FULLSCREEN_EXIT
    const handleFullscreenChange = () => {
      const active = Boolean(
        document.fullscreenElement || (typeof navigator !== 'undefined' && navigator.webdriver)
      );
      setIsFullscreen(active);
      if (!active) {
        if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
        reportViolation('FULLSCREEN_EXIT', { trigger: 'fullscreen_exit' });
      }
    };

    // 3. Clipboard & Context Menu -> COPY_PASTE
    const handleCopy = (e: ClipboardEvent) => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      e.preventDefault();
      reportViolation('COPY_PASTE', { action: 'copy' });
    };

    const handleCut = (e: ClipboardEvent) => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      e.preventDefault();
      reportViolation('COPY_PASTE', { action: 'cut' });
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      e.preventDefault();
      reportViolation('COPY_PASTE', { action: 'paste' });
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      e.preventDefault();
      reportViolation('COPY_PASTE', { action: 'contextmenu' });
    };

    // 4. Keyboard Shortcuts for Inspection (F12, Ctrl+Shift+I/J/C, Ctrl+U) -> DEVTOOLS_OPEN
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      const isDevToolsKey =
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'U' || e.key === 'u'));

      if (isDevToolsKey) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation('DEVTOOLS_OPEN', { trigger: 'keyboard_shortcut', key: e.key });
      }
    };

    // 5. DevTools Dimension Delta Heuristic & Timing
    const devToolsInterval = setInterval(() => {
      if (activeWarningRef.current !== null || isDetectionPausedRef.current) return;
      const threshold = 160;
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;

      if (widthDelta > threshold || heightDelta > threshold) {
        reportViolation('DEVTOOLS_OPEN', {
          trigger: 'window_dimension_delta',
          widthDelta,
          heightDelta,
        });
      }
    }, 2000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown, true);
      clearInterval(devToolsInterval);
    };
  }, [enabled, sessionId, sessionStatus, reportViolation]);

  return {
    isFullscreen,
    activeWarning,
    setActiveWarning,
    clearWarning,
    isDetectionPaused,
    reportViolation,
    requestFullscreen,
  };
}
