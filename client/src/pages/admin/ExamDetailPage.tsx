import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Database,
  ExternalLink,
  FileEdit,
  Globe,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { api } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { NeonButton } from '../../components/ui/NeonButton';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ErrorState, EmptyState } from '../../components/ui/EmptyState';
import { toast } from 'sonner';
import {
  UnpublishConfirmModal,
  DeleteExamModal,
  ExamStatusMenu,
} from '../../components/admin/ExamLifecycleModals';

interface QuestionItem {
  id: number;
  exam_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  marks: number | string;
  order_index: number;
}

interface ExamDetailResponse {
  exam: {
    id: number;
    title: string;
    description: string | null;
    duration_minutes: number;
    min_trust_score: number;
    max_extension_mins?: number;
    start_window: string;
    end_window: string;
    is_published: boolean | number;
    created_by: number;
    created_at: string;
    updated_at?: string;
  };
  creator?: {
    id: number;
    full_name: string;
    email: string;
  };
  stats?: {
    totalSessions: number;
    inProgressSessions: number;
    completedSessions: number;
    disqualifiedSessions: number;
    timedOutSessions: number;
    questionCount: number;
    totalMarks: number;
  };
  questions: QuestionItem[];
}

export function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const examId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const examQuery = useQuery({
    queryKey: ['admin-exam-detail', examId],
    queryFn: () => api.get<ExamDetailResponse>(`/exams/${examId}`),
    enabled: !Number.isNaN(examId) && examId > 0,
  });

  const examData = examQuery.data;
  const exam = examData?.exam;
  const stats = examData?.stats;
  const creator = examData?.creator;
  const questions = examData?.questions ?? [];
  const isPublished = Boolean(exam?.is_published);

  // Form edit states (for DRAFT mode)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [minTrustScore, setMinTrustScore] = useState(50);
  const [maxExtensionMins, setMaxExtensionMins] = useState(30);
  const [startWindow, setStartWindow] = useState('');
  const [endWindow, setEndWindow] = useState('');
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Question editing / adding state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [qCorrect, setQCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [qMarks, setQMarks] = useState(2);
  const [qError, setQError] = useState<string | null>(null);

  // Modals
  const [unpublishModalOpen, setUnpublishModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync state when exam data loads or changes
  useEffect(() => {
    if (exam) {
      setTitle(exam.title);
      setDescription(exam.description ?? '');
      setDurationMinutes(exam.duration_minutes);
      setMinTrustScore(exam.min_trust_score);
      setMaxExtensionMins(Number(exam.max_extension_mins ?? 30));

      // Format ISO string to datetime-local input format (YYYY-MM-DDTHH:mm)
      const toLocalDt = (isoStr: string) => {
        try {
          const d = new Date(isoStr);
          if (Number.isNaN(d.getTime())) return '';
          return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        } catch {
          return '';
        }
      };

      setStartWindow(toLocalDt(exam.start_window));
      setEndWindow(toLocalDt(exam.end_window));
      setIsEditingParams(false);
      setErrors({});
    }
  }, [exam]);

  // Helper to extract error message safely
  const extractError = (err: unknown, fallback: string): string => {
    const res = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
    return res?.data?.error?.message || (err instanceof Error ? err.message : fallback);
  };

  // Mutations
  const updateExamMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/exams/${examId}`, body),
    onSuccess: () => {
      toast.success('Examination specifications updated');
      setIsEditingParams(false);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to update examination'));
    },
  });

  const publishExamMutation = useMutation({
    mutationFn: () => api.patch(`/exams/${examId}/publish`),
    onSuccess: () => {
      toast.success('Examination published and active');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } } })?.response;
      const fieldErrors = resp?.data?.error?.details?.fieldErrors;
      if (fieldErrors) {
        const firstField = Object.keys(fieldErrors)[0];
        const firstMsg = fieldErrors[firstField][0];
        toast.error(`Publish blocked: ${firstMsg}`);
      } else {
        toast.error(resp?.data?.error?.message || 'Failed to publish examination');
      }
    },
  });

  const unpublishExamMutation = useMutation({
    mutationFn: () => api.post(`/exams/${examId}/unpublish`),
    onSuccess: () => {
      toast.success('Examination unpublished');
      setUnpublishModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to unpublish examination'));
    },
  });

  const deleteExamMutation = useMutation({
    mutationFn: () => api.delete(`/exams/${examId}`),
    onSuccess: () => {
      toast.success('Examination permanently deleted');
      setDeleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
      navigate('/admin/exams');
    },
    onError: (err: unknown) => {
      const msg = extractError(err, 'Failed to delete examination');
      setDeleteError(msg);
      toast.error(msg);
    },
  });

  const addQuestionMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post(`/exams/${examId}/questions`, body),
    onSuccess: () => {
      toast.success('Question added to assessment bank');
      resetQuestionForm();
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to add question'));
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: (vars: { questionId: number; body: Record<string, unknown> }) =>
      api.patch(`/exams/${examId}/questions/${vars.questionId}`, vars.body),
    onSuccess: () => {
      toast.success('Question updated');
      resetQuestionForm();
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to update question'));
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => api.delete(`/exams/${examId}/questions/${questionId}`),
    onSuccess: () => {
      toast.success('Question removed');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to delete question'));
    },
  });

  const reorderQuestionsMutation = useMutation({
    mutationFn: (questionIds: number[]) =>
      api.put(`/exams/${examId}/questions/reorder`, { questionIds }),
    onSuccess: () => {
      toast.success('Question order updated');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to reorder questions'));
    },
  });

  const resetQuestionForm = () => {
    setIsAddingQuestion(false);
    setEditingQuestionId(null);
    setQText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setQCorrect('A');
    setQMarks(2);
    setQError(null);
  };

  const handleEditQuestionClick = (q: QuestionItem) => {
    setEditingQuestionId(q.id);
    setQText(q.question_text);
    setOptA(q.option_a);
    setOptB(q.option_b);
    setOptC(q.option_c === 'N/A' ? '' : q.option_c);
    setOptD(q.option_d === 'N/A' ? '' : q.option_d);
    setQCorrect(q.correct_option);
    setQMarks(Number(q.marks));
    setQError(null);
    setIsAddingQuestion(false);
  };

  const handleSaveQuestion = () => {
    if (!qText.trim()) {
      setQError('Question prompt is required');
      return;
    }
    if (!optA.trim() || !optB.trim()) {
      setQError('Options A and B are required');
      return;
    }
    if (qCorrect === 'C' && !optC.trim()) {
      setQError('Correct option C points to an empty option');
      return;
    }
    if (qCorrect === 'D' && !optD.trim()) {
      setQError('Correct option D points to an empty option');
      return;
    }
    if (qMarks <= 0) {
      setQError('Marks must be greater than 0');
      return;
    }

    const payload = {
      questionText: qText.trim(),
      optionA: optA.trim(),
      optionB: optB.trim(),
      optionC: optC.trim() || 'N/A',
      optionD: optD.trim() || 'N/A',
      correctOption: qCorrect,
      marks: qMarks,
    };

    if (editingQuestionId) {
      updateQuestionMutation.mutate({ questionId: editingQuestionId, body: payload });
    } else {
      addQuestionMutation.mutate(payload);
    }
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...questions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    reorderQuestionsMutation.mutate(reordered.map((q) => q.id));
  };

  // Validation before saving changes
  const handleSaveExamParams = () => {
    const errs: Record<string, string> = {};

    if (!title.trim()) {
      errs.title = 'Title is required';
    }
    if (description.trim().length > 0 && description.trim().length < 20) {
      errs.description = 'Syllabus & instructions must be at least 20 characters';
    }
    if (durationMinutes < 1 || durationMinutes > 600) {
      errs.durationMinutes = 'Duration must be between 1 and 600 minutes';
    }
    if (minTrustScore < 0 || minTrustScore > 100) {
      errs.minTrustScore = 'Minimum trust score must be between 0 and 100';
    }

    const sTime = new Date(startWindow).getTime();
    const eTime = new Date(endWindow).getTime();
    if (startWindow && endWindow) {
      if (eTime <= sTime) {
        errs.endWindow = 'End window must be after start window';
      } else {
        const winMins = (eTime - sTime) / 60000;
        if (winMins < durationMinutes) {
          errs.endWindow = `Window duration (${Math.round(winMins)} mins) must be at least equal to exam duration (${durationMinutes} mins)`;
        }
      }
    }

    const ext = Number(maxExtensionMins);
    if (Number.isNaN(ext) || ext < 0 || ext > 120) {
      errs.maxExtensionMins = 'Max extra time must be between 0 and 120 minutes';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});
    updateExamMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      durationMinutes,
      minTrustScore,
      maxExtensionMins,
      startWindow: startWindow ? new Date(startWindow).toISOString() : undefined,
      endWindow: endWindow ? new Date(endWindow).toISOString() : undefined,
    });
  };

  const handleDiscardChanges = () => {
    if (exam) {
      setTitle(exam.title);
      setDescription(exam.description ?? '');
      setDurationMinutes(exam.duration_minutes);
      setMinTrustScore(exam.min_trust_score);
      setMaxExtensionMins(Number(exam.max_extension_mins ?? 30));
      setIsEditingParams(false);
      setErrors({});
    }
  };

  if (examQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-20" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard className="h-96 lg:col-span-2" />
          <SkeletonCard className="h-96" />
        </div>
      </div>
    );
  }

  if (examQuery.isError || !exam) {
    return (
      <div className="space-y-6">
        <Link
          to="/admin/exams"
          className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Assessment Directory
        </Link>
        <ErrorState
          title="Examination Not Found"
          description="Could not locate assessment blueprint # "
          onRetry={() => examQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Link to="/admin" className="hover:text-foreground">
            Admin
          </Link>
          <span>/</span>
          <Link to="/admin/exams" className="hover:text-foreground">
            Exam Catalog
          </Link>
          <span>/</span>
          <span className="text-foreground font-bold truncate max-w-xs">{exam.title}</span>
        </div>

        <Link
          to="/admin/exams"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Directory</span>
        </Link>
      </div>

      {/* Main Header */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
              EXAM #{exam.id}
            </span>
            <ExamStatusMenu
              exam={{
                id: exam.id,
                title: exam.title,
                is_published: exam.is_published,
              }}
              onPublish={() => publishExamMutation.mutate()}
              onUnpublish={() => setUnpublishModalOpen(true)}
              onDelete={() => {
                setDeleteError(null);
                setDeleteModalOpen(true);
              }}
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{exam.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          {isPublished ? (
            <NeonButton
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="w-4 h-4 text-rose-500" />}
              onClick={() => setUnpublishModalOpen(true)}
            >
              Unpublish Exam
            </NeonButton>
          ) : (
            <NeonButton
              variant="primary"
              size="sm"
              leftIcon={<Globe className="w-4 h-4" />}
              onClick={() => publishExamMutation.mutate()}
              isLoading={publishExamMutation.isPending}
            >
              Publish Examination
            </NeonButton>
          )}
        </div>
      </div>

      {/* Published Notice Banner */}
      {isPublished && (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 text-brand">
            <Lock className="w-5 h-5 shrink-0" />
            <div className="text-xs font-mono">
              <strong className="font-bold text-foreground block">
                Assessment is PUBLISHED and live
              </strong>
              <span className="text-muted-foreground">
                Parameters and question bank are locked to prevent candidate mid-exam desynchronization.
              </span>
            </div>
          </div>
          <NeonButton
            variant="secondary"
            size="sm"
            onClick={() => setUnpublishModalOpen(true)}
            className="shrink-0"
          >
            Unpublish to Edit
          </NeonButton>
        </div>
      )}

      {/* Main Grid: Parameters & Question Bank (Left 2 cols) vs Bento Stats (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Assessment Specifications Bento Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-foreground font-mono font-bold text-sm">
                <FileEdit className="w-4 h-4 text-brand" />
                <span>Assessment Specifications</span>
              </div>
              {!isPublished && (
                <div className="flex items-center gap-2">
                  {isEditingParams ? (
                    <>
                      <NeonButton variant="secondary" size="sm" onClick={handleDiscardChanges}>
                        Discard
                      </NeonButton>
                      <NeonButton
                        variant="primary"
                        size="sm"
                        leftIcon={<Save className="w-3.5 h-3.5" />}
                        onClick={handleSaveExamParams}
                        isLoading={updateExamMutation.isPending}
                      >
                        Save Changes
                      </NeonButton>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingParams(true)}
                      className="text-xs font-mono text-brand hover:underline cursor-pointer"
                    >
                      Edit Parameters
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Title */}
              <div>
                <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                  EXAMINATION TITLE {!isPublished && <span className="text-rose-500">*</span>}
                </label>
                {isEditingParams && !isPublished ? (
                  <>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                      }}
                      className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                        errors.title ? 'border-rose-500' : 'border-border focus:border-brand'
                      }`}
                    />
                    {errors.title && <p className="text-rose-500 text-[11px] mt-1">{errors.title}</p>}
                  </>
                ) : (
                  <p className="text-foreground font-semibold text-sm">{exam.title}</p>
                )}
              </div>

              {/* Syllabus / Instructions */}
              <div>
                <label className="block text-muted-foreground text-[11px] mb-1 font-semibold flex items-center justify-between">
                  <span>SYLLABUS & INSTRUCTIONS (MIN 20 CHARS) {!isPublished && <span className="text-rose-500">*</span>}</span>
                  {isEditingParams && (
                    <span className={description.trim().length >= 20 ? 'text-emerald-500' : 'text-amber-500'}>
                      {description.trim().length}/20 chars
                    </span>
                  )}
                </label>
                {isEditingParams && !isPublished ? (
                  <>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
                      }}
                      className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                        errors.description ? 'border-rose-500' : 'border-border focus:border-brand'
                      }`}
                    />
                    {errors.description && (
                      <p className="text-rose-500 text-[11px] mt-1">{errors.description}</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {exam.description || 'No detailed instructions configured.'}
                  </p>
                )}
              </div>

              {/* Numerical Grid: Duration, Min Trust & Max Extension */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                    DURATION (MINUTES) {!isPublished && <span className="text-rose-500">*</span>}
                  </label>
                  {isEditingParams && !isPublished ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        max={600}
                        value={durationMinutes}
                        onChange={(e) => {
                          setDurationMinutes(parseInt(e.target.value, 10) || 1);
                          if (errors.durationMinutes)
                            setErrors((prev) => ({ ...prev, durationMinutes: '' }));
                        }}
                        className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                          errors.durationMinutes ? 'border-rose-500' : 'border-border focus:border-brand'
                        }`}
                      />
                      {errors.durationMinutes && (
                        <p className="text-rose-500 text-[11px] mt-1">{errors.durationMinutes}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-foreground font-bold">{exam.duration_minutes} minutes</p>
                  )}
                </div>

                <div>
                  <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                    MINIMUM TRUST THRESHOLD (%) {!isPublished && <span className="text-rose-500">*</span>}
                  </label>
                  {isEditingParams && !isPublished ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={minTrustScore}
                        onChange={(e) => {
                          setMinTrustScore(parseInt(e.target.value, 10) || 0);
                          if (errors.minTrustScore)
                            setErrors((prev) => ({ ...prev, minTrustScore: '' }));
                        }}
                        className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                          errors.minTrustScore ? 'border-rose-500' : 'border-border focus:border-brand'
                        }`}
                      />
                      {errors.minTrustScore && (
                        <p className="text-rose-500 text-[11px] mt-1">{errors.minTrustScore}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-rose-500 font-bold">{exam.min_trust_score}%</p>
                  )}
                </div>

                <div>
                  <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                    MAX EXTRA TIME (MINS) {!isPublished && <span className="text-muted-foreground font-normal">(0-120)</span>}
                  </label>
                  {isEditingParams && !isPublished ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={maxExtensionMins}
                        onChange={(e) => {
                          setMaxExtensionMins(parseInt(e.target.value, 10) || 0);
                          if (errors.maxExtensionMins)
                            setErrors((prev) => ({ ...prev, maxExtensionMins: '' }));
                        }}
                        className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                          errors.maxExtensionMins ? 'border-rose-500' : 'border-border focus:border-brand'
                        }`}
                      />
                      {errors.maxExtensionMins && (
                        <p className="text-rose-500 text-[11px] mt-1">{errors.maxExtensionMins}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-foreground font-bold">
                      {Number(exam.max_extension_mins ?? 30) === 0 ? 'Disabled (0 mins)' : `${exam.max_extension_mins ?? 30} minutes`}
                    </p>
                  )}
                </div>
              </div>

              {/* Time Windows Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                    START WINDOW {!isPublished && <span className="text-rose-500">*</span>}
                  </label>
                  {isEditingParams && !isPublished ? (
                    <input
                      type="datetime-local"
                      value={startWindow}
                      onChange={(e) => setStartWindow(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                  ) : (
                    <p className="text-foreground">
                      {new Date(exam.start_window).toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-muted-foreground text-[11px] mb-1 font-semibold">
                    END WINDOW {!isPublished && <span className="text-rose-500">*</span>}
                  </label>
                  {isEditingParams && !isPublished ? (
                    <>
                      <input
                        type="datetime-local"
                        value={endWindow}
                        onChange={(e) => {
                          setEndWindow(e.target.value);
                          if (errors.endWindow) setErrors((prev) => ({ ...prev, endWindow: '' }));
                        }}
                        className={`w-full rounded-xl border bg-background p-2.5 text-xs text-foreground font-mono focus:outline-none ${
                          errors.endWindow ? 'border-rose-500' : 'border-border focus:border-brand'
                        }`}
                      />
                      {errors.endWindow && (
                        <p className="text-rose-500 text-[11px] mt-1">{errors.endWindow}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-foreground">{new Date(exam.end_window).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Question Bank Bento Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand" />
                  <span>Curated Question Bank</span>
                </h3>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  {questions.length} questions configured • {stats?.totalMarks ?? 0} total marks
                </p>
              </div>

              {!isPublished && (
                <div className="flex items-center gap-2">
                  {!isAddingQuestion && !editingQuestionId && (
                    <NeonButton
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => {
                        resetQuestionForm();
                        setIsAddingQuestion(true);
                      }}
                    >
                      Add Question
                    </NeonButton>
                  )}
                </div>
              )}
            </div>

            {/* Question Add / Edit Modal Dialog */}
            <Modal
              isOpen={Boolean(isAddingQuestion || editingQuestionId)}
              onClose={resetQuestionForm}
              size="lg"
              title={editingQuestionId ? 'Edit Question' : 'Add New Question'}
              description="Configure question text, multiple choice options, and marks"
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton variant="secondary" size="sm" onClick={resetQuestionForm}>
                    Cancel
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    onClick={handleSaveQuestion}
                    isLoading={addQuestionMutation.isPending || updateQuestionMutation.isPending}
                  >
                    {editingQuestionId ? 'Update Question' : 'Save Question'}
                  </NeonButton>
                </div>
              }
            >
              <div className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-xs font-mono text-foreground font-semibold mb-1">
                    QUESTION PROMPT *
                  </label>
                  <input
                    type="text"
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    placeholder="Question prompt..."
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono text-foreground font-semibold">
                    ANSWER OPTIONS
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      placeholder="Option A *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      placeholder="Option B *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                      placeholder="Option C"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                      placeholder="Option D"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>

                {qError && (
                  <p className="text-rose-500 text-xs flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{qError}</span>
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-semibold">Correct Option:</span>
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="qCorrectRadio"
                          checked={qCorrect === opt}
                          onChange={() => setQCorrect(opt)}
                          className="accent-brand"
                        />
                        <span className="font-bold text-foreground">{opt}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground font-semibold">Marks:</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={qMarks}
                      onChange={(e) => setQMarks(parseInt(e.target.value, 10) || 1)}
                      className="w-16 rounded-lg border border-border bg-background p-1.5 text-center text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </Modal>

            {/* Questions List */}
            {questions.length === 0 ? (
              <EmptyState
                icon={<Database className="w-8 h-8 text-brand" />}
                title="Question Bank Empty"
                description={
                  isPublished
                    ? 'No questions found in this assessment.'
                    : 'Add questions individually or upload a CSV file.'
                }
              />
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-border bg-background p-4 text-xs font-mono space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-brand font-bold mr-2">Q{idx + 1}.</span>
                        <span className="text-foreground font-semibold">{q.question_text}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Key: {q.correct_option}
                        </span>
                        <span className="font-bold text-muted-foreground text-[10px] px-1.5 py-0.5">
                          {q.marks} pts
                        </span>

                        {!isPublished && (
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, 'up')}
                              disabled={idx === 0 || reorderQuestionsMutation.isPending}
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, 'down')}
                              disabled={
                                idx === questions.length - 1 || reorderQuestionsMutation.isPending
                              }
                              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditQuestionClick(q)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer ml-1"
                              title="Edit question"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteQuestionMutation.mutate(q.id)}
                              className="p-1 rounded text-muted-foreground hover:text-rose-500 cursor-pointer"
                              title="Delete question"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-muted-foreground pt-1">
                      <div
                        className={
                          q.correct_option === 'A' ? 'text-emerald-500 font-bold' : ''
                        }
                      >
                        A: {q.option_a}
                      </div>
                      <div
                        className={
                          q.correct_option === 'B' ? 'text-emerald-500 font-bold' : ''
                        }
                      >
                        B: {q.option_b}
                      </div>
                      {q.option_c && q.option_c !== 'N/A' && (
                        <div
                          className={
                            q.correct_option === 'C' ? 'text-emerald-500 font-bold' : ''
                          }
                        >
                          C: {q.option_c}
                        </div>
                      )}
                      {q.option_d && q.option_d !== 'N/A' && (
                        <div
                          className={
                            q.correct_option === 'D' ? 'text-emerald-500 font-bold' : ''
                          }
                        >
                          D: {q.option_d}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col) - Bento Stats Cards */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand" />
              <span>Assessment Metadata</span>
            </h3>

            <div className="space-y-3 pt-1 border-t border-border">
              <div>
                <span className="text-[10px] text-muted-foreground block">AUTHOR / CREATOR:</span>
                <span className="font-bold text-foreground">
                  {creator?.full_name ?? 'Dr. Elena Vance'}
                </span>
                <span className="text-muted-foreground block text-[11px]">
                  {creator?.email ?? 'admin@proctoriq.io'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">INITIALIZED AT:</span>
                <span className="text-foreground">
                  {new Date(exam.created_at).toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground block">IMMUTABILITY STATUS:</span>
                <span
                  className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                    isPublished
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isPublished ? 'LOCKED / PUBLISHED' : 'MUTABLE DRAFT'}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate Activity & Telemetry Bento Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                <span>Session Telemetry</span>
              </h3>
              <Link
                to="/proctor"
                className="text-[11px] text-brand hover:underline flex items-center gap-1"
              >
                <span>Live Monitor</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border">
              <div className="rounded-xl border border-border bg-background p-3">
                <span className="text-[10px] text-muted-foreground block">TOTAL SESSIONS</span>
                <span className="text-xl font-bold text-foreground tabular-nums">
                  {stats?.totalSessions ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
                <span className="text-[10px] text-brand font-bold block">IN PROGRESS</span>
                <span className="text-xl font-bold text-brand tabular-nums">
                  {stats?.inProgressSessions ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <span className="text-[10px] text-emerald-500 block">COMPLETED</span>
                <span className="text-xl font-bold text-emerald-500 tabular-nums">
                  {stats?.completedSessions ?? 0}
                </span>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                <span className="text-[10px] text-rose-500 block">DISQUALIFIED</span>
                <span className="text-xl font-bold text-rose-500 tabular-nums">
                  {stats?.disqualifiedSessions ?? 0}
                </span>
              </div>
            </div>

            {(stats?.inProgressSessions ?? 0) > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-400">
                Active candidate sessions detected. Unpublishing or deleting this examination is prevented until all active examinees submit.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modals */}
      <UnpublishConfirmModal
        isOpen={unpublishModalOpen}
        onClose={() => setUnpublishModalOpen(false)}
        exam={{
          id: exam.id,
          title: exam.title,
          active_sessions: stats?.inProgressSessions ?? 0,
        }}
        onConfirm={() => unpublishExamMutation.mutate()}
        isLoading={unpublishExamMutation.isPending}
      />

      <DeleteExamModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        exam={{
          id: exam.id,
          title: exam.title,
          total_sessions: stats?.totalSessions ?? 0,
        }}
        onConfirm={() => deleteExamMutation.mutate()}
        isLoading={deleteExamMutation.isPending}
        error={deleteError}
      />
    </div>
  );
}
