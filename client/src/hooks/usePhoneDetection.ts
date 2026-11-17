import { useEffect, useRef, useState } from 'react';
import {
  detectPhoneInVideo,
  getObjectDetector,
  PhoneDetectionWindow,
} from '../utils/phoneDetector';
import { captureWebcamSnapshotWithBox } from '../utils/faceDetector';

interface UsePhoneDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  isPaused?: boolean;
  onViolation?: (
    code: 'PHONE_DETECTED',
    snapshot: string,
    evidenceMeta: Record<string, unknown>
  ) => void;
}

export function usePhoneDetection({
  videoRef,
  enabled = true,
  isPaused = false,
  onViolation,
}: UsePhoneDetectionOptions) {
  const [phoneOk, setPhoneOk] = useState<boolean>(true);
  const [phoneStatusText, setPhoneStatusText] = useState<string>('Phone check: OK');
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const trackerRef = useRef<PhoneDetectionWindow>(new PhoneDetectionWindow(5, 3));
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Lazy initialize model in background
  useEffect(() => {
    let isCancelled = false;

    getObjectDetector()
      .then(() => {
        if (!isCancelled) {
          setModelLoaded(true);
          setModelError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Neural phone detection model failed to load';
          setModelError(msg);
          setPhoneStatusText('Phone check: Model Offline');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Reset tracker if detection is paused by warning gate
  useEffect(() => {
    if (isPaused) {
      trackerRef.current.reset();
      setPhoneOk(true);
      if (!modelError) {
        setPhoneStatusText('Phone check: OK');
      }
    }
  }, [isPaused, modelError]);

  // Main Detection Loop (~1 iteration per second)
  useEffect(() => {
    if (!enabled || isPaused) {
      return;
    }

    const intervalId = setInterval(async () => {
      // Pause detection when the browser tab is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const result = await detectPhoneInVideo(video);
        const check = trackerRef.current.recordCheck(result.detected);

        if (result.detected) {
          setPhoneOk(false);
          setPhoneStatusText(`Phone Detected (${check.positiveCount}/5)`);
        } else {
          if (check.positiveCount === 0) {
            setPhoneOk(true);
            setPhoneStatusText('Phone check: OK');
          } else {
            setPhoneStatusText(`Phone check: Clear (${check.positiveCount}/5)`);
          }
        }

        if (check.shouldReport) {
          const snapshot = captureWebcamSnapshotWithBox(video, result.box);
          if (snapshot && onViolationRef.current) {
            onViolationRef.current('PHONE_DETECTED', snapshot, {
              reason: 'Mobile phone visible in camera frame (seen in 3 of 5 checks)',
              confidence: result.score ?? 0.88,
              box: result.box,
              checksPositive: check.positiveCount,
            });
          }
        }
      } catch (err: unknown) {
        // If detection fails due to model loading issue, update error status
        if (!modelLoaded) {
          const msg =
            err instanceof Error ? err.message : 'Phone detection model unavailable';
          setModelError(msg);
          setPhoneStatusText('Phone check: Model Offline');
        }
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isPaused, videoRef, modelLoaded]);

  return {
    phoneOk,
    phoneStatusText,
    modelError,
    modelLoaded,
    tracker: trackerRef.current,
  };
}
