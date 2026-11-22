import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../src/config/db.js';
import {
  allocatePersonas,
  createRng,
  getPersonaWeights,
  simulatorEngine,
} from '../src/services/simulator.js';

describe('Simulator Personas, Budgets and Realistic Outcomes', () => {
  beforeAll(async () => {
    // Ensure Exam 1 exists, is published, and has an active window in exam_monitoring_test
    await executeSql(
      `UPDATE Exams
          SET is_published = 1,
              start_window = DATE_SUB(NOW(), INTERVAL 1 HOUR),
              end_window = DATE_ADD(NOW(), INTERVAL 24 HOUR)
        WHERE id = 1`
    );
    // Reset any stale simulation data
    await simulatorEngine.reset();
  });

  afterAll(async () => {
    if (simulatorEngine.getState().isRunning) {
      await simulatorEngine.stop();
    }
    await simulatorEngine.reset();
    await pool.end();
  });

  describe('1. Persona Weights and Deterministic Allocation', () => {
    it('allocates the exact required 12-candidate mix for Realistic / MED: 5 Honest, 4 Mostly Honest, 2 Careless, 1 Cheater', () => {
      const weights = getPersonaWeights('realistic', 'medium');
      const rng = createRng('test-seed-12');
      const personas = allocatePersonas(12, weights, rng);

      expect(personas.length).toBe(12);
      const counts = {
        honest: personas.filter((p) => p === 'honest').length,
        mostly_honest: personas.filter((p) => p === 'mostly_honest').length,
        careless: personas.filter((p) => p === 'careless').length,
        cheater: personas.filter((p) => p === 'cheater').length,
      };

      expect(counts.honest).toBe(5);
      expect(counts.mostly_honest).toBe(4);
      expect(counts.careless).toBe(2);
      expect(counts.cheater).toBe(1);
    });

    it('allocates 40 candidates on Realistic / MED with >40% Honest and 10% Cheater', () => {
      const weights = getPersonaWeights('realistic', 'medium');
      const rng = createRng('test-seed-40');
      const personas = allocatePersonas(40, weights, rng);

      expect(personas.length).toBe(40);
      const honestCount = personas.filter((p) => p === 'honest').length;
      const cheaterCount = personas.filter((p) => p === 'cheater').length;

      // 17 Honest = 42.5% (> 40%)
      expect(honestCount).toBeGreaterThanOrEqual(17);
      // 4 Cheaters = 10% (between 5% and 20%)
      expect(cheaterCount).toBe(4);
    });

    it('is strictly deterministic when provided the same seed', () => {
      const weights = getPersonaWeights('realistic', 'medium');
      const p1 = allocatePersonas(20, weights, createRng('deterministic-seed-xyz'));
      const p2 = allocatePersonas(20, weights, createRng('deterministic-seed-xyz'));

      expect(p1).toEqual(p2);
    });

    it('scales persona weights across Chaos profiles (LOW has more honest, HIGH has more cheaters)', () => {
      const lowWeights = getPersonaWeights('realistic', 'low');
      const highWeights = getPersonaWeights('realistic', 'high');

      expect(lowWeights.honest).toBe(0.60);
      expect(lowWeights.cheater).toBe(0.02);

      expect(highWeights.honest).toBe(0.20);
      expect(highWeights.cheater).toBe(0.25);
      expect(highWeights.cheater).toBeGreaterThan(lowWeights.cheater);
    });

    it('Stress test scenario heavily favors cheaters and careless examinees', () => {
      const stressWeights = getPersonaWeights('stress_test', 'medium');
      expect(stressWeights.cheater).toBeGreaterThanOrEqual(0.50);
      expect(stressWeights.honest).toBeLessThanOrEqual(0.05);
    });
  });

  describe('2. Live Cohort Simulation (40 Candidates with Fixed Seed on Realistic/MED)', () => {
    it('executes 40 candidates: terminated between 5% and 20%, clean >40%, caps respected, Results rows graded', async () => {
      const fixedSeed = 'realistic-med-fixed-40';
      await simulatorEngine.start({
        examId: 1,
        studentCount: 40,
        speed: 10.0, // High execution speed for fast, responsive test run
        chaos: 'medium',
        scenario: 'realistic',
        seed: fixedSeed,
      });

      // Wait until all candidates have finished their sessions
      const startTime = Date.now();
      while (simulatorEngine.getState().isRunning) {
        if (Date.now() - startTime > 35000) {
          throw new Error('Simulation run timed out after 35 seconds');
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const state = simulatorEngine.getState();
      expect(state.isRunning).toBe(false);
      expect(state.candidates.length).toBe(40);

      // 1. Terminated share is between 5% and 20%
      const terminatedCount = state.candidates.filter(
        (c) => c.status === 'TERMINATED_CHEATING' || c.result?.integrityStatus === 'DISQUALIFIED'
      ).length;
      const terminatedShare = terminatedCount / 40;
      expect(terminatedShare).toBeGreaterThanOrEqual(0.05);
      expect(terminatedShare).toBeLessThanOrEqual(0.20);

      // 2. Clean share is above 40%
      const cleanCount = state.candidates.filter(
        (c) => c.result?.integrityStatus === 'CLEAN'
      ).length;
      const cleanShare = cleanCount / 40;
      expect(cleanShare).toBeGreaterThan(0.40);

      // 3. Nobody exceeds their persona cap
      for (const candidate of state.candidates) {
        expect(candidate.violationsCount).toBeLessThanOrEqual(candidate.violationBudget);
        if (candidate.persona === 'honest') {
          expect(candidate.violationsCount).toBe(0);
        } else if (candidate.persona === 'mostly_honest') {
          expect(candidate.violationsCount).toBeLessThanOrEqual(2);
        } else if (candidate.persona === 'careless') {
          expect(candidate.violationsCount).toBeLessThanOrEqual(3);
        }
      }

      // 4. Every finished candidate has a Results row with a score
      for (const candidate of state.candidates) {
        expect(candidate.result).toBeDefined();
        expect(typeof candidate.result?.percentage).toBe('number');
        expect(typeof candidate.result?.rawScore).toBe('number');
        expect(candidate.result?.finalTrustScore).toBeGreaterThanOrEqual(0);
        expect(['CLEAN', 'FLAGGED', 'DISQUALIFIED']).toContain(candidate.result?.integrityStatus);
      }

      // Verify records in MySQL Results table
      const [dbResults] = await queryRows<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM Results r
         JOIN Exam_Sessions es ON es.id = r.session_id
         JOIN Users u ON u.id = es.student_id
        WHERE u.email LIKE 'virtual.candidate.%'`
      );
      expect(Number(dbResults.cnt)).toBe(40);

      // Check summary strip data
      expect(state.summary).toBeDefined();
      expect(state.summary?.cleanCount).toBe(cleanCount);
      expect(state.summary?.disqualifiedCount).toBe(terminatedCount);
      expect(state.summary?.avgScore).toBeGreaterThanOrEqual(0);
      expect(state.summary?.avgTrust).toBeGreaterThan(50);
    }, 40000);
  });

  describe('3. Chaos and Scenario Comparisons', () => {
    it('LOW chaos allocates fewer problem candidates than HIGH chaos', () => {
      const lowWeights = getPersonaWeights('realistic', 'low');
      const highWeights = getPersonaWeights('realistic', 'high');

      const lowPersonas = allocatePersonas(20, lowWeights, createRng('low-seed'));
      const highPersonas = allocatePersonas(20, highWeights, createRng('high-seed'));

      const lowProblemCount = lowPersonas.filter((p) => p === 'careless' || p === 'cheater').length;
      const highProblemCount = highPersonas.filter((p) => p === 'careless' || p === 'cheater').length;

      expect(lowProblemCount).toBeLessThan(highProblemCount);
    });

    it('Stress test reproduces heavy terminations', async () => {
      await simulatorEngine.reset();

      await simulatorEngine.start({
        examId: 1,
        studentCount: 12,
        speed: 10.0,
        chaos: 'high',
        scenario: 'stress_test',
        seed: 'stress-seed-999',
      });

      const startTime = Date.now();
      while (simulatorEngine.getState().isRunning) {
        if (Date.now() - startTime > 25000) {
          throw new Error('Stress test timed out');
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const state = simulatorEngine.getState();
      const terminated = state.candidates.filter(
        (c) => c.status === 'TERMINATED_CHEATING' || c.result?.integrityStatus === 'DISQUALIFIED'
      ).length;

      // Heavy terminations: >= 35% of candidates disqualified
      expect(terminated / 12).toBeGreaterThanOrEqual(0.35);

      // Clean up after test
      await simulatorEngine.reset();
    }, 30000);
  });
});
