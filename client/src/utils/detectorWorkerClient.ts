import type { PhoneCheckResult, PhoneBoundingBox } from './phoneDetector';
import { detectPhoneInVideo } from './phoneDetector';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

class DetectorWorkerClient {
  private worker: Worker | null = null;
  private reqId = 0;
  private pending = new Map<number, PendingRequest>();
  private failedToInit = false;

  private initWorker(): Worker | null {
    if (this.failedToInit) return null;
    if (this.worker) return this.worker;

    try {
      if (typeof window === 'undefined' || typeof Worker === 'undefined') {
        this.failedToInit = true;
        return null;
      }

      this.worker = new Worker(
        new URL('../workers/detector.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (e: MessageEvent<{ id: number; type: string; result: unknown; error?: string }>) => {
        const { id, result, error } = e.data || {};
        const p = this.pending.get(id);
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(id);
          if (error) {
            p.reject(new Error(error));
          } else {
            p.resolve(result);
          }
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[DetectorWorkerClient] Worker error:', err);
      };

      return this.worker;
    } catch (err) {
      console.warn('[DetectorWorkerClient] Could not instantiate worker, using inline fallback:', err);
      this.failedToInit = true;
      return null;
    }
  }

  public async detectPhone(
    video: HTMLVideoElement,
    threshold = 0.6
  ): Promise<PhoneCheckResult> {
    if (!video || video.readyState < 2) {
      return { detected: false };
    }

    const worker = this.initWorker();
    if (!worker || typeof createImageBitmap === 'undefined') {
      // Inline fallback
      return detectPhoneInVideo(video, threshold);
    }

    try {
      // Hardware-accelerated resize to 320x240 for fast neural detection (<0.5ms on main thread)
      const bitmap = await createImageBitmap(video, {
        resizeWidth: 320,
        resizeHeight: 240,
        resizeQuality: 'low',
      });

      const id = ++this.reqId;
      return await new Promise<PhoneCheckResult>((resolve) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          // Fallback if worker timed out
          detectPhoneInVideo(video, threshold).then(resolve).catch(() => resolve({ detected: false }));
        }, 600);

        this.pending.set(id, {
          resolve: (val) => {
            const res = val as { detected: boolean; score?: number; box?: PhoneBoundingBox };
            if (res && res.box && video.videoWidth && video.videoHeight) {
              // Scale box from 320x240 to video dimensions
              const scaleX = video.videoWidth / 320;
              const scaleY = video.videoHeight / 240;
              resolve({
                detected: res.detected,
                score: res.score,
                box: {
                  x: res.box.x * scaleX,
                  y: res.box.y * scaleY,
                  width: res.box.width * scaleX,
                  height: res.box.height * scaleY,
                  score: res.score,
                },
              });
            } else {
              resolve(res || { detected: false });
            }
          },
          reject: () => {
            detectPhoneInVideo(video, threshold).then(resolve).catch(() => resolve({ detected: false }));
          },
          timer,
        });

        worker.postMessage(
          {
            id,
            type: 'DETECT_PHONE',
            bitmap,
            threshold,
          },
          [bitmap]
        );
      });
    } catch {
      return detectPhoneInVideo(video, threshold);
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('Worker terminated'));
    });
    this.pending.clear();
  }
}

export const detectorWorkerClient = new DetectorWorkerClient();
