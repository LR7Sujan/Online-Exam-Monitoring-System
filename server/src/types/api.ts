import type { RowDataPacket } from 'mysql2/promise';

export type UserRole = 'ADMIN' | 'PROCTOR' | 'STUDENT';
export type SessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING' | 'TIMED_OUT';
export type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED';
export type IntegrityStatus = 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED';
export type AnswerOption = 'A' | 'B' | 'C' | 'D';
export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorPayload | null;
}

export interface JwtUserPayload {
  sub: number;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number | boolean;
  created_at: Date;
}

export interface ExamRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  min_trust_score: number;
  max_extension_mins: number;
  start_window: Date;
  end_window: Date;
  is_published: number | boolean;
  created_by: number;
  created_at: Date;
}

export interface QuestionRow extends RowDataPacket {
  id: number;
  exam_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: AnswerOption;
  marks: string | number;
  order_index: number;
}

export interface ExamSessionRow extends RowDataPacket {
  id: number;
  exam_id: number;
  student_id: number;
  trust_score: number;
  status: SessionStatus;
  needs_reinstatement?: number | boolean;
  extra_minutes_granted?: number;
  ip_address?: string | null;
  device_fingerprint?: string | null;
  session_token?: string | null;
  started_at: Date;
  server_deadline: Date;
  ended_at: Date | null;
  last_heartbeat_at: Date;
  time_expired_at?: Date | null;
  pending_warning_log_id?: number | null;
  warning_count?: number;
  last_warning_ack_at?: Date | null;
  seconds_remaining?: number;
  seconds_overdue?: number;
  seconds_since_ack?: number | null;
  in_grace_window?: boolean;
  exam_title?: string;
  duration_minutes?: number;
  min_trust_score?: number;
  max_extension_mins?: number;
  extension_request?: TimeExtensionRequestRow | null;
}

export type ExtensionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface TimeExtensionRequestRow extends RowDataPacket {
  request_id: number;
  session_id: number;
  requested_minutes: number;
  reason: string | null;
  status: ExtensionRequestStatus;
  granted_minutes: number | null;
  decided_by: number | null;
  decided_at: Date | null;
  created_at: Date;
  student_id?: number;
  student_name?: string;
  student_email?: string;
  exam_id?: number;
  exam_title?: string;
  trust_score?: number;
  total_violations?: number;
  seconds_remaining?: number;
  decided_by_name?: string | null;
}

export interface ViolationTypeRow extends RowDataPacket {
  id: number;
  code: string;
  label: string;
  description: string | null;
  penalty_points: number;
  severity: ViolationSeverity;
}

export interface ProctoringLogRow extends RowDataPacket {
  id: number;
  session_id: number;
  violation_type_id: number;
  penalty_applied: number;
  occurred_at: Date;
  evidence_meta: unknown;
  proctor_review_status: ReviewStatus;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  review_notes: string | null;
}

export interface ResultRow extends RowDataPacket {
  id: number;
  session_id: number;
  raw_score: string | number;
  total_marks: string | number;
  percentage: string | number;
  final_trust_score: number;
  integrity_status: IntegrityStatus;
  graded_at: Date;
}

export interface SessionWarningRow extends RowDataPacket {
  warning_id: number;
  session_id: number;
  log_id: number;
  violation_code: string;
  message: string;
  penalty_points: number;
  trust_score_after: number;
  issued_at: Date;
  acknowledged_at: Date | null;
}


