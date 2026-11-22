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
    snapshot: string,
    evidenceMeta: Record<string, unknown>
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

  // Mutable refs for tracking in the 1-second interval without closure capture issues
  const consecutiveRef = useRef<number>(0);
  const multiFaceTrackerRef = useRef<MultiFaceTracker>(new MultiFaceTracker(5));
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Reset trackers when detection is paused by warning gate
  useEffect(() => {
    if (isPaused) {
      consecutiveRef.current = 0;
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

  // Main Detection Loop: runs about once per second (1000ms)
  useEffect(() => {
    if (!enabled || !cameraActive || cameraDenied) {
      return;
    }

    const intervalId = setInterval(async () => {
      if (isPaused) {
        consecutiveRef.current = 0;
        setConsecutiveNoFaceSeconds(0);
        multiFaceTrackerRef.current.reset();
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

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

        // Rule 1: 0 faces for 5 consecutive seconds -> report NO_FACE
        if (count === 0) {
          multiFaceTrackerRef.current.reset();
          consecutiveRef.current += 1;
          const currentCount = consecutiveRef.current;
          setConsecutiveNoFaceSeconds(currentCount);
          setFaceOk(false);
          setStatusText(
            result.isCoveredOrDark
              ? 'LENS COVERED'
              : `NO FACE (${Math.min(currentCount, 5)}/5s)`
          );

          if (currentCount >= 5) {
            const snapshot =
              (await captureWebcamSnapshotAsync(video, { violationCode: 'NO_FACE' })) ||
              captureWebcamSnapshot(video);
            if (snapshot && onViolationRef.current) {
              onViolationRef.current('NO_FACE', snapshot, {
                consecutiveSeconds: currentCount,
                reason: result.isCoveredOrDark
                  ? 'Webcam lens obscured/covered for 5 consecutive seconds'
                  : 'Candidate face absent from camera frame for 5 consecutive seconds',
                averageLuminance: result.averageLuminance,
                detector: result.detectorType,
              });
            }
            // Reset consecutive counter after dispatching violation
            consecutiveRef.current = 0;
            setConsecutiveNoFaceSeconds(0);
          }
        }
        // Rule 2: 2 or more faces -> 5-second continuous observation timer
        else if (count >= 2) {
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          setFaceOk(false);

          const observation = multiFaceTrackerRef.current.recordFrame(count);
          if (observation.statusText) {
            setStatusText(observation.statusText);
          }

          if (observation.shouldReport) {
            const snapshot =
              (await captureWebcamSnapshotAsync(video, {
                violationCode: 'MULTIPLE_FACES',
                boxes: result.faces,
              })) || captureWebcamSnapshot(video);
            if (snapshot && onViolationRef.current) {
              onViolationRef.current('MULTIPLE_FACES', snapshot, {
                faceCount: count,
                consecutiveSeconds: observation.consecutiveSeconds,
                reason: `Multiple faces (${count}) persisted for 5 continuous seconds in optical stream`,
                detector: result.detectorType,
                faces: result.faces,
              });
            }
          }
        }
        // Rule 3: Exactly 1 face -> Face OK, cancel any multi-face observation
        else {
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          multiFaceTrackerRef.current.reset();
          setFaceOk(true);
          setStatusText('Face OK: 1 Face Detected');
        }
      } catch (err) {
        console.warn('[FaceDetection] Detection iteration warning:', err);
      }
    }, 1000);

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

