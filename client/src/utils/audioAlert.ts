// ============================================================================
// ProctorIQ Web Audio API Procedural Sound Synthesizer & Haptic Engine
// Off by default. Zero external asset dependencies; procedural audio synthesis.
// ============================================================================

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Returns whether audio is muted.
 * Default is MUTED (true / off by default) unless explicitly set to 'false'.
 */
export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return true;
  const item = localStorage.getItem('proctoriq_audio_muted');
  // Off by default: only enabled if user explicitly toggled it to 'false'
  return item !== 'false';
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('proctoriq_audio_muted', muted ? 'true' : 'false');
}

/**
 * Haptic feedback trigger for tactile feedback on supported touch/mobile devices
 */
export function triggerHaptic(pattern: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (pattern === 'heavy') navigator.vibrate([40, 30, 40]);
      else if (pattern === 'medium') navigator.vibrate(25);
      else navigator.vibrate(12);
    }
  } catch {
    // Graceful fallback on devices without vibration motor
  }
}

/**
 * Procedural synthesized chime/ping effects
 */
export function playPingSound(
  type: 'violation' | 'critical' | 'confirm' | 'reinstate' = 'violation'
): void {
  try {
    if (isAudioMuted()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'critical') {
      // Urgent dual-tone siren for DEVTOOLS_OPEN / MULTIPLE_FACES
      triggerHaptic('heavy');
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.setValueAtTime(587.33, now + 0.08); // D5
      osc.frequency.setValueAtTime(987.77, now + 0.18); // B5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'confirm') {
      // Pleasant upward chime for review confirmation
      triggerHaptic('light');
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12); // G5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'reinstate') {
      // Radiant rising triple chord
      triggerHaptic('medium');
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Subtle futuristic sonar blip for normal violation log
      triggerHaptic('light');
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(370, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch {
    // Audio playback blocked by browser user gesture policy
  }
}
