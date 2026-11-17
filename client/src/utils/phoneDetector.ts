/**
 * Phone Detection Engine for ProctorIQ
 * Uses MediaPipe tasks-vision ObjectDetector (EfficientDet-Lite0, 'cell phone' class)
 * with a 3-of-5 sliding window check (~3s) to prevent flicker.
 */

export interface PhoneBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export interface PhoneCheckResult {
  detected: boolean;
  score?: number;
  box?: PhoneBoundingBox;
}

/**
 * Pure 3-of-5 sliding window evaluator for phone presence
 */
export class PhoneDetectionWindow {
  private history: boolean[] = [];
  private readonly windowSize: number;
  private readonly minDetections: number;
  private reported = false;

  constructor(windowSize = 5, minDetections = 3) {
    this.windowSize = windowSize;
    this.minDetections = minDetections;
  }

  public recordCheck(phoneDetected: boolean): {
    shouldReport: boolean;
    positiveCount: number;
    historyLength: number;
  } {
    this.history.push(phoneDetected);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    const positiveCount = this.history.filter(Boolean).length;

    if (positiveCount >= this.minDetections) {
      if (!this.reported) {
        this.reported = true;
        return {
          shouldReport: true,
          positiveCount,
          historyLength: this.history.length,
        };
      }
    } else if (positiveCount === 0) {
      // Once phone is completely cleared, allow next qualification to fire
      this.reported = false;
    }

    return {
      shouldReport: false,
      positiveCount,
      historyLength: this.history.length,
    };
  }

  public reset(): void {
    this.history = [];
    this.reported = false;
  }

  public getHistory(): boolean[] {
    return [...this.history];
  }

  public getPositiveCount(): number {
    return this.history.filter(Boolean).length;
  }
}

// MediaPipe ObjectDetector lazy instance cache
let objectDetectorInstance: any = null;
let initPromise: Promise<any> | null = null;
let modelLoadError: string | null = null;

export async function getObjectDetector(): Promise<any> {
  if (objectDetectorInstance) return objectDetectorInstance;
  if (modelLoadError) throw new Error(modelLoadError);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Lazy dynamic import of @mediapipe/tasks-vision
      const visionModule = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, ObjectDetector } = visionModule;

      const wasmFileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      const detector = await ObjectDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
        },
        scoreThreshold: 0.5,
        runningMode: 'IMAGE',
        categoryAllowlist: ['cell phone'],
      });

      objectDetectorInstance = detector;
      return detector;
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : 'MediaPipe ObjectDetector failed to initialize';
      modelLoadError = errMsg;
      console.warn('[PhoneDetector] Model loading error:', err);
      throw new Error(errMsg);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Runs 1 frame phone detection on an HTMLVideoElement
 */
export async function detectPhoneInVideo(video: HTMLVideoElement): Promise<PhoneCheckResult> {
  try {
    if (!video || video.readyState < 2) {
      return { detected: false };
    }

    const detector = await getObjectDetector();
    const results = detector.detect(video);

    if (!results?.detections || results.detections.length === 0) {
      return { detected: false };
    }

    // Look for category 'cell phone' with score >= 0.5
    for (const d of results.detections) {
      const category = d.categories?.[0];
      const categoryName = (category?.categoryName || '').toLowerCase();
      const score = category?.score ?? 0;

      if ((categoryName === 'cell phone' || categoryName === 'phone') && score >= 0.5) {
        const box = d.boundingBox
          ? {
              x: d.boundingBox.originX,
              y: d.boundingBox.originY,
              width: d.boundingBox.width,
              height: d.boundingBox.height,
              score,
            }
          : undefined;

        return {
          detected: true,
          score,
          box,
        };
      }
    }

    return { detected: false };
  } catch (err) {
    // If model failed or was not loaded, propagate error or return fallback
    throw err;
  }
}
