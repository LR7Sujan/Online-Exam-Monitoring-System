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
  ip_address?: string | null;
  device_fingerprint?: string | null;
  session_token?: string | null;
  started_at: Date;
  server_deadline: Date;
  ended_at: Date | null;
  last_heartbeat_at: Date;
  seconds_remaining?: number;
  exam_title?: string;
  duration_minutes?: number;
  min_trust_score?: number;
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

