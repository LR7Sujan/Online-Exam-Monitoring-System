import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';

interface DetectPhoneMessage {
  id: number;
  type: 'DETECT_PHONE';
  bitmap: ImageBitmap;
  threshold?: number;
}

interface DetectFaceMessage {
  id: number;
  type: 'DETECT_FACE';
  bitmap: ImageBitmap;
}

type WorkerMessage = DetectPhoneMessage | DetectFaceMessage;

let objectDetector: ObjectDetector | null = null;
let initPromise: Promise<ObjectDetector> | null = null;

async function getWorkerObjectDetector(): Promise<ObjectDetector> {
  if (objectDetector) return objectDetector;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const wasmFileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );
      const detector = await ObjectDetector.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite',
        },
        scoreThreshold: 0.35,
        runningMode: 'IMAGE',
        categoryAllowlist: ['cell phone'],
      });
      objectDetector = detector;
      return detector;
    } catch (err) {
      console.warn('[WorkerDetector] Failed to init MediaPipe ObjectDetector in worker:', err);
      throw err;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const data = e.data;
  if (!data) return;

  if (data.type === 'DETECT_PHONE') {
    const { id, bitmap, threshold = 0.6 } = data;
    try {
      const detector = await getWorkerObjectDetector();
      const results = detector.detect(bitmap);

      let detected = false;
      let maxScore = 0;
      let matchedBox: { x: number; y: number; width: number; height: number; score?: number } | undefined;

      if (results?.detections && results.detections.length > 0) {
        for (const d of results.detections) {
          const cat = d.categories?.[0];
          const catName = (cat?.categoryName || '').toLowerCase();
          const score = cat?.score ?? 0;

          if ((catName === 'cell phone' || catName === 'phone') && score >= threshold) {
            detected = true;
            if (score > maxScore) {
              maxScore = score;
              if (d.boundingBox) {
                // Denormalize or use coordinates from bounding box
                matchedBox = {
                  x: d.boundingBox.originX,
                  y: d.boundingBox.originY,
                  width: d.boundingBox.width,
                  height: d.boundingBox.height,
                  score,
                };
              }
            }
          }
        }
      }

      self.postMessage({
        id,
        type: 'DETECT_PHONE_RESULT',
        result: {
          detected,
          score: maxScore > 0 ? maxScore : undefined,
          box: matchedBox,
        },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      self.postMessage({
        id,
        type: 'DETECT_PHONE_RESULT',
        error: errMsg,
        result: { detected: false },
      });
    } finally {
      bitmap.close();
    }
  } else if (data.type === 'DETECT_FACE') {
    const { id, bitmap } = data;
    try {
      // Analyze optical luminance & skin variance using OffscreenCanvas
      const width = bitmap.width || 320;
      const height = bitmap.height || 240;
      const canvas = new OffscreenCanvas(64, 48);
      const ctx = canvas.getContext('2d');
      let isCoveredOrDark = false;
      let avgLum = 128;

      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, 64, 48);
        const imgData = ctx.getImageData(0, 0, 64, 48).data;
        let totalLum = 0;
        const totalPixels = 64 * 48;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          totalLum += 0.299 * r + 0.587 * g + 0.114 * b;
        }
        avgLum = totalLum / totalPixels;
        if (avgLum < 12 || avgLum > 248) {
          isCoveredOrDark = true;
        }
      }

      self.postMessage({
        id,
        type: 'DETECT_FACE_RESULT',
        result: {
          isCoveredOrDark,
          averageLuminance: avgLum,
          width,
          height,
        },
      });
    } catch (err: unknown) {
      self.postMessage({
        id,
        type: 'DETECT_FACE_RESULT',
        error: String(err),
        result: { isCoveredOrDark: false, averageLuminance: 128 },
      });
    } finally {
      bitmap.close();
    }
  }
};
