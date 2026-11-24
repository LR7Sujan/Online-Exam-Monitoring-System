import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { verifyJwtToken } from '../middleware/auth.js';
import { notifyProctorsAndAdmins, notifyStudent } from '../services/notificationService.js';
import type { ExamSessionRow, JwtUserPayload } from '../types/api.js';

interface AuthedSocket extends Socket {
  user?: JwtUserPayload;
}

let ioInstance: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim());

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  ioInstance.use((socket: AuthedSocket, next) => {
    const token =
      typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : null;

    if (!token) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    try {
      socket.user = verifyJwtToken(token);
      next();
    } catch {
      next(new Error('INVALID_TOKEN'));
    }
  });

  ioInstance.on('connection', (socket: AuthedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(`role:${user.role}`);
    socket.join(`user:${user.sub}`);
    if (user.role === 'PROCTOR' || user.role === 'ADMIN') {
      socket.join('proctors');
    }

    socket.on('session:join', async (sessionIdRaw: unknown) => {
      const sessionId = Number(sessionIdRaw);
      if (!Number.isInteger(sessionId) || sessionId <= 0) return;

      if (user.role === 'PROCTOR' || user.role === 'ADMIN') {
        socket.join(`session:${sessionId}`);
        return;
      }

      const rows = await queryRows<ExamSessionRow[]>(
        'SELECT id, student_id FROM Exam_Sessions WHERE id = ? LIMIT 1',
        [sessionId]
      );
      if (rows[0] && rows[0].student_id === user.sub) {
        socket.join(`session:${sessionId}`);
      }
    });

    socket.on('session:leave', (sessionIdRaw: unknown) => {
      const sessionId = Number(sessionIdRaw);
      if (Number.isInteger(sessionId) && sessionId > 0) {
        socket.leave(`session:${sessionId}`);
      }
    });

    socket.on('ping:latency', (clientTimestamp: unknown, callback: unknown) => {
      if (typeof callback === 'function') {
        callback(clientTimestamp);
      }
    });
  });

  return ioInstance;
}

export function getIo(): Server | null {
  return ioInstance;
}

export function emitToProctors(event: string, payload: unknown): void {
  if (!ioInstance) return;
  ioInstance.to('role:PROCTOR').to('role:ADMIN').emit(event, payload);
}

export function emitToStudent(studentId: number, _sessionId: number, event: string, payload: unknown): void {
  if (!ioInstance) return;
  // Strict tenant/user isolation: route exclusively to the target student's socket room
  ioInstance.to(`user:${studentId}`).emit(event, payload);
}

export function emitViolationNew(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentUpdate: { sessionId: number; trust_score: number; status: string }
): void {
  if (!ioInstance) return;
  emitToProctors('violation:new', proctorPayload);
  emitToProctors('session:update', proctorPayload);
  emitToStudent(studentId, sessionId, 'session:update', studentUpdate);
  emitToStudent(studentId, sessionId, 'violation:logged', {
    sessionId,
    trustScore: studentUpdate.trust_score,
    sessionStatus: studentUpdate.status,
    violationCode: proctorPayload.violationCode,
    penaltyApplied: proctorPayload.penaltyApplied,
  });

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

  const studentMsg = `${violationLabel}: A penalty of -${penalty} pts was deducted. New Trust Score: ${studentUpdate.trust_score}%.`;
  void notifyStudent(studentId, {
    type: 'WARNING',
    severity,
    title: `Warning: ${violationLabel}`,
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
  if (!ioInstance) return;
  emitToProctors('session:update', proctorPayload);
  emitToStudent(studentId, sessionId, 'session:update', studentUpdate);
}

export function emitSessionTerminated(
  studentId: number,
  sessionId: number,
  proctorPayload: Record<string, unknown>,
  studentPayload: { sessionId: number; trust_score: number; status: string; reason?: string }
): void {
  if (!ioInstance) return;
  emitToProctors('session:terminated', proctorPayload);
  emitToProctors('session:update', proctorPayload);
  emitToStudent(studentId, sessionId, 'session:terminated', {
    ...studentPayload,
    trustScore: studentPayload.trust_score,
  });
  emitToStudent(studentId, sessionId, 'session:update', studentPayload);

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
  if (!ioInstance) return;
  emitToProctors('exam:submitted', proctorPayload);
  emitToProctors('session:submitted', proctorPayload);
  emitToProctors('session:update', proctorPayload);
  emitToStudent(studentId, sessionId, 'exam:submitted', studentPayload);
  emitToStudent(studentId, sessionId, 'session:submitted', studentPayload);
  emitToStudent(studentId, sessionId, 'session:update', {
    sessionId,
    trust_score: studentPayload.trust_score,
    status: studentPayload.status,
  });
}

export function emitSimulatorReset(payload?: Record<string, unknown>): void {
  if (!ioInstance) return;
  ioInstance.emit('simulator:reset', payload ?? { timestamp: new Date().toISOString() });
}

export function emitExtensionRequested(payload: Record<string, unknown>): void {
  if (!ioInstance) return;
  emitToProctors('extension:requested', payload);
}

export function emitExtensionDecided(
  studentId: number,
  sessionId: number,
  payload: Record<string, unknown>
): void {
  if (!ioInstance) return;
  ioInstance.to(`user:${studentId}`).to(`session:${sessionId}`).emit('extension:decided', payload);
  emitToProctors('extension:decided', payload);

  const status = String(payload.status ?? 'DECIDED');
  const minutes = Number(payload.minutesGranted ?? 0);
  const examTitle = String(payload.examTitle ?? 'Assessment');

  void notifyStudent(studentId, {
    type: 'EXTENSION',
    severity: status === 'APPROVED' ? 'INFO' : 'HIGH',
    title: `Time Extension ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
    message: `Your extension request for ${examTitle} was ${status === 'APPROVED' ? `approved (+${minutes}m)` : 'rejected'}.`,
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
  if (!ioInstance) return;
  emitToProctors('warning:issued', payload);
  ioInstance.to(`user:${studentId}`).to(`session:${sessionId}`).emit('warning:issued', payload);
}

export function emitWarningAcked(
  studentId: number,
  sessionId: number,
  payload: Record<string, unknown>
): void {
  if (!ioInstance) return;
  emitToProctors('warning:acked', payload);
  ioInstance.to(`user:${studentId}`).to(`session:${sessionId}`).emit('warning:acked', payload);
}

