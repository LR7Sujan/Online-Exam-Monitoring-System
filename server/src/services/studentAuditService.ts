import type { RowDataPacket } from 'mysql2/promise';
import { queryRows } from '../config/db.js';
import { generateSignedSnapshotUrl } from './snapshotSigner.js';
import { mapOriginalToDisplayedAnswer } from './paperGenerator.js';
import { getRecordingBySessionId, type ReviewTimelineEvent } from './recordingService.js';
import type { AnswerOption } from '../types/api.js';

export interface StudentListQuery {
  page?: number;
  limit?: number;
  search?: string;
  integrityStatus?: 'ALL' | 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED';
  trustMin?: number;
  trustMax?: number;
  attendance?: 'ALL' | 'ATTENDED' | 'NEVER_ATTENDED';
  sortBy?: 'name' | 'email' | 'examsAttended' | 'avgScore' | 'avgTrust' | 'lastExamDate' | 'violations' | 'warnings' | 'createdAt';
  sortDir?: 'ASC' | 'DESC';
}

export interface StudentListItem {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
  examsAttended: number;
  avgScore: number | null;
  avgTrust: number | null;
  worstIntegrityStatus: 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED' | 'NONE';
  lastExamDate: string | null;
  totalViolations: number;
  totalWarnings: number;
  isCurrentlyActive: boolean;
  activeSessionId: number | null;
}

export interface StudentListResponse {
  students: StudentListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Lists registered students with aggregate exam statistics, worst integrity status,
 * live attendance status, search, filters, and server-side pagination.
 */
export async function getStudentsList(query: StudentListQuery): Promise<StudentListResponse> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["u.role = 'STUDENT'"];
  const params: (string | number | boolean | null)[] = [];

  if (query.search && query.search.trim()) {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    const term = `%${query.search.trim()}%`;
    params.push(term, term);
  }

  // Base aggregate subquery per student to compute metrics cleanly
  let havingClause = '';
  const havingConditions: string[] = [];

  if (query.attendance === 'ATTENDED') {
    havingConditions.push('COUNT(DISTINCT es.id) > 0');
  } else if (query.attendance === 'NEVER_ATTENDED') {
    havingConditions.push('COUNT(DISTINCT es.id) = 0');
  }

  if (typeof query.trustMin === 'number' && !Number.isNaN(query.trustMin)) {
    havingConditions.push('ROUND(AVG(es.trust_score), 1) >= ?');
    params.push(query.trustMin);
  }

  if (typeof query.trustMax === 'number' && !Number.isNaN(query.trustMax)) {
    havingConditions.push('ROUND(AVG(es.trust_score), 1) <= ?');
    params.push(query.trustMax);
  }

  if (query.integrityStatus && query.integrityStatus !== 'ALL') {
    if (query.integrityStatus === 'DISQUALIFIED') {
      havingConditions.push(`MAX(CASE WHEN r.integrity_status = 'DISQUALIFIED' THEN 3
                                     WHEN r.integrity_status = 'FLAGGED' THEN 2
                                     WHEN r.integrity_status = 'CLEAN' THEN 1 ELSE 0 END) = 3`);
    } else if (query.integrityStatus === 'FLAGGED') {
      havingConditions.push(`MAX(CASE WHEN r.integrity_status = 'DISQUALIFIED' THEN 3
                                     WHEN r.integrity_status = 'FLAGGED' THEN 2
                                     WHEN r.integrity_status = 'CLEAN' THEN 1 ELSE 0 END) = 2`);
    } else if (query.integrityStatus === 'CLEAN') {
      havingConditions.push(`MAX(CASE WHEN r.integrity_status = 'DISQUALIFIED' THEN 3
                                     WHEN r.integrity_status = 'FLAGGED' THEN 2
                                     WHEN r.integrity_status = 'CLEAN' THEN 1 ELSE 0 END) = 1`);
    }
  }

  if (havingConditions.length > 0) {
    havingClause = `HAVING ${havingConditions.join(' AND ')}`;
  }

  // Sort mapping
  let sortColumn = 'u.full_name';
  const dir = query.sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  switch (query.sortBy) {
    case 'email':
      sortColumn = 'u.email';
      break;
    case 'examsAttended':
      sortColumn = 'exams_attended';
      break;
    case 'avgScore':
      sortColumn = 'avg_score';
      break;
    case 'avgTrust':
      sortColumn = 'avg_trust';
      break;
    case 'lastExamDate':
      sortColumn = 'last_exam_date';
      break;
    case 'violations':
      sortColumn = 'total_violations';
      break;
    case 'warnings':
      sortColumn = 'total_warnings';
      break;
    case 'createdAt':
      sortColumn = 'u.created_at';
      break;
    default:
      sortColumn = 'u.full_name';
  }

  const whereSql = conditions.join(' AND ');

  // Count total matching students
  const countSql = `
    SELECT COUNT(*) AS total FROM (
      SELECT u.id
        FROM Users u
        LEFT JOIN Exam_Sessions es ON es.student_id = u.id
        LEFT JOIN Results r ON r.session_id = es.id
       WHERE ${whereSql}
       GROUP BY u.id
       ${havingClause}
    ) AS student_counts
  `;
  const countRows = await queryRows<RowDataPacket[]>(countSql, params);
  const total = Number(countRows[0]?.total ?? 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Fetch page rows
  const dataSql = `
    SELECT 
      u.id,
      u.full_name AS name,
      u.email,
      u.created_at AS joined_at,
      COUNT(DISTINCT es.id) AS exams_attended,
      ROUND(AVG(r.percentage), 1) AS avg_score,
      ROUND(AVG(es.trust_score), 1) AS avg_trust,
      COALESCE(
        MAX(CASE WHEN r.integrity_status = 'DISQUALIFIED' THEN 3
                 WHEN r.integrity_status = 'FLAGGED' THEN 2
                 WHEN r.integrity_status = 'CLEAN' THEN 1
                 ELSE 0 END), 0
      ) AS worst_integrity_num,
      MAX(es.started_at) AS last_exam_date,
      (SELECT COUNT(*) FROM Proctoring_Logs pl 
         JOIN Exam_Sessions es2 ON es2.id = pl.session_id 
        WHERE es2.student_id = u.id) AS total_violations,
      (SELECT COUNT(*) FROM Session_Warnings sw 
         JOIN Exam_Sessions es3 ON es3.id = sw.session_id 
        WHERE es3.student_id = u.id) AS total_warnings,
      (SELECT es4.id FROM Exam_Sessions es4 
        WHERE es4.student_id = u.id AND es4.status = 'IN_PROGRESS' 
        LIMIT 1) AS active_session_id
    FROM Users u
    LEFT JOIN Exam_Sessions es ON es.student_id = u.id
    LEFT JOIN Results r ON r.session_id = es.id
    WHERE ${whereSql}
    GROUP BY u.id, u.full_name, u.email, u.created_at
    ${havingClause}
    ORDER BY ${sortColumn} ${dir}
    LIMIT ? OFFSET ?
  `;

  const pageParams = [...params, limit, offset];
  const rows = await queryRows<RowDataPacket[]>(dataSql, pageParams);

  const students: StudentListItem[] = rows.map((r) => {
    let worstIntegrity: 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED' | 'NONE' = 'NONE';
    const num = Number(r.worst_integrity_num);
    if (num === 3) worstIntegrity = 'DISQUALIFIED';
    else if (num === 2) worstIntegrity = 'FLAGGED';
    else if (num === 1) worstIntegrity = 'CLEAN';

    const examsCount = Number(r.exams_attended ?? 0);
    return {
      id: Number(r.id),
      name: String(r.name),
      email: String(r.email),
      joinedAt: new Date(r.joined_at).toISOString(),
      examsAttended: examsCount,
      avgScore: r.avg_score !== null && examsCount > 0 ? Number(r.avg_score) : null,
      avgTrust: r.avg_trust !== null && examsCount > 0 ? Number(r.avg_trust) : null,
      worstIntegrityStatus: worstIntegrity,
      lastExamDate: r.last_exam_date ? new Date(r.last_exam_date).toISOString() : null,
      totalViolations: Number(r.total_violations ?? 0),
      totalWarnings: Number(r.total_warnings ?? 0),
      isCurrentlyActive: Boolean(r.active_session_id),
      activeSessionId: r.active_session_id ? Number(r.active_session_id) : null,
    };
  });

  return {
    students,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Returns student profile KPIs, timeline progress data for charts, and violation distribution.
 */
export async function getStudentProfile(studentId: number) {
  const userRows = await queryRows<RowDataPacket[]>(
    "SELECT id, full_name AS name, email, created_at AS joined_at, role FROM Users WHERE id = ? AND role = 'STUDENT' LIMIT 1",
    [studentId]
  );
  if (!userRows[0]) return null;

  const user = userRows[0];

  // Aggregates & KPIs
  const kpiRows = await queryRows<RowDataPacket[]>(
    `SELECT 
       COUNT(DISTINCT es.id) AS exams_attended,
       ROUND(AVG(r.percentage), 1) AS avg_score,
       ROUND(AVG(es.trust_score), 1) AS avg_trust,
       SUM(CASE WHEN r.integrity_status = 'CLEAN' THEN 1 ELSE 0 END) AS clean_exams_count,
       (SELECT COUNT(*) FROM Proctoring_Logs pl 
          JOIN Exam_Sessions es2 ON es2.id = pl.session_id 
         WHERE es2.student_id = ?) AS total_violations
     FROM Exam_Sessions es
     LEFT JOIN Results r ON r.session_id = es.id
     WHERE es.student_id = ?`,
    [studentId, studentId]
  );

  const k = kpiRows[0] || {};
  const examsAttended = Number(k.exams_attended ?? 0);
  const cleanCount = Number(k.clean_exams_count ?? 0);
  const cleanRate = examsAttended > 0 ? Math.round((cleanCount / examsAttended) * 100) : 100;

  // Progress chart timeline data: score and trust per exam over time
  const progressRows = await queryRows<RowDataPacket[]>(
    `SELECT es.id AS session_id, es.exam_id, e.title AS exam_title, es.paper_code,
            es.started_at, es.trust_score, es.status AS session_status,
            r.percentage AS score
       FROM Exam_Sessions es
       JOIN Exams e ON e.id = es.exam_id
       LEFT JOIN Results r ON r.session_id = es.id
      WHERE es.student_id = ?
      ORDER BY es.started_at ASC`,
    [studentId]
  );

  const progress = progressRows.map((p) => {
    // Subject code from paper_code or prefix of title
    const subjectCode = p.paper_code || `EX-${p.exam_id}`;
    return {
      sessionId: Number(p.session_id),
      examId: Number(p.exam_id),
      examTitle: String(p.exam_title),
      subjectCode,
      date: new Date(p.started_at).toISOString(),
      score: p.score !== null ? Number(p.score) : null,
      trustScore: Number(p.trust_score),
      status: p.session_status,
    };
  });

  // Violations by type for Donut chart
  const violationDistRows = await queryRows<RowDataPacket[]>(
    `SELECT vt.code AS code,
            vt.label AS label,
            COUNT(*) AS count
       FROM Proctoring_Logs pl
       JOIN Exam_Sessions es ON es.id = pl.session_id
       JOIN Violation_Types vt ON vt.id = pl.violation_type_id
      WHERE es.student_id = ?
      GROUP BY vt.code, vt.label
      ORDER BY count DESC`,
    [studentId]
  );

  const violationsByType = violationDistRows.map((v) => ({
    code: String(v.code),
    label: String(v.label),
    count: Number(v.count),
  }));

  return {
    student: {
      id: Number(user.id),
      name: String(user.name),
      email: String(user.email),
      joinedAt: new Date(user.joined_at).toISOString(),
      role: 'STUDENT',
    },
    kpis: {
      examsAttended,
      avgScore: k.avg_score !== null && examsAttended > 0 ? Number(k.avg_score) : null,
      avgTrust: k.avg_trust !== null && examsAttended > 0 ? Number(k.avg_trust) : null,
      totalViolations: Number(k.total_violations ?? 0),
      cleanRate,
    },
    progress,
    violationsByType,
  };
}

/**
 * Returns table of attended examinations for the student.
 */
export async function getStudentSessions(studentId: number) {
  const sql = `
    SELECT es.id AS session_id, es.exam_id, e.title AS exam_title, es.paper_code,
           es.started_at, es.ended_at, es.trust_score, e.min_trust_score, es.status AS session_status,
           r.raw_score, r.total_marks, r.percentage, r.integrity_status,
           (SELECT COUNT(*) FROM Proctoring_Logs pl WHERE pl.session_id = es.id) AS violations_count,
           (SELECT COUNT(*) FROM Session_Warnings sw WHERE sw.session_id = es.id) AS warnings_count,
           er.recording_id, er.status AS recording_status
      FROM Exam_Sessions es
      JOIN Exams e ON e.id = es.exam_id
      LEFT JOIN Results r ON r.session_id = es.id
      LEFT JOIN Exam_Recordings er ON er.session_id = es.id
     WHERE es.student_id = ?
     ORDER BY es.started_at DESC
  `;

  const rows = await queryRows<RowDataPacket[]>(sql, [studentId]);

  return rows.map((row) => {
    let integrity = row.integrity_status;
    if (!integrity) {
      if (row.session_status === 'TERMINATED_CHEATING') {
        integrity = 'DISQUALIFIED';
      } else if (Number(row.trust_score) < Number(row.min_trust_score)) {
        integrity = 'FLAGGED';
      } else {
        integrity = 'CLEAN';
      }
    }

    const hasRecording = Boolean(row.recording_id && ['READY', 'RECORDING'].includes(row.recording_status));

    return {
      sessionId: Number(row.session_id),
      examId: Number(row.exam_id),
      examTitle: String(row.exam_title),
      subjectCode: row.paper_code || `EX-${row.exam_id}`,
      date: new Date(row.started_at).toISOString(),
      rawScore: row.raw_score !== null ? Number(row.raw_score) : null,
      totalMarks: row.total_marks !== null ? Number(row.total_marks) : null,
      percentage: row.percentage !== null ? Number(row.percentage) : null,
      trustScore: Number(row.trust_score),
      minTrustScore: Number(row.min_trust_score),
      integrityStatus: integrity,
      sessionStatus: row.session_status,
      violationsCount: Number(row.violations_count ?? 0),
      warningsCount: Number(row.warnings_count ?? 0),
      hasRecording,
      recordingId: row.recording_id ? Number(row.recording_id) : null,
    };
  });
}

/**
 * Returns full scorecard for an exam session:
 * - Header (student, exam, paper code, started/ended, status, duration, extra time)
 * - Score card (score, total, percentage, correct/wrong/unanswered, negative marks, exam rank, exam average)
 * - Final trust score & integrity status
 * - Question-by-question review mapped through paper permutations
 * - Timeline of violations and warnings
 * - Extension request history
 * - Recording metadata / availability status
 */
export async function getSessionScorecard(sessionId: number) {
  const sessionRows = await queryRows<RowDataPacket[]>(
    `SELECT es.id AS session_id, es.student_id, es.exam_id, es.paper_code, es.started_at, es.ended_at,
            es.trust_score, es.status AS session_status, es.extra_minutes_granted,
            es.question_order, es.option_maps,
            u.full_name AS student_name, u.email AS student_email,
            e.title AS exam_title, e.description AS exam_description, e.min_trust_score, e.duration_minutes,
            e.record_video, e.record_audio
       FROM Exam_Sessions es
       JOIN Users u ON u.id = es.student_id
       JOIN Exams e ON e.id = es.exam_id
      WHERE es.id = ?
      LIMIT 1`,
    [sessionId]
  );

  if (!sessionRows[0]) return null;
  const sess = sessionRows[0];
  const examId = Number(sess.exam_id);
  const startedMs = new Date(sess.started_at).getTime();
  const endedMs = sess.ended_at ? new Date(sess.ended_at).getTime() : Date.now();
  const durationUsedMinutes = Math.max(1, Math.round((endedMs - startedMs) / 60000));

  // Results row
  const resultRows = await queryRows<RowDataPacket[]>(
    'SELECT * FROM Results WHERE session_id = ? LIMIT 1',
    [sessionId]
  );
  const result = resultRows[0] || null;

  // Rank among attendees and exam average
  const rankRows = await queryRows<RowDataPacket[]>(
    `SELECT COUNT(*) + 1 AS exam_rank
       FROM Results r2
       JOIN Exam_Sessions es2 ON es2.id = r2.session_id
      WHERE es2.exam_id = ? AND r2.percentage > ?`,
    [examId, result?.percentage ?? 0]
  );
  const examRank = Number(rankRows[0]?.exam_rank ?? 1);

  const statsRows = await queryRows<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT r2.id) AS total_attendees, ROUND(AVG(r2.percentage), 1) AS exam_average
       FROM Results r2
       JOIN Exam_Sessions es2 ON es2.id = r2.session_id
      WHERE es2.exam_id = ?`,
    [examId]
  );
  const totalAttendees = Number(statsRows[0]?.total_attendees ?? 1);
  const examAverage = Number(statsRows[0]?.exam_average ?? (result?.percentage ?? 0));

  // Fetch Questions for exam
  const questionRows = await queryRows<RowDataPacket[]>(
    'SELECT * FROM Questions WHERE exam_id = ? ORDER BY order_index ASC',
    [examId]
  );

  // Fetch student responses
  const answerRows = await queryRows<RowDataPacket[]>(
    'SELECT question_id, selected_option FROM Student_Responses WHERE session_id = ?',
    [sessionId]
  );
  const answerMap = new Map<number, AnswerOption>();
  answerRows.forEach((a) => {
    answerMap.set(Number(a.question_id), a.selected_option as AnswerOption);
  });

  // Parse paper permutations
  let questionOrderIds: number[] = [];
  if (sess.question_order) {
    try {
      questionOrderIds = typeof sess.question_order === 'string'
        ? JSON.parse(sess.question_order)
        : sess.question_order;
    } catch {
      questionOrderIds = [];
    }
  }

  let optionMaps: Record<string, AnswerOption[]> = {};
  if (sess.option_maps) {
    try {
      optionMaps = typeof sess.option_maps === 'string'
        ? JSON.parse(sess.option_maps)
        : sess.option_maps;
    } catch {
      optionMaps = {};
    }
  }

  // Build ordered list of questions
  const qMap = new Map<number, RowDataPacket>();
  questionRows.forEach((q) => qMap.set(Number(q.id), q));

  let orderedQuestionList: RowDataPacket[] = [];
  if (Array.isArray(questionOrderIds) && questionOrderIds.length > 0) {
    questionOrderIds.forEach((qid) => {
      const q = qMap.get(qid);
      if (q) orderedQuestionList.push(q);
    });
  }
  if (orderedQuestionList.length === 0) {
    orderedQuestionList = questionRows;
  }

  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const questions = orderedQuestionList.map((q, idx) => {
    const qid = Number(q.id);
    const marks = Number(q.marks || 1);
    const storedCorrect = q.correct_option as AnswerOption;
    const storedSelected = answerMap.get(qid) ?? null;

    const oMap = optionMaps[String(qid)];

    // Map stored canonical options to student display representation if permuted
    const origOptions: Record<AnswerOption, string> = {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d,
    };

    const dispA = oMap && oMap[0] ? origOptions[oMap[0]] : origOptions.A;
    const dispB = oMap && oMap[1] ? origOptions[oMap[1]] : origOptions.B;
    const dispC = oMap && oMap[2] ? origOptions[oMap[2]] : origOptions.C;
    const dispD = oMap && oMap[3] ? origOptions[oMap[3]] : origOptions.D;

    const displayedOptions = {
      A: dispA,
      B: dispB,
      C: dispC,
      D: dispD,
    };

    const dispCorrectLetter = mapOriginalToDisplayedAnswer(storedCorrect, oMap);
    const dispSelectedLetter = storedSelected ? mapOriginalToDisplayedAnswer(storedSelected, oMap) : null;

    const isUnanswered = storedSelected === null;
    const isCorrect = !isUnanswered && storedSelected === storedCorrect;

    if (isUnanswered) {
      unansweredCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }

    return {
      displayedNumber: idx + 1,
      questionId: qid,
      questionText: String(q.question_text),
      options: displayedOptions,
      studentAnswer: dispSelectedLetter,
      studentAnswerText: dispSelectedLetter ? displayedOptions[dispSelectedLetter] : null,
      correctAnswer: dispCorrectLetter,
      correctAnswerText: displayedOptions[dispCorrectLetter],
      marksGained: isCorrect ? marks : 0,
      totalMarks: marks,
      isCorrect,
      isUnanswered,
    };
  });

  // Violations & Warnings timeline
  const violationRows = await queryRows<RowDataPacket[]>(
    `SELECT log_id, violation_code, violation_label, penalty_applied, occurred_at,
            severity, proctor_review_status, snapshot_url, evidence_meta
       FROM vw_ViolationAuditReport
      WHERE session_id = ?
      ORDER BY occurred_at ASC`,
    [sessionId]
  );

  const violationEvents: ReviewTimelineEvent[] = violationRows.map((v) => {
    const rawSnap = v.snapshot_url as string | null | undefined;
    const signedSnap = generateSignedSnapshotUrl(rawSnap, v.log_id as number);
    const occurredMs = new Date(v.occurred_at).getTime();
    return {
      id: `violation-${v.log_id}`,
      type: 'VIOLATION',
      code: v.violation_code,
      label: v.violation_label || v.violation_code,
      penalty: Number(v.penalty_applied || 0),
      timeMs: Math.max(0, occurredMs - startedMs),
      occurredAt: new Date(v.occurred_at).toISOString(),
      severity: v.severity,
      status: v.proctor_review_status,
      snapshotUrl: signedSnap,
    };
  });

  const warningRows = await queryRows<RowDataPacket[]>(
    `SELECT warning_id, message, issued_at, acknowledged_at, penalty_points, violation_code
       FROM Session_Warnings
      WHERE session_id = ?
      ORDER BY issued_at ASC`,
    [sessionId]
  );

  const warningEvents: ReviewTimelineEvent[] = warningRows.map((w, index) => {
    const issuedMs = new Date(w.issued_at).getTime();
    return {
      id: `warning-${w.warning_id}`,
      type: 'WARNING',
      code: (w.violation_code as string) || `WARN_${index + 1}`,
      label: (w.message as string) || `Warning #${index + 1}`,
      penalty: Number(w.penalty_points || 0),
      timeMs: Math.max(0, issuedMs - startedMs),
      occurredAt: new Date(w.issued_at).toISOString(),
      severity: 'WARNING',
      status: w.acknowledged_at ? 'ACKNOWLEDGED' : 'PENDING',
    };
  });

  const timeline = [...violationEvents, ...warningEvents].sort((a, b) => a.timeMs - b.timeMs);

  // Time Extension Requests
  const extRows = await queryRows<RowDataPacket[]>(
    `SELECT request_id, requested_minutes, reason, status, created_at AS requested_at, decided_at AS reviewed_at, granted_minutes
       FROM Time_Extension_Requests
      WHERE session_id = ?
      ORDER BY created_at ASC`,
    [sessionId]
  );

  const extensionHistory = extRows.map((e) => ({
    requestId: Number(e.request_id),
    requestedMinutes: Number(e.requested_minutes),
    grantedMinutes: e.granted_minutes !== null ? Number(e.granted_minutes) : null,
    reason: String(e.reason || ''),
    status: e.status,
    requestedAt: new Date(e.requested_at).toISOString(),
    reviewedAt: e.reviewed_at ? new Date(e.reviewed_at).toISOString() : null,
    reviewerNotes: null,
  }));

  // Recording info
  const recordingRow = await getRecordingBySessionId(sessionId);
  let recordingMessage = 'No recording found for this session.';
  let hasRecording = false;

  if (recordingRow) {
    if (recordingRow.status === 'READY') {
      hasRecording = true;
      recordingMessage = 'Webcam recording is ready for playback.';
    } else if (recordingRow.status === 'RECORDING') {
      recordingMessage = 'Recording is currently processing.';
    } else if (recordingRow.status === 'FAILED') {
      recordingMessage = 'Recording failed during chunk capture.';
    } else if (recordingRow.expires_at && new Date(recordingRow.expires_at).getTime() < Date.now()) {
      recordingMessage = 'Recording has expired under the retention policy.';
    }
  } else if (!sess.record_video) {
    recordingMessage = 'Camera recording was disabled for this examination.';
  }

  const integrityStatus = result?.integrity_status ?? (
    sess.session_status === 'TERMINATED_CHEATING'
      ? 'DISQUALIFIED'
      : Number(sess.trust_score) < Number(sess.min_trust_score)
        ? 'FLAGGED'
        : 'CLEAN'
  );

  const totalMarks = Number(result?.total_marks ?? (questionRows.reduce((acc, q) => acc + Number(q.marks || 1), 0)));
  const rawScore = Number(result?.raw_score ?? questions.reduce((acc, q) => acc + q.marksGained, 0));
  const percentage = Number(result?.percentage ?? (totalMarks > 0 ? Math.round((rawScore / totalMarks) * 100) : 0));

  return {
    header: {
      studentId: Number(sess.student_id),
      studentName: String(sess.student_name),
      studentEmail: String(sess.student_email),
      examId,
      examTitle: String(sess.exam_title),
      paperCode: String(sess.paper_code || `P000`),
      startedAt: new Date(sess.started_at).toISOString(),
      endedAt: sess.ended_at ? new Date(sess.ended_at).toISOString() : null,
      status: sess.session_status,
      durationUsedMinutes,
      extraMinutesGranted: Number(sess.extra_minutes_granted || 0),
    },
    score: {
      rawScore,
      totalMarks,
      percentage,
      correctCount,
      wrongCount,
      unansweredCount,
      negativeMarks: 0,
      examRank,
      totalAttendees,
      examAverage,
    },
    integrity: {
      finalTrustScore: Number(sess.trust_score),
      minRequiredScore: Number(sess.min_trust_score),
      integrityStatus,
    },
    questions,
    timeline,
    extensionHistory,
    recording: {
      hasRecording,
      recordingId: recordingRow?.recording_id ?? null,
      status: recordingRow?.status ?? null,
      durationMs: recordingRow?.duration_ms ?? null,
      message: recordingMessage,
    },
  };
}
