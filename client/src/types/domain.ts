export type UserRole = 'ADMIN' | 'PROCTOR' | 'STUDENT';
export type SessionStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'TERMINATED_CHEATING' | 'TIMED_OUT';
export type ReviewStatus = 'PENDING' | 'CONFIRMED' | 'DISMISSED';
export type IntegrityStatus = 'CLEAN' | 'FLAGGED' | 'DISQUALIFIED';
export type AnswerOption = 'A' | 'B' | 'C' | 'D';
export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExtensionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type ViolationCode =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'COPY_PASTE'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'DEVTOOLS_OPEN'
  | 'PHONE_DETECTED'
  | 'VOICE_DETECTED';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface ExamItem {
  id: number;
  title: string;
  description: string | null;
  duration_minutes: number;
  min_trust_score: number;
  max_extension_mins?: number;
  shuffle_questions?: boolean | number;
  shuffle_options?: boolean | number;
  record_video?: boolean | number;
  record_audio?: boolean | number;
  unique_permutations?: number;
  start_window: string;
  end_window: string;
  is_published: boolean | number;
  question_count?: number;
  total_marks?: number | string;
  total_sessions?: number;
  active_sessions?: number;
  creator_name?: string;
  session_id?: number | null;
  session_status?: SessionStatus | null;
  session_trust_score?: number | null;
  session_deadline?: string | null;
  is_window_open?: number | boolean;
}

export interface QuestionItem {
  id: number;
  exam_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option?: AnswerOption;
  marks: number | string;
  order_index: number;
}

export interface ExamSession {
  id: number;
  exam_id: number;
  student_id: number;
  trust_score: number;
  status: SessionStatus;
  needs_reinstatement?: boolean | number;
  extra_minutes_granted?: number;
  ip_address?: string | null;
  device_fingerprint?: string | null;
  started_at: string;
  server_deadline: string;
  ended_at: string | null;
  last_heartbeat_at: string;
  seconds_remaining?: number;
  exam_title?: string;
  duration_minutes?: number;
  min_trust_score?: number;
  max_extension_mins?: number;
  record_video?: boolean | number;
  record_audio?: boolean | number;
  extension_request?: TimeExtensionRequest | null;
  pending_warning_log_id?: number | null;
  warning_count?: number;
  last_warning_ack_at?: string | null;
  paper_code?: string;
  question_order?: number[];
  option_maps?: Record<string, AnswerOption[]>;
  paper_hash?: string;
}

export interface SessionWarning {
  warning_id?: number;
  warningId?: number;
  session_id?: number;
  sessionId?: number;
  log_id?: number;
  logId?: number;
  violation_code?: ViolationCode | string;
  violationCode?: ViolationCode | string;
  violation_label?: string;
  violationLabel?: string;
  message: string;
  penalty_points?: number;
  penaltyPoints?: number;
  trust_score_after?: number;
  trustScoreAfter?: number;
  warning_count?: number;
  warningCount?: number;
  issued_at?: string;
  issuedAt?: string;
  acknowledged_at?: string | null;
  acknowledgedAt?: string | null;
  snapshot_url?: string | null;
  snapshotUrl?: string | null;
}

export interface TimeExtensionRequest {
  request_id: number;
  session_id: number;
  requested_minutes: number;
  reason: string | null;
  status: ExtensionRequestStatus;
  granted_minutes: number | null;
  decided_by: number | null;
  decided_at: string | null;
  created_at: string;
  student_id?: number;
  student_name?: string;
  student_email?: string;
  exam_id?: number;
  exam_title?: string;
  trust_score?: number;
  total_violations?: number;
  seconds_remaining?: number;
  decided_by_name?: string | null;
  expires_at?: string;
  max_extension_mins?: number;
}

export interface ViolationType {
  id: number;
  code: ViolationCode;
  label: string;
  description: string | null;
  penalty_points: number;
  severity: ViolationSeverity;
}

export interface SessionLogItem {
  id: number;
  penalty_applied: number;
  occurred_at: string;
  proctor_review_status: ReviewStatus;
  violation_code: ViolationCode;
  violation_label: string;
  severity: ViolationSeverity;
}

export interface ResultRecord {
  id?: number;
  result_id?: number;
  session_id: number;
  raw_score: number | string;
  total_marks: number | string;
  percentage: number | string;
  final_trust_score: number;
  integrity_status: IntegrityStatus;
  graded_at: string;
  paper_code?: string;
  paper_hash?: string;
  session_status?: SessionStatus;
  exam_title?: string;
  min_trust_score?: number;
  student_name?: string;
  student_email?: string;
}

export interface ProctorLiveMonitorRow {
  session_id: number;
  exam_id: number;
  exam_title: string;
  min_trust_score: number;
  duration_minutes: number;
  student_id: number;
  student_name: string;
  student_email: string;
  trust_score: number;
  status: SessionStatus;
  needs_reinstatement?: boolean | number;
  ip_address?: string | null;
  device_fingerprint?: string | null;
  started_at: string;
  server_deadline: string;
  ended_at: string | null;
  last_heartbeat_at: string;
  is_disconnected?: boolean | number;
  seconds_since_heartbeat?: number;
  seconds_remaining: number;
  total_violations: number;
  pending_violations: number;
  confirmed_violations: number;
  dismissed_violations: number;
  last_violation_at: string | null;
  raw_score: number | string | null;
  total_marks: number | string | null;
  percentage: number | string | null;
  integrity_status: IntegrityStatus | null;
  max_extension_mins?: number;
  extra_minutes_granted?: number;
  extension_request_id?: number | null;
  extension_status?: ExtensionRequestStatus | null;
  extension_requested_minutes?: number | null;
  extension_granted_minutes?: number | null;
  extension_request_status?: ExtensionRequestStatus | null;
  requested_extension_minutes?: number | null;
  warning_count?: number;
  pending_warning_log_id?: number | null;
  last_warning_ack_at?: string | null;
  paper_code?: string;
  paper_hash?: string;
  granted_extension_minutes?: number | null;
  extension_reason?: string | null;
  extension_created_at?: string | null;
  extension_decided_at?: string | null;
  extension_decided_by?: number | null;
  extension_decided_by_name?: string | null;
}

export interface ViolationAuditRow {
  log_id: number;
  session_id: number;
  exam_id: number;
  exam_title: string;
  min_trust_score: number;
  student_id: number;
  student_name: string;
  student_email: string;
  violation_type_id: number;
  violation_code: ViolationCode;
  violation_label: string;
  severity: ViolationSeverity;
  penalty_applied: number;
  occurred_at: string;
  evidence_meta: unknown;
  proctor_review_status: ReviewStatus;
  reviewed_by: number | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  current_trust_score: number;
  session_status: SessionStatus;
  integrity_status: IntegrityStatus | null;
  snapshot_url?: string | null;
  snapshotUrl?: string | null;
}

export interface DbTelemetry {
  database: string;
  triggers: Array<{
    TRIGGER_NAME: string;
    EVENT_MANIPULATION: string;
    EVENT_OBJECT_TABLE: string;
    ACTION_TIMING: string;
  }>;
  routines: Array<{
    ROUTINE_NAME: string;
    ROUTINE_TYPE: string;
    DATA_TYPE: string | null;
  }>;
  views: Array<{
    TABLE_NAME: string;
    IS_UPDATABLE: string;
  }>;
  tables: Array<{
    TABLE_NAME: string;
    TABLE_ROWS: number;
    ENGINE: string;
  }>;
}

export type RecordingStatus = 'RECORDING' | 'READY' | 'FAILED';

export interface ExamRecordingItem {
  recording_id: number;
  session_id: number;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  duration_ms: number;
  status: RecordingStatus;
  legal_hold: boolean;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface RecordingStorageStats {
  totalSizeBytes: number;
  totalRecordings: number;
  oldestRecordingAt: string | null;
  maxStorageBytes: number;
  usagePercentage: number;
  isExceeded: boolean;
  retentionDays: number;
}

export interface RecordingNoteItem {
  note_id: number;
  recording_id: number;
  author_id: number;
  author_name: string;
  time_ms: number;
  text: string;
  created_at: string;
}

export interface ReviewTimelineEvent {
  id: string;
  type: 'VIOLATION' | 'WARNING';
  code: string;
  label: string;
  penalty: number;
  timeMs: number;
  occurredAt: string;
  severity?: string;
  status?: string;
  snapshotUrl?: string | null;
}

export interface RecordingReviewDetails {
  recording: ExamRecordingItem & { has_audio: boolean };
  session: {
    sessionId: number;
    studentName: string;
    studentEmail: string;
    examTitle: string;
    examId: number;
    paperCode: string;
    startedAt: string;
    finishedAt: string | null;
    currentTrustScore: number;
    minTrustScore: number;
    sessionStatus: SessionStatus;
    ipAddress: string | null;
  };
  events: ReviewTimelineEvent[];
  notes: RecordingNoteItem[];
}


