import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureWebcamSnapshot,
  captureWebcamSnapshotAsync,
  detectFacesInVideo,
  drawBoundingBoxesOnCanvas,
  initMediaPipeDetector,
  MultiFaceTracker,
  type DetectionResult,
} from '../utils/faceDetector';
import { mediaSession } from '../proctoring/mediaSession';

interface UseFaceDetectionOptions {
  enabled?: boolean;
  isPaused?: boolean;
  onViolation?: (
    code: 'NO_FACE' | 'MULTIPLE_FACES',
    evidenceMeta: Record<string, unknown>,
    snapshot?: Promise<string | null> | string | null
  ) => void;
}

export function useFaceDetection({
  enabled = true,
  isPaused = false,
  onViolation,
}: UseFaceDetectionOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraDenied, setCameraDenied] = useState<boolean>(false);
  const [deniedDevice, setDeniedDevice] = useState<'camera' | 'microphone' | 'both'>('camera');
  const [faceCount, setFaceCount] = useState<number>(1);
  const [faceOk, setFaceOk] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>('Face OK');
  const [consecutiveNoFaceSeconds, setConsecutiveNoFaceSeconds] = useState<number>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Mutable refs for tracking in the staggered 300ms interval without closure capture issues
  const consecutiveRef = useRef<number>(0);
  const noFaceStartRef = useRef<number | null>(null);
  const multiFaceStartRef = useRef<number | null>(null);
  const multiFaceTrackerRef = useRef<MultiFaceTracker>(new MultiFaceTracker(5));
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Reset trackers when detection is paused by warning gate
  useEffect(() => {
    if (isPaused) {
      consecutiveRef.current = 0;
      noFaceStartRef.current = null;
      multiFaceStartRef.current = null;
      setConsecutiveNoFaceSeconds(0);
      multiFaceTrackerRef.current.reset();
    }
  }, [isPaused]);

  // Initialize MediaPipe detector in background
  useEffect(() => {
    initMediaPipeDetector().catch(() => { });
  }, []);

  // Cancellation ref for StrictMode safety
  const isCancelledRef = useRef<boolean>(false);

  // Camera & Microphone start / restart logic
  const startCamera = useCallback(async () => {
    mediaSession.startSession();
    setCameraDenied(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia unavailable');
      }

      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: true,
      });

      // StrictMode cancellation or unmount check
      if (isCancelledRef.current || !enabled || mediaSession.isSessionStopped()) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      mediaSession.registerStream(mediaStream);

      // Handle optical track ending mid-exam (unplugged, disabled, hardware disconnect)
      mediaStream.getVideoTracks().forEach((track) => {
        const handleEnded = () => {
          setCameraActive(false);
          setCameraDenied(true);
          setDeniedDevice('camera');
        };
        track.onended = handleEnded;
        track.addEventListener('ended', handleEnded);
      });

      // Handle microphone track ending mid-exam
      mediaStream.getAudioTracks().forEach((track) => {
        const handleEnded = () => {
          setCameraActive(false);
          setCameraDenied(true);
          setDeniedDevice('microphone');
        };
        track.onended = handleEnded;
        track.addEventListener('ended', handleEnded);
      });

      if (videoRef.current) {
        mediaSession.registerVideo(videoRef.current);
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => { });
      }
      setCameraActive(true);
      setCameraDenied(false);
    } catch (err: unknown) {
      if (isCancelledRef.current || !enabled) return;

      console.warn('[FaceDetection] Camera / microphone initialization issue:', err);
      const error = err as { name?: string; message?: string };
      const errStr = String(err).toLowerCase();

      if (
        error?.name === 'NotAllowedError' ||
        error?.name === 'PermissionDeniedError' ||
        errStr.includes('permission') ||
        errStr.includes('denied')
      ) {
        setCameraDenied(true);
        setCameraActive(false);
        if (errStr.includes('audio') || errStr.includes('mic')) {
          setDeniedDevice('microphone');
        } else if (errStr.includes('video') || errStr.includes('camera')) {
          setDeniedDevice('camera');
        } else {
          setDeniedDevice('both');
        }
        return;
      }

      // Synthetic fallback stream for headless/test environments
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#F87171';
          ctx.beginPath();
          ctx.arc(160, 120, 50, 0, Math.PI * 2);
          ctx.fill();
        }

        const canvasWithCapture = canvas as HTMLCanvasElement & { captureStream?(fps?: number): MediaStream };
        const capture = canvasWithCapture.captureStream?.(10);
        if (capture && videoRef.current) {
          // Add synthetic audio track if Web Audio API is available
          try {
            const AudioContextClass =
              window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
              const audioCtx = new AudioContextClass();
              mediaSession.registerAudioContext(audioCtx);
              const osc = audioCtx.createOscillator();
              const dest = audioCtx.createMediaStreamDestination();
              osc.connect(dest);
              osc.start();
              dest.stream.getAudioTracks().forEach((t) => capture.addTrack(t));
            }
          } catch {
            // Synthetic audio track fallback ignored in mock tests
          }

          streamRef.current = capture;
          setStream(capture);
          mediaSession.registerStream(capture);
          mediaSession.registerVideo(videoRef.current);
          videoRef.current.srcObject = capture;
          await videoRef.current.play().catch(() => { });
          setCameraActive(true);
          setCameraDenied(false);
        } else {
          setCameraActive(false);
        }
      } catch {
        setCameraActive(false);
      }
    }
  }, [enabled]);

  // Mount camera
  useEffect(() => {
    isCancelledRef.current = false;
    if (enabled) {
      startCamera();
    } else {
      mediaSession.stopAll();
      setCameraActive(false);
    }

    return () => {
      isCancelledRef.current = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      mediaSession.stopAll();
    };
  }, [startCamera, enabled]);

  // Main Detection Loop: staggered interval (300ms) with timestamp-based continuous observation
  useEffect(() => {
    if (!enabled || !cameraActive || cameraDenied) {
      return;
    }

    let isRunning = false;

    const intervalId = setInterval(async () => {
      if (isPaused) {
        consecutiveRef.current = 0;
        noFaceStartRef.current = null;
        multiFaceStartRef.current = null;
        setConsecutiveNoFaceSeconds(0);
        multiFaceTrackerRef.current.reset();
        return;
      }
      if (isRunning) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      isRunning = true;
      try {
        const result: DetectionResult = await detectFacesInVideo(video);
        const count = result.faceCount;

        setFaceCount(count);

        // Render bounding boxes onto overlay canvas
        if (canvasRef.current) {
          canvasRef.current.width = video.videoWidth || 320;
          canvasRef.current.height = video.videoHeight || 240;
          drawBoundingBoxesOnCanvas(
            canvasRef.current,
            video,
            result,
            consecutiveRef.current + (count === 0 ? 1 : 0)
          );
        }

        const now = Date.now();

        // Rule 1: 0 faces for 5 continuous seconds -> report NO_FACE
        if (count === 0) {
          multiFaceStartRef.current = null;
          multiFaceTrackerRef.current.reset();
          if (!noFaceStartRef.current) {
            noFaceStartRef.current = now;
          }
          const elapsedMs = now - noFaceStartRef.current;
          const currentCount = Math.min(5, Math.floor(elapsedMs / 1000) + 1);
          consecutiveRef.current = currentCount;
          setConsecutiveNoFaceSeconds(currentCount);
          setFaceOk(false);
          setStatusText(
            result.isCoveredOrDark
              ? 'LENS COVERED'
              : `NO FACE (${currentCount}/5s)`
          );

          if (elapsedMs >= 5000) {
            const snapshotPromise = captureWebcamSnapshotAsync(video, { violationCode: 'NO_FACE' })
              .then((s) => s || captureWebcamSnapshot(video));

            if (onViolationRef.current) {
              onViolationRef.current(
                'NO_FACE',
                {
                  consecutiveSeconds: currentCount,
                  reason: result.isCoveredOrDark
                    ? 'Webcam lens obscured/covered for 5 consecutive seconds'
                    : 'Candidate face absent from camera frame for 5 consecutive seconds',
                  averageLuminance: result.averageLuminance,
                  detector: result.detectorType,
                },
                snapshotPromise
              );
            }
            noFaceStartRef.current = null;
            consecutiveRef.current = 0;
            setConsecutiveNoFaceSeconds(0);
          }
        }
        // Rule 2: 2 or more faces -> 5-second continuous observation timer
        else if (count >= 2) {
          noFaceStartRef.current = null;
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          setFaceOk(false);

          if (!multiFaceStartRef.current) {
            multiFaceStartRef.current = now;
          }
          const elapsedMs = now - multiFaceStartRef.current;
          const elapsedSec = Math.min(5, Math.floor(elapsedMs / 1000) + 1);
          setStatusText(`Checking... ${elapsedSec}s`);

          if (elapsedMs >= 5000) {
            const snapshotPromise = captureWebcamSnapshotAsync(video, {
              violationCode: 'MULTIPLE_FACES',
              boxes: result.faces,
            }).then((s) => s || captureWebcamSnapshot(video));

            if (onViolationRef.current) {
              onViolationRef.current(
                'MULTIPLE_FACES',
                {
                  faceCount: count,
                  consecutiveSeconds: 5,
                  reason: `Multiple faces (${count}) persisted for 5 continuous seconds in optical stream`,
                  detector: result.detectorType,
                  faces: result.faces,
                },
                snapshotPromise
              );
            }
            multiFaceStartRef.current = null;
          }
        }
        // Rule 3: Exactly 1 face -> Face OK, cancel any observation
        else {
          noFaceStartRef.current = null;
          multiFaceStartRef.current = null;
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          multiFaceTrackerRef.current.reset();
          setFaceOk(true);
          setStatusText('Face OK: 1 Face Detected');
        }
      } catch (err) {
        console.warn('[FaceDetection] Detection iteration warning:', err);
      } finally {
        isRunning = false;
      }
    }, 300);

    mediaSession.registerInterval(intervalId);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, cameraActive, cameraDenied, isPaused]);

  return {
    videoRef,
    canvasRef,
    stream,
    cameraActive,
    cameraDenied,
    deniedDevice,
    faceCount,
    faceOk,
    statusText,
    consecutiveNoFaceSeconds,
    multiFaceTracker: multiFaceTrackerRef.current,
    startCamera,
    retryCamera: startCamera,
  };
}

