import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { executeSql, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { mailService } from '../services/mailService.js';
import { simulatorEngine, type ChaosLevel, type ScenarioType } from '../services/simulator.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

// GET /api/admin/results — all graded exam results
adminRouter.get('/results', async (_req, res, next) => {
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT
         r.id AS result_id,
         r.session_id,
         r.raw_score,
         r.total_marks,
         r.percentage,
         r.final_trust_score,
         r.integrity_status,
         r.graded_at,
         es.exam_id,
         es.status AS session_status,
         es.started_at,
         es.ended_at,
         e.title AS exam_title,
         e.min_trust_score,
         u.id AS student_id,
         u.full_name AS student_name,
         u.email AS student_email
       FROM Results r
       JOIN Exam_Sessions es ON es.id = r.session_id
       JOIN Exams e ON e.id = es.exam_id
       JOIN Users u ON u.id = es.student_id
       ORDER BY r.graded_at DESC`
    );
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (_req, res, next) => {
  try {
    const rows = await queryRows<RowDataPacket[]>(
      `SELECT id, full_name, email, role, is_active, created_at
         FROM Users
        ORDER BY FIELD(role, 'ADMIN', 'PROCTOR', 'STUDENT'), id ASC`
    );
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:userId — role modification & account activation toggle
adminRouter.patch('/users/:userId', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const { role, isActive, is_active } = req.body as {
      role?: 'ADMIN' | 'PROCTOR' | 'STUDENT';
      isActive?: boolean;
      is_active?: boolean;
    };

    const existingRows = await queryRows<RowDataPacket[]>(
      'SELECT id, role, is_active FROM Users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = existingRows[0];
    if (!user) {
      res.status(404).json({ success: false, data: null, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      return;
    }

    const nextRole = role ?? user.role;
    const nextActive = (isActive !== undefined ? isActive : is_active !== undefined ? is_active : user.is_active) ? 1 : 0;

    await queryRows(
      'UPDATE Users SET role = ?, is_active = ? WHERE id = ?',
      [nextRole, nextActive, userId]
    );

    const updated = await queryRows<RowDataPacket[]>(
      'SELECT id, full_name, email, role, is_active, created_at FROM Users WHERE id = ? LIMIT 1',
      [userId]
    );

    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-report/export — CSV export of vw_ViolationAuditReport
adminRouter.get('/audit-report/export', async (_req, res, next) => {
  try {
    const rows = await queryRows<RowDataPacket[]>(
      'SELECT * FROM vw_ViolationAuditReport ORDER BY occurred_at DESC'
    );

    const headers = [
      'Log ID',
      'Session ID',
      'Occurred At',
      'Student Name',
      'Student Email',
      'Exam Title',
      'Violation Code',
      'Violation Label',
      'Severity',
      'Penalty Applied',
      'Trust Score After',
      'Review Status',
      'Review Notes',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const lines = [headers.map(escapeCsv).join(',')];
    for (const r of rows) {
      lines.push(
        [
          escapeCsv(r.log_id),
          escapeCsv(r.session_id),
          escapeCsv(r.occurred_at),
          escapeCsv(r.student_name),
          escapeCsv(r.student_email),
          escapeCsv(r.exam_title),
          escapeCsv(r.violation_code),
          escapeCsv(r.violation_label),
          escapeCsv(r.severity),
          escapeCsv(r.penalty_applied),
          escapeCsv(r.current_trust_score),
          escapeCsv(r.proctor_review_status),
          escapeCsv(r.review_notes ?? ''),
        ].join(',')
      );
    }

    const csvContent = lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="proctoriq-audit-report.csv"');
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

// QA Fix (Sub-Phase 11.3): GET /api/admin/system-stats — table counts and health diagnostics
adminRouter.get('/system-stats', async (_req, res, next) => {
  try {
    const [userCount, examCount, sessionCount, logCount] = await Promise.all([
      queryRows<RowDataPacket[]>('SELECT COUNT(*) AS c FROM Users'),
      queryRows<RowDataPacket[]>('SELECT COUNT(*) AS c FROM Exams'),
      queryRows<RowDataPacket[]>('SELECT COUNT(*) AS c FROM Exam_Sessions'),
      queryRows<RowDataPacket[]>('SELECT COUNT(*) AS c FROM Proctoring_Logs'),
    ]);

    sendSuccess(res, {
      status: 'healthy',
      database: env.DB_NAME,
      tableCounts: {
        Users: Number(userCount[0]?.c ?? 0),
        Exams: Number(examCount[0]?.c ?? 0),
        Exam_Sessions: Number(sessionCount[0]?.c ?? 0),
        Proctoring_Logs: Number(logCount[0]?.c ?? 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/db-telemetry — live DBMS inspection (triggers, procedures, views, table stats)
adminRouter.get('/db-telemetry', async (_req, res, next) => {
  try {
    const [triggers, routines, views, tables] = await Promise.all([
      queryRows<RowDataPacket[]>(
        `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING
           FROM information_schema.TRIGGERS
          WHERE TRIGGER_SCHEMA = ?
          ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING`,
        [env.DB_NAME]
      ),
      queryRows<RowDataPacket[]>(
        `SELECT ROUTINE_NAME, ROUTINE_TYPE, DATA_TYPE, CREATED
           FROM information_schema.ROUTINES
          WHERE ROUTINE_SCHEMA = ?
          ORDER BY ROUTINE_NAME`,
        [env.DB_NAME]
      ),
      queryRows<RowDataPacket[]>(
        `SELECT TABLE_NAME, IS_UPDATABLE
           FROM information_schema.VIEWS
          WHERE TABLE_SCHEMA = ?
          ORDER BY TABLE_NAME`,
        [env.DB_NAME]
      ),
      queryRows<RowDataPacket[]>(
        `SELECT TABLE_NAME, TABLE_ROWS, ENGINE
           FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME`,
        [env.DB_NAME]
      ),
    ]);

    sendSuccess(res, {
      database: env.DB_NAME,
      triggers,
      routines,
      views,
      tables,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/simulator/status
adminRouter.get('/simulator/status', (_req, res) => {
  sendSuccess(res, simulatorEngine.getState());
});

// POST /api/admin/simulator/tick
adminRouter.post('/simulator/tick', async (_req, res, next) => {
  try {
    const state = await simulatorEngine.tick();
    sendSuccess(res, state);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/simulator/start
adminRouter.post('/simulator/start', async (req, res, next) => {
  try {
    const { examId, studentCount, speed, chaos, scenario, seed } = req.body || {};
    const state = await simulatorEngine.start({
      examId: examId ? Number(examId) : 1,
      studentCount: studentCount ? Number(studentCount) : 10,
      speed: speed ? Number(speed) : 1.5,
      chaos: (chaos as ChaosLevel) || 'medium',
      scenario: (scenario as ScenarioType) || 'realistic',
      seed: seed !== undefined ? seed : undefined,
    });
    sendSuccess(res, state);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/simulator/pause
adminRouter.post('/simulator/pause', (_req, res) => {
  const state = simulatorEngine.pause();
  sendSuccess(res, state);
});

// POST /api/admin/simulator/resume
adminRouter.post('/simulator/resume', (_req, res) => {
  const state = simulatorEngine.resume();
  sendSuccess(res, state);
});

// POST /api/admin/simulator/stop
adminRouter.post('/simulator/stop', async (_req, res, next) => {
  try {
    const state = await simulatorEngine.stop();
    sendSuccess(res, state);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/exams/:examId/open-window (Opens exam window for demo/simulator)
adminRouter.post('/exams/:examId/open-window', async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);
    if (!examId || Number.isNaN(examId)) {
      throw new AppError(400, 'INVALID_EXAM_ID', 'Invalid exam id.');
    }
    const examRows = await queryRows<RowDataPacket[]>('SELECT * FROM Exams WHERE id = ? LIMIT 1', [examId]);
    const exam = examRows[0];
    if (!exam) {
      throw new AppError(404, 'EXAM_NOT_FOUND', 'Exam not found.');
    }
    if (!exam.is_published) {
      throw new AppError(409, 'EXAM_UNPUBLISHED', 'Cannot open window on an unpublished DRAFT exam. Publish the exam first.');
    }
    await executeSql(
      'UPDATE Exams SET start_window = DATE_SUB(NOW(), INTERVAL 1 HOUR), end_window = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?',
      [examId]
    );
    const [updated] = await queryRows<RowDataPacket[]>(
      'SELECT id, title, start_window, end_window, (NOW() BETWEEN start_window AND end_window) AS is_window_open FROM Exams WHERE id = ?',
      [examId]
    );
    sendSuccess(res, {
      message: 'Exam window opened for testing and simulator demo (valid for 24 hours).',
      exam: updated,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/system/fast-forward
adminRouter.post('/system/fast-forward', async (req, res, next) => {
  try {
    const { sessionId, secondsLeft } = req.body as { sessionId: number; secondsLeft: number };
    await queryRows(
      'UPDATE Exam_Sessions SET server_deadline = DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id = ?',
      [secondsLeft ?? 2, sessionId]
    );
    sendSuccess(res, { updated: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/simulator/reset
adminRouter.post('/simulator/reset', async (_req, res, next) => {
  try {
    const counts = await simulatorEngine.reset();
    sendSuccess(res, counts);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/mail/test
adminRouter.post('/mail/test', async (req, res, next) => {
  try {
    const { to } = req.body as { to?: string };
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      res.status(400).json({
        success: false,
        data: null,
        error: { code: 'INVALID_RECIPIENT', message: 'A valid recipient email address is required.' },
      });
      return;
    }

    const result = await mailService.sendTestEmail(to.trim());
    if (!result.success) {
      res.status(502).json({
        success: false,
        data: null,
        error: {
          code: 'MAIL_SEND_FAILED',
          message: result.error || 'Failed to dispatch test email.',
        },
      });
      return;
    }

    sendSuccess(res, {
      message: `Test email successfully dispatched to ${to.trim()}`,
      provider: env.MAIL_PROVIDER,
    });
  } catch (err) {
    next(err);
  }
});

