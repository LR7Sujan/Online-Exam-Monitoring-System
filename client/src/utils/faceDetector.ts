/**
 * Client-Side Optical Face Detector for ProctorIQ
 * Supports MediaPipe Face Detection + Native Shape Detection FaceDetector
 * with Optical Luminance & Skin-Chroma heuristic fallback.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

export interface DetectionResult {
  faces: BoundingBox[];
  faceCount: number;
  isCoveredOrDark: boolean;
  averageLuminance: number;
  confidence: number;
  detectorType: 'mediapipe' | 'native' | 'optical';
}

interface MediaPipeDetectionItem {
  boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
}

interface MediaPipeDetectorInstance {
  setOptions(opts: { model: string; minDetectionConfidence: number }): void;
  initialize(): Promise<void>;
  onResults(cb: (res: { detections?: MediaPipeDetectionItem[] }) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close?(): Promise<void>;
}

interface DetectedFaceItem {
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface NativeFaceDetectorInstance {
  detect(image: ImageBitmapSource): Promise<DetectedFaceItem[]>;
}

type WindowWithFaceDetector = Window & typeof globalThis & {
  FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => NativeFaceDetectorInstance;
};

// MediaPipe instance cache
let mpFaceDetector: MediaPipeDetectorInstance | null = null;
let mpInitAttempted = false;
let mpInitSuccess = false;

export async function initMediaPipeDetector(): Promise<boolean> {
  if (mpInitAttempted) return mpInitSuccess;
  mpInitAttempted = true;

  try {
    const mp = await import('@mediapipe/face_detection');
    const FaceDetectionClass =
      mp.FaceDetection ||
      (mp as unknown as { default?: { FaceDetection?: new (opts: unknown) => MediaPipeDetectorInstance } }).default
        ?.FaceDetection;
    if (!FaceDetectionClass) return false;

    const detector = new FaceDetectionClass({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });

    detector.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5,
    });

    await detector.initialize();
    mpFaceDetector = detector;
    mpInitSuccess = true;
    return true;
  } catch (err) {
    console.info('[FaceDetector] MediaPipe CDN/WASM deferred, using optical/native detector fallback:', err);
    mpInitSuccess = false;
    return false;
  }
}

/**
 * Analyzes video frame optical luminance and contrast to verify if the lens
 * is obscured (tape, hand, covered, or complete darkness).
 */
export function analyzeLensObscuration(
  video: HTMLVideoElement,
  sampleWidth = 64,
  sampleHeight = 48
): { isObscured: boolean; avgLum: number; stdDev: number; skinPixels: number } {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { isObscured: false, avgLum: 128, stdDev: 40, skinPixels: 100 };

    ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const totalPixels = sampleWidth * sampleHeight;

    let totalLum = 0;
    const lumArray: number[] = new Array(totalPixels);
    let skinPixelCount = 0;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumArray[i] = lum;
      totalLum += lum;

      // YCbCr skin tone estimation
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
        skinPixelCount++;
      }
    }

    const avgLum = totalLum / totalPixels;
    let varianceSum = 0;
    for (let i = 0; i < totalPixels; i++) {
      const diff = lumArray[i] - avgLum;
      varianceSum += diff * diff;
    }
    const stdDev = Math.sqrt(varianceSum / totalPixels);

    // If completely dark (< 15) or zero contrast/uniform tape (< 7), camera is covered
    const isObscured = avgLum < 16 || (stdDev < 8 && avgLum < 60);

    return { isObscured, avgLum, stdDev, skinPixels: skinPixelCount };
  } catch {
    return { isObscured: false, avgLum: 120, stdDev: 30, skinPixels: 80 };
  }
}

/**
 * Capture a lightweight, compressed JPEG base64 data URL from a video element
 */
export function captureWebcamSnapshot(video: HTMLVideoElement, quality = 0.72): string | null {
  try {
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const canvas = document.createElement('canvas');
    // Scale down to max 640 width for ultra-fast transfer (~35KB-60KB compressed JPEG)
    const maxWidth = 640;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('[FaceDetector] Snapshot capture failed:', err);
    return null;
  }
}

/**
 * Runs 1 client-side face detection frame on HTMLVideoElement
 */
export async function detectFacesInVideo(video: HTMLVideoElement): Promise<DetectionResult> {
  const width = video.videoWidth || 320;
  const height = video.videoHeight || 240;

  // 1. First optical check: is the webcam covered, blacked out, or taped?
  const optical = analyzeLensObscuration(video);
  if (optical.isObscured) {
    return {
      faces: [],
      faceCount: 0,
      isCoveredOrDark: true,
      averageLuminance: optical.avgLum,
      confidence: 0.99,
      detectorType: 'optical',
    };
  }

  // 2. Try native FaceDetector if available (Chromium high-performance native pipeline)
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const NativeFaceDetector = (window as unknown as WindowWithFaceDetector).FaceDetector;
      if (NativeFaceDetector) {
        const nativeDetector = new NativeFaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        const detected = await nativeDetector.detect(video);
        if (Array.isArray(detected)) {
          const boxes: BoundingBox[] = detected.map((f: DetectedFaceItem) => ({
            x: f.boundingBox.x,
            y: f.boundingBox.y,
            width: f.boundingBox.width,
            height: f.boundingBox.height,
            score: 0.95,
          }));
          return {
            faces: boxes,
            faceCount: boxes.length,
            isCoveredOrDark: false,
            averageLuminance: optical.avgLum,
            confidence: 0.95,
            detectorType: 'native',
          };
        }
      }
    } catch {
      // Fall through to MediaPipe or optical
    }
  }

  // 3. Try MediaPipe FaceDetection if initialized
  if (mpFaceDetector) {
    try {
      let rawDetections: MediaPipeDetectionItem[] = [];
      const onResultsPromise = new Promise<void>((resolve) => {
        mpFaceDetector!.onResults((res: { detections?: MediaPipeDetectionItem[] }) => {
          rawDetections = res.detections || [];
          resolve();
        });
      });

      await mpFaceDetector.send({ image: video });
      await Promise.race([
        onResultsPromise,
        new Promise((r) => setTimeout(r, 400)), // timeout safety
      ]);

      const boxes: BoundingBox[] = rawDetections.map((d: MediaPipeDetectionItem) => {
        const b = d.boundingBox;
        return {
          x: b.xCenter * width - (b.width * width) / 2,
          y: b.yCenter * height - (b.height * height) / 2,
          width: b.width * width,
          height: b.height * height,
          score: 0.9,
        };
      });

      return {
        faces: boxes,
        faceCount: boxes.length,
        isCoveredOrDark: false,
        averageLuminance: optical.avgLum,
        confidence: 0.92,
        detectorType: 'mediapipe',
      };
    } catch {
      // Fall through to optical heuristic
    }
  }

  // 4. Optical Fallback: estimate presence based on skin-tone centroid & illumination
  // If skin pixel proportion is >= 3% and frame is well illuminated, candidate face is in view
  const skinRatio = optical.skinPixels / (64 * 48);
  if (skinRatio >= 0.035 && optical.avgLum >= 25) {
    const boxW = width * 0.45;
    const boxH = height * 0.55;
    const boxX = (width - boxW) / 2;
    const boxY = (height - boxH) / 2 - 10;
    return {
      faces: [{ x: boxX, y: boxY, width: boxW, height: boxH, score: 0.88 }],
      faceCount: 1,
      isCoveredOrDark: false,
      averageLuminance: optical.avgLum,
      confidence: 0.88,
      detectorType: 'optical',
    };
  }

  return {
    faces: [],
    faceCount: 0,
    isCoveredOrDark: optical.isObscured,
    averageLuminance: optical.avgLum,
    confidence: 0.85,
    detectorType: 'optical',
  };
}

/**
 * Draws futuristic bounding box HUD onto overlay canvas
 */
export function drawBoundingBoxesOnCanvas(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  result: DetectionResult,
  consecutiveNoFaceSeconds: number
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const scaleX = w / (video.videoWidth || w);
  const scaleY = h / (video.videoHeight || h);

  // If 0 faces detected or camera covered
  if (result.faceCount === 0) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.setLineDash([]);

    // Top warning banner
    ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
    ctx.fillRect(w / 2 - 95, 16, 190, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      result.isCoveredOrDark ? 'CAMERA COVERED / DARK' : `NO FACE (${consecutiveNoFaceSeconds}/5s)`,
      w / 2,
      31
    );

    // Crosshair target in center
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 15, h / 2);
    ctx.lineTo(w / 2 + 15, h / 2);
    ctx.moveTo(w / 2, h / 2 - 15);
    ctx.lineTo(w / 2, h / 2 + 15);
    ctx.stroke();
    return;
  }

  // If Multiple faces (2+)
  if (result.faceCount >= 2) {
    result.faces.forEach((face, idx) => {
      const bx = face.x * scaleX;
      const by = face.y * scaleY;
      const bw = face.width * scaleX;
      const bh = face.height * scaleY;

      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);

      // Face badge
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(bx, Math.max(0, by - 18), 75, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`FACE #${idx + 1} ALERT`, bx + 4, Math.max(12, by - 5));
    });
    return;
  }

  // Exactly 1 face (Face OK)
  const face = result.faces[0];
  if (face) {
    const bx = face.x * scaleX;
    const by = face.y * scaleY;
    const bw = face.width * scaleX;
    const bh = face.height * scaleY;

    // Corner brackets styling (futuristic HUD)
    const corner = Math.min(18, bw * 0.25, bh * 0.25);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + corner);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + corner, by);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + corner);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - corner);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + corner, by + bh);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - corner);
    ctx.stroke();

    // Inner subtle box
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);

    // "FACE OK" badge
    ctx.fillStyle = '#10B981';
    ctx.fillRect(bx, Math.max(0, by - 18), 72, 18);
    ctx.fillStyle = '#05070E';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('FACE OK: 1', bx + 6, Math.max(12, by - 5));
  }
}

