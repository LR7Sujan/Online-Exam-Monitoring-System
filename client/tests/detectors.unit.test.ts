import { describe, it, expect } from 'vitest';
import { MultiFaceTracker } from '../src/utils/faceDetector.js';
import { PhoneDetectionWindow } from '../src/utils/phoneDetector.js';
import { VoiceActivityTracker } from '../src/utils/voiceDetector.js';

describe('Proctoring Client Detectors Unit Tests', () => {
  describe('MultiFaceTracker (5-second continuous observation)', () => {
    it('does not fire if faces drop below 2 before 5 seconds', () => {
      const tracker = new MultiFaceTracker(5);

      // Frame 1: 2 faces -> observing 1s
      let res = tracker.recordFrame(2);
      expect(res.shouldReport).toBe(false);
      expect(res.isObserving).toBe(true);
      expect(res.statusText).toBe('Checking... 1s');

      // Frame 2: 2 faces -> observing 2s
      res = tracker.recordFrame(2);
      expect(res.shouldReport).toBe(false);
      expect(res.isObserving).toBe(true);
      expect(res.statusText).toBe('Checking... 2s');

      // Frame 3: count drops to 1 face -> immediate cancellation
      res = tracker.recordFrame(1);
      expect(res.shouldReport).toBe(false);
      expect(res.isObserving).toBe(false);
      expect(res.consecutiveSeconds).toBe(0);

      // Frame 4: 2 faces -> observation starts fresh from 1s
      res = tracker.recordFrame(2);
      expect(res.shouldReport).toBe(false);
      expect(res.isObserving).toBe(true);
      expect(res.statusText).toBe('Checking... 1s');
    });

    it('fires once after 5 continuous seconds of 2+ faces and does not fire repeatedly', () => {
      const tracker = new MultiFaceTracker(5);

      expect(tracker.recordFrame(2).shouldReport).toBe(false); // 1s
      expect(tracker.recordFrame(3).shouldReport).toBe(false); // 2s
      expect(tracker.recordFrame(2).shouldReport).toBe(false); // 3s
      expect(tracker.recordFrame(2).shouldReport).toBe(false); // 4s

      // 5th continuous frame of >= 2 faces -> fires!
      const reportRes = tracker.recordFrame(2);
      expect(reportRes.shouldReport).toBe(true);
      expect(reportRes.statusText ?? '').toMatch(/MULTIPLE FACES/);

      // 6th frame of >= 2 faces -> should NOT fire again (single fire)
      const res6 = tracker.recordFrame(2);
      expect(res6.shouldReport).toBe(false);

      // Reset allows next qualification to fire
      tracker.reset();
      for (let i = 0; i < 4; i++) {
        tracker.recordFrame(2);
      }
      expect(tracker.recordFrame(2).shouldReport).toBe(true);
    });
  });

  describe('PhoneDetectionWindow (3-of-5 sliding checks rule)', () => {
    it('does not fire when phone is detected in fewer than 3 of last 5 checks', () => {
      const window = new PhoneDetectionWindow(5, 3);

      expect(window.recordCheck(true).shouldReport).toBe(false);  // 1 of 1
      expect(window.recordCheck(false).shouldReport).toBe(false); // 1 of 2
      expect(window.recordCheck(false).shouldReport).toBe(false); // 1 of 3
      expect(window.recordCheck(true).shouldReport).toBe(false);  // 2 of 4
      const res = window.recordCheck(false);                      // 2 of 5
      expect(res.shouldReport).toBe(false);
      expect(res.positiveCount).toBe(2);
    });

    it('fires when phone is detected in 3 of last 5 checks and resets properly', () => {
      const window = new PhoneDetectionWindow(5, 3);

      expect(window.recordCheck(true).shouldReport).toBe(false);  // 1 of 1
      expect(window.recordCheck(false).shouldReport).toBe(false); // 1 of 2
      expect(window.recordCheck(true).shouldReport).toBe(false);  // 2 of 3
      
      // 3rd detection in last 4 checks -> should report!
      const res = window.recordCheck(true);
      expect(res.shouldReport).toBe(true);
      expect(res.positiveCount).toBe(3);

      // Subsequent detections while in positive state do not re-fire
      expect(window.recordCheck(true).shouldReport).toBe(false);

      // Complete reset
      window.reset();
      expect(window.getHistory().length).toBe(0);
    });
  });

  describe('VoiceActivityTracker (4 seconds speech in 6-second window)', () => {
    it('ignores transient sounds (coughs, clicks <= 1 second)', () => {
      const tracker = new VoiceActivityTracker(6000, 4000, 200);

      const start = 1000;
      let reported = false;
      // 0.6 seconds of speech (cough/click)
      for (let t = start; t <= start + 600; t += 200) {
        if (tracker.recordSample(true, t).shouldReport) reported = true;
      }
      // Followed by silence up to 6s
      for (let t = start + 800; t <= start + 5000; t += 200) {
        if (tracker.recordSample(false, t).shouldReport) reported = true;
      }

      expect(reported).toBe(false);
    });

    it('fires once when sustained speech reaches 4 seconds within 6 seconds', () => {
      const tracker = new VoiceActivityTracker(6000, 4000, 200);

      const start = 10000;
      let reportCount = 0;
      // 4.2 seconds of speech
      for (let t = start; t <= start + 4200; t += 200) {
        const res = tracker.recordSample(true, t);
        if (res.shouldReport) reportCount++;
      }

      expect(reportCount).toBe(1);

      // Continued talking does not re-fire
      for (let t = start + 4400; t <= start + 6000; t += 200) {
        const res = tracker.recordSample(true, t);
        if (res.shouldReport) reportCount++;
      }
      expect(reportCount).toBe(1);
    });
  });
});
