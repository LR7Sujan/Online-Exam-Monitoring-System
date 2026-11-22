import { closeMediaPipeDetector } from '../utils/faceDetector';
import { closePhoneDetector } from '../utils/phoneDetector';

/**
 * MediaSession Manager (Singleton)
 *
 * Centralized ownership of all live audio and video media streams, video elements,
 * Web Audio contexts, analysers, MediaPipe detectors, and detection timers across
 * the entire examination lifecycle.
 *
 * Calling stopAll() guarantees:
 * - Every track of every MediaStream is stopped (track.stop()), removing browser recording indicators.
 * - Every video element has srcObject set to null and playback paused.
 * - AudioContext is closed and AnalyserNodes disconnected.
 * - Detection intervals and requestAnimationFrame loops are cancelled.
 * - MediaPipe detectors are closed and disposed.
 * - Webcam preview UI is cleared.
 */
class MediaSessionManager {
  private streams: Set<MediaStream> = new Set();
  private tracks: Set<MediaStreamTrack> = new Set();
  private videos: Set<HTMLVideoElement> = new Set();
  private audioContexts: Set<AudioContext> = new Set();
  private audioNodes: Set<AudioNode> = new Set();
  private intervals: Set<ReturnType<typeof setInterval>> = new Set();
  private animationFrames: Set<number> = new Set();
  private cleanups: Set<() => void> = new Set();
  private isStopped = false;

  constructor() {
    if (typeof window !== 'undefined') {
      (window as unknown as { __mediaSession?: MediaSessionManager }).__mediaSession = this;
      window.addEventListener('beforeunload', () => {
        this.stopAll();
      });
      window.addEventListener('pagehide', () => {
        this.stopAll();
      });
    }
  }

  /**
   * Resets the stopped state when beginning a new media session.
   */
  public startSession(): void {
    this.isStopped = false;
  }

  public isSessionStopped(): boolean {
    return this.isStopped;
  }

  /**
   * Register a MediaStream to be tracked and stopped when the session concludes.
   */
  public registerStream(stream: MediaStream | null | undefined): void {
    if (!stream) return;
    if (this.isStopped) {
      stream.getTracks().forEach((track) => {
        try {
          if (track.readyState !== 'ended') track.stop();
        } catch {
          // safe ignore
        }
      });
      return;
    }

    this.streams.add(stream);
    stream.getTracks().forEach((track) => {
      this.tracks.add(track);
      const onEnded = () => {
        const allEnded = stream.getTracks().every((t) => t.readyState === 'ended');
        if (allEnded) {
          this.streams.delete(stream);
        }
        this.tracks.delete(track);
      };
      track.addEventListener('ended', onEnded);
    });
  }

  /**
   * Unregister a MediaStream without stopping it (e.g. when replacing or handing off).
   */
  public unregisterStream(stream: MediaStream | null | undefined): void {
    if (!stream) return;
    this.streams.delete(stream);
  }

  /**
   * Register an HTMLVideoElement to clear srcObject and pause on stopAll.
   */
  public registerVideo(video: HTMLVideoElement | null | undefined): void {
    if (!video) return;
    this.videos.add(video);
  }

  /**
   * Register an AudioContext to be closed on stopAll.
   */
  public registerAudioContext(ctx: AudioContext | null | undefined): void {
    if (!ctx) return;
    this.audioContexts.add(ctx);
  }

  /**
   * Register an AudioNode (Source, Analyser, Gain) to disconnect on stopAll.
   */
  public registerAudioNode(node: AudioNode | null | undefined): void {
    if (!node) return;
    this.audioNodes.add(node);
  }

  /**
   * Register a setInterval timer ID to cancel on stopAll.
   */
  public registerInterval(id: ReturnType<typeof setInterval> | null | undefined): void {
    if (!id) return;
    this.intervals.add(id);
  }

  public clearInterval(id: ReturnType<typeof setInterval> | null | undefined): void {
    if (!id) return;
    this.intervals.delete(id);
    clearInterval(id);
  }

  /**
   * Register a requestAnimationFrame loop ID to cancel on stopAll.
   */
  public registerAnimationFrame(id: number | null | undefined): void {
    if (!id) return;
    this.animationFrames.add(id);
  }

  public cancelAnimationFrame(id: number | null | undefined): void {
    if (!id) return;
    this.animationFrames.delete(id);
    cancelAnimationFrame(id);
  }

  /**
   * Register a custom cleanup function (e.g. to reset React state or detectors).
   */
  public registerCleanup(fn: () => void): () => void {
    this.cleanups.add(fn);
    return () => this.cleanups.delete(fn);
  }

  /**
   * Shuts down all active media tracks, video elements, audio contexts,
   * detection loops, and detectors across the application.
   */
  public stopAll(): void {
    this.isStopped = true;

    // 1. Stop every MediaStream track
    for (const stream of this.streams) {
      try {
        stream.getTracks().forEach((track) => {
          try {
            if (track.readyState !== 'ended') {
              track.stop();
            }
          } catch (trackErr) {
            console.warn('[MediaSession] Error stopping MediaStreamTrack:', trackErr);
          }
        });
      } catch (streamErr) {
        console.warn('[MediaSession] Error stopping MediaStream:', streamErr);
      }
    }
    this.streams.clear();

    // 2. Stop every individually tracked track
    for (const track of this.tracks) {
      try {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      } catch (trackErr) {
        console.warn('[MediaSession] Error stopping MediaStreamTrack from track set:', trackErr);
      }
    }
    this.tracks.clear();

    // 2. Pause and clear all registered HTMLVideoElements
    for (const video of this.videos) {
      try {
        video.pause();
        video.srcObject = null;
        if (typeof video.load === 'function') {
          video.load();
        }
      } catch (videoErr) {
        console.warn('[MediaSession] Error clearing HTMLVideoElement:', videoErr);
      }
    }
    this.videos.clear();

    // 3. Disconnect all registered AudioNodes
    for (const node of this.audioNodes) {
      try {
        node.disconnect();
      } catch {
        // safe ignore
      }
    }
    this.audioNodes.clear();

    // 4. Close all registered AudioContext instances
    for (const ctx of this.audioContexts) {
      try {
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch {
        // safe ignore
      }
    }
    this.audioContexts.clear();

    // 5. Cancel all intervals
    for (const id of this.intervals) {
      try {
        clearInterval(id);
      } catch {
        // safe ignore
      }
    }
    this.intervals.clear();

    // 6. Cancel all animation frames
    for (const id of this.animationFrames) {
      try {
        cancelAnimationFrame(id);
      } catch {
        // safe ignore
      }
    }
    this.animationFrames.clear();

    // 7. Execute all custom cleanup callbacks
    for (const cleanup of this.cleanups) {
      try {
        cleanup();
      } catch (cleanupErr) {
        console.warn('[MediaSession] Error in custom cleanup:', cleanupErr);
      }
    }
    this.cleanups.clear();

    // 8. Close MediaPipe detectors
    closeMediaPipeDetector().catch(() => {});
    closePhoneDetector().catch(() => {});

    // 9. Extra safety pass: scan DOM for any video elements currently holding a MediaStream
    if (typeof document !== 'undefined') {
      try {
        const domVideos = document.querySelectorAll('video');
        domVideos.forEach((v) => {
          if (v.srcObject) {
            if (v.srcObject instanceof MediaStream) {
              v.srcObject.getTracks().forEach((t) => {
                try {
                  if (t.readyState !== 'ended') t.stop();
                } catch {
                  // safe ignore
                }
              });
            }
            v.pause();
            v.srcObject = null;
          }
        });
      } catch {
        // safe ignore
      }
    }
  }
}

export const mediaSession = new MediaSessionManager();
