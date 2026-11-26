import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckSquare,
  Copy,
  Database,
  ExternalLink,
  FileEdit,
  Globe,
  GripVertical,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Shield,
  SlidersHorizontal,
  Square,
  Trash2,
  UploadCloud,
  Users,
  Video,
  Mic,
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
    shuffle_questions?: boolean | number;
    shuffle_options?: boolean | number;
    record_video?: boolean | number;
    record_audio?: boolean | number;
    permutationNotice?: {
      questionCount: number;
      shuffleQuestions: boolean;
      shuffleOptions: boolean;
      maxUniquePapers: number;
      isSmallExam: boolean;
      notice: string | null;
    };
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
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [recordVideo, setRecordVideo] = useState(true);
  const [recordAudio, setRecordAudio] = useState(false);
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
  const [qNegativeMarks, setQNegativeMarks] = useState(0);
  const [qError, setQError] = useState<string | null>(null);
  const [initialQValues, setInitialQValues] = useState<{
    text: string;
    optA: string;
    optB: string;
    optC: string;
    optD: string;
    correct: 'A' | 'B' | 'C' | 'D';
    marks: number;
    negativeMarks: number;
  } | null>(null);
  const [isConfirmDiscardQuestionOpen, setIsConfirmDiscardQuestionOpen] = useState(false);

  // Question delete confirmation & bulk edit state
  const [questionToDelete, setQuestionToDelete] = useState<QuestionItem | null>(null);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [selectedQIds, setSelectedQIds] = useState<number[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);

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
      setShuffleQuestions(exam.shuffle_questions !== undefined ? Boolean(exam.shuffle_questions) : true);
      setShuffleOptions(exam.shuffle_options !== undefined ? Boolean(exam.shuffle_options) : true);
      setRecordVideo(exam.record_video !== undefined ? Boolean(exam.record_video) : true);
      setRecordAudio(exam.record_audio !== undefined ? Boolean(exam.record_audio) : false);

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

  const duplicateQuestionMutation = useMutation({
    mutationFn: (q: QuestionItem) =>
      api.post(`/exams/${examId}/questions`, {
        questionText: `${q.question_text} (Copy)`,
        optionA: q.option_a,
        optionB: q.option_b,
        optionC: q.option_c || 'N/A',
        optionD: q.option_d || 'N/A',
        correctOption: q.correct_option,
        marks: Number(q.marks),
      }),
    onSuccess: () => {
      toast.success('Question duplicated');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to duplicate question'));
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (questionId: number) => api.delete(`/exams/${examId}/questions/${questionId}`),
    onSuccess: () => {
      toast.success('Question removed');
      setQuestionToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to delete question'));
    },
  });

  const bulkDeleteQuestionsMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.post(`/exams/${examId}/questions/bulk-delete`, { questionIds: ids }),
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} question(s) removed`);
      setSelectedQIds([]);
      setIsBulkDeleteConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to delete selected questions'));
    },
  });

  const bulkImportQuestionsMutation = useMutation({
    mutationFn: (parsedQuestions: Array<Record<string, unknown>>) =>
      api.post(`/exams/${examId}/questions/bulk`, { questions: parsedQuestions }),
    onSuccess: (data) => {
      const count =
        (data as { count?: number; importedCount?: number })?.importedCount ??
        (data as { count?: number })?.count ??
        0;
      toast.success(`${count} question(s) imported successfully`);
      setIsCsvImportModalOpen(false);
      setCsvText('');
      setCsvError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-exam-detail', examId] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
    },
    onError: (err: unknown) => {
      toast.error(extractError(err, 'Failed to import CSV questions'));
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
    setQNegativeMarks(0);
    setQError(null);
    setInitialQValues(null);
  };

  const handleOpenAddQuestion = () => {
    if (isPublished) return;
    resetQuestionForm();
    setIsAddingQuestion(true);
  };

  const handleEditQuestionClick = (q: QuestionItem) => {
    if (isPublished) return;
    const initial = {
      text: q.question_text,
      optA: q.option_a,
      optB: q.option_b,
      optC: q.option_c === 'N/A' ? '' : q.option_c,
      optD: q.option_d === 'N/A' ? '' : q.option_d,
      correct: q.correct_option,
      marks: Number(q.marks),
      negativeMarks: 0,
    };
    setEditingQuestionId(q.id);
    setQText(initial.text);
    setOptA(initial.optA);
    setOptB(initial.optB);
    setOptC(initial.optC);
    setOptD(initial.optD);
    setQCorrect(initial.correct);
    setQMarks(initial.marks);
    setQNegativeMarks(initial.negativeMarks);
    setInitialQValues(initial);
    setQError(null);
    setIsAddingQuestion(false);
  };

  const isQuestionDirty = editingQuestionId
    ? Boolean(
        initialQValues &&
          (qText !== initialQValues.text ||
            optA !== initialQValues.optA ||
            optB !== initialQValues.optB ||
            optC !== initialQValues.optC ||
            optD !== initialQValues.optD ||
            qCorrect !== initialQValues.correct ||
            qMarks !== initialQValues.marks ||
            qNegativeMarks !== initialQValues.negativeMarks)
      )
    : Boolean(
        qText.trim() ||
          optA.trim() ||
          optB.trim() ||
          optC.trim() ||
          optD.trim() ||
          qMarks !== 2 ||
          qNegativeMarks !== 0
      );

  const isQuestionValid =
    qText.trim().length > 0 &&
    optA.trim().length > 0 &&
    optB.trim().length > 0 &&
    (qCorrect !== 'C' || (optC.trim().length > 0 && optC !== 'N/A')) &&
    (qCorrect !== 'D' || (optD.trim().length > 0 && optD !== 'N/A')) &&
    qMarks > 0 &&
    qNegativeMarks >= 0;

  const handleCancelQuestionEdit = () => {
    if (isQuestionDirty) {
      setIsConfirmDiscardQuestionOpen(true);
    } else {
      resetQuestionForm();
    }
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
      negativeMarks: qNegativeMarks,
    };

    if (editingQuestionId) {
      updateQuestionMutation.mutate({ questionId: editingQuestionId, body: payload });
    } else {
      addQuestionMutation.mutate(payload);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedQIds.length === questions.length) {
      setSelectedQIds([]);
    } else {
      setSelectedQIds(questions.map((q) => q.id));
    }
  };

  const handleToggleSelectQuestion = (qId: number) => {
    setSelectedQIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleParseAndImportCsv = () => {
    if (!csvText.trim()) {
      setCsvError('Please enter question CSV rows to import');
      return;
    }

    try {
      const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
      const rows: Array<Record<string, unknown>> = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && line.toLowerCase().includes('question_text')) continue;

        // Simple CSV splitter respecting quotes
        const match = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g);
        if (!match) continue;
        const cols = match.map((c) => {
          let s = c.startsWith(',') ? c.slice(1) : c;
          s = s.trim();
          if (s.startsWith('"') && s.endsWith('"')) {
            s = s.slice(1, -1).replace(/""/g, '"');
          }
          return s;
        });

        if (cols.length >= 6) {
          const qPrompt = cols[0];
          const a = cols[1];
          const b = cols[2];
          const c = cols[3] || 'N/A';
          const d = cols[4] || 'N/A';
          const corr = (cols[5] || 'A').toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const m = parseInt(cols[6] || '2', 10) || 2;

          if (qPrompt && a && b) {
            rows.push({
              questionText: qPrompt,
              optionA: a,
              optionB: b,
              optionC: c,
              optionD: d,
              correctOption: ['A', 'B', 'C', 'D'].includes(corr) ? corr : 'A',
              marks: m,
            });
          }
        }
      }

      if (rows.length === 0) {
        setCsvError('No valid question rows found. Expected: question_text,option_a,option_b,option_c,option_d,correct_option,marks');
        return;
      }

      setCsvError(null);
      bulkImportQuestionsMutation.mutate(rows);
    } catch {
      setCsvError('Failed to parse CSV input format.');
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
      shuffleQuestions,
      shuffleOptions,
      recordVideo,
      recordAudio,
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
      setShuffleQuestions(exam.shuffle_questions !== undefined ? Boolean(exam.shuffle_questions) : true);
      setShuffleOptions(exam.shuffle_options !== undefined ? Boolean(exam.shuffle_options) : true);
      setRecordVideo(exam.record_video !== undefined ? Boolean(exam.record_video) : true);
      setRecordAudio(exam.record_audio !== undefined ? Boolean(exam.record_audio) : false);
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
          {/* Exam Parameters Bento Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-foreground font-mono font-bold text-sm">
                <FileEdit className="w-4 h-4 text-brand" />
                <span>Exam Parameters</span>
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
                      aria-label="Edit exam parameters"
                      title="Edit exam parameters"
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-foreground hover:border-brand/50 hover:bg-brand/10 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4 text-brand" />
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

              {/* Anti-Cheat Paper Shuffling Controls */}
              <div className="pt-3 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-foreground text-xs font-mono font-bold">
                      Anti-Cheat Paper Randomization
                    </label>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Generate unique paper configurations per candidate with Fisher-Yates server shuffle
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-elevated cursor-pointer hover:border-brand/40 transition-colors">
                    <input
                      type="checkbox"
                      data-testid="toggle-shuffle-questions"
                      checked={shuffleQuestions}
                      disabled={!isEditingParams || isPublished}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
                    />
                    <div className="text-xs font-mono">
                      <span className="font-bold text-foreground block">Shuffle Question Sequence</span>
                      <span className="text-[10px] text-muted-foreground">Each candidate gets a distinct question sequence</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-elevated cursor-pointer hover:border-brand/40 transition-colors">
                    <input
                      type="checkbox"
                      data-testid="toggle-shuffle-options"
                      checked={shuffleOptions}
                      disabled={!isEditingParams || isPublished}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
                    />
                    <div className="text-xs font-mono">
                      <span className="font-bold text-foreground block">Shuffle Option Choices</span>
                      <span className="text-[10px] text-muted-foreground">Randomize A, B, C, D choices per question</span>
                    </div>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-elevated cursor-pointer hover:border-brand/40 transition-colors">
                    <input
                      type="checkbox"
                      data-testid="toggle-record-video"
                      checked={recordVideo}
                      disabled={!isEditingParams}
                      onChange={(e) => setRecordVideo(e.target.checked)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
                    />
                    <div className="text-xs font-mono">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5 text-brand" />
                        Record Webcam Video
                      </span>
                      <span className="text-[10px] text-muted-foreground">Record candidate webcam feed for proctor review (default ON)</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-elevated cursor-pointer hover:border-brand/40 transition-colors">
                    <input
                      type="checkbox"
                      data-testid="toggle-record-audio"
                      checked={recordAudio}
                      disabled={!isEditingParams}
                      onChange={(e) => setRecordAudio(e.target.checked)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand accent-brand cursor-pointer"
                    />
                    <div className="text-xs font-mono">
                      <span className="font-bold text-foreground flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-brand" />
                        Record Audio (Optional)
                      </span>
                      <span className="text-[10px] text-muted-foreground">Also record microphone stream (disclosed in consent, default OFF)</span>
                    </div>
                  </label>
                </div>

                {/* Small Exam Permutations Notice Banner */}
                {Boolean(exam.permutationNotice?.notice) && (
                  <div
                    data-testid="small-exam-notice"
                    className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs font-mono text-amber-500 flex items-center gap-2.5 shadow-sm"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>{exam.permutationNotice?.notice}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Curated Question Bank Bento Card */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground font-mono flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand" />
                  <span>Curated Question Bank</span>
                </h3>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  {questions.length} questions configured • {questions.reduce((sum, q) => sum + Number(q.marks || 0), 0)} total marks
                </p>
              </div>

              <div className="flex items-center gap-2">
                <NeonButton
                  variant={isBulkEditMode ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={isPublished || questions.length === 0}
                  title={isPublished ? 'Unpublish to edit questions' : 'Toggle question edit mode'}
                  leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setIsBulkEditMode(!isBulkEditMode);
                    setSelectedQIds([]);
                  }}
                >
                  {isBulkEditMode ? 'Done Editing' : 'Edit questions'}
                </NeonButton>

                <NeonButton
                  variant="primary"
                  size="sm"
                  disabled={isPublished}
                  title={isPublished ? 'Unpublish to edit questions' : 'Add new question'}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={handleOpenAddQuestion}
                >
                  Add Question
                </NeonButton>
              </div>
            </div>

            {/* Bulk Edit Actions Bar */}
            {isBulkEditMode && !isPublished && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-background/80 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {selectedQIds.length === questions.length && questions.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-brand" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>
                      {selectedQIds.length === questions.length ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                  <span className="text-muted-foreground">
                    ({selectedQIds.length} of {questions.length} selected)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedQIds.length === 0 || bulkDeleteQuestionsMutation.isPending}
                    onClick={() => setIsBulkDeleteConfirmOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected ({selectedQIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCsvError(null);
                      setCsvText('');
                      setIsCsvImportModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand/40 bg-brand/10 text-brand hover:bg-brand/20 cursor-pointer transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Import CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Question Add / Edit Modal Dialog */}
            <Modal
              isOpen={Boolean(isAddingQuestion || editingQuestionId)}
              onClose={handleCancelQuestionEdit}
              size="lg"
              title={editingQuestionId ? 'Edit Question' : 'Add New Question'}
              description="Configure question text, multiple choice options, and marks"
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton variant="secondary" size="sm" onClick={handleCancelQuestionEdit}>
                    Cancel
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    onClick={handleSaveQuestion}
                    disabled={
                      !isQuestionValid ||
                      (Boolean(editingQuestionId) && !isQuestionDirty) ||
                      addQuestionMutation.isPending ||
                      updateQuestionMutation.isPending
                    }
                    isLoading={addQuestionMutation.isPending || updateQuestionMutation.isPending}
                  >
                    {editingQuestionId ? 'Save changes' : 'Save Question'}
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
                    onChange={(e) => {
                      setQText(e.target.value);
                      if (qError) setQError(null);
                    }}
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
                      onChange={(e) => {
                        setOptA(e.target.value);
                        if (qError) setQError(null);
                      }}
                      placeholder="Option A *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optB}
                      onChange={(e) => {
                        setOptB(e.target.value);
                        if (qError) setQError(null);
                      }}
                      placeholder="Option B *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optC}
                      onChange={(e) => {
                        setOptC(e.target.value);
                        if (qError) setQError(null);
                      }}
                      placeholder="Option C"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={optD}
                      onChange={(e) => {
                        setOptD(e.target.value);
                        if (qError) setQError(null);
                      }}
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

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-semibold">Correct Option:</span>
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="qCorrectRadio"
                          checked={qCorrect === opt}
                          onChange={() => {
                            setQCorrect(opt);
                            if (qError) setQError(null);
                          }}
                          className="accent-brand"
                        />
                        <span className="font-bold text-foreground">{opt}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-semibold">Marks:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={qMarks}
                        onChange={(e) => {
                          setQMarks(parseInt(e.target.value, 10) || 1);
                          if (qError) setQError(null);
                        }}
                        className="w-16 rounded-lg border border-border bg-background p-1.5 text-center text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-semibold">Negative:</span>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={qNegativeMarks}
                        onChange={(e) => {
                          setQNegativeMarks(parseInt(e.target.value, 10) || 0);
                          if (qError) setQError(null);
                        }}
                        className="w-16 rounded-lg border border-border bg-background p-1.5 text-center text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Modal>

            {/* Confirm Discard Modal */}
            <Modal
              isOpen={isConfirmDiscardQuestionOpen}
              onClose={() => setIsConfirmDiscardQuestionOpen(false)}
              size="sm"
              title="Discard Unsaved Edits?"
              description="You have unsaved edits on this question. If you close now, your modifications will be lost."
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsConfirmDiscardQuestionOpen(false)}
                  >
                    Keep Editing
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    className="!bg-rose-600 hover:!bg-rose-500 !border-rose-500"
                    onClick={() => {
                      setIsConfirmDiscardQuestionOpen(false);
                      resetQuestionForm();
                    }}
                  >
                    Discard Changes
                  </NeonButton>
                </div>
              }
            >
              <p className="font-mono text-xs text-muted-foreground">
                All changes made since opening the editor will be discarded and reverted to their original state.
              </p>
            </Modal>

            {/* Confirm Single Delete Modal */}
            <Modal
              isOpen={Boolean(questionToDelete)}
              onClose={() => setQuestionToDelete(null)}
              size="sm"
              title="Delete Question"
              description="Are you sure you want to delete this question? This action cannot be undone."
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setQuestionToDelete(null)}
                  >
                    Cancel
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    className="!bg-rose-600 hover:!bg-rose-500 !border-rose-500"
                    onClick={() => {
                      if (questionToDelete) {
                        deleteQuestionMutation.mutate(questionToDelete.id);
                      }
                    }}
                    isLoading={deleteQuestionMutation.isPending}
                  >
                    Delete Question
                  </NeonButton>
                </div>
              }
            >
              <div className="font-mono text-xs text-muted-foreground space-y-1">
                <p className="font-bold text-foreground">
                  Question: &quot;{questionToDelete?.question_text}&quot;
                </p>
                <p>This will permanently remove the question from the examination bank.</p>
              </div>
            </Modal>

            {/* Confirm Bulk Delete Modal */}
            <Modal
              isOpen={isBulkDeleteConfirmOpen}
              onClose={() => setIsBulkDeleteConfirmOpen(false)}
              size="sm"
              title="Delete Selected Questions"
              description={`Are you sure you want to delete ${selectedQIds.length} question(s) from this examination? This action cannot be undone.`}
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  >
                    Cancel
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    className="!bg-rose-600 hover:!bg-rose-500 !border-rose-500"
                    onClick={() => bulkDeleteQuestionsMutation.mutate(selectedQIds)}
                    isLoading={bulkDeleteQuestionsMutation.isPending}
                  >
                    Delete Questions
                  </NeonButton>
                </div>
              }
            >
              <p className="font-mono text-xs text-muted-foreground">
                All {selectedQIds.length} selected questions will be permanently removed.
              </p>
            </Modal>

            {/* Bulk CSV Import Modal */}
            <Modal
              isOpen={isCsvImportModalOpen}
              onClose={() => setIsCsvImportModalOpen(false)}
              size="lg"
              title="Bulk CSV Question Import"
              description="Draft and bulk-import questions using standard comma-separated format"
              footer={
                <div className="flex items-center justify-end gap-2.5 w-full">
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsCsvImportModalOpen(false)}
                  >
                    Cancel
                  </NeonButton>
                  <NeonButton
                    variant="primary"
                    size="sm"
                    onClick={handleParseAndImportCsv}
                    isLoading={bulkImportQuestionsMutation.isPending}
                  >
                    Parse & Import Questions
                  </NeonButton>
                </div>
              }
            >
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">CSV DATA FORMAT:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvText(
                        `question_text,option_a,option_b,option_c,option_d,correct_option,marks\n` +
                          `"What does ACID stand for?","Atomicity Consistency Isolation Durability","Automatic Centralized Data","Array Cluster Index Database","N/A","A",2\n` +
                          `"Which isolation level prevents dirty reads?","READ UNCOMMITTED","READ COMMITTED","REPEATABLE READ","SERIALIZABLE","B",2`
                      );
                      setCsvError(null);
                    }}
                    className="text-brand hover:underline cursor-pointer"
                  >
                    Insert Example CSV
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`question_text,option_a,option_b,option_c,option_d,correct_option,marks\n"Prompt","Opt A","Opt B","Opt C","Opt D","A",2`}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                />

                {csvError && (
                  <p className="text-rose-500 text-xs flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{csvError}</span>
                  </p>
                )}
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
                    className="rounded-xl border border-border bg-background p-4 text-xs font-mono space-y-2.5 transition-colors hover:border-border"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 flex items-start gap-2.5">
                        {isBulkEditMode && !isPublished && (
                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            <span className="cursor-grab text-muted-foreground hover:text-foreground">
                              <GripVertical className="w-4 h-4" />
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedQIds.includes(q.id)}
                              onChange={() => handleToggleSelectQuestion(q.id)}
                              className="rounded border-border accent-brand cursor-pointer"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="text-brand font-bold mr-2">Q{idx + 1}.</span>
                          <span
                            onClick={() => {
                              if (!isPublished) {
                                handleEditQuestionClick(q);
                              }
                            }}
                            className={`text-foreground font-semibold ${
                              !isPublished
                                ? 'cursor-pointer hover:text-brand hover:underline transition-colors'
                                : ''
                            }`}
                            title={!isPublished ? 'Click to edit question' : undefined}
                          >
                            {q.question_text}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Key: {q.correct_option}
                        </span>
                        <span className="font-bold text-muted-foreground text-[10px] px-1.5 py-0.5">
                          {q.marks} pts
                        </span>

                        {/* 36px Row Action Buttons */}
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => handleEditQuestionClick(q)}
                            disabled={isPublished}
                            aria-label="Edit question"
                            title={isPublished ? 'Unpublish to edit questions' : 'Edit question'}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-foreground hover:border-brand/50 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateQuestionMutation.mutate(q)}
                            disabled={isPublished || duplicateQuestionMutation.isPending}
                            aria-label="Duplicate question"
                            title={isPublished ? 'Unpublish to edit questions' : 'Duplicate question'}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-foreground hover:border-brand/50 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'up')}
                            disabled={isPublished || idx === 0 || reorderQuestionsMutation.isPending}
                            aria-label="Move question up"
                            title={isPublished ? 'Unpublish to edit questions' : 'Move up'}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-foreground hover:border-brand/50 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveQuestion(idx, 'down')}
                            disabled={isPublished || idx === questions.length - 1 || reorderQuestionsMutation.isPending}
                            aria-label="Move question down"
                            title={isPublished ? 'Unpublish to edit questions' : 'Move down'}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-foreground hover:border-brand/50 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuestionToDelete(q)}
                            disabled={isPublished}
                            aria-label="Delete question"
                            title={isPublished ? 'Unpublish to edit questions' : 'Delete question'}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-border bg-surface/90 text-muted-foreground hover:text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
