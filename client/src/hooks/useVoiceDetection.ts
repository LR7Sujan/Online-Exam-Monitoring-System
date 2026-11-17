import { useEffect, useRef, useState } from 'react';
import { AudioVoiceDetector } from '../utils/voiceDetector';
import { captureWebcamSnapshot } from '../utils/faceDetector';

interface UseVoiceDetectionOptions {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled?: boolean;
  isPaused?: boolean;
  onViolation?: (
    code: 'VOICE_DETECTED',
    snapshot: string,
    evidenceMeta: Record<string, unknown>
  ) => void;
}

export function useVoiceDetection({
  stream,
  videoRef,
  enabled = true,
  isPaused = false,
  onViolation,
}: UseVoiceDetectionOptions) {
  const [micOk, setMicOk] = useState<boolean>(true);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const detectorRef = useRef<AudioVoiceDetector | null>(null);
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  // Initialize and attach AudioVoiceDetector to media stream
  useEffect(() => {
    if (!enabled || !stream) {
      if (detectorRef.current) {
        detectorRef.current.stop();
        detectorRef.current = null;
      }
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return;
    }

    const detector = new AudioVoiceDetector({
      onLevelUpdate: (level, calibrating, speaking) => {
        setMicLevel(Math.min(1, Math.max(0, level * 5))); // scale for meter visibility
        setIsCalibrating(calibrating);
        setIsSpeaking(speaking);
        setMicOk(!speaking);
      },
      onViolation: (meta) => {
        const video = videoRef.current;
        const snapshot = video ? captureWebcamSnapshot(video) : null;
        if (snapshot && onViolationRef.current) {
          onViolationRef.current('VOICE_DETECTED', snapshot, {
            ...meta,
            reason: 'Sustained speech detected on microphone (>= 4s in 6s window)',
          });
        }
      },
    });

    detectorRef.current = detector;

    detector
      .start(stream)
      .then(() => {
        setAudioError(null);
      })
      .catch((err) => {
        console.warn('[VoiceDetection] Failed to start audio detector:', err);
        setAudioError(err instanceof Error ? err.message : 'Microphone analysis failed');
      });

    return () => {
      detector.stop();
      if (detectorRef.current === detector) {
        detectorRef.current = null;
      }
    };
  }, [enabled, stream, videoRef]);

  // Handle pause / resume synchronization from warning gate
  useEffect(() => {
    if (!detectorRef.current) return;
    if (isPaused) {
      detectorRef.current.pause();
      setIsSpeaking(false);
      setMicOk(true);
    } else {
      detectorRef.current.resume();
    }
  }, [isPaused]);

  return {
    micOk,
    micLevel,
    isCalibrating,
    isSpeaking,
    audioError,
  };
}
