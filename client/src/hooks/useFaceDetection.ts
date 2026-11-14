import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureWebcamSnapshot,
  detectFacesInVideo,
  drawBoundingBoxesOnCanvas,
  initMediaPipeDetector,
  type DetectionResult,
} from '../utils/faceDetector';

interface UseFaceDetectionOptions {
  enabled?: boolean;
  onViolation?: (
    code: 'NO_FACE' | 'MULTIPLE_FACES',
    snapshot: string,
    evidenceMeta: Record<string, unknown>
  ) => void;
}

export function useFaceDetection({
  enabled = true,
  onViolation,
}: UseFaceDetectionOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraDenied, setCameraDenied] = useState<boolean>(false);
  const [faceCount, setFaceCount] = useState<number>(1);
  const [faceOk, setFaceOk] = useState<boolean>(true);
  const [statusText, setStatusText] = useState<string>('Face OK');
  const [consecutiveNoFaceSeconds, setConsecutiveNoFaceSeconds] = useState<number>(0);

  // Mutable refs for tracking in the 1-second interval without closure capture issues
  const consecutiveRef = useRef<number>(0);
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Initialize MediaPipe detector in background
  useEffect(() => {
    initMediaPipeDetector().catch(() => { });
  }, []);

  // Camera start / restart logic
  const startCamera = useCallback(async () => {
    setCameraDenied(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia unavailable');
      }

      // Stop any existing tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;

      // Handle optical track ending mid-exam (unplugged, disabled, hardware disconnect)
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setCameraActive(false);
          setCameraDenied(true);
        };
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { });
      }
      setCameraActive(true);
      setCameraDenied(false);
    } catch (err: unknown) {
      console.warn('[FaceDetection] Camera initialization issue:', err);
      const error = err as { name?: string };
      if (
        error?.name === 'NotAllowedError' ||
        error?.name === 'PermissionDeniedError' ||
        String(err).includes('Permission') ||
        String(err).includes('denied')
      ) {
        setCameraDenied(true);
        setCameraActive(false);
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
          streamRef.current = capture;
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
  }, []);

  // Mount camera
  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startCamera]);

  // Main Detection Loop: runs about once per second (1000ms)
  useEffect(() => {
    if (!enabled || !cameraActive || cameraDenied) {
      return;
    }

    const intervalId = setInterval(async () => {
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
            const snapshot = captureWebcamSnapshot(video);
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
        // Rule 2: 2 or more faces -> report MULTIPLE_FACES immediately
        else if (count >= 2) {
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          setFaceOk(false);
          setStatusText(`ALERT: ${count} FACES DETECTED`);

          const snapshot = captureWebcamSnapshot(video);
          if (snapshot && onViolationRef.current) {
            onViolationRef.current('MULTIPLE_FACES', snapshot, {
              faceCount: count,
              reason: `Multiple faces (${count}) detected simultaneously in optical stream`,
              detector: result.detectorType,
              faces: result.faces,
            });
          }
        }
        // Rule 3: Exactly 1 face -> Face OK
        else {
          consecutiveRef.current = 0;
          setConsecutiveNoFaceSeconds(0);
          setFaceOk(true);
          setStatusText('Face OK: 1 Face Detected');
        }
      } catch (err) {
        console.warn('[FaceDetection] Detection iteration warning:', err);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, cameraActive, cameraDenied]);

  return {
    videoRef,
    canvasRef,
    cameraActive,
    cameraDenied,
    faceCount,
    faceOk,
    statusText,
    consecutiveNoFaceSeconds,
    startCamera,
    retryCamera: startCamera,
  };
}

