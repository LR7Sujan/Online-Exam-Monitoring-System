import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { startOrResumeExamSession } from '../routes/exams.routes.js';
import {
  emitExamSubmitted,
  emitSessionTerminated,
  emitSessionUpdate,
  emitSimulatorReset,
  emitViolationNew,
  emitWarningIssued,
  emitWarningAcked,
} from '../realtime/socket.js';
import type { AnswerOption, ExamSessionRow, ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '../../../');
const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(projectRootDir, env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

export type ChaosLevel = 'low' | 'medium' | 'high';
export type ScenarioType = 'realistic' | 'strict' | 'stress_test';
export type PersonaType = 'honest' | 'mostly_honest' | 'careless' | 'cheater';

export interface SimResult {
  rawScore: number;
  totalMarks: number;
  percentage: number;
  finalTrustScore: number;
  integrityStatus: 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED';
  gradedAt: string;
}

export interface SimCandidate {
  studentId: number;
  fullName: string;
  email: string;
  sessionId: number;
  trustScore: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING' | 'TIMED_OUT';
  lastAction: string;
  lastActionAt: string;
  violationsCount: number;
  answersCount: number;
  paperCode?: string;
  optionMaps?: Record<string, AnswerOption[]>;
  persona: PersonaType;
  ability: number; // 0.40 to 0.95
  violationBudget: number; // Hard cap
  targetFinishMode: 'SUBMIT' | 'TIMEOUT';
  nextViolationAllowedAt: number;
  graceUntilTime: number;
  isAcknowledgingWarning: boolean;
  questionsRemaining: number[];
  pendingAnswerChanges: number[];
  result?: SimResult;
}

export interface SimActivityLog {
  id: string;
  timestamp: string;
  candidateName: string;
  type: 'answer' | 'violation' | 'status_change';
  detail: string;
  severity?: string;
  trustScore?: number;
}

export interface SimulatorSummary {
  cleanCount: number;
  flaggedCount: number;
  disqualifiedCount: number;
  avgScore: number;
  avgTrust: number;
}

export interface SimulatorState {
  isRunning: boolean;
  isPaused: boolean;
  examId: number;
  studentCount: number;
  speed: number;
  chaos: ChaosLevel;
  scenario: ScenarioType;
  seed: string | number;
  startedAt: string | null;
  endedAt?: string | null;
  stats: {
    activeCount: number;
    answersCount: number;
    infractionsCount: number;
    terminatedCount: number;
    submittedCount: number;
  };
  summary?: SimulatorSummary;
  candidates: SimCandidate[];
  activityLogs: SimActivityLog[];
}

interface QuestionRow extends RowDataPacket {
  id: number;
  marks: number;
  correct_option: string;
}

const DEFAULT_HASH = '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2'; // password123

/**
 * Seeded PRNG using mulberry32 algorithm for fully reproducible simulations.
 */
export function createRng(seed?: number | string): () => number {
  let s: number;
  if (typeof seed === 'string') {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    }
    s = h >>> 0;
  } else if (typeof seed === 'number' && !isNaN(seed)) {
    s = seed >>> 0;
  } else {
    s = Math.floor(Math.random() * 0xffffffff);
  }

  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PersonaWeights {
  honest: number;
  mostly_honest: number;
  careless: number;
  cheater: number;
}

export function getPersonaWeights(scenario: ScenarioType, chaos: ChaosLevel): PersonaWeights {
  if (scenario === 'stress_test') {
    if (chaos === 'low') return { honest: 0.10, mostly_honest: 0.20, careless: 0.30, cheater: 0.40 };
    if (chaos === 'medium') return { honest: 0.05, mostly_honest: 0.15, careless: 0.30, cheater: 0.50 };
    return { honest: 0.00, mostly_honest: 0.10, careless: 0.30, cheater: 0.60 };
  }
  if (scenario === 'strict') {
    if (chaos === 'low') return { honest: 0.50, mostly_honest: 0.35, careless: 0.10, cheater: 0.05 };
    if (chaos === 'medium') return { honest: 0.30, mostly_honest: 0.35, careless: 0.20, cheater: 0.15 };
    return { honest: 0.15, mostly_honest: 0.20, careless: 0.35, cheater: 0.30 };
  }
  // Realistic (default)
  // LOW: 60% Honest, 30% Mostly honest, 8% Careless, 2% Cheater
  // MED: 42.5% Honest, 30% Mostly honest, 17.5% Careless, 10% Cheater
  // HIGH: 20% Honest, 25% Mostly honest, 30% Careless, 25% Cheater
  if (chaos === 'low') return { honest: 0.60, mostly_honest: 0.30, careless: 0.08, cheater: 0.02 };
  if (chaos === 'medium') return { honest: 0.425, mostly_honest: 0.30, careless: 0.175, cheater: 0.10 };
  return { honest: 0.20, mostly_honest: 0.25, careless: 0.30, cheater: 0.25 };
}

export function allocatePersonas(
  count: number,
  weights: PersonaWeights,
  rng: () => number
): PersonaType[] {
  const rawCounts = {
    honest: count * weights.honest,
    mostly_honest: count * weights.mostly_honest,
    careless: count * weights.careless,
    cheater: count * weights.cheater,
  };

  const personas: PersonaType[] = [];
  const remainders: Array<{ type: PersonaType; rem: number }> = [];

  let allocated = 0;
  for (const [key, val] of Object.entries(rawCounts) as [PersonaType, number][]) {
    const floor = Math.floor(val);
    allocated += floor;
    for (let i = 0; i < floor; i++) {
      personas.push(key);
    }
    remainders.push({ type: key, rem: val - floor });
  }

  // Sort descending by remainder and fill up to count
  remainders.sort((a, b) => b.rem - a.rem);
  let idx = 0;
  while (allocated < count) {
    personas.push(remainders[idx % remainders.length].type);
    allocated++;
    idx++;
  }

  // Fisher-Yates shuffle with seeded rng
  for (let i = personas.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [personas[i], personas[j]] = [personas[j], personas[i]];
  }

  return personas;
}

class SimulatorEngine {
  private timer: NodeJS.Timeout | null = null;
  private rng: () => number = createRng();
  private state: SimulatorState = {
    isRunning: false,
    isPaused: false,
    examId: 1,
    studentCount: 12,
    speed: 2.0,
    chaos: 'medium',
    scenario: 'realistic',
    seed: 42,
    startedAt: null,
    stats: {
      activeCount: 0,
      answersCount: 0,
      infractionsCount: 0,
      terminatedCount: 0,
      submittedCount: 0,
    },
    candidates: [],
    activityLogs: [],
  };

  private questionCache: Array<{ id: number; marks: number; correct_option: string }> = [];
  private violationTypesCache: ViolationTypeRow[] = [];

  public getState(): SimulatorState {
    const active = this.state.candidates.filter((c) => c.status === 'IN_PROGRESS').length;
    const terminated = this.state.candidates.filter((c) => c.status === 'TERMINATED_CHEATING').length;
    const submitted = this.state.candidates.filter((c) => c.status === 'SUBMITTED' || c.status === 'TIMED_OUT').length;

    return {
      ...this.state,
      stats: {
        ...this.state.stats,
        activeCount: active,
        terminatedCount: terminated,
        submittedCount: submitted,
      },
    };
  }

  public async start(config: {
    examId?: number;
    studentCount?: number;
    speed?: number;
    chaos?: ChaosLevel;
    scenario?: ScenarioType;
    seed?: string | number;
  }): Promise<SimulatorState> {
    if (this.state.isRunning) {
      await this.stop();
    }

    const examId = config.examId ?? 1;
    const studentCount = Math.max(1, Math.min(100, config.studentCount ?? 12));
    const speed = Math.max(0.5, Math.min(10, config.speed ?? 2.0));
    const chaos = config.chaos ?? 'medium';
    const scenario = config.scenario ?? 'realistic';
    const seed = config.seed !== undefined && config.seed !== '' ? config.seed : Math.floor(Math.random() * 1000000);

    this.rng = createRng(seed);

    // Verify exam exists, is published, and has open window
    const exams = await queryRows<RowDataPacket[]>(
      'SELECT id, title, min_trust_score, is_published, (NOW() BETWEEN start_window AND end_window) AS is_window_open FROM Exams WHERE id = ? LIMIT 1',
      [examId]
    );
    if (!exams[0]) {
      throw new AppError(404, 'EXAM_NOT_FOUND', `Target Exam ID ${examId} not found.`);
    }
    if (!exams[0].is_published) {
      throw new AppError(409, 'EXAM_UNPUBLISHED', `Target Exam #${examId} ("${exams[0].title}") is unpublished (DRAFT). Publish it before launching the swarm.`);
    }
    if (!exams[0].is_window_open) {
      throw new AppError(409, 'EXAM_WINDOW_CLOSED', `Target Exam #${examId} ("${exams[0].title}") window is closed. Open the exam window before launching the swarm.`);
    }

    // Cache exam questions
    this.questionCache = await queryRows<QuestionRow[]>(
      'SELECT id, marks, correct_option FROM Questions WHERE exam_id = ? ORDER BY id ASC',
      [examId]
    );
    if (this.questionCache.length === 0) {
      throw new AppError(409, 'EXAM_NO_QUESTIONS', `Target Exam #${examId} ("${exams[0].title}") has no questions configured.`);
    }

    // Cache violation types
    this.violationTypesCache = await queryRows<ViolationTypeRow[]>(
      'SELECT id, code, label, penalty_points, severity FROM Violation_Types'
    );

    // Allocate personas across the cohort based on scenario & chaos
    const weights = getPersonaWeights(scenario, chaos);
    const personaList = allocatePersonas(studentCount, weights, this.rng);

    // Create or retrieve virtual student users
    const runSuffix = Date.now().toString().slice(-6);
    const candidates: SimCandidate[] = [];

    // Pre-calculate timeout candidate indices (1 or 2 candidates timeout)
    const timeoutCount = Math.min(2, Math.max(1, Math.floor(studentCount * 0.08)));
    const timeoutIndices = new Set<number>();
    for (let t = 0; t < timeoutCount; t++) {
      timeoutIndices.add(Math.floor(this.rng() * studentCount));
    }

    for (let i = 0; i < studentCount; i++) {
      const candidateIdx = i + 1;
      const email = `virtual.candidate.${candidateIdx}.${runSuffix}@proctoriq.io`;
      const fullName = `Virtual Candidate ${candidateIdx}`;

      const ins = await executeSql(
        'INSERT INTO Users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)',
        [fullName, email, DEFAULT_HASH, 'STUDENT']
      );
      const studentId = ins.insertId;

      const ip = `192.168.10.${100 + (candidateIdx % 150)}`;
      const fingerprint = `sim-fp-${studentId}-${runSuffix}`;
      const sessionToken = `sim-tok-${studentId}-${runSuffix}`;

      const { session } = await startOrResumeExamSession({
        examId,
        studentId,
        studentName: fullName,
        ipAddress: ip,
        deviceFingerprint: fingerprint,
        sessionToken,
      });

      let oMaps: Record<string, AnswerOption[]> = {};
      if (session.option_maps) {
        oMaps = typeof session.option_maps === 'string'
          ? JSON.parse(session.option_maps)
          : session.option_maps;
      }

      const persona = personaList[i];
      // Candidate ability between 40% and 95%
      const ability = Math.round((0.40 + this.rng() * 0.55) * 100) / 100;

      // Budget per persona
      let violationBudget = 0;
      if (persona === 'honest') {
        // Honest: 0 violations, at most 1 minor if budget allowed, but 0 guarantees CLEAN (>40% requirement)
        violationBudget = 0;
      } else if (persona === 'mostly_honest') {
        // 1 to 2 minor/medium violations
        violationBudget = 1 + Math.floor(this.rng() * 2);
      } else if (persona === 'careless') {
        // 2 to 3 mixed violations
        violationBudget = 2 + Math.floor(this.rng() * 2);
      } else if (persona === 'cheater') {
        // 4 to 6 serious violations (ensures termination)
        violationBudget = 4 + Math.floor(this.rng() * 3);
      }

      const targetFinishMode: 'SUBMIT' | 'TIMEOUT' = timeoutIndices.has(i) ? 'TIMEOUT' : 'SUBMIT';

      // Setup question list in candidate's paper order
      let questionOrder: number[] = this.questionCache.map((q) => q.id);
      if (session.question_order) {
        try {
          const parsed = typeof session.question_order === 'string'
            ? JSON.parse(session.question_order)
            : session.question_order;
          if (Array.isArray(parsed) && parsed.length > 0) {
            questionOrder = parsed.map(Number);
          }
        } catch {
          // ignore fallback
        }
      }

      // ~20% of candidates will change 1 or 2 answers after initially answering
      const pendingAnswerChanges: number[] = [];
      if (this.rng() < 0.25 && questionOrder.length > 1) {
        const changeCount = Math.min(2, Math.max(1, Math.floor(this.rng() * 2) + 1));
        for (let c = 0; c < changeCount; c++) {
          const qId = questionOrder[Math.floor(this.rng() * questionOrder.length)];
          if (!pendingAnswerChanges.includes(qId)) {
            pendingAnswerChanges.push(qId);
          }
        }
      }

      // Spread initial violation schedule (random delay before first violation)
      const initialDelaySec = 2 + this.rng() * 4;
      const nextViolationAllowedAt = Date.now() + Math.round((initialDelaySec * 1000) / speed);

      candidates.push({
        studentId,
        fullName,
        email,
        sessionId: session.id,
        trustScore: session.trust_score,
        status: session.status as SimCandidate['status'],
        lastAction: `Session initiated (${persona})`,
        lastActionAt: new Date().toISOString(),
        violationsCount: 0,
        answersCount: 0,
        paperCode: session.paper_code,
        optionMaps: oMaps,
        persona,
        ability,
        violationBudget,
        targetFinishMode,
        nextViolationAllowedAt,
        graceUntilTime: 0,
        isAcknowledgingWarning: false,
        questionsRemaining: [...questionOrder],
        pendingAnswerChanges,
      });

      emitSessionUpdate(
        studentId,
        session.id,
        {
          sessionId: session.id,
          trust_score: session.trust_score,
          status: 'IN_PROGRESS',
        },
        {
          sessionId: session.id,
          trust_score: session.trust_score,
          status: 'IN_PROGRESS',
        }
      );
    }

    this.state = {
      isRunning: true,
      isPaused: false,
      examId,
      studentCount,
      speed,
      chaos,
      scenario,
      seed,
      startedAt: new Date().toISOString(),
      stats: {
        activeCount: candidates.length,
        answersCount: 0,
        infractionsCount: 0,
        terminatedCount: 0,
        submittedCount: 0,
      },
      candidates,
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          candidateName: 'System Swarm Engine',
          type: 'status_change',
          detail: `Spawned ${candidates.length} virtual candidates for Exam #${examId} (Speed: ${speed}x, Chaos: ${chaos}, Scenario: ${scenario}, Seed: ${seed})`,
        },
      ],
    };

    const intervalMs = Math.round(1500 / speed);
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.warn('[SimulatorEngine] Tick execution warning:', err);
      });
    }, intervalMs);

    return this.getState();
  }

  public pause(): SimulatorState {
    if (this.state.isRunning) {
      this.state.isPaused = true;
      this.addLog('System Swarm Engine', 'status_change', 'Simulation paused.');
    }
    return this.getState();
  }

  public resume(): SimulatorState {
    if (this.state.isRunning) {
      this.state.isPaused = false;
      this.addLog('System Swarm Engine', 'status_change', 'Simulation resumed.');
    }
    return this.getState();
  }

  public async stop(): Promise<SimulatorState> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.isRunning = false;
    this.state.isPaused = false;
    return this.getState();
  }

  public async reset(): Promise<{
    deletedLogs: number;
    deletedResponses: number;
    deletedResults: number;
    deletedSessions: number;
    deletedUsers: number;
  }> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state = {
      isRunning: false,
      isPaused: false,
      examId: 1,
      studentCount: 12,
      speed: 2.0,
      chaos: 'medium',
      scenario: 'realistic',
      seed: 42,
      startedAt: null,
      stats: {
        activeCount: 0,
        answersCount: 0,
        infractionsCount: 0,
        terminatedCount: 0,
        submittedCount: 0,
      },
      candidates: [],
      activityLogs: [],
    };

    // Remove any generated simulated snapshots from uploads directory
    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          if (file.startsWith('sim-') && file.endsWith('.jpg')) {
            try {
              fs.unlinkSync(path.join(uploadsDir, file));
            } catch (err) {
              console.warn('[SimulatorEngine] Failed to delete simulated snapshot file:', file, err);
            }
          }
        }
      } catch (err) {
        console.warn('[SimulatorEngine] Error reading uploads dir for cleanup:', err);
      }
    }

    let deletedCounts = {
      deletedLogs: 0,
      deletedResponses: 0,
      deletedResults: 0,
      deletedSessions: 0,
      deletedUsers: 0,
    };

    try {
      const [resultSets] = await pool.query<RowDataPacket[][]>('CALL sp_ResetSimulatorData()');
      const counts = resultSets[0]?.[0] as {
        deletedLogs?: number;
        deletedResponses?: number;
        deletedResults?: number;
        deletedSessions?: number;
        deletedUsers?: number;
      } | undefined;
      if (counts) {
        deletedCounts = {
          deletedLogs: Number(counts.deletedLogs ?? 0),
          deletedResponses: Number(counts.deletedResponses ?? 0),
          deletedResults: Number(counts.deletedResults ?? 0),
          deletedSessions: Number(counts.deletedSessions ?? 0),
          deletedUsers: Number(counts.deletedUsers ?? 0),
        };
      }
    } catch (spErr: unknown) {
      const msg = spErr instanceof Error ? spErr.message : String(spErr);
      console.warn('[SimulatorEngine] sp_ResetSimulatorData fallback to direct transaction:', msg);
      const conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        const [logs] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM Proctoring_Logs pl
           JOIN Exam_Sessions es ON es.id = pl.session_id
           JOIN Users u ON u.id = es.student_id
          WHERE u.email LIKE 'virtual.candidate.%'`
        );
        deletedCounts.deletedLogs = Number(logs[0]?.cnt ?? 0);

        const [resps] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM Student_Responses sr
           JOIN Exam_Sessions es ON es.id = sr.session_id
           JOIN Users u ON u.id = es.student_id
          WHERE u.email LIKE 'virtual.candidate.%'`
        );
        deletedCounts.deletedResponses = Number(resps[0]?.cnt ?? 0);

        const [results] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) as cnt FROM Results r
           JOIN Exam_Sessions es ON es.id = r.session_id
           JOIN Users u ON u.id = es.student_id
          WHERE u.email LIKE 'virtual.candidate.%'`
        );
        deletedCounts.deletedResults = Number(results[0]?.cnt ?? 0);

        const [delSessions] = await conn.query<{ affectedRows: number } & RowDataPacket[]>(
          `DELETE es FROM Exam_Sessions es
           JOIN Users u ON u.id = es.student_id
          WHERE u.email LIKE 'virtual.candidate.%'`
        );
        deletedCounts.deletedSessions = Number(delSessions.affectedRows ?? 0);

        const [delUsers] = await conn.query<{ affectedRows: number } & RowDataPacket[]>(
          `DELETE FROM Users WHERE email LIKE 'virtual.candidate.%'`
        );
        deletedCounts.deletedUsers = Number(delUsers.affectedRows ?? 0);

        await conn.commit();
      } catch (fallbackErr) {
        await conn.rollback();
        throw fallbackErr;
      } finally {
        conn.release();
      }
    }

    emitSimulatorReset(deletedCounts);
    return deletedCounts;
  }

  private addLog(
    candidateName: string,
    type: SimActivityLog['type'],
    detail: string,
    severity?: string,
    trustScore?: number
  ) {
    const entry: SimActivityLog = {
      id: `log-${Date.now()}-${Math.floor(this.rng() * 1000)}`,
      timestamp: new Date().toLocaleTimeString(),
      candidateName,
      type,
      detail,
      severity,
      trustScore,
    };
    this.state.activityLogs.unshift(entry);
    if (this.state.activityLogs.length > 80) {
      this.state.activityLogs.pop();
    }
  }

  private finalizeSimulation(): void {
    const cleanCount = this.state.candidates.filter(
      (c) => c.result?.integrityStatus === 'CLEAN'
    ).length;
    const flaggedCount = this.state.candidates.filter(
      (c) => c.result?.integrityStatus === 'FLAGGED'
    ).length;
    const disqualifiedCount = this.state.candidates.filter(
      (c) => c.result?.integrityStatus === 'DISQUALIFIED' || c.status === 'TERMINATED_CHEATING'
    ).length;

    const finishedWithScore = this.state.candidates.filter((c) => c.result);
    const avgScore = finishedWithScore.length > 0
      ? Math.round(
          finishedWithScore.reduce((acc, c) => acc + (c.result?.percentage ?? 0), 0) /
            finishedWithScore.length
        )
      : 0;
    const avgTrust = this.state.candidates.length > 0
      ? Math.round(
          this.state.candidates.reduce((acc, c) => acc + c.trustScore, 0) /
            this.state.candidates.length
        )
      : 0;

    this.state.summary = {
      cleanCount,
      flaggedCount,
      disqualifiedCount,
      avgScore,
      avgTrust,
    };
    this.state.endedAt = new Date().toISOString();
    this.state.isRunning = false;
    this.state.isPaused = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.addLog(
      'System Swarm Engine',
      'status_change',
      'Simulation complete. All candidates have concluded their sessions.'
    );
  }

  private async tick(): Promise<void> {
    if (!this.state.isRunning || this.state.isPaused) return;

    const activeCandidates = this.state.candidates.filter((c) => c.status === 'IN_PROGRESS');
    if (activeCandidates.length === 0) {
      this.finalizeSimulation();
      return;
    }

    // Process a slice of candidates per tick for responsive, lively execution
    const sliceSize = Math.min(8, Math.max(1, Math.ceil(activeCandidates.length / 5)));
    // Shuffle active candidates for fair turns
    const candidatesToStep = [...activeCandidates]
      .sort(() => this.rng() - 0.5)
      .slice(0, sliceSize);

    for (const candidate of candidatesToStep) {
      await this.stepCandidate(candidate);
    }
  }

  private async stepCandidate(candidate: SimCandidate): Promise<void> {
    if (candidate.status !== 'IN_PROGRESS') return;

    const now = Date.now();
    const hasRemainingQuestions =
      candidate.questionsRemaining.length > 0 || candidate.pendingAnswerChanges.length > 0;
    const hasRemainingViolations = candidate.violationsCount < candidate.violationBudget;

    // 1. If candidate has completed both all questions and all planned violations, submit exam!
    if (!hasRemainingQuestions && !hasRemainingViolations) {
      await this.submitCandidateExam(candidate);
      return;
    }

    // 2. Check if candidate can commit a scheduled violation
    const canViolate =
      hasRemainingViolations &&
      now >= candidate.nextViolationAllowedAt &&
      !candidate.isAcknowledgingWarning &&
      now >= candidate.graceUntilTime;

    let shouldViolate = false;
    if (canViolate) {
      if (!hasRemainingQuestions) {
        shouldViolate = true;
      } else if (candidate.persona === 'cheater') {
        shouldViolate = true;
      } else if (candidate.persona === 'careless') {
        shouldViolate = this.rng() < 0.6;
      } else {
        shouldViolate = this.rng() < 0.4;
      }
    }

    if (shouldViolate) {
      await this.triggerCandidateViolation(candidate);
    } else if (hasRemainingQuestions) {
      await this.submitCandidateAnswer(candidate);
    }
  }

  private async submitCandidateAnswer(candidate: SimCandidate): Promise<void> {
    if (this.questionCache.length === 0) return;

    let targetQuestionId: number;
    let isRevision = false;

    if (candidate.questionsRemaining.length > 0) {
      targetQuestionId = candidate.questionsRemaining.shift()!;
    } else if (candidate.pendingAnswerChanges.length > 0) {
      targetQuestionId = candidate.pendingAnswerChanges.shift()!;
      isRevision = true;
    } else {
      return;
    }

    const q = this.questionCache.find((item) => item.id === targetQuestionId) || this.questionCache[0];
    const correctLetter = (q.correct_option || 'A').toUpperCase() as AnswerOption;
    const allOptions: AnswerOption[] = ['A', 'B', 'C', 'D'];

    // Decide if student picks correct or incorrect option based on candidate ability
    const picksCorrect = this.rng() < candidate.ability;
    let chosenOriginalLetter: AnswerOption;
    if (picksCorrect) {
      chosenOriginalLetter = correctLetter;
    } else {
      const wrongOptions = allOptions.filter((opt) => opt !== correctLetter);
      chosenOriginalLetter = wrongOptions[Math.floor(this.rng() * wrongOptions.length)];
    }

    // Map to displayed letter using candidate's optionMaps
    const oMap = candidate.optionMaps?.[String(q.id)];
    let displayedLetter: AnswerOption = chosenOriginalLetter;
    if (oMap && oMap.length === 4) {
      const idx = oMap.indexOf(chosenOriginalLetter);
      if (idx !== -1) {
        displayedLetter = allOptions[idx];
      }
    }

    try {
      await executeSql(
        `INSERT INTO Student_Responses (session_id, question_id, selected_option, answered_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option), answered_at = NOW()`,
        [candidate.sessionId, q.id, chosenOriginalLetter]
      );

      candidate.answersCount += 1;
      const actionText = isRevision
        ? `Revised Question #${q.id} (${displayedLetter})`
        : `Answered Question #${q.id} (${displayedLetter})`;

      candidate.lastAction = actionText;
      candidate.lastActionAt = new Date().toISOString();
      this.state.stats.answersCount += 1;

      this.addLog(
        candidate.fullName,
        'answer',
        isRevision
          ? `Changed answer for Question #${q.id} to option ${displayedLetter}`
          : `Submitted option ${displayedLetter} for Question #${q.id}`
      );
    } catch (err) {
      console.warn('[SimulatorEngine] Failed to submit simulated answer:', err);
    }
  }

  private async submitCandidateExam(candidate: SimCandidate): Promise<void> {
    const trigger = candidate.targetFinishMode === 'TIMEOUT' ? 'TIMEOUT' : 'STUDENT_SUBMIT';

    try {
      const [resultSets] = await pool.query<RowDataPacket[][]>(
        'CALL sp_SubmitAndGradeExam(?, ?)',
        [candidate.sessionId, trigger]
      );
      const graded = resultSets[0]?.[0];
      if (!graded) return;

      const rawScore = Number(graded.raw_score ?? 0);
      const totalMarks = Number(graded.total_marks ?? 0);
      const percentage = Number(graded.percentage ?? 0);
      const finalTrustScore = Number(graded.final_trust_score ?? candidate.trustScore);
      const integrityStatus = (graded.integrity_status as SimResult['integrityStatus']) || 'CLEAN';

      candidate.result = {
        rawScore,
        totalMarks,
        percentage,
        finalTrustScore,
        integrityStatus,
        gradedAt: graded.graded_at ? new Date(graded.graded_at).toISOString() : new Date().toISOString(),
      };

      candidate.status = trigger === 'TIMEOUT' ? 'TIMED_OUT' : 'SUBMITTED';
      candidate.trustScore = finalTrustScore;
      candidate.lastAction = `Completed (${integrityStatus}, Score: ${percentage}%)`;
      candidate.lastActionAt = new Date().toISOString();
      this.state.stats.submittedCount += 1;

      emitExamSubmitted(
        candidate.studentId,
        candidate.sessionId,
        {
          sessionId: candidate.sessionId,
          examId: this.state.examId,
          studentId: candidate.studentId,
          studentName: candidate.fullName,
          status: candidate.status,
          result: candidate.result,
          submittedAt: new Date().toISOString(),
        },
        {
          sessionId: candidate.sessionId,
          trust_score: finalTrustScore,
          status: candidate.status,
          result: candidate.result,
        }
      );

      this.addLog(
        candidate.fullName,
        'status_change',
        `Submitted assessment (${trigger === 'TIMEOUT' ? 'Timeout' : 'Normal'}). Graded: ${percentage}% (${integrityStatus}, Trust: ${finalTrustScore}%)`,
        integrityStatus === 'DISQUALIFIED' ? 'CRITICAL' : integrityStatus === 'FLAGGED' ? 'MEDIUM' : undefined,
        finalTrustScore
      );
    } catch (err) {
      console.warn('[SimulatorEngine] Failed to finalize exam submission:', err);
    }
  }

  private async triggerCandidateViolation(candidate: SimCandidate): Promise<void> {
    // 0. Check Warning Gate: if candidate already has an unacknowledged warning, skip
    const sessRows = await queryRows<ExamSessionRow[]>(
      'SELECT pending_warning_log_id, warning_count FROM Exam_Sessions WHERE id = ?',
      [candidate.sessionId]
    );
    if (sessRows[0]?.pending_warning_log_id || candidate.isAcknowledgingWarning) {
      return;
    }

    // Select violation code tailored to candidate persona
    let codes: string[];
    if (candidate.persona === 'honest') {
      codes = ['COPY_PASTE', 'NO_FACE'];
    } else if (candidate.persona === 'mostly_honest') {
      codes = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'NO_FACE', 'VOICE_DETECTED', 'COPY_PASTE'];
    } else if (candidate.persona === 'careless') {
      codes = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'NO_FACE', 'VOICE_DETECTED', 'PHONE_DETECTED', 'DEVTOOLS_OPEN'];
    } else {
      // cheater: repeated serious violations
      codes = ['PHONE_DETECTED', 'MULTIPLE_FACES', 'DEVTOOLS_OPEN', 'NO_FACE'];
    }

    const chosenCode = codes[Math.floor(this.rng() * codes.length)];
    const vType = this.violationTypesCache.find((t) => t.code === chosenCode) || {
      id: 1,
      code: chosenCode,
      label: chosenCode,
      penalty_points: 15,
      severity: 'MEDIUM' as const,
    };

    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `sim-${chosenCode.toLowerCase()}-${candidate.sessionId}-${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, filename);

      const tinyJpeg = Buffer.from(
        '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
        'base64'
      );
      fs.writeFileSync(filePath, tinyJpeg);

      const snapshotUrl = `/uploads/${filename}`;
      const evidencePayload = JSON.stringify({
        simulated: true,
        violationCode: chosenCode,
        snapshotUrl,
        snapshot_url: snapshotUrl,
        timestamp: new Date().toISOString(),
      });

      const insertRes = await executeSql(
        `INSERT INTO Proctoring_Logs (session_id, violation_type_id, evidence_meta, snapshot_url)
         VALUES (?, ?, ?, ?)`,
        [candidate.sessionId, vType.id, evidencePayload, snapshotUrl]
      );

      const updatedRows = await queryRows<ExamSessionRow[]>(
        `SELECT es.*, e.min_trust_score, e.title AS exam_title
           FROM Exam_Sessions es
           JOIN Exams e ON e.id = es.exam_id
          WHERE es.id = ?
          LIMIT 1`,
        [candidate.sessionId]
      );
      const updated = updatedRows[0];
      if (!updated) return;

      candidate.trustScore = updated.trust_score;
      candidate.status = updated.status as SimCandidate['status'];
      candidate.violationsCount += 1;
      candidate.lastAction = `Triggered ${vType.label} (-${vType.penalty_points} pts)`;
      candidate.lastActionAt = new Date().toISOString();
      this.state.stats.infractionsCount += 1;

      // Minimum spacing 20 to 40 simulated seconds before next violation can occur
      const spacingSeconds = 20 + this.rng() * 20;
      candidate.nextViolationAllowedAt = Date.now() + Math.round((spacingSeconds * 1000) / this.state.speed);

      const basePayload = {
        logId: insertRes.insertId,
        sessionId: candidate.sessionId,
        examId: updated.exam_id,
        studentId: candidate.studentId,
        studentName: candidate.fullName,
        violationCode: vType.code,
        violationLabel: vType.label,
        severity: vType.severity,
        penaltyApplied: vType.penalty_points,
        trust_score: updated.trust_score,
        trustScore: updated.trust_score,
        minTrustScore: updated.min_trust_score,
        status: updated.status,
        sessionStatus: updated.status,
        snapshot_url: snapshotUrl,
        snapshotUrl,
        occurredAt: new Date().toISOString(),
      };

      emitViolationNew(candidate.studentId, candidate.sessionId, basePayload, {
        sessionId: candidate.sessionId,
        trust_score: updated.trust_score,
        status: updated.status,
      });

      if (updated.status !== 'TERMINATED_CHEATING') {
        const warningMessage = `${vType.label}: Violation detected. Please adhere to proctoring guidelines.`;
        const [warningInsert] = await pool.query<ResultSetHeader>(
          `INSERT INTO Session_Warnings (session_id, log_id, violation_code, message, penalty_points, trust_score_after, issued_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [candidate.sessionId, insertRes.insertId, vType.code, warningMessage, vType.penalty_points, updated.trust_score]
        );
        const warningId = warningInsert.insertId;
        const newWarningCount = (sessRows[0]?.warning_count ?? 0) + 1;

        await pool.query(
          `UPDATE Exam_Sessions
              SET pending_warning_log_id = ?,
                  warning_count = warning_count + 1
            WHERE id = ?`,
          [insertRes.insertId, candidate.sessionId]
        );

        candidate.isAcknowledgingWarning = true;

        const warningPayload = {
          warningId,
          sessionId: candidate.sessionId,
          logId: insertRes.insertId,
          violationCode: vType.code,
          violationLabel: vType.label,
          message: warningMessage,
          penaltyPoints: vType.penalty_points,
          trustScoreAfter: updated.trust_score,
          warningCount: newWarningCount,
          issuedAt: new Date().toISOString(),
        };
        emitWarningIssued(candidate.studentId, candidate.sessionId, warningPayload);

        // Acknowledge warning after random 2 to 6 simulated seconds
        const ackDelayMs = Math.round(((2000 + this.rng() * 4000)) / this.state.speed);
        setTimeout(async () => {
          try {
            await pool.query(
              'UPDATE Session_Warnings SET acknowledged_at = NOW() WHERE warning_id = ?',
              [warningId]
            );
            await pool.query(
              `UPDATE Exam_Sessions
                  SET pending_warning_log_id = NULL,
                      last_warning_ack_at = NOW()
                WHERE id = ?`,
              [candidate.sessionId]
            );

            candidate.isAcknowledgingWarning = false;
            // 5 second simulated grace period
            candidate.graceUntilTime = Date.now() + Math.round(5000 / this.state.speed);

            emitWarningAcked(candidate.studentId, candidate.sessionId, {
              warningId,
              sessionId: candidate.sessionId,
              acknowledgedAt: new Date().toISOString(),
              graceSeconds: 5,
            });
          } catch {
            candidate.isAcknowledgingWarning = false;
          }
        }, ackDelayMs);
      }

      this.addLog(
        candidate.fullName,
        'violation',
        `${vType.label} (-${vType.penalty_points} pts, Trust: ${updated.trust_score}%)`,
        vType.severity,
        updated.trust_score
      );

      // Handle termination if trust score falls below min threshold
      if (updated.status === 'TERMINATED_CHEATING') {
        this.state.stats.terminatedCount += 1;

        const [resultSets] = await pool.query<RowDataPacket[][]>(
          'CALL sp_SubmitAndGradeExam(?, ?)',
          [candidate.sessionId, 'AUTO_TERMINATED']
        );
        const gradedResult = resultSets[0]?.[0] ?? null;

        if (gradedResult) {
          candidate.result = {
            rawScore: 0,
            totalMarks: Number(gradedResult.total_marks ?? 0),
            percentage: 0,
            finalTrustScore: updated.trust_score,
            integrityStatus: 'DISQUALIFIED',
            gradedAt: gradedResult.graded_at ? new Date(gradedResult.graded_at).toISOString() : new Date().toISOString(),
          };
        }

        emitSessionTerminated(
          candidate.studentId,
          candidate.sessionId,
          { ...basePayload, reason: vType.code, result: gradedResult },
          {
            sessionId: candidate.sessionId,
            trust_score: updated.trust_score,
            status: updated.status,
            reason: vType.code,
          }
        );

        this.addLog(
          candidate.fullName,
          'status_change',
          `CANDIDATE DISQUALIFIED: Trust score dropped below threshold (${updated.trust_score}%). Session terminated.`,
          'CRITICAL',
          updated.trust_score
        );
      }
    } catch (err) {
      console.warn('[SimulatorEngine] Failed to dispatch simulated violation:', err);
    }
  }
}

export const simulatorEngine = new SimulatorEngine();
