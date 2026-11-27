import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Database,
  GraduationCap,
  Plus,
  RefreshCw,
  Scale,
  Shield,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminOverviewDashboard } from '../components/admin/AdminOverviewDashboard';
import { ExamWizardModal } from '../components/admin/ExamWizardModal';
import { ViolationRulesManager } from '../components/admin/ViolationRulesManager';
import { UsersManagerTable } from '../components/admin/UsersManagerTable';
import { ResultsAndExportTable } from '../components/admin/ResultsAndExportTable';
import {
  UnpublishConfirmModal,
  DeleteExamModal,
  ExamStatusMenu,
} from '../components/admin/ExamLifecycleModals';
import { NeonButton } from '../components/ui/NeonButton';
import { SkeletonCard } from '../components/ui/Skeleton';
import { EmptyState, ErrorState } from '../components/ui/EmptyState';
import { api } from '../lib/api';
import type { DbTelemetry, ExamItem, QuestionItem, RecordingStorageStats } from '../types/domain';

interface ExamDetailResponse {
  exam: ExamItem;
  questions: QuestionItem[];
}

export function AdminDashboardPage({
  initialTab = 'overview',
}: {
  initialTab?: 'overview' | 'exams' | 'rules' | 'users' | 'results' | 'db' | 'analytics';
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'exams' | 'rules' | 'users' | 'results' | 'db'
  >(
    initialTab === 'analytics' || initialTab === 'overview'
      ? 'overview'
      : (initialTab as 'exams' | 'rules' | 'users' | 'results' | 'db')
  );

  // Synchronize active tab when URL route changes (e.g. /admin <-> /admin/exams <-> /admin/analytics)
  useEffect(() => {
    if (initialTab === 'analytics' || initialTab === 'overview') {
      setActiveTab('overview');
    } else if (initialTab) {
      setActiveTab(initialTab as 'exams' | 'rules' | 'users' | 'results' | 'db');
    }
  }, [initialTab]);

  // Exam Management States
  const navigate = useNavigate();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  // Lifecycle Modals State
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);
  const [targetUnpublishExam, setTargetUnpublishExam] = useState<ExamItem | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetDeleteExam, setTargetDeleteExam] = useState<ExamItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Queries
  const examsQuery = useQuery({
    queryKey: ['admin-exams-overview'],
    queryFn: () => api.get<ExamItem[]>('/exams'),
  });

  const examDetailQuery = useQuery({
    queryKey: ['admin-exam-detail', selectedExamId],
    queryFn: () => api.get<ExamDetailResponse>(`/exams/${selectedExamId}`),
    enabled: selectedExamId !== null,
  });

  const dbTelemetryQuery = useQuery({
    queryKey: ['admin-db-telemetry'],
    queryFn: () => api.get<DbTelemetry>('/admin/db-telemetry'),
    enabled: activeTab === 'db',
  });

  const recordingStorageQuery = useQuery({
    queryKey: ['admin-recording-storage'],
    queryFn: () => api.get<RecordingStorageStats>('/admin/recordings/storage'),
    enabled: activeTab === 'db' || activeTab === 'overview',
  });

  const pruneRecordingsMutation = useMutation({
    mutationFn: () => api.post<{ prunedCount: number }>('/admin/recordings/cleanup'),
    onSuccess: (data) => {
      toast.success(`Retention cleanup completed: ${data.prunedCount} expired recordings removed`);
      queryClient.invalidateQueries({ queryKey: ['admin-recording-storage'] });
    },
    onError: () => {
      toast.error('Failed to run recording retention cleanup');
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: (examId: number) => api.patch(`/exams/${examId}/publish`),
    onSuccess: () => {
      toast.success('Examination published and active');
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } } })?.response;
      const fieldErrors = resp?.data?.error?.details?.fieldErrors;
      if (fieldErrors) {
        const firstField = Object.keys(fieldErrors)[0];
        toast.error(`Publish blocked: ${fieldErrors[firstField][0]}`);
      } else {
        toast.error(resp?.data?.error?.message || 'Failed to publish examination');
      }
    },
  });

  const unpublishExamMutation = useMutation({
    mutationFn: (examId: number) => api.post(`/exams/${examId}/unpublish`),
    onSuccess: () => {
      toast.success('Examination unpublished');
      setUnpublishModalOpen(false);
      setTargetUnpublishExam(null);
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
      toast.error(resp?.data?.error?.message || 'Failed to unpublish examination');
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: (examId: number) => api.delete(`/exams/${examId}`),
    onSuccess: () => {
      toast.success('Examination permanently deleted');
      setDeleteModalOpen(false);
      setTargetDeleteExam(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
      const msg = resp?.data?.error?.message || 'Failed to delete examination';
      setDeleteError(msg);
      toast.error(msg);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (vars: { examId: number; questionId: number }) =>
      api.delete(`/exams/${vars.examId}/questions/${vars.questionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', selectedExamId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
  });

  const exams = examsQuery.data ?? [];
  const selectedExamData = examDetailQuery.data;

  return (
    <div className="space-y-8">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand" />
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-brand font-semibold">
                Governance & Intelligence Deck
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              Administrator Console
            </h1>
          </div>

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-surface p-1 shadow-sm overflow-x-auto scrollbar-none">
            {[
              { id: 'overview', label: 'Overview Analytics', icon: BarChart3 },
              { id: 'exams', label: 'Exam Manager', icon: GraduationCap },
              { id: 'rules', label: 'Rules & Simulator', icon: Scale },
              { id: 'users', label: 'User Directory', icon: Users },
              { id: 'results', label: 'Results & Exports', icon: Shield },
              { id: 'db', label: 'DBMS Telemetry', icon: Database },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as typeof activeTab)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-mono font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================ */}
        {/* 1. OVERVIEW DASHBOARD */}
        {/* ================================================================ */}
        {activeTab === 'overview' && <AdminOverviewDashboard />}

        {/* ================================================================ */}
        {/* 2. EXAM MANAGEMENT */}
        {/* ================================================================ */}
        {activeTab === 'exams' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-brand" />
                  <span>Curated Assessment Directory</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure assessment windows, duration, questions, and authoritative integrity thresholds.
                </p>
              </div>

              <NeonButton
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingExam(null);
                  setWizardOpen(true);
                }}
              >
                Architect New Examination
              </NeonButton>
            </div>

            {/* Exam Cards Grid */}
            {examsQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} className="h-44" />
                ))}
              </div>
            ) : examsQuery.isError ? (
              <ErrorState
                title="Failed to Load Examinations"
                description="Unable to query assessment catalog from MySQL database. Please verify connection and retry."
                onRetry={() => examsQuery.refetch()}
              />
            ) : exams.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="w-8 h-8 text-brand" />}
                title="No Examinations Configured"
                description="No assessment blueprints have been authored yet. Initialize a new examination to get started."
                action={{
                  label: 'Architect New Examination',
                  onClick: () => {
                    setEditingExam(null);
                    setWizardOpen(true);
                  },
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {exams.map((exam) => {
                const isPublished = Boolean(exam.is_published);
                const isSelected = selectedExamId === exam.id;

                return (
                  <div
                    key={exam.id}
                    onClick={() => navigate(`/admin/exams/${exam.id}`)}
                    className={`rounded-2xl border p-5 shadow-sm transition-all space-y-4 cursor-pointer hover:border-brand/60 hover:shadow-md ${
                      isSelected
                        ? 'border-brand bg-surface-elevated ring-1 ring-brand/30'
                        : 'border-border bg-surface'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-brand font-semibold">
                          EXAM #{exam.id}
                        </span>
                        <h4 className="text-base font-bold text-foreground truncate" title={exam.title}>
                          {exam.title}
                        </h4>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ExamStatusMenu
                          exam={{
                            id: exam.id,
                            title: exam.title,
                            is_published: exam.is_published,
                          }}
                          onPublish={() => publishExamMutation.mutate(exam.id)}
                          onUnpublish={() => {
                            setTargetUnpublishExam(exam);
                            setUnpublishModalOpen(true);
                          }}
                          onDelete={() => {
                            setTargetDeleteExam(exam);
                            setDeleteError(null);
                            setDeleteModalOpen(true);
                          }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                      {exam.description || 'No detailed instructions provided.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-b border-border py-2.5 text-muted-foreground">
                      <div>
                        <span className="text-muted-foreground text-[10px]">DURATION:</span>
                        <div className="font-bold text-foreground tabular-nums">{exam.duration_minutes} mins</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px]">MIN TRUST:</span>
                        <div className="font-bold text-rose-500 tabular-nums">{exam.min_trust_score}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px]">QUESTIONS:</span>
                        <div className="font-bold text-brand tabular-nums">{exam.question_count ?? 20}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-[10px]">TOTAL MARKS:</span>
                        <div className="font-bold text-emerald-500 tabular-nums">{exam.total_marks ?? 40}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isPublished}
                        title={isPublished ? 'Unpublish to view or edit questions' : 'Inspect Questions'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isPublished) {
                            setSelectedExamId(isSelected ? null : exam.id);
                          }
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-mono font-medium transition-all ${
                          isPublished
                            ? 'opacity-50 cursor-not-allowed bg-surface text-muted-foreground/50 border border-border'
                            : isSelected
                              ? 'bg-brand/15 text-brand border border-brand/30 cursor-pointer'
                              : 'bg-surface-elevated text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border cursor-pointer'
                        }`}
                      >
                        {isSelected ? 'Close Questions' : 'Inspect Questions'}
                      </button>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {isPublished ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUnpublishExam(exam);
                              setUnpublishModalOpen(true);
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                          >
                            Unpublish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => publishExamMutation.mutate(exam.id)}
                            disabled={publishExamMutation.isPending}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors cursor-pointer"
                          >
                            Publish
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            {/* Questions Inspection Panel */}
            {selectedExamId && selectedExamData && (
              <div className="rounded-2xl border border-brand/30 bg-surface-elevated p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-foreground font-mono">
                      Exam Questions: {selectedExamData.exam.title}
                    </h4>
                    <p className="text-xs font-mono text-muted-foreground">
                      {selectedExamData.questions.length} Questions Configured
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExamId(null)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto scrollbar-thin">
                  {selectedExamData.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-border bg-background p-3 text-xs font-mono flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-foreground font-semibold">
                          <span className="text-brand font-bold mr-2">Q{idx + 1}.</span>
                          {q.question_text}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                          <div className={q.correct_option === 'A' ? 'text-emerald-500 font-bold' : ''}>A: {q.option_a}</div>
                          <div className={q.correct_option === 'B' ? 'text-emerald-500 font-bold' : ''}>B: {q.option_b}</div>
                          <div className={q.correct_option === 'C' ? 'text-emerald-500 font-bold' : ''}>C: {q.option_c}</div>
                          <div className={q.correct_option === 'D' ? 'text-emerald-500 font-bold' : ''}>D: {q.option_d}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Key: {q.correct_option ?? 'N/A'}
                        </span>
                        <span className="text-muted-foreground text-[10px] tabular-nums">{q.marks} pts</span>
                        <button
                          type="button"
                          onClick={() =>
                            deleteQuestionMutation.mutate({
                              examId: selectedExamId,
                              questionId: q.id,
                            })
                          }
                          className="p-1 text-muted-foreground hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* 3. VIOLATION RULES & SIMULATOR */}
        {/* ================================================================ */}
        {activeTab === 'rules' && <ViolationRulesManager />}

        {/* ================================================================ */}
        {/* 4. USER MANAGEMENT TABLE */}
        {/* ================================================================ */}
        {activeTab === 'users' && <UsersManagerTable />}

        {/* ================================================================ */}
        {/* 5. RESULTS & AUDIT EXPORTS */}
        {/* ================================================================ */}
        {activeTab === 'results' && <ResultsAndExportTable />}

        {/* ================================================================ */}
        {/* 6. DBMS TELEMETRY INSPECTOR */}
        {activeTab === 'db' && (
          <div className="space-y-6 font-mono text-xs">
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-brand" />
                <span>Authoritative MySQL DBMS Telemetry (Information Schema)</span>
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Live introspection of triggers, stored procedures, SQL views, and physical tables
              </p>
            </div>

            {/* Webcam Video Recording Storage & Retention Card */}
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-brand/10 text-brand">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Webcam Recording Storage & Retention
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Retention window: {recordingStorageQuery.data?.retentionDays ?? 30} days • Cap: {((recordingStorageQuery.data?.maxStorageBytes ?? 5368709120) / (1024 ** 3)).toFixed(1)} GB
                    </p>
                  </div>
                </div>

                <NeonButton
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${pruneRecordingsMutation.isPending ? 'animate-spin' : ''}`} />}
                  onClick={() => pruneRecordingsMutation.mutate()}
                  isLoading={pruneRecordingsMutation.isPending}
                >
                  Run Retention Pruning
                </NeonButton>
              </div>

              {recordingStorageQuery.data?.isExceeded && (
                <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Storage quota exceeded! New exam recordings are blocked until expired sessions are purged or quota increased.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Storage Utilized</span>
                  <p className="text-base font-bold text-foreground">
                    {((recordingStorageQuery.data?.totalSizeBytes ?? 0) / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${
                        (recordingStorageQuery.data?.usagePercentage ?? 0) > 85 ? 'bg-rose-500' : 'bg-brand'
                      }`}
                      style={{ width: `${Math.min(recordingStorageQuery.data?.usagePercentage ?? 0, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Total Recordings</span>
                  <p className="text-base font-bold text-foreground">
                    {recordingStorageQuery.data?.totalRecordings ?? 0}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Captured video sessions</span>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Oldest Active Video</span>
                  <p className="text-xs font-bold text-foreground truncate">
                    {recordingStorageQuery.data?.oldestRecordingAt
                      ? new Date(recordingStorageQuery.data.oldestRecordingAt).toLocaleDateString()
                      : 'None'}
                  </p>
                  <span className="text-[10px] text-muted-foreground">Earliest timestamp</span>
                </div>

                <div className="p-3 rounded-xl border border-border bg-background space-y-1">
                  <span className="text-[10px] text-muted-foreground uppercase">Legal Hold Policy</span>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Protected</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground">Flagged sessions exempt from prune</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Triggers */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-sm">
                <h4 className="font-bold text-brand text-xs uppercase tracking-wider">
                  Active Database Triggers
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.triggers ?? []).map((t, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background p-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">{t.TRIGGER_NAME}</span>
                      <span className="text-[10px] text-rose-500 font-semibold">
                        {t.ACTION_TIMING} {t.EVENT_MANIPULATION} ON {t.EVENT_OBJECT_TABLE}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stored Procedures */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-sm">
                <h4 className="font-bold text-accent text-xs uppercase tracking-wider">
                  Transactional Stored Procedures
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.routines ?? []).map((r, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background p-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">{r.ROUTINE_NAME}</span>
                      <span className="text-[10px] text-brand font-semibold">
                        {r.ROUTINE_TYPE}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Views */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-sm">
                <h4 className="font-bold text-emerald-500 text-xs uppercase tracking-wider">
                  Authoritative SQL Views
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.views ?? []).map((v, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background p-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">{v.TABLE_NAME}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        VIEW (UPDATABLE: {v.IS_UPDATABLE})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tables */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-sm">
                <h4 className="font-bold text-amber-500 text-xs uppercase tracking-wider">
                  Physical Storage Tables
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.tables ?? []).map((tb, idx) => (
                    <div key={idx} className="rounded-xl border border-border bg-background p-2.5 flex items-center justify-between">
                      <span className="font-medium text-foreground">{tb.TABLE_NAME}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        ~{tb.TABLE_ROWS} rows ({tb.ENGINE})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* EXAM WIZARD MODAL */}
      <ExamWizardModal
        isOpen={wizardOpen}
        editingExam={editingExam}
        onClose={() => {
          setWizardOpen(false);
          setEditingExam(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
        }}
      />

      {/* UNPUBLISH CONFIRMATION MODAL */}
      <UnpublishConfirmModal
        isOpen={unpublishModalOpen}
        onClose={() => {
          setUnpublishModalOpen(false);
          setTargetUnpublishExam(null);
        }}
        exam={
          targetUnpublishExam
            ? {
                id: targetUnpublishExam.id,
                title: targetUnpublishExam.title,
                active_sessions: targetUnpublishExam.active_sessions,
              }
            : null
        }
        onConfirm={() => {
          if (targetUnpublishExam) {
            unpublishExamMutation.mutate(targetUnpublishExam.id);
          }
        }}
        isLoading={unpublishExamMutation.isPending}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <DeleteExamModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTargetDeleteExam(null);
          setDeleteError(null);
        }}
        exam={
          targetDeleteExam
            ? {
                id: targetDeleteExam.id,
                title: targetDeleteExam.title,
                total_sessions: targetDeleteExam.total_sessions,
              }
            : null
        }
        onConfirm={() => {
          if (targetDeleteExam) {
            deleteExamMutation.mutate(targetDeleteExam.id);
          }
        }}
        isLoading={deleteExamMutation.isPending}
        error={deleteError}
      />
    </div>
  );
}

export default AdminDashboardPage;
