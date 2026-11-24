import { useEffect, useRef, useState, useCallback } from 'react';
import { enqueueChunk, flushAllChunks, clearSessionChunks } from '../utils/recordingQueue';
import { useAuthStore } from '../store/authStore';

export interface UseExamRecorderParams {
  stream: MediaStream | null;
  sessionId: number;
  examId: number;
  recordVideo?: boolean | number;
  recordAudio?: boolean | number;
  isExamRunning: boolean;
  onUploadStalled?: (reason: string) => void;
}

export interface UseExamRecorderReturn {
  isRecording: boolean;
  isUploading: boolean;
  recordingSeconds: number;
  recorderError: string | null;
  flushAndFinish: () => Promise<boolean>;
}

export function useExamRecorder({
  stream,
  sessionId,
  recordVideo = true,
  recordAudio = false,
  isExamRunning,
  onUploadStalled,
}: UseExamRecorderParams): UseExamRecorderReturn {
  const { user, token } = useAuthStore();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recorderError, setRecorderError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFinishedRef = useRef<boolean>(false);

  // Demo Simulator guard: never record simulator candidates
  const isSimulatorCandidate =
    user?.email?.startsWith('virtual.candidate.') ||
    user?.email?.startsWith('sim-') ||
    user?.email?.includes('.sim.') ||
    user?.email?.includes('.load.');

  const isEnabled = Boolean(recordVideo) && !isSimulatorCandidate && Boolean(sessionId);

  // Pick best supported MIME type
  const getSupportedMimeType = useCallback((): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return '';
  }, []);

  // Upload an incoming chunk via IndexedDB queue and immediate flush
  const handleChunkData = useCallback(
    async (blob: Blob) => {
      if (!blob || blob.size === 0 || !token) return;

      const currentIndex = chunkIndexRef.current++;
      try {
        await enqueueChunk(sessionId, currentIndex, blob);
        setIsUploading(true);

        const flushed = await flushAllChunks(sessionId, token);
        if (flushed === 0) {
          onUploadStalled?.('Recording upload paused. Chunks queued locally in IndexedDB.');
        }
      } catch (err) {
        console.warn(`[useExamRecorder] Error processing chunk ${currentIndex}:`, err);
        onUploadStalled?.('Temporary network issue saving recording chunk.');
      } finally {
        setIsUploading(false);
      }
    },
    [sessionId, token, onUploadStalled]
  );

  // Start recording when exam begins
  useEffect(() => {
    if (!isEnabled || !isExamRunning || !stream || isFinishedRef.current) {
      return;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      return;
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      console.warn('[useExamRecorder] MediaRecorder not supported in this browser.');
      setRecorderError('MediaRecorder unsupported');
      return;
    }

    try {
      // Isolate video track (and audio track only if recordAudio is enabled)
      const tracksToRecord: MediaStreamTrack[] = [];
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        tracksToRecord.push(videoTracks[0]);
      }
      if (recordAudio) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          tracksToRecord.push(audioTracks[0]);
        }
      }

      if (tracksToRecord.length === 0) {
        console.warn('[useExamRecorder] No valid tracks available to record.');
        return;
      }

      const recordingStream = new MediaStream(tracksToRecord);

      // videoBitsPerSecond: ~250,000 (~100 MB/hr at 640x480 10fps)
      const recorder = new MediaRecorder(recordingStream, {
        mimeType,
        videoBitsPerSecond: 250000,
      });

      mediaRecorderRef.current = recorder;
      chunkIndexRef.current = 0;
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          void handleChunkData(event.data);
        }
      };

      recorder.onerror = (err) => {
        console.warn('[useExamRecorder] Recorder error:', err);
        setRecorderError('Recording encountered an error');
      };

      // 10000 ms (10 seconds) timeslice chunks
      recorder.start(10000);
      setIsRecording(true);
      setRecorderError(null);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.warn('[useExamRecorder] Failed to initialize MediaRecorder:', err);
      setRecorderError(err instanceof Error ? err.message : 'Failed to start recorder');
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isEnabled, isExamRunning, stream, recordAudio, getSupportedMimeType, handleChunkData]);

  // Flush and finish recording
  const flushAndFinish = useCallback(async (): Promise<boolean> => {
    if (!isEnabled || isFinishedRef.current || !token) {
      return true;
    }
    isFinishedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const durationMs = startTimeRef.current > 0 ? Date.now() - startTimeRef.current : 0;

    // Stop MediaRecorder to flush final chunk
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) {
            resolve();
            return;
          }
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
      } catch (err) {
        console.warn('[useExamRecorder] Error stopping MediaRecorder:', err);
      }
    }
    setIsRecording(false);

    // Wait a brief moment for any pending ondataavailable event to write to IndexedDB
    await new Promise((r) => setTimeout(r, 200));

    // Flush all queued chunks to server
    try {
      setIsUploading(true);
      await flushAllChunks(sessionId, token);

      // Call server finish endpoint
      const finishRes = await fetch(`/api/sessions/${sessionId}/recording/finish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ durationMs }),
      });

      if (finishRes.ok) {
        await clearSessionChunks(sessionId);
        return true;
      } else {
        console.warn('[useExamRecorder] Failed to finish recording on server:', finishRes.status);
        return false;
      }
    } catch (err) {
      console.warn('[useExamRecorder] Error finalizing recording:', err);
      return false;
    } finally {
      setIsUploading(false);
    }
  }, [isEnabled, sessionId, token]);

  return {
    isRecording,
    isUploading,
    recordingSeconds,
    recorderError,
    flushAndFinish,
  };
}
