import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, pool, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { startOrResumeExamSession } from '../routes/exams.routes.js';
import {
  emitSessionTerminated,
  emitSessionUpdate,
  emitSimulatorReset,
  emitViolationNew,
} from '../realtime/socket.js';
import type { ExamSessionRow, ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve uploads directory relative to project root or script location
const projectRootDir = path.resolve(__dirname, '../../../');
const uploadsDir = env.UPLOADS_DIR
  ? path.resolve(projectRootDir, env.UPLOADS_DIR)
  : path.resolve(__dirname, '../../uploads');

export type ChaosLevel = 'low' | 'medium' | 'high';

export interface SimCandidate {
  studentId: number;
  fullName: string;
  email: string;
  sessionId: number;
  trustScore: number;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING';
  lastAction: string;
  lastActionAt: string;
  violationsCount: number;
  answersCount: number;
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

export interface SimulatorState {
  isRunning: boolean;
  isPaused: boolean;
  examId: number;
  studentCount: number;
  speed: number;
  chaos: ChaosLevel;
  startedAt: string | null;
  stats: {
    activeCount: number;
    answersCount: number;
    infractionsCount: number;
    terminatedCount: number;
  };
  candidates: SimCandidate[];
  activityLogs: SimActivityLog[];
}

interface QuestionRow extends RowDataPacket {
  id: number;
  marks: number;
}

const DEFAULT_HASH = '$2b$10$FlZlPTMFm3bi1YTpOqGSNu89sqsX7DOgiIkxk/G3lf7XPBXYDMgX2'; // password123

class SimulatorEngine {
  private timer: NodeJS.Timeout | null = null;
  private state: SimulatorState = {
    isRunning: false,
    isPaused: false,
    examId: 1,
    studentCount: 10,
    speed: 1.5,
    chaos: 'medium',
    startedAt: null,
    stats: {
      activeCount: 0,
      answersCount: 0,
      infractionsCount: 0,
      terminatedCount: 0,
    },
    candidates: [],
    activityLogs: [],
  };

  private questionCache: Array<{ id: number; marks: number }> = [];
  private violationTypesCache: ViolationTypeRow[] = [];

  public getState(): SimulatorState {
    return {
      ...this.state,
      stats: {
        ...this.state.stats,
        activeCount: this.state.candidates.filter((c) => c.status === 'IN_PROGRESS').length,
        terminatedCount: this.state.candidates.filter((c) => c.status === 'TERMINATED_CHEATING').length,
      },
    };
  }

  public async start(config: {
    examId?: number;
    studentCount?: number;
    speed?: number;
    chaos?: ChaosLevel;
  }): Promise<SimulatorState> {
    if (this.state.isRunning) {
      await this.stop();
    }

    const examId = config.examId ?? 1;
    const studentCount = Math.max(1, Math.min(100, config.studentCount ?? 12));
    const speed = Math.max(0.5, Math.min(5, config.speed ?? 1.5));
    const chaos = config.chaos ?? 'medium';

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
      'SELECT id, marks FROM Questions WHERE exam_id = ? ORDER BY id ASC',
      [examId]
    );
    if (this.questionCache.length === 0) {
      throw new AppError(409, 'EXAM_NO_QUESTIONS', `Target Exam #${examId} ("${exams[0].title}") has no questions configured.`);
    }

    // Cache violation types
    this.violationTypesCache = await queryRows<ViolationTypeRow[]>(
      'SELECT id, code, label, penalty_points, severity FROM Violation_Types'
    );

    // Create or retrieve virtual student users
    const runSuffix = Date.now().toString().slice(-6);
    const candidates: SimCandidate[] = [];
    for (let i = 1; i <= studentCount; i++) {
      const email = `virtual.candidate.${i}.${runSuffix}@proctoriq.io`;
      const fullName = `Virtual Candidate ${i}`;

      const ins = await executeSql(
        'INSERT INTO Users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)',
        [fullName, email, DEFAULT_HASH, 'STUDENT']
      );
      const studentId = ins.insertId;

      const ip = `192.168.10.${100 + (i % 150)}`;
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

      candidates.push({
        studentId,
        fullName,
        email,
        sessionId: session.id,
        trustScore: session.trust_score,
        status: session.status as SimCandidate['status'],
        lastAction: 'Session initiated',
        lastActionAt: new Date().toISOString(),
        violationsCount: 0,
        answersCount: 0,
      });

      // Emit session update to live proctor monitor
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
      startedAt: new Date().toISOString(),
      stats: {
        activeCount: candidates.length,
        answersCount: 0,
        infractionsCount: 0,
        terminatedCount: 0,
      },
      candidates,
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          candidateName: 'System Swarm Engine',
          type: 'status_change',
          detail: `Spawned ${candidates.length} virtual candidates for Exam #${examId} (Speed: ${speed}x, Chaos: ${chaos})`,
        },
      ],
    };

    // Calculate tick interval based on speed: ~1500ms at 1.0x, 300ms at 5.0x
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
    this.addLog('System Swarm Engine', 'status_change', 'Simulation halted.');
    return this.getState();
  }

  public async reset(): Promise<{
    deletedLogs: number;
    deletedResponses: number;
    deletedResults: number;
    deletedSessions: number;
    deletedUsers: number;
  }> {
    // 1. Stop timer and clear in-memory state
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
      startedAt: null,
      stats: {
        activeCount: 0,
        answersCount: 0,
        infractionsCount: 0,
        terminatedCount: 0,
      },
      candidates: [],
      activityLogs: [],
    };

    // 2. Remove any generated simulated snapshots from uploads directory
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

    // 3. Database cleanup: execute stored procedure or transactional fallback
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
      console.warn('[SimulatorEngine] sp_ResetSimulatorData failed, falling back to direct transaction:', msg);
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

    // 4. Broadcast reset over Socket.IO to all listening dashboards
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
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

  private async tick(): Promise<void> {
    if (!this.state.isRunning || this.state.isPaused) return;

    // Pick random active candidate
    const activeCandidates = this.state.candidates.filter((c) => c.status === 'IN_PROGRESS');
    if (activeCandidates.length === 0) {
      this.addLog('System Swarm Engine', 'status_change', 'All candidates have concluded their sessions.');
      await this.stop();
      return;
    }

    const candidate = activeCandidates[Math.floor(Math.random() * activeCandidates.length)];

    // Decide whether to submit an answer or trigger an infraction based on chaos
    const infractionProb =
      this.state.chaos === 'low' ? 0.2 : this.state.chaos === 'medium' ? 0.45 : 0.72;

    const isInfraction = Math.random() < infractionProb;

    if (isInfraction) {
      await this.triggerCandidateViolation(candidate);
    } else {
      await this.submitCandidateAnswer(candidate);
    }
  }

  private async submitCandidateAnswer(candidate: SimCandidate): Promise<void> {
    if (this.questionCache.length === 0) return;

    const q = this.questionCache[Math.floor(Math.random() * this.questionCache.length)];
    const options: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    const chosen = options[Math.floor(Math.random() * options.length)];

    try {
      await executeSql(
        `INSERT INTO Student_Responses (session_id, question_id, selected_option, answered_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE selected_option = VALUES(selected_option), answered_at = NOW()`,
        [candidate.sessionId, q.id, chosen]
      );

      candidate.answersCount += 1;
      candidate.lastAction = `Answered Question #${q.id} (${chosen})`;
      candidate.lastActionAt = new Date().toISOString();
      this.state.stats.answersCount += 1;

      this.addLog(candidate.fullName, 'answer', `Submitted option ${chosen} for Question #${q.id}`);
    } catch (err) {
      console.warn('[SimulatorEngine] Failed to submit simulated answer:', err);
    }
  }

  private async triggerCandidateViolation(candidate: SimCandidate): Promise<void> {
    // Select violation code based on chaos level
    let codes: string[];
    if (this.state.chaos === 'low') {
      codes = ['TAB_SWITCH', 'COPY_PASTE', 'TAB_SWITCH'];
    } else if (this.state.chaos === 'medium') {
      codes = ['TAB_SWITCH', 'FULLSCREEN_EXIT', 'NO_FACE', 'COPY_PASTE'];
    } else {
      codes = ['NO_FACE', 'MULTIPLE_FACES', 'DEVTOOLS_OPEN', 'TAB_SWITCH', 'FULLSCREEN_EXIT'];
    }

    const chosenCode = codes[Math.floor(Math.random() * codes.length)];
    const vType = this.violationTypesCache.find((t) => t.code === chosenCode) || {
      id: 1,
      code: chosenCode,
      label: chosenCode,
      penalty_points: 15,
      severity: 'MEDIUM' as const,
    };

    try {
      // Ensure uploads directory exists and write a real snapshot JPEG
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `sim-${chosenCode.toLowerCase()}-${candidate.sessionId}-${Date.now()}.jpg`;
      const filePath = path.join(uploadsDir, filename);

      // Create a lightweight synthetic image buffer for the snapshot
      // 1x1 or 120x90 JPEG header bytes or standard tiny valid JPEG
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

      // Realtime broadcast to live proctors via Socket.IO
      emitViolationNew(candidate.studentId, candidate.sessionId, basePayload, {
        sessionId: candidate.sessionId,
        trust_score: updated.trust_score,
        status: updated.status,
      });

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
