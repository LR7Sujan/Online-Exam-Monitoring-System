import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Download,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  StepBack,
  StepForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { TrustRing } from '../ui/TrustRing';
import { StatusPill } from '../ui/StatusPill';
import { Modal } from '../ui/Modal';
import { NeonButton } from '../ui/NeonButton';
import type {
  RecordingReviewDetails,
  RecordingNoteItem,
  ReviewTimelineEvent,
} from '../../types/domain';

export interface RecordingPlayerProps {
  recordingId: number;
  isOpen?: boolean;
  onClose?: () => void;
  mode?: 'modal' | 'fullpage' | 'embedded';
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_STORAGE_KEY = 'proctoriq_recording_playback_rate';

export function RecordingPlayer({
  recordingId,
  isOpen = true,
  onClose,
  mode = 'modal',
}: RecordingPlayerProps) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';

  // Player DOM refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedViewRef = useRef<boolean>(false);

  // Video State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<string>('16 / 9');
  const [bufferedEnd, setBufferedEnd] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    return saved ? Number(saved) || 1 : 1;
  });

  // UI / Scrubbing state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [hoveredEvent, setHoveredEvent] = useState<ReviewTimelineEvent | null>(null);
  const [speedMenuOpen, setSpeedMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'events' | 'notes'>('events');
  const [noteInput, setNoteInput] = useState<string>('');
  const [lightboxSnapshot, setLightboxSnapshot] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState<boolean>(false);

  // Sync fullscreen state with document fullscreenchange
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Fetch full review metadata
  const reviewQuery = useQuery<RecordingReviewDetails>({
    queryKey: ['recording-review', recordingId],
    queryFn: () => api.get<RecordingReviewDetails>(`/recordings/${recordingId}/review`),
    enabled: isOpen && recordingId > 0,
  });

  const reviewData = reviewQuery.data;
  const recording = reviewData?.recording;
  const session = reviewData?.session;
  const events = reviewData?.events ?? [];
  const notes = reviewData?.notes ?? [];

  // Duration derivation (fallback to DB duration_ms if Infinity or NaN)
  const totalDurationSec = useMemo(() => {
    if (Number.isFinite(videoDuration) && videoDuration > 0) {
      return videoDuration;
    }
    const rawSec = videoRef.current?.duration;
    if (rawSec && Number.isFinite(rawSec) && rawSec > 0) {
      return rawSec;
    }
    if (recording?.duration_ms && recording.duration_ms > 0) {
      return recording.duration_ms / 1000;
    }
    return 60; // minimum fallback
  }, [videoDuration, recording?.duration_ms]);

  // Audio track detection
  const hasAudioTrack = Boolean(recording?.has_audio);

  // Stream URL with auth token
  const apiBase = import.meta.env.VITE_API_URL ?? '/api';
  const streamUrl = useMemo(() => {
    if (!recordingId || !token) return '';
    return `${apiBase}/recordings/${recordingId}/stream?token=${encodeURIComponent(token)}`;
  }, [recordingId, token, apiBase]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // Set playback speed & remember
  const handleSetSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setSpeedMenuOpen(false);
  }, []);

  // Controls auto-hide timer
  const resetHideControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying]);

  // Play / Pause toggle
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

  // Seek helper
  const seekTo = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const target = Math.max(0, Math.min(seconds, totalDurationSec));
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    },
    [totalDurationSec]
  );

  // Jump to event (3s before timestamp)
  const jumpToEvent = useCallback(
    (eventTimeMs: number) => {
      const targetSec = Math.max(0, eventTimeMs / 1000 - 3);
      seekTo(targetSec);
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    },
    [seekTo]
  );

  // Frame step (, and .)
  const stepFrame = useCallback(
    (forward: boolean) => {
      if (!videoRef.current) return;
      if (!videoRef.current.paused) {
        videoRef.current.pause();
      }
      const frameDelta = 0.1; // 10 fps exam recording chunk rate
      seekTo(videoRef.current.currentTime + (forward ? frameDelta : -frameDelta));
    },
    [seekTo]
  );

  // Frame capture evidence snapshot
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = dataUrl;
      const timeMs = Math.round(video.currentTime * 1000);
      a.download = `evidence-frame-sess${session?.sessionId ?? 0}-${timeMs}ms.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Evidence snapshot captured at ${formatTime(video.currentTime)}`);
    } catch {
      toast.error('Unable to capture video frame');
    }
  }, [formatTime, session?.sessionId]);

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: (body: { timeMs: number; text: string }) =>
      api.post<RecordingNoteItem>(`/recordings/${recordingId}/notes`, body),
    onSuccess: () => {
      setNoteInput('');
      toast.success('Observation note added');
      queryClient.invalidateQueries({ queryKey: ['recording-review', recordingId] });
    },
    onError: () => toast.error('Failed to add note'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => api.delete(`/recordings/${recordingId}/notes/${noteId}`),
    onSuccess: () => {
      toast.success('Note removed');
      queryClient.invalidateQueries({ queryKey: ['recording-review', recordingId] });
    },
    onError: () => toast.error('Failed to delete note'),
  });

  const deleteRecordingMutation = useMutation({
    mutationFn: () => api.delete(`/recordings/${recordingId}`),
    onSuccess: () => {
      toast.success('Exam recording permanently deleted');
      queryClient.invalidateQueries({ queryKey: ['recording-review', recordingId] });
      queryClient.invalidateQueries({ queryKey: ['session-recording'] });
      setDeleteModalOpen(false);
      onClose?.();
    },
    onError: () => toast.error('Failed to delete recording'),
  });

  // Handle note submission
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    addNoteMutation.mutate({
      timeMs: Math.round(currentTime * 1000),
      text: noteInput.trim(),
    });
  };

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // PiP toggle
  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      toast.error('Picture-in-Picture not supported in this browser');
    }
  }, []);

  // Keyboard accessibility listeners
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger shortcuts if typing inside input / textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTo(currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(currentTime + 5);
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          seekTo(currentTime - 10);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          seekTo(currentTime + 10);
          break;
        case 'Home':
          e.preventDefault();
          seekTo(0);
          break;
        case 'End':
          e.preventDefault();
          seekTo(totalDurationSec);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case ',':
          e.preventDefault();
          stepFrame(false);
          break;
        case '.':
          e.preventDefault();
          stepFrame(true);
          break;
        case '>':
          if (e.shiftKey) {
            e.preventDefault();
            const currIdx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
            if (currIdx < PLAYBACK_SPEEDS.length - 1) {
              handleSetSpeed(PLAYBACK_SPEEDS[currIdx + 1]);
            }
          }
          break;
        case '<':
          if (e.shiftKey) {
            e.preventDefault();
            const currIdx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
            if (currIdx > 0) {
              handleSetSpeed(PLAYBACK_SPEEDS[currIdx - 1]);
            }
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else {
            onClose?.();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    togglePlayPause,
    seekTo,
    currentTime,
    totalDurationSec,
    toggleFullscreen,
    stepFrame,
    playbackSpeed,
    handleSetSpeed,
    isFullscreen,
    onClose,
  ]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setVideoDuration(dur);
      }
      if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        setAspectRatio(`${videoRef.current.videoWidth} / ${videoRef.current.videoHeight}`);
      }
      videoRef.current.playbackRate = playbackSpeed;
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbing) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleProgress = () => {
    if (!videoRef.current) return;
    const buf = videoRef.current.buffered;
    if (buf.length > 0) {
      setBufferedEnd(buf.end(buf.length - 1));
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    resetHideControlsTimer();

    // Log playback start in access log once
    if (!hasLoggedViewRef.current && recordingId) {
      hasLoggedViewRef.current = true;
      api.post(`/recordings/${recordingId}/view`).catch(() => {});
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
  };

  // Scrubber mouse events
  const handleScrubberMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    setIsScrubbing(true);
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * totalDurationSec);
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeAtCursor = ratio * totalDurationSec;
    setHoverTime(timeAtCursor);
    setHoverPosition(ratio * 100);

    if (isScrubbing) {
      seekTo(timeAtCursor);
    }
  };

  const handleScrubberMouseLeave = () => {
    setHoverTime(null);
    setHoveredEvent(null);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [isScrubbing]);

  // If closed, return null
  if (!isOpen) return null;

  const content = (
    <div
      ref={containerRef}
      onMouseMove={resetHideControlsTimer}
      data-testid="recording-player-container"
      className={`relative flex flex-col bg-background text-foreground select-none font-mono ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen bg-black overflow-hidden'
          : mode === 'modal'
          ? 'fixed inset-0 z-50 overflow-hidden bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4'
          : mode === 'embedded'
          ? 'w-full rounded-2xl border border-border bg-surface shadow-md overflow-hidden'
          : 'w-full h-full min-h-screen'
      }`}
    >
      {/* Player Wrapper Container */}
      <div
        className={`flex flex-col w-full h-full bg-surface overflow-hidden ${
          isFullscreen
            ? 'h-screen max-w-none rounded-none border-none shadow-none'
            : mode === 'modal'
            ? 'rounded-2xl border border-border shadow-2xl max-w-7xl max-h-[96vh]'
            : mode === 'embedded'
            ? 'rounded-2xl shadow-none'
            : 'max-w-full'
        }`}
      >
        {/* =================================================================== */}
        {/* HEADER BAR */}
        {/* =================================================================== */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-elevated/80 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Student trust ring */}
            {session && (
              <div className="shrink-0">
                <TrustRing
                  score={session.currentTrustScore}
                  minThreshold={session.minTrustScore}
                  size={42}
                  showLabel={true}
                />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-foreground truncate">
                  {session?.studentName || 'Student Review'}
                </h2>
                {session && <StatusPill status={session.sessionStatus} size="sm" />}
                <span className="text-[10px] text-brand px-1.5 py-0.5 rounded border border-brand/30 bg-brand/10 font-bold">
                  {session?.paperCode || 'P000'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {session?.examTitle} • Started:{' '}
                {session?.startedAt ? new Date(session.startedAt).toLocaleTimeString() : 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download Button (Admin only) */}
            {isAdmin && (
              <button
                type="button"
                data-testid="recording-download-btn"
                onClick={() => setDownloadModalOpen(true)}
                title="Download video stream (logged in audit)"
                aria-label="Download video stream"
                className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:border-brand/40 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>
            )}

            {/* Delete Button (Admin only) */}
            {isAdmin && (
              <button
                type="button"
                data-testid="recording-delete-btn"
                onClick={() => setDeleteModalOpen(true)}
                title="Delete recording permanently"
                aria-label="Delete recording permanently"
                className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Exit Fullscreen button */}
            {isFullscreen && (
              <button
                type="button"
                data-testid="exit-fullscreen-btn"
                onClick={toggleFullscreen}
                aria-label="Exit fullscreen"
                title="Exit fullscreen (F or Esc)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
              >
                <Minimize className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </button>
            )}

            {/* Close button for modal */}
            {onClose && mode === 'modal' && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close review player"
                title="Close review player (Esc)"
                className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* MAIN BODY: VIDEO + SIDEBAR */}
        {/* =================================================================== */}
        <div className={`flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden ${isFullscreen ? 'h-full' : ''}`}>
          {/* VIDEO STAGE */}
          <div className="flex-1 flex flex-col bg-black relative min-h-0 overflow-hidden group">
            {/* Native Video Element */}
            <div
              className="w-full relative flex items-center justify-center bg-black overflow-hidden"
              style={{
                aspectRatio: isFullscreen ? 'auto' : aspectRatio,
                height: isFullscreen ? '100%' : undefined,
                maxHeight: isFullscreen ? 'calc(100vh - 120px)' : '680px',
              }}
            >
              <video
                ref={videoRef}
                data-testid="review-video-element"
                src={streamUrl}
                playsInline
                preload="metadata"
                onClick={togglePlayPause}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onProgress={handleProgress}
                onPlay={handlePlay}
                onPause={handlePause}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onError={() => {
                  setHasError(true);
                  setIsBuffering(false);
                }}
                className="w-full h-full object-contain cursor-pointer"
              />

              {/* Big Center Play Button when paused */}
              <AnimatePresence>
                {!isPlaying && !isBuffering && !hasError && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    type="button"
                    onClick={togglePlayPause}
                    aria-label="Play video"
                    data-testid="center-play-button"
                    className="absolute inset-auto p-5 rounded-full bg-black/60 border border-brand/50 text-white backdrop-blur-md shadow-2xl hover:scale-110 hover:border-brand transition-transform cursor-pointer"
                  >
                    <Play className="w-10 h-10 translate-x-0.5 fill-white" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Loading Spinner */}
              {isBuffering && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-brand animate-spin" />
                    <span className="text-xs text-white/80">Buffering chunk stream...</span>
                  </div>
                </div>
              )}

              {/* Error State with Retry */}
              {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                  <div className="max-w-sm text-center space-y-3 p-5 rounded-2xl border border-rose-500/40 bg-surface/90">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-foreground">
                      Unable to stream recording
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      The video stream or network connection encountered an interruption.
                    </p>
                    <NeonButton
                      variant="primary"
                      size="sm"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => {
                        setHasError(false);
                        if (videoRef.current) {
                          videoRef.current.load();
                        }
                      }}
                    >
                      Retry Stream
                    </NeonButton>
                  </div>
                </div>
              )}
            </div>

            {/* =============================================================== */}
            {/* PLAYER CONTROLS OVERLAY (Auto-hiding) */}
            {/* =============================================================== */}
            <div
              data-testid="player-controls-overlay"
              className={`transition-opacity duration-300 ${
                showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              } flex flex-col bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 pt-6 space-y-2 shrink-0 z-20 absolute bottom-0 inset-x-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto`}
            >
              {/* Scrubbing bar & Violation markers */}
              <div
                ref={progressBarRef}
                data-testid="seek-bar"
                onMouseDown={handleScrubberMouseDown}
                onMouseMove={handleScrubberMouseMove}
                onMouseLeave={handleScrubberMouseLeave}
                className="relative h-3 w-full rounded-full bg-white/20 cursor-pointer flex items-center group/bar"
              >
                {/* Buffered track */}
                <div
                  className="absolute h-1.5 rounded-full bg-white/30 transition-all pointer-events-none"
                  style={{
                    width: `${Math.min(100, (bufferedEnd / totalDurationSec) * 100)}%`,
                  }}
                />

                {/* Played track */}
                <div
                  className="absolute h-1.5 rounded-full bg-brand pointer-events-none shadow-sm"
                  style={{
                    width: `${Math.min(100, (currentTime / totalDurationSec) * 100)}%`,
                  }}
                />

                {/* Violation / Warning Timeline Ticks */}
                {events.map((ev) => {
                  const percent = Math.min(100, (ev.timeMs / 1000 / totalDurationSec) * 100);
                  const isViolation = ev.type === 'VIOLATION';
                  const tickColor = isViolation
                    ? ev.severity === 'CRITICAL' || ev.severity === 'HIGH'
                      ? 'bg-rose-500'
                      : 'bg-amber-400'
                    : 'bg-violet-400';

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      data-testid={`timeline-marker-${ev.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToEvent(ev.timeMs);
                      }}
                      onMouseEnter={() => setHoveredEvent(ev)}
                      title={`${ev.code} (-${ev.penalty} pts) at ${formatTime(ev.timeMs / 1000)}`}
                      className={`absolute top-0 bottom-0 w-2.5 -translate-x-1/2 flex items-center justify-center cursor-pointer hover:scale-150 transition-transform z-10`}
                      style={{ left: `${percent}%` }}
                    >
                      <span className={`w-1.5 h-3 rounded-full ${tickColor} shadow-md`} />
                    </button>
                  );
                })}

                {/* Scrubber thumb */}
                <div
                  className="absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-brand -translate-x-1/2 shadow-lg group-hover/bar:scale-125 transition-transform pointer-events-none"
                  style={{
                    left: `${Math.min(100, (currentTime / totalDurationSec) * 100)}%`,
                  }}
                />

                {/* Hover Time Tooltip */}
                {hoverTime !== null && (
                  <div
                    className="absolute -top-7 -translate-x-1/2 bg-black/90 text-white border border-border text-[10px] px-2 py-0.5 rounded shadow pointer-events-none font-mono z-30"
                    style={{ left: `${hoverPosition}%` }}
                  >
                    {formatTime(hoverTime)}
                  </div>
                )}

                {/* Hovered Event Tooltip */}
                {hoveredEvent && (
                  <div
                    className="absolute -top-16 -translate-x-1/2 bg-surface/95 border border-border text-foreground text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl pointer-events-none font-mono whitespace-nowrap z-40"
                    style={{
                      left: `${Math.min(
                        90,
                        Math.max(10, (hoveredEvent.timeMs / 1000 / totalDurationSec) * 100)
                      )}%`,
                    }}
                  >
                    <p className="font-bold text-rose-500 flex items-center gap-1">
                      <span>{hoveredEvent.code}</span>
                      {hoveredEvent.penalty > 0 && <span>(-{hoveredEvent.penalty} pts)</span>}
                    </p>
                    <p className="text-muted-foreground text-[9px] truncate max-w-[200px]">
                      {hoveredEvent.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Control Buttons Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-white">
                {/* Left controls: Play/pause, step, skip, time */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Play/Pause */}
                  <button
                    type="button"
                    data-testid="play-pause-btn"
                    onClick={togglePlayPause}
                    title={isPlaying ? 'Pause (Space or K)' : 'Play (Space or K)'}
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </button>

                  {/* Skip back 10s */}
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 10)}
                    title="Rewind 10s (J)"
                    aria-label="Rewind 10 seconds"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  {/* Skip forward 10s */}
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 10)}
                    title="Forward 10s (L)"
                    aria-label="Forward 10 seconds"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Frame step backward */}
                  <button
                    type="button"
                    onClick={() => stepFrame(false)}
                    title="Step frame back (,)"
                    aria-label="Step frame backward"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white"
                  >
                    <StepBack className="w-3.5 h-3.5" />
                  </button>

                  {/* Frame step forward */}
                  <button
                    type="button"
                    onClick={() => stepFrame(true)}
                    title="Step frame forward (.)"
                    aria-label="Step frame forward"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-muted-foreground hover:text-white"
                  >
                    <StepForward className="w-3.5 h-3.5" />
                  </button>

                  {/* Current / Total Time Display */}
                  <div className="text-xs font-mono font-medium ml-1">
                    <span className="text-white">{formatTime(currentTime)}</span>
                    <span className="text-white/40 mx-1">/</span>
                    <span className="text-white/70">{formatTime(totalDurationSec)}</span>
                  </div>
                </div>

                {/* Right controls: Audio, Speed, Capture Frame, PiP, Fullscreen */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Audio Volume (only if file has audio track) */}
                  {hasAudioTrack ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const nextMute = !isMuted;
                          setIsMuted(nextMute);
                          if (videoRef.current) {
                            videoRef.current.muted = nextMute;
                          }
                        }}
                        title={isMuted ? 'Unmute' : 'Mute'}
                        aria-label={isMuted ? 'Unmute' : 'Mute'}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setVolume(val);
                          setIsMuted(val === 0);
                          if (videoRef.current) {
                            videoRef.current.volume = val;
                            videoRef.current.muted = val === 0;
                          }
                        }}
                        className="w-16 h-1 accent-brand bg-white/20 rounded cursor-pointer hidden sm:block"
                      />
                    </div>
                  ) : (
                    <span
                      title="Audio track disabled for this exam session"
                      className="text-[10px] text-white/40 hidden sm:inline"
                    >
                      (Video Only)
                    </span>
                  )}

                  {/* Playback speed selector */}
                  <div className="relative">
                    <button
                      type="button"
                      data-testid="playback-speed-button"
                      onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
                      title="Playback speed (Shift+< or Shift+>)"
                      aria-label="Playback speed menu"
                      className="px-2 py-1 rounded-lg border border-border bg-surface-elevated hover:bg-muted text-xs font-bold transition-colors cursor-pointer"
                    >
                      {playbackSpeed}x
                    </button>

                    {speedMenuOpen && (
                      <div className="absolute bottom-full mb-2 right-0 rounded-xl border border-border bg-surface p-1 shadow-2xl flex flex-col gap-0.5 z-50 min-w-[70px]">
                        {PLAYBACK_SPEEDS.map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            data-testid={`speed-opt-${spd}`}
                            onClick={() => handleSetSpeed(spd)}
                            className={`px-2.5 py-1 text-xs text-left rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                              playbackSpeed === spd
                                ? 'bg-brand text-white font-bold'
                                : 'text-foreground hover:bg-muted'
                            }`}
                          >
                            <span>{spd}x</span>
                            {playbackSpeed === spd && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Capture Frame Button */}
                  <button
                    type="button"
                    onClick={captureFrame}
                    title="Capture still frame evidence"
                    aria-label="Capture still frame evidence"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/80 hover:text-white"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  {/* Picture in Picture */}
                  <button
                    type="button"
                    onClick={togglePiP}
                    title="Picture-in-Picture"
                    aria-label="Toggle Picture-in-Picture"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-white/80 hover:text-white hidden sm:block"
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                  </button>

                  {/* Fullscreen */}
                  <button
                    type="button"
                    data-testid="fullscreen-btn"
                    onClick={toggleFullscreen}
                    title="Fullscreen (F)"
                    aria-label="Toggle Fullscreen"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* SIDE REVIEW PANEL: EVENTS & NOTES */}
          {/* =============================================================== */}
          <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-border bg-surface-elevated/40 flex flex-col shrink-0 min-h-0 h-80 lg:h-auto overflow-hidden">
            {/* Panel Tabs */}
            <div className="flex items-center border-b border-border bg-surface-elevated/50 p-1 shrink-0">
              <button
                type="button"
                data-testid="tab-events"
                onClick={() => setActiveTab('events')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'events'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Events ({events.length})</span>
              </button>

              <button
                type="button"
                data-testid="tab-notes"
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Proctor Notes ({notes.length})</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {/* 1. EVENTS TAB */}
              {activeTab === 'events' && (
                <div className="space-y-2">
                  {events.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      Zero violations or warnings detected.
                    </div>
                  ) : (
                    events.map((ev) => {
                      const isViolation = ev.type === 'VIOLATION';
                      const isCurrent =
                        currentTime * 1000 >= ev.timeMs &&
                        currentTime * 1000 <= ev.timeMs + 4000;

                      return (
                        <div
                          key={ev.id}
                          data-testid={`event-item-${ev.id}`}
                          onClick={() => jumpToEvent(ev.timeMs)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isCurrent
                              ? 'border-brand bg-brand/10 shadow-sm ring-1 ring-brand'
                              : 'border-border bg-surface-elevated hover:border-brand/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  isViolation
                                    ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                    : 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                                }`}
                              >
                                {ev.code}
                              </span>
                              {ev.penalty > 0 && (
                                <span className="text-[10px] font-bold text-rose-500">
                                  -{ev.penalty} PTS
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatTime(ev.timeMs / 1000)}
                            </span>
                          </div>

                          <p className="text-xs text-foreground mt-1 line-clamp-2">{ev.label}</p>

                          {/* Optical snapshot thumbnail if present */}
                          {ev.snapshotUrl && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxSnapshot(ev.snapshotUrl ?? null);
                                }}
                                className="relative w-14 h-9 rounded-md overflow-hidden border border-border group/thumb shrink-0 cursor-pointer"
                              >
                                <img
                                  src={ev.snapshotUrl}
                                  alt="Evidence snapshot"
                                  className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                  <Search className="w-3 h-3 text-white" />
                                </div>
                              </button>
                              <span className="text-[10px] text-muted-foreground">
                                Click thumbnail for optical snapshot
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* 2. PROCTOR NOTES TAB */}
              {activeTab === 'notes' && (
                <div className="space-y-3">
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Add observation at timestamp:</span>
                      <span className="font-bold text-brand">{formatTime(currentTime)}</span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        data-testid="note-input"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder={`Note at ${formatTime(currentTime)}...`}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                      <NeonButton
                        type="submit"
                        variant="primary"
                        size="sm"
                        data-testid="add-note-btn"
                        isLoading={addNoteMutation.isPending}
                        disabled={!noteInput.trim()}
                      >
                        Save
                      </NeonButton>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    {notes.length === 0 ? (
                      <p className="text-xs text-center text-muted-foreground py-6">
                        No proctor notes recorded yet. Add observations at specific video moments
                        above.
                      </p>
                    ) : (
                      notes.map((note) => (
                        <div
                          key={note.note_id}
                          data-testid={`note-item-${note.note_id}`}
                          onClick={() => seekTo(note.time_ms / 1000)}
                          className="p-2.5 rounded-xl border border-border bg-surface-elevated hover:border-brand/40 transition-colors cursor-pointer group/note"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand/15 text-brand border border-brand/30">
                                {formatTime(note.time_ms / 1000)}
                              </span>
                              <span className="text-[11px] font-bold text-foreground">
                                {note.author_name}
                              </span>
                            </div>

                            {(isAdmin || Number(currentUser?.id) === note.author_id) && (
                              <button
                                type="button"
                                data-testid={`delete-note-btn-${note.note_id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNoteMutation.mutate(note.note_id);
                                }}
                                title="Delete note"
                                className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover/note:opacity-100 transition-opacity p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-foreground mt-1.5 break-words">{note.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX MODAL */}
      <Modal
        isOpen={Boolean(lightboxSnapshot)}
        onClose={() => setLightboxSnapshot(null)}
        size="lg"
        title="Evidence Snapshot Inspection"
      >
        {lightboxSnapshot && (
          <div className="space-y-3">
            <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-border bg-black">
              <img
                src={lightboxSnapshot}
                alt="Enlarged evidence snapshot"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Authoritative client optical snapshot captured at violation moment.
            </p>
          </div>
        )}
      </Modal>

      {/* DOWNLOAD CONFIRMATION MODAL */}
      <Modal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        size="sm"
        title="Download Exam Video Recording"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setDownloadModalOpen(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <a
              href={`${apiBase}/recordings/${recordingId}/download`}
              onClick={() => setDownloadModalOpen(false)}
              download
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-brand hover:opacity-95 shadow-sm transition-opacity"
            >
              Confirm Download
            </a>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          <p className="text-foreground">
            You are about to download the full video recording for session{' '}
            <strong>#{session?.sessionId}</strong> ({session?.studentName}).
          </p>
          <p className="text-muted-foreground">
            This download action will be timestamped and permanently logged in the authoritative{' '}
            <code>Recording_Access_Log</code>.
          </p>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        size="sm"
        title="Permanently Delete Recording?"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleteRecordingMutation.isPending}
              onClick={() => deleteRecordingMutation.mutate()}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm cursor-pointer"
            >
              {deleteRecordingMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          <p className="text-foreground">
            Are you sure you want to permanently delete this video recording?
          </p>
          <p className="text-rose-400 font-semibold">
            This will purge the video file from disk and remove its database metadata. This action
            cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );

  if (mode === 'modal') {
    return createPortal(content, document.body);
  }

  return content;
}
