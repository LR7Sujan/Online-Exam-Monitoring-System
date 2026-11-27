import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { queryRows } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireRole('ADMIN', 'PROCTOR'));

const daysQuerySchema = z.object({
  days: z
    .preprocess((val) => (val === undefined ? '7' : String(val)), z.enum(['7', '30']))
    .transform((val) => Number(val) as 7 | 30),
});

interface ViolationDayPoint {
  date: string;
  count: number;
  violation_count: number;
  total_penalty: number;
  impacted_sessions: number;
}

interface ViolationsSummary {
  total: number;
  dailyAverage: number;
  peakDate: string;
  peakCount: number;
}

async function getViolationsOverTime(days: 7 | 30): Promise<{
  series: ViolationDayPoint[];
  summary: ViolationsSummary;
}> {
  const dateWindowRows = await queryRows<RowDataPacket[]>(
    "SELECT DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? - 1 DAY), '%Y-%m-%d') AS start_date",
    [days]
  );
  const startDateStr = dateWindowRows[0]?.start_date ?? '';
  const [startY, startM, startD] = startDateStr.split('-').map(Number);
  const dateList: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(startY, startM - 1, startD + i));
    dateList.push(d.toISOString().slice(0, 10));
  }

  const rawViolations = await queryRows<RowDataPacket[]>(
    `SELECT DATE(pl.occurred_at) AS date,
            COUNT(pl.id) AS violation_count,
            COALESCE(SUM(pl.penalty_applied), 0) AS total_penalty,
            COUNT(DISTINCT pl.session_id) AS impacted_sessions
       FROM Proctoring_Logs pl
      WHERE pl.occurred_at >= DATE_SUB(CURDATE(), INTERVAL ? - 1 DAY)
      GROUP BY DATE(pl.occurred_at)
      ORDER BY date ASC`,
    [days]
  );

  const rowMap = new Map<string, { count: number; total_penalty: number; impacted_sessions: number }>();
  for (const row of rawViolations) {
    const dStr =
      row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : String(row.date ?? '').slice(0, 10);
    rowMap.set(dStr, {
      count: Number(row.violation_count ?? 0),
      total_penalty: Number(row.total_penalty ?? 0),
      impacted_sessions: Number(row.impacted_sessions ?? 0),
    });
  }

  const series: ViolationDayPoint[] = dateList.map((dStr) => {
    const item = rowMap.get(dStr);
    const count = item ? item.count : 0;
    return {
      date: dStr,
      count,
      violation_count: count,
      total_penalty: item ? item.total_penalty : 0,
      impacted_sessions: item ? item.impacted_sessions : 0,
    };
  });

  const total = series.reduce((sum, item) => sum + item.count, 0);
  const dailyAverage = Number((total / days).toFixed(1));
  let peakDate = series[0]?.date ?? '';
  let peakCount = series[0]?.count ?? 0;
  for (const item of series) {
    if (item.count > peakCount) {
      peakCount = item.count;
      peakDate = item.date;
    }
  }

  const summary: ViolationsSummary = {
    total,
    dailyAverage,
    peakDate,
    peakCount,
  };

  return { series, summary };
}

// GET /api/analytics/dashboard — comprehensive admin overview intelligence
analyticsRouter.get('/dashboard', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=15');
    const { days } = daysQuerySchema.parse(req.query);

    // 1. KPI cards: total exams, students, sessions, cheating rate
    const kpiRows = await queryRows<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM Exams) AS total_exams,
         (SELECT COUNT(*) FROM Users WHERE role = 'STUDENT') AS total_students,
         (SELECT COUNT(*) FROM Exam_Sessions) AS total_sessions,
         (SELECT COUNT(*) FROM Exam_Sessions WHERE status = 'TERMINATED_CHEATING') AS terminated_sessions`
    );
    const kpi = kpiRows[0] || {};
    const totalSessions = Number(kpi.total_sessions ?? 0);
    const terminatedSessions = Number(kpi.terminated_sessions ?? 0);
    const cheatingRate = totalSessions > 0 ? Number(((terminatedSessions / totalSessions) * 100).toFixed(1)) : 0;

    // 2. Violations over time (continuous 7/30 day window with zero-fill)
    const { series: violationsOverTime, summary: violationsSummary } = await getViolationsOverTime(days);

    // 3. Violation type distribution (donut)
    const violationDistribution = await queryRows<RowDataPacket[]>(
      `SELECT vt.code,
              vt.label,
              vt.severity,
              COUNT(pl.id) AS count,
              COALESCE(SUM(pl.penalty_applied), 0) AS total_penalty
         FROM Violation_Types vt
         LEFT JOIN Proctoring_Logs pl ON pl.violation_type_id = vt.id
        GROUP BY vt.id, vt.code, vt.label, vt.severity
        ORDER BY count DESC`
    );

    // 4. Integrity status split per exam (stacked bars)
    const integritySplit = await queryRows<RowDataPacket[]>(
      `SELECT e.id AS exam_id,
              e.title AS exam_title,
              CASE
                WHEN e.title LIKE '%:%' THEN TRIM(SUBSTRING_INDEX(e.title, ':', 1))
                ELSE CONCAT('EX-', e.id)
              END AS subject_code,
              COALESCE(SUM(CASE WHEN r.integrity_status = 'CLEAN' THEN 1 ELSE 0 END), 0) AS clean_count,
              COALESCE(SUM(CASE WHEN r.integrity_status = 'FLAGGED' THEN 1 ELSE 0 END), 0) AS flagged_count,
              COALESCE(SUM(CASE WHEN r.integrity_status = 'DISQUALIFIED' THEN 1 ELSE 0 END), 0) AS disqualified_count,
              COUNT(r.id) AS total_graded
         FROM Exams e
         LEFT JOIN Exam_Sessions es ON es.exam_id = e.id
         LEFT JOIN Results r ON r.session_id = es.id
        GROUP BY e.id, e.title
        ORDER BY e.id ASC`
    );

    // 5. Trust score histogram distribution
    const trustHistogram = await queryRows<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN trust_score BETWEEN 0 AND 49 THEN 1 ELSE 0 END), 0) AS bucket_0_49,
         COALESCE(SUM(CASE WHEN trust_score BETWEEN 50 AND 69 THEN 1 ELSE 0 END), 0) AS bucket_50_69,
         COALESCE(SUM(CASE WHEN trust_score BETWEEN 70 AND 84 THEN 1 ELSE 0 END), 0) AS bucket_70_84,
         COALESCE(SUM(CASE WHEN trust_score BETWEEN 85 AND 99 THEN 1 ELSE 0 END), 0) AS bucket_85_99,
         COALESCE(SUM(CASE WHEN trust_score = 100 THEN 1 ELSE 0 END), 0) AS bucket_100
       FROM Exam_Sessions`
    );

    // 6. Top 10 most-flagged sessions leaderboard
    const leaderboard = await queryRows<RowDataPacket[]>(
      `SELECT session_id,
              student_id,
              student_name,
              student_email,
              exam_id,
              exam_title,
              trust_score,
              status,
              total_violations,
              pending_violations,
              last_violation_at
         FROM vw_ProctorLiveMonitor
        ORDER BY total_violations DESC, trust_score ASC
        LIMIT 10`
    );

    // 7. Heatmap
    const heatmap = await queryRows<RowDataPacket[]>('SELECT * FROM vw_ViolationHeatmap');

    sendSuccess(res, {
      kpis: {
        totalExams: Number(kpi.total_exams ?? 0),
        totalStudents: Number(kpi.total_students ?? 0),
        totalSessions,
        terminatedSessions,
        cheatingRate,
      },
      violationsOverTime,
      violationsSummary,
      summary: violationsSummary,
      violationDistribution,
      integritySplit,
      trustHistogram: trustHistogram[0] || {},
      leaderboard,
      heatmap,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/violations-over-time — 7/30 day window continuous violations telemetry
analyticsRouter.get('/violations-over-time', async (req, res, next) => {
  try {
    const { days } = daysQuerySchema.parse(req.query);
    const { series, summary } = await getViolationsOverTime(days);
    sendSuccess(res, {
      days,
      violationsOverTime: series,
      series,
      summary,
      total: summary.total,
      dailyAverage: summary.dailyAverage,
      peakDate: summary.peakDate,
      peakCount: summary.peakCount,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/overview — queries vw_ExamAnalytics
analyticsRouter.get('/overview', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=15');
    const exams = await queryRows<RowDataPacket[]>(
      'SELECT * FROM vw_ExamAnalytics ORDER BY exam_id ASC'
    );

    const summary = exams.reduce(
      (acc, row) => ({
        totalExams: acc.totalExams + 1,
        totalSessions: acc.totalSessions + Number(row.total_sessions ?? 0),
        activeSessions: acc.activeSessions + Number(row.in_progress_sessions ?? 0),
        terminatedSessions: acc.terminatedSessions + Number(row.terminated_sessions ?? 0),
        totalViolations: acc.totalViolations + Number(row.total_violations ?? 0),
      }),
      {
        totalExams: 0,
        totalSessions: 0,
        activeSessions: 0,
        terminatedSessions: 0,
        totalViolations: 0,
      }
    );

    // QA Fix (Sub-Phase 11.3): Spread summary properties at top-level while maintaining summary sub-object
    sendSuccess(res, { ...summary, summary, exams });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/heatmap — queries vw_ViolationHeatmap (with optional ?days=7|30|all window)
const heatmapQuerySchema = z.object({
  days: z.enum(['7', '30', 'all']).optional(),
});

analyticsRouter.get('/heatmap', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=15');
    const { days } = heatmapQuerySchema.parse(req.query);
    let rows: RowDataPacket[];
    if (days === '7' || days === '30') {
      const dayInterval = Number(days) - 1;
      rows = await queryRows<RowDataPacket[]>(
        `SELECT
           HOUR(pl.occurred_at) AS hour_of_day,
           vt.code AS violation_code,
           vt.label AS violation_label,
           vt.severity,
           COUNT(*) AS violation_count,
           SUM(pl.penalty_applied) AS total_penalty_points
         FROM Proctoring_Logs pl
         JOIN Violation_Types vt ON vt.id = pl.violation_type_id
        WHERE pl.occurred_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY HOUR(pl.occurred_at), vt.code, vt.label, vt.severity
        ORDER BY hour_of_day ASC, violation_count DESC`,
        [dayInterval]
      );
    } else {
      rows = await queryRows<RowDataPacket[]>('SELECT * FROM vw_ViolationHeatmap');
    }
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

