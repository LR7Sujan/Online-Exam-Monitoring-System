/**
 * Client-Side Optical Face Detector for ProctorIQ
 * Supports MediaPipe Face Detection + Native Shape Detection FaceDetector
 * with Optical Luminance & Skin-Chroma heuristic fallback.
 */

/**
 * Bounding box interface
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
}

/**
 * Multiple faces continuous observation tracker (5 continuous seconds requirement)
 */
export class MultiFaceTracker {
  private consecutiveSeconds = 0;
  private readonly requiredSeconds: number;
  private reported = false;

  constructor(requiredSeconds = 5) {
    this.requiredSeconds = requiredSeconds;
  }

  public recordFrame(faceCount: number): {
    shouldReport: boolean;
    consecutiveSeconds: number;
    isObserving: boolean;
    statusText?: string;
  } {
    if (faceCount >= 2) {
      this.consecutiveSeconds += 1;
      const current = this.consecutiveSeconds;

      if (current >= this.requiredSeconds) {
        if (!this.reported) {
          this.reported = true;
          return {
            shouldReport: true,
            consecutiveSeconds: current,
            isObserving: false,
            statusText: `MULTIPLE FACES (${faceCount} Faces Detected)`,
          };
        }
        return {
          shouldReport: false,
          consecutiveSeconds: current,
          isObserving: false,
          statusText: `MULTIPLE FACES (${faceCount} Faces Detected)`,
        };
      }

      return {
        shouldReport: false,
        consecutiveSeconds: current,
        isObserving: true,
        statusText: `Checking... ${current}s`,
      };
    } else {
      // If at any moment count drops below 2, cancel and reset immediately
      this.consecutiveSeconds = 0;
      this.reported = false;
      return {
        shouldReport: false,
        consecutiveSeconds: 0,
        isObserving: false,
      };
    }
  }

  public reset(): void {
    this.consecutiveSeconds = 0;
    this.reported = false;
  }

  public getConsecutiveSeconds(): number {
    return this.consecutiveSeconds;
  }

  public isObservationActive(): boolean {
    return this.consecutiveSeconds > 0 && this.consecutiveSeconds < this.requiredSeconds;
  }
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
 * Evidence capture options for burning forensic annotations and stamps
 */
export interface EvidenceCaptureOptions {
  violationCode?: string;
  box?: { x: number; y: number; width: number; height: number; label?: string; score?: number };
  boxes?: Array<{ x: number; y: number; width: number; height: number; label?: string; score?: number }>;
  quality?: number;
  maxWidth?: number;
}

/**
 * Checks whether the captured canvas is completely black, white, or devoid of visual variance
 */
export function isCanvasBlankOrSolid(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const sampleStepX = Math.max(1, Math.floor(width / 24));
    const sampleStepY = Math.max(1, Math.floor(height / 24));
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let totalLuma = 0;
    let count = 0;
    const lumas: number[] = [];

    for (let y = 0; y < height; y += sampleStepY) {
      for (let x = 0; x < width; x += sampleStepX) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a < 50) return true; // Transparent canvas
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuma += luma;
        lumas.push(luma);
        count++;
      }
    }

    if (count === 0) return true;
    const mean = totalLuma / count;
    let varianceSum = 0;
    for (const l of lumas) {
      varianceSum += (l - mean) ** 2;
    }
    const variance = varianceSum / count;

    // Flat monochrome frame (solid black or blank) has variance near 0
    return variance < 4;
  } catch {
    return false;
  }
}

/**
 * Renders video frame to canvas with bounding boxes and forensic timestamp strip
 */
export function renderEvidenceToCanvas(
  video: HTMLVideoElement,
  options?: EvidenceCaptureOptions
): HTMLCanvasElement | null {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  const maxWidth = options?.maxWidth ?? 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, width, height);

  // 1. Draw Bounding Boxes with labels
  const allBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label?: string;
    score?: number;
    color?: string;
  }> = [];

  if (options?.box) {
    allBoxes.push({
      ...options.box,
      color: '#F43F5E',
      label:
        options.box.label ??
        (options.box.score ? `PHONE: ${Math.round(options.box.score * 100)}%` : 'PHONE DETECTED'),
    });
  }

  if (options?.boxes && options.boxes.length > 0) {
    options.boxes.forEach((b, idx) => {
      allBoxes.push({
        ...b,
        color: '#F59E0B',
        label: b.label ?? `FACE ${idx + 1}${b.score ? ` (${Math.round(b.score * 100)}%)` : ''}`,
      });
    });
  }

  for (const b of allBoxes) {
    const bx = b.x * scale;
    const by = b.y * scale;
    const bw = b.width * scale;
    const bh = b.height * scale;
    const color = b.color ?? '#F43F5E';

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);

    const label = b.label ?? 'VIOLATION TARGET';
    ctx.fillStyle = color;
    const labelW = Math.max(90, label.length * 7.5 + 12);
    ctx.fillRect(bx, Math.max(0, by - 20), labelW, 20);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(label, bx + 5, Math.max(14, by - 6));
  }

  // 2. Forensic Timestamp & Violation Code Strip
  const vCode = options?.violationCode ?? 'VIOLATION_DETECTED';
  const timestampStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  const stripHeight = 22;
  const stripY = height - stripHeight;

  ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
  ctx.fillRect(0, stripY, width, stripHeight);

  ctx.fillStyle = '#F43F5E';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`[${vCode}]`, 8, stripY + 15);

  const codeWidth = ctx.measureText(`[${vCode}] `).width;
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '10px monospace';
  ctx.fillText(`${timestampStr} • ProctorIQ Forensic Frame`, 8 + codeWidth, stripY + 15);

  return canvas;
}

/**
 * Capture a lightweight, compressed JPEG base64 data URL from a video element (with blank retry)
 */
export async function captureWebcamSnapshotAsync(
  video: HTMLVideoElement,
  options?: EvidenceCaptureOptions
): Promise<string | null> {
  const quality = options?.quality ?? 0.7;

  let canvas = renderEvidenceToCanvas(video, options);
  let ctx = canvas?.getContext('2d');

  if (!canvas || !ctx || isCanvasBlankOrSolid(ctx, canvas.width, canvas.height)) {
    // Retry once after 300ms if video frame was blank or not yet decoded
    await new Promise((resolve) => setTimeout(resolve, 300));
    canvas = renderEvidenceToCanvas(video, options);
    ctx = canvas?.getContext('2d');
  }

  if (!canvas) {
    return null;
  }

  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('[FaceDetector] Snapshot capture failed:', err);
    return null;
  }
}

/**
 * Synchronous capture wrapper for backwards compatibility
 */
export function captureWebcamSnapshot(
  video: HTMLVideoElement,
  qualityOrOptions: number | EvidenceCaptureOptions = 0.7
): string | null {
  try {
    const options: EvidenceCaptureOptions =
      typeof qualityOrOptions === 'number'
        ? { quality: qualityOrOptions }
        : qualityOrOptions;

    const canvas = renderEvidenceToCanvas(video, options);
    if (!canvas) return null;
    return canvas.toDataURL('image/jpeg', options.quality ?? 0.7);
  } catch (err) {
    console.warn('[FaceDetector] Snapshot capture failed:', err);
    return null;
  }
}

/**
 * Captures snapshot and burns an optional evidence bounding box into the exported image
 */
export function captureWebcamSnapshotWithBox(
  video: HTMLVideoElement,
  box?: { x: number; y: number; width: number; height: number; label?: string; score?: number },
  quality = 0.7
): string | null {
  return captureWebcamSnapshot(video, {
    box,
    violationCode: 'PHONE_DETECTED',
    quality,
  });
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

