/**
 * Voice (Talking) Detection Engine for ProctorIQ
 * Uses Web Audio API: MediaStreamAudioSourceNode -> AnalyserNode.
 * Calibrates 5s room noise floor, isolates human voice band (300Hz-3400Hz),
 * and enforces sustained speech for 4 seconds within a 6-second window.
 * Audio is strictly processed locally in memory; never stored or sent.
 */

export function calculateBandEnergy(
  frequencyData: Uint8Array | Float32Array,
  sampleRate: number,
  fftSize: number,
  minFreq = 300,
  maxFreq = 3400
): number {
  if (!frequencyData || frequencyData.length === 0 || sampleRate <= 0 || fftSize <= 0) {
    return 0;
  }

  const binSize = sampleRate / fftSize;
  const startBin = Math.max(0, Math.floor(minFreq / binSize));
  const endBin = Math.min(frequencyData.length - 1, Math.ceil(maxFreq / binSize));

  if (startBin >= endBin) return 0;

  let sumSquares = 0;
  let count = 0;

  for (let i = startBin; i <= endBin; i++) {
    // Uint8Array values are 0..255; Float32Array are in decibels or linear
    const raw = frequencyData[i];
    const val = typeof raw === 'number' ? (raw > 1 ? raw / 255 : Math.max(0, raw)) : 0;
    sumSquares += val * val;
    count++;
  }

  return count > 0 ? Math.sqrt(sumSquares / count) : 0;
}

/**
 * Pure 4s-within-6s sliding window evaluator for voice activity
 */
export class VoiceActivityTracker {
  private history: Array<{ timestamp: number; isSpeech: boolean }> = [];
  private readonly windowDurationMs: number;
  private readonly requiredSpeechDurationMs: number;
  private readonly sampleIntervalMs: number;
  private reported = false;

  constructor(
    windowDurationMs = 6000,
    requiredSpeechDurationMs = 4000,
    sampleIntervalMs = 200
  ) {
    this.windowDurationMs = windowDurationMs;
    this.requiredSpeechDurationMs = requiredSpeechDurationMs;
    this.sampleIntervalMs = sampleIntervalMs;
  }

  public recordSample(
    isSpeech: boolean,
    now: number = Date.now()
  ): {
    shouldReport: boolean;
    speechSeconds: number;
    speechRatio: number;
  } {
    this.history.push({ timestamp: now, isSpeech });

    // Evict samples outside the window
    const cutoff = now - this.windowDurationMs;
    this.history = this.history.filter((s) => s.timestamp >= cutoff);

    // Compute active speech duration based on sample counts
    const speechCount = this.history.filter((s) => s.isSpeech).length;
    const speechDurationMs = speechCount * this.sampleIntervalMs;
    const speechSeconds = Math.round((speechDurationMs / 1000) * 10) / 10;
    const speechRatio = this.history.length > 0 ? speechCount / this.history.length : 0;

    if (speechDurationMs >= this.requiredSpeechDurationMs) {
      if (!this.reported) {
        this.reported = true;
        return { shouldReport: true, speechSeconds, speechRatio };
      }
    } else if (speechDurationMs <= 600) {
      // Speech has stopped; reset reported flag so subsequent qualification can fire
      this.reported = false;
    }

    return { shouldReport: false, speechSeconds, speechRatio };
  }

  public reset(): void {
    this.history = [];
    this.reported = false;
  }

  public getSpeechSeconds(): number {
    const speechCount = this.history.filter((s) => s.isSpeech).length;
    return Math.round(((speechCount * this.sampleIntervalMs) / 1000) * 10) / 10;
  }

  public isReporting(): boolean {
    return this.reported;
  }
}

export interface VoiceDetectorCallbacks {
  onViolation?: (evidenceMeta: Record<string, unknown>) => void;
  onLevelUpdate?: (level: number, isCalibrating: boolean, isSpeaking: boolean) => void;
}

export class AudioVoiceDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private isCalibrating = true;
  private calibrationSamples: number[] = [];
  private calibrationStartTime = 0;
  private noiseFloor = 0.02;
  private speechMargin = 0.035;

  private tracker = new VoiceActivityTracker(6000, 4000, 200);
  private recentEnergies: number[] = [];
  private isPaused = false;
  private callbacks: VoiceDetectorCallbacks;

  constructor(callbacks: VoiceDetectorCallbacks = {}) {
    this.callbacks = callbacks;
  }

  public async start(stream: MediaStream): Promise<void> {
    this.stop();

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error('No audio track available on MediaStream for voice detector');
    }

    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API (AudioContext) unavailable in this browser environment');
    }

    this.audioContext = new AudioContextClass();
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.4;

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    // Connect source to analyser only (no destination connection, preventing audio playback feedback)
    this.sourceNode.connect(this.analyser);

    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.calibrationStartTime = Date.now();
    this.tracker.reset();
    this.recentEnergies = [];

    const bufferLength = this.analyser.frequencyBinCount;
    const frequencyData = new Uint8Array(bufferLength);

    this.intervalId = setInterval(() => {
      if (this.isPaused || !this.analyser || !this.audioContext) return;

      this.analyser.getByteFrequencyData(frequencyData);
      const bandEnergy = calculateBandEnergy(
        frequencyData,
        this.audioContext.sampleRate,
        this.analyser.fftSize,
        300,
        3400
      );

      const now = Date.now();

      // 1. First 5 seconds: Noise Floor Calibration
      if (this.isCalibrating) {
        this.calibrationSamples.push(bandEnergy);
        const elapsed = now - this.calibrationStartTime;

        this.callbacks.onLevelUpdate?.(bandEnergy, true, false);

        if (elapsed >= 5000 && this.calibrationSamples.length > 10) {
          const avg =
            this.calibrationSamples.reduce((a, b) => a + b, 0) / this.calibrationSamples.length;
          this.noiseFloor = Math.max(0.015, avg);
          this.isCalibrating = false;
        }
        return;
      }

      // 2. Speech Analysis
      this.recentEnergies.push(bandEnergy);
      if (this.recentEnergies.length > 10) {
        this.recentEnergies.shift();
      }

      // Speech modulation: variance across frames (natural human cadence vs constant drone/hum)
      const avgEnergy = this.recentEnergies.reduce((a, b) => a + b, 0) / this.recentEnergies.length;
      const variance =
        this.recentEnergies.reduce((acc, val) => acc + Math.pow(val - avgEnergy, 2), 0) /
        this.recentEnergies.length;
      const stdDev = Math.sqrt(variance);

      const threshold = this.noiseFloor + this.speechMargin;
      const isAboveNoise = bandEnergy > threshold;
      // Speech modulation is typically dynamic (stdDev > 0.003) or significantly loud above noise
      const isSpeech = isAboveNoise && (stdDev > 0.003 || bandEnergy > threshold * 1.5);

      this.callbacks.onLevelUpdate?.(bandEnergy, false, isSpeech);

      // Track 4 seconds of speech within 6-second window
      const check = this.tracker.recordSample(isSpeech, now);
      if (check.shouldReport) {
        this.callbacks.onViolation?.({
          bandEnergy,
          noiseFloor: this.noiseFloor,
          threshold,
          speechSeconds: check.speechSeconds,
          speechRatio: check.speechRatio,
          reason: 'Sustained human speech detected on microphone (>= 4s within 6s window)',
        });
      }
    }, 200);
  }

  public pause(): void {
    this.isPaused = true;
    this.tracker.reset();
    this.recentEnergies = [];
  }

  public resume(): void {
    this.isPaused = false;
    this.tracker.reset();
    this.recentEnergies = [];
  }

  public reset(): void {
    this.tracker.reset();
    this.recentEnergies = [];
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close().catch(() => {});
      } catch {}
      this.audioContext = null;
    }
    this.tracker.reset();
  }
}
