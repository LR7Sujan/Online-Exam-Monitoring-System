import { notifyProctorsAndAdmins, notifyStudent } from '../services/notificationService.js';
import { getRealtimeAdapter } from './adapter.js';
import { CHANNELS } from './channels.js';

/**
 * Publishes an event to proctors and admins on private-role-proctor.
 */
export function emitToProctors(event: string, payload: unknown): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, event, payload);
}

/**
 * Publishes an event directly to a specific student user channel and session channel.
 */
export function emitToStudent(studentId: number, sessionId: number | undefined, event: string, payload: unknown): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.user(studentId), event, payload);
  if (sessionId) {
    void adapter.publish(CHANNELS.session(sessionId), event, payload);
  }
}

/**
 * Emits violation events to proctors and student, and creates persistent notifications.
 */
export function emitViolationNew(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentUpdate: { sessionId: number; trust_score: number; status: string }
): void {
  const adapter = getRealtimeAdapter();

  // Proctor channels
  void adapter.publish(CHANNELS.PROCTORS, 'violation:new', proctorPayload);
  void adapter.publish(CHANNELS.PROCTORS, 'session:update', proctorPayload);

  // Student channels
  const studentPayload = {
    sessionId,
    trustScore: studentUpdate.trust_score,
    sessionStatus: studentUpdate.status,
    violationCode: proctorPayload.violationCode,
    penaltyApplied: proctorPayload.penaltyApplied,
  };
  void adapter.publish(CHANNELS.user(studentId), 'session:update', studentUpdate);
  void adapter.publish(CHANNELS.user(studentId), 'violation:logged', studentPayload);
  void adapter.publish(CHANNELS.session(sessionId), 'violation:logged', studentPayload);

  // Persist notifications for proctors/admins & student
  const studentName = String(proctorPayload.studentName ?? 'Candidate');
  const violationLabel = String(proctorPayload.violationLabel ?? proctorPayload.violationCode ?? 'Violation');
  const penalty = Number(proctorPayload.penaltyApplied ?? 0);
  const examTitle = String(proctorPayload.examTitle ?? 'Assessment');
  const severity = (proctorPayload.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO') ?? 'MEDIUM';

  const proctorMsg = `${studentName}: ${violationLabel}, -${penalty} pts, ${examTitle}`;
  void notifyProctorsAndAdmins({
    type: 'VIOLATION',
    severity,
    title: 'Violation Detected',
    message: proctorMsg,
    sessionId,
    studentName,
    examTitle,
    payload: proctorPayload,
  });

  const penaltyText = penalty > 0 ? ` (-${penalty} points)` : '';
  const studentMsg = `A warning was issued during ${examTitle}: ${violationLabel.toLowerCase()} was detected${penaltyText}.`;
  void notifyStudent(studentId, {
    type: 'WARNING',
    severity,
    title: 'Warning Issued',
    message: studentMsg,
    sessionId,
    studentName,
    examTitle,
    payload: {
      violationCode: proctorPayload.violationCode,
      penaltyApplied: penalty,
      trustScore: studentUpdate.trust_score,
    },
  });
}

export function emitSessionUpdate(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentUpdate: { sessionId: number; trust_score: number; status: string }
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'session:update', proctorPayload);
  void adapter.publish(CHANNELS.user(studentId), 'session:update', studentUpdate);
  void adapter.publish(CHANNELS.session(sessionId), 'session:update', studentUpdate);
}

export function emitSessionTerminated(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentPayload: { sessionId: number; trust_score: number; status: string; reason?: string }
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'session:terminated', proctorPayload);
  void adapter.publish(CHANNELS.PROCTORS, 'session:update', proctorPayload);

  const stdTerm = {
    ...studentPayload,
    trustScore: studentPayload.trust_score,
  };
  void adapter.publish(CHANNELS.user(studentId), 'session:terminated', stdTerm);
  void adapter.publish(CHANNELS.session(sessionId), 'session:terminated', stdTerm);
  void adapter.publish(CHANNELS.user(studentId), 'session:update', studentPayload);

  const studentName = String(proctorPayload.studentName ?? 'Candidate');
  const examTitle = String(proctorPayload.examTitle ?? 'Assessment');

  void notifyProctorsAndAdmins({
    type: 'TERMINATION',
    severity: 'CRITICAL',
    title: 'Exam Terminated',
    message: `${studentName}: Exam Terminated (Cheating limit breached), ${examTitle}`,
    sessionId,
    studentName,
    examTitle,
    payload: proctorPayload,
  });

  void notifyStudent(studentId, {
    type: 'TERMINATION',
    severity: 'CRITICAL',
    title: 'Exam Terminated',
    message: 'Your assessment was terminated because your trust score dropped below the required threshold.',
    sessionId,
    studentName,
    examTitle,
    payload: studentPayload,
  });
}

export function emitExamSubmitted(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentPayload: { sessionId: number; trust_score: number; status: string; result?: unknown; examTitle?: string; studentName?: string }
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'exam:submitted', proctorPayload);
  void adapter.publish(CHANNELS.PROCTORS, 'session:submitted', proctorPayload);
  void adapter.publish(CHANNELS.PROCTORS, 'session:update', proctorPayload);

  void adapter.publish(CHANNELS.user(studentId), 'exam:submitted', studentPayload);
  void adapter.publish(CHANNELS.session(sessionId), 'exam:submitted', studentPayload);
  void adapter.publish(CHANNELS.user(studentId), 'session:submitted', studentPayload);
  void adapter.publish(CHANNELS.user(studentId), 'session:update', {
    sessionId,
    trust_score: studentPayload.trust_score,
    status: studentPayload.status,
  });

  const examTitle = studentPayload.examTitle || String(proctorPayload.examTitle || 'Assessment');
  void notifyStudent(studentId, {
    type: 'INFO',
    severity: 'INFO',
    title: 'Results Available',
    message: `Your result for ${examTitle} is ready.`,
    sessionId,
    examTitle,
    payload: { sessionId },
  });
}

export function emitSimulatorReset(payload?: Record<string, unknown>): void {
  const adapter = getRealtimeAdapter();
  const data = payload ?? { timestamp: new Date().toISOString() };
  void adapter.publish(CHANNELS.PROCTORS, 'simulator:reset', data);
}

export function emitSnapshotReady(
  studentId: number,
  sessionId: number,
  payload: { logId: number; sessionId: number; snapshotUrl: string | null; snapshot_url?: string | null }
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'log:snapshot_ready', payload);
  void adapter.publish(CHANNELS.user(studentId), 'log:snapshot_ready', payload);
  void adapter.publish(CHANNELS.session(sessionId), 'log:snapshot_ready', payload);
}

export function emitExtensionRequested(payload: Record<string, unknown>): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'extension:requested', payload);
}

export function emitExtensionDecided(
  studentId: number,
  sessionId: number,
  payload: Record<string, unknown>
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'extension:decided', payload);
  void adapter.publish(CHANNELS.user(studentId), 'extension:decided', payload);
  void adapter.publish(CHANNELS.session(sessionId), 'extension:decided', payload);

  const status = String(payload.status ?? 'DECIDED');
  const minutes = Number(payload.minutesGranted ?? payload.grantedMinutes ?? 0);
  const examTitle = String(payload.examTitle ?? 'Assessment');
  const isApproved = status === 'APPROVED';

  void notifyStudent(studentId, {
    type: 'EXTENSION',
    severity: isApproved ? 'INFO' : 'HIGH',
    title: isApproved ? 'Extra Time Approved' : 'Extra Time Declined',
    message: isApproved
      ? `Your request for ${minutes} extra minutes was approved.`
      : 'Your request for extra time was declined.',
    sessionId,
    examTitle,
    payload,
  });
}

export function emitWarningIssued(
  studentId: number,
  sessionId: number,
  payload: Record<string, unknown>
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'warning:issued', payload);
  void adapter.publish(CHANNELS.user(studentId), 'warning:issued', payload);
  void adapter.publish(CHANNELS.session(sessionId), 'warning:issued', payload);
}

export function emitWarningAcked(
  studentId: number,
  sessionId: number,
  payload: Record<string, unknown>
): void {
  const adapter = getRealtimeAdapter();
  void adapter.publish(CHANNELS.PROCTORS, 'warning:acked', payload);
  void adapter.publish(CHANNELS.user(studentId), 'warning:acked', payload);
  void adapter.publish(CHANNELS.session(sessionId), 'warning:acked', payload);
}
