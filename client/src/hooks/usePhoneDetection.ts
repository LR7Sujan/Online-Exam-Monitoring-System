import { useEffect, useRef, useState } from 'react';
import {
  InstantPhoneTracker,
  PhoneDetectionWindow,
} from '../utils/phoneDetector';
import { detectorWorkerClient } from '../utils/detectorWorkerClient';
import {
  captureWebcamSnapshotWithBox,
  captureWebcamSnapshotAsync,
} from '../utils/faceDetector';
import { mediaSession } from '../proctoring/mediaSession';

interface UsePhoneDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  isPaused?: boolean;
  confidenceThreshold?: number;
  onViolation?: (
    code: 'PHONE_DETECTED',
    evidenceMeta: Record<string, unknown>,
    snapshot?: Promise<string | null> | string | null
  ) => void;
}

export function usePhoneDetection({
  videoRef,
  enabled = true,
  isPaused = false,
  confidenceThreshold = 0.6,
  onViolation,
}: UsePhoneDetectionOptions) {
  const [phoneOk, setPhoneOk] = useState<boolean>(true);
  const [phoneStatusText, setPhoneStatusText] = useState<string>('Phone check: OK');
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelLoaded] = useState<boolean>(true);

  const trackerRef = useRef<InstantPhoneTracker>(new InstantPhoneTracker());
  // Legacy compatibility window for any external references
  const legacyWindowRef = useRef<PhoneDetectionWindow>(new PhoneDetectionWindow(5, 3));
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const thresholdRef = useRef(confidenceThreshold);
  thresholdRef.current = confidenceThreshold;

  // Reset / cooldown tracker if detection is paused by warning gate
  useEffect(() => {
    if (isPaused) {
      trackerRef.current.setCooldown(3);
      legacyWindowRef.current.reset();
      setPhoneOk(true);
      if (!modelError) {
        setPhoneStatusText('Phone check: OK');
      }
    }
  }, [isPaused, modelError]);

  // Main Detection Loop (~250ms interval, off-thread worker processing)
  useEffect(() => {
    if (!enabled || isPaused) {
      return;
    }

    let isRunning = false;

    const intervalId = setInterval(async () => {
      // Pause detection when the browser tab is hidden or previous check is in-flight
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (isRunning) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      isRunning = true;
      try {
        const threshold = thresholdRef.current ?? 0.6;
        // Offload detection to Web Worker with 320x240 ImageBitmap (<0.5ms main thread time)
        const result = await detectorWorkerClient.detectPhone(video, threshold);
        const check = trackerRef.current.recordCheck(result.detected);

        if (result.detected) {
          setPhoneOk(false);
          const scorePercent = Math.round((result.score ?? threshold) * 100);
          setPhoneStatusText(`Phone Detected (${scorePercent}%)`);
        } else {
          setPhoneOk(true);
          setPhoneStatusText('Phone check: OK');
        }

        // INSTANT PHONE PENALTY: single frame trigger
        if (check.shouldReport) {
          // Asynchronous snapshot capture on full resolution with bounding box
          const snapshotPromise = captureWebcamSnapshotAsync(video, {
            violationCode: 'PHONE_DETECTED',
            box: result.box,
          }).then((s) => s || captureWebcamSnapshotWithBox(video, result.box));

          if (onViolationRef.current) {
            onViolationRef.current(
              'PHONE_DETECTED',
              {
                reason: `Mobile phone visible in camera view (confidence: ${Math.round((result.score ?? threshold) * 100)}%)`,
                confidence: result.score ?? threshold,
                box: result.box,
                threshold,
                instant: true,
              },
              snapshotPromise
            );
          }
        }
      } catch (err: unknown) {
        if (!modelLoaded) {
          const msg =
            err instanceof Error ? err.message : 'Phone detection model unavailable';
          setModelError(msg);
          setPhoneStatusText('Phone check: Model Offline');
        }
      } finally {
        isRunning = false;
      }
    }, 250);

    mediaSession.registerInterval(intervalId);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, isPaused, videoRef, modelLoaded]);

  return {
    phoneOk,
    phoneStatusText,
    modelError,
    modelLoaded,
    tracker: legacyWindowRef.current,
    instantTracker: trackerRef.current,
  };
}
