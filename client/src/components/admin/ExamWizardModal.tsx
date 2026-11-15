import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { NeonButton } from '../ui/NeonButton';
import { api } from '../../lib/api';
import type { AnswerOption, ExamItem } from '../../types/domain';

interface ExamWizardModalProps {
  isOpen: boolean;
  editingExam?: ExamItem | null;
  onClose: () => void;
  onSuccess: (exam: ExamItem) => void;
}

export interface QuestionDraft {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: AnswerOption;
  marks: number;
}

export interface ParsedCsvQuestion {
  rowNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: AnswerOption;
  marks: number;
  isValid: boolean;
  errorReason?: string;
}

interface StepIssue {
  field: string;
  message: string;
  targetId: string;
  step: 1 | 2 | 3;
}

interface StepErrorGroup {
  step: 1 | 2 | 3;
  stepName: string;
  errors: StepIssue[];
}

function normalizeHeader(raw: string): string {
  const h = raw.toLowerCase().trim().replace(/[\s_-]+/g, '');
  if (['questiontext', 'question', 'prompt', 'qtext', 'questionprompt'].includes(h)) return 'question_text';
  if (['optiona', 'opta', 'a', 'choicea', 'ansa'].includes(h)) return 'option_a';
  if (['optionb', 'optb', 'b', 'choiceb', 'ansb'].includes(h)) return 'option_b';
  if (['optionc', 'optc', 'c', 'choicec', 'ansc'].includes(h)) return 'option_c';
  if (['optiond', 'optd', 'd', 'choiced', 'ansd'].includes(h)) return 'option_d';
  if (
    [
      'correctoption',
      'correctopt',
      'correct',
      'answer',
      'correctopta/b/c/d',
      'correctoptiona/b/c/d',
      'key',
    ].includes(h)
  ) {
    return 'correct_option';
  }
  if (['marks', 'points', 'score', 'pts', 'weight'].includes(h)) return 'marks';
  return h;
}

function parseCsvRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      } else {
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (!inQuotes) {
      if (char === delimiter) {
        currentRecord.push(currentField);
        currentField = '';
        i++;
        continue;
      }
      if (char === '\r' && nextChar === '\n') {
        currentRecord.push(currentField);
        records.push(currentRecord);
        currentRecord = [];
        currentField = '';
        i += 2;
        continue;
      }
      if (char === '\n' || char === '\r') {
        currentRecord.push(currentField);
        records.push(currentRecord);
        currentRecord = [];
        currentField = '';
        i++;
        continue;
      }
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records.filter((rec) => rec.some((cell) => cell.trim().length > 0));
}

function parseCsvString(rawText: string): {
  rows: ParsedCsvQuestion[];
  validCount: number;
  invalidCount: number;
} {
  let text = rawText.trim();
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  if (!text) {
    return { rows: [], validCount: 0, invalidCount: 0 };
  }

  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const rawRecords = parseCsvRecords(text, delimiter);
  if (rawRecords.length === 0) {
    return { rows: [], validCount: 0, invalidCount: 0 };
  }

  const firstRow = rawRecords[0];
  const normalizedFirst = firstRow.map(normalizeHeader);
  const hasHeader =
    normalizedFirst.includes('question_text') ||
    (normalizedFirst.includes('correct_option') && normalizedFirst.includes('marks'));

  let colMap = {
    question_text: 0,
    option_a: 1,
    option_b: 2,
    option_c: 3,
    option_d: 4,
    correct_option: 5,
    marks: 6,
  };

  let dataRows: string[][];

  if (hasHeader) {
    dataRows = rawRecords.slice(1);
    const newMap: Record<string, number> = {};
    normalizedFirst.forEach((h, idx) => {
      newMap[h] = idx;
    });
    colMap = {
      question_text: newMap['question_text'] ?? 0,
      option_a: newMap['option_a'] ?? 1,
      option_b: newMap['option_b'] ?? 2,
      option_c: newMap['option_c'] ?? 3,
      option_d: newMap['option_d'] ?? 4,
      correct_option: newMap['correct_option'] ?? 5,
      marks: newMap['marks'] ?? 6,
    };
  } else {
    dataRows = rawRecords;
  }

  const rows: ParsedCsvQuestion[] = [];

  dataRows.forEach((record, index) => {
    const rowNumber = index + (hasHeader ? 2 : 1);
    const questionText = record[colMap.question_text]?.trim() ?? '';
    const optionA = record[colMap.option_a]?.trim() ?? '';
    const optionB = record[colMap.option_b]?.trim() ?? '';
    const rawOptionC = record[colMap.option_c]?.trim();
    const optionC = rawOptionC && rawOptionC.toUpperCase() !== 'N/A' ? rawOptionC : '';
    const rawOptionD = record[colMap.option_d]?.trim();
    const optionD = rawOptionD && rawOptionD.toUpperCase() !== 'N/A' ? rawOptionD : '';
    const rawCorrect = (record[colMap.correct_option]?.trim() || '').toUpperCase();
    const rawMarks = parseInt(record[colMap.marks]?.trim() ?? '1', 10);
    const marks = Number.isInteger(rawMarks) && rawMarks > 0 ? rawMarks : 1;

    let isValid = true;
    let errorReason: string | undefined;

    if (!questionText) {
      isValid = false;
      errorReason = 'Missing question prompt';
    } else if (!optionA || !optionB) {
      isValid = false;
      errorReason = 'Option A and Option B are required';
    } else if (!['A', 'B', 'C', 'D'].includes(rawCorrect)) {
      isValid = false;
      errorReason = `Invalid correct option: "${rawCorrect}". Must be A, B, C, or D`;
    } else if (rawCorrect === 'C' && !optionC) {
      isValid = false;
      errorReason = 'Correct option C is specified, but Option C is empty';
    } else if (rawCorrect === 'D' && !optionD) {
      isValid = false;
      errorReason = 'Correct option D is specified, but Option D is empty';
    } else if (rawMarks <= 0) {
      isValid = false;
      errorReason = 'Marks must be greater than 0';
    }

    const safeCorrect: AnswerOption = ['A', 'B', 'C', 'D'].includes(rawCorrect)
      ? (rawCorrect as AnswerOption)
      : 'A';

    rows.push({
      rowNumber,
      questionText,
      optionA,
      optionB,
      optionC: optionC || 'N/A',
      optionD: optionD || 'N/A',
      correctOption: safeCorrect,
      marks,
      isValid,
      errorReason,
    });
  });

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  return { rows, validCount, invalidCount };
}

export function ExamWizardModal({
  isOpen,
  editingExam,
  onClose,
  onSuccess,
}: ExamWizardModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Details
  const [title, setTitle] = useState(editingExam?.title ?? '');
  const [description, setDescription] = useState(editingExam?.description ?? '');
  const [durationMinutes, setDurationMinutes] = useState(editingExam?.duration_minutes ?? 60);

  // Step 2: Windows & Threshold
  const nowStr = new Date().toISOString().slice(0, 16);
  const weekLaterStr = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16);
  const [startWindow, setStartWindow] = useState(
    editingExam?.start_window ? new Date(editingExam.start_window).toISOString().slice(0, 16) : nowStr
  );
  const [endWindow, setEndWindow] = useState(
    editingExam?.end_window ? new Date(editingExam.end_window).toISOString().slice(0, 16) : weekLaterStr
  );
  const [minTrustScore, setMinTrustScore] = useState(editingExam?.min_trust_score ?? 50);
  const [maxExtensionMins, setMaxExtensionMins] = useState(editingExam?.max_extension_mins ?? 30);

  // Step 3: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [csvMode, setCsvMode] = useState(false);
  const [csvTab, setCsvTab] = useState<'upload' | 'paste'>('paste');
  const [csvText, setCsvText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvQuestion[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // New Question Form state
  const [newQText, setNewQText] = useState('');
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState<AnswerOption>('A');
  const [newMarks, setNewMarks] = useState(2);
  const [newQError, setNewQError] = useState<string | null>(null);

  // Validation Tracking
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishErrors, setPublishErrors] = useState<StepErrorGroup[]>([]);

  // Validation Calculations
  const getStep1Errors = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    }
    if (!description.trim()) {
      errs.description = 'Syllabus/instructions is required';
    } else if (description.trim().length < 20) {
      errs.description = `Syllabus must be at least 20 characters (currently ${description.trim().length})`;
    }
    const dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 1 || dur > 600) {
      errs.durationMinutes = 'Duration must be an integer between 1 and 600 minutes';
    }
    return errs;
  };

  const getStep2Errors = () => {
    const errs: Record<string, string> = {};
    if (!startWindow) {
      errs.startWindow = 'Start window is required';
    }
    if (!endWindow) {
      errs.endWindow = 'End window is required';
    }
    if (startWindow && endWindow) {
      const s = new Date(startWindow).getTime();
      const e = new Date(endWindow).getTime();
      if (Number.isNaN(s)) {
        errs.startWindow = 'Invalid start window date';
      }
      if (Number.isNaN(e)) {
        errs.endWindow = 'Invalid end window date';
      }
      if (!Number.isNaN(s) && !Number.isNaN(e)) {
        if (e <= s) {
          errs.endWindow = 'End window must be after start window';
        } else {
          const windowMinutes = (e - s) / (60 * 1000);
          const dur = Number(durationMinutes) || 60;
          if (windowMinutes < dur) {
            errs.endWindow = `Window duration (${Math.round(windowMinutes)}m) must be at least equal to exam duration (${dur}m)`;
          }
        }
      }
    }
    const trust = Number(minTrustScore);
    if (Number.isNaN(trust) || trust < 0 || trust > 100) {
      errs.minTrustScore = 'Minimum trust score must be between 0 and 100';
    }
    const ext = Number(maxExtensionMins);
    if (Number.isNaN(ext) || ext < 0 || ext > 120) {
      errs.maxExtensionMins = 'Max extra time must be between 0 and 120 minutes';
    }
    return errs;
  };

  const getStep3Errors = () => {
    const errs: Record<string, string> = {};
    if (questions.length === 0) {
      errs.questions = 'At least 1 question is required to publish an assessment';
    }
    return errs;
  };

  const step1Errors = getStep1Errors();
  const step2Errors = getStep2Errors();
  const step3Errors = getStep3Errors();

  const isStep1Valid = Object.keys(step1Errors).length === 0;
  const isStep2Valid = Object.keys(step2Errors).length === 0;
  const isStep3Valid = Object.keys(step3Errors).length === 0;

  // Step Navigation Gating
  const handleStepClick = (targetStep: 1 | 2 | 3) => {
    if (targetStep === 1) {
      setCurrentStep(1);
      return;
    }
    if (targetStep === 2) {
      if (!isStep1Valid) {
        setTouched((prev) => ({ ...prev, title: true, description: true, durationMinutes: true }));
        return;
      }
      setCurrentStep(2);
      return;
    }
    if (targetStep === 3) {
      if (!isStep1Valid) {
        setTouched((prev) => ({ ...prev, title: true, description: true, durationMinutes: true }));
        setCurrentStep(1);
        return;
      }
      if (!isStep2Valid) {
        setTouched((prev) => ({ ...prev, startWindow: true, endWindow: true, minTrustScore: true }));
        setCurrentStep(2);
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleContinue = () => {
    if (currentStep === 1) {
      if (!isStep1Valid) {
        setTouched((prev) => ({ ...prev, title: true, description: true, durationMinutes: true }));
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isStep2Valid) {
        setTouched((prev) => ({ ...prev, startWindow: true, endWindow: true, minTrustScore: true }));
        return;
      }
      setCurrentStep(3);
    }
  };

  // Save Exam Mutation
  const saveExamMutation = useMutation({
    mutationFn: async ({ isPublished }: { isPublished: boolean }) => {
      let savedExam: ExamItem;
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        durationMinutes: Number(durationMinutes) || 60,
        minTrustScore: Number(minTrustScore) || 50,
        maxExtensionMins: Number.isFinite(Number(maxExtensionMins)) ? Number(maxExtensionMins) : 30,
        startWindow: startWindow ? new Date(startWindow).toISOString() : undefined,
        endWindow: endWindow ? new Date(endWindow).toISOString() : undefined,
        isPublished,
      };

      if (questions.length > 0) {
        payload.questions = questions.map((q, idx) => ({
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC || 'N/A',
          optionD: q.optionD || 'N/A',
          correctOption: q.correctOption,
          marks: q.marks,
          orderIndex: idx + 1,
        }));
      }

      if (editingExam) {
        savedExam = await api.patch<ExamItem>(`/exams/${editingExam.id}`, payload);
      } else {
        savedExam = await api.post<ExamItem>('/exams', payload);
      }

      return savedExam;
    },
    onSuccess: (savedExam) => {
      queryClient.invalidateQueries({ queryKey: ['proctor-exams-list'] });
      queryClient.invalidateQueries({ queryKey: ['admin-exams'] });
      onSuccess(savedExam);
      onClose();
    },
  });

  if (!isOpen) return null;

  // Add individual question draft
  const handleAddQuestion = () => {
    setNewQError(null);
    if (!newQText.trim()) {
      setNewQError('Question prompt is required');
      return;
    }
    if (!newOptA.trim() || !newOptB.trim()) {
      setNewQError('Option A and Option B are required');
      return;
    }
    if (newCorrect === 'C' && (!newOptC.trim() || newOptC === 'N/A')) {
      setNewQError('Option C is empty but designated as the correct option');
      return;
    }
    if (newCorrect === 'D' && (!newOptD.trim() || newOptD === 'N/A')) {
      setNewQError('Option D is empty but designated as the correct option');
      return;
    }
    if (newMarks <= 0) {
      setNewQError('Marks must be greater than 0');
      return;
    }

    setQuestions((prev) => [
      ...prev,
      {
        questionText: newQText.trim(),
        optionA: newOptA.trim(),
        optionB: newOptB.trim(),
        optionC: newOptC.trim() || 'N/A',
        optionD: newOptD.trim() || 'N/A',
        correctOption: newCorrect,
        marks: Number(newMarks),
      },
    ]);
    setNewQText('');
    setNewOptA('');
    setNewOptB('');
    setNewOptC('');
    setNewOptD('');
    setNewCorrect('A');
    setNewMarks(2);
    setNewQError(null);
  };

  // CSV Template Downloader
  const handleDownloadTemplate = () => {
    const sample =
      `question_text,option_a,option_b,option_c,option_d,correct_option,marks\n` +
      `"What does the ACID acronym stand for?","Atomicity Consistency Isolation Durability","Automated Centralized Integrated Data","Array Cluster Index Database","Access Control Identity Domain","A",2\n` +
      `"Which isolation level prevents dirty reads but allows phantom reads?","READ UNCOMMITTED","READ COMMITTED","REPEATABLE READ","SERIALIZABLE","B",2\n` +
      `"Which MySQL engine provides ACID transaction support?","InnoDB","MyISAM","MEMORY","CSV","A",1`;
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'exam_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV (Text or File)
  const processCsvText = (raw: string) => {
    setCsvError(null);
    try {
      const result = parseCsvString(raw);
      if (result.rows.length === 0 || result.validCount === 0) {
        setCsvError(
          'No valid question rows found. Ensure CSV has: question_text, optA, optB, optC, optD, correct_opt (A/B/C/D), marks'
        );
        setParsedRows([]);
        return;
      }
      setParsedRows(result.rows);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setParsedRows([]);
    }
  };

  const handleParseCsv = () => {
    if (csvTab === 'paste') {
      if (!csvText.trim()) {
        setCsvError(
          'No valid question rows found. Ensure CSV has: question_text, optA, optB, optC, optD, correct_opt (A/B/C/D), marks'
        );
        return;
      }
      processCsvText(csvText);
    } else if (csvFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = String(e.target?.result || '');
        processCsvText(content);
      };
      reader.onerror = () => {
        setCsvError('Failed to read CSV file');
      };
      reader.readAsText(csvFile);
    } else {
      setCsvError('Please select or drop a .csv file first');
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setCsvError('File exceeds maximum size of 2MB');
        return;
      }
      setCsvFile(file);
      setCsvError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        processCsvText(String(event.target?.result || ''));
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        setCsvError('File exceeds maximum size of 2MB');
        return;
      }
      setCsvFile(file);
      setCsvError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        processCsvText(String(event.target?.result || ''));
      };
      reader.readAsText(file);
    }
  };

  const handleImportValidRows = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setQuestions((prev) => [
      ...prev,
      ...validRows.map((r) => ({
        questionText: r.questionText,
        optionA: r.optionA,
        optionB: r.optionB,
        optionC: r.optionC,
        optionD: r.optionD,
        correctOption: r.correctOption,
        marks: r.marks,
      })),
    ]);

    setParsedRows([]);
    setCsvText('');
    setCsvFile(null);
    setCsvMode(false);
  };

  // Draft Save Handler
  const handleSaveDraft = () => {
    if (!title.trim()) {
      setTouched((prev) => ({ ...prev, title: true }));
      setCurrentStep(1);
      setTimeout(() => {
        document.getElementById('exam-wizard-title')?.focus();
      }, 50);
      return;
    }
    saveExamMutation.mutate({ isPublished: false });
  };

  // Publish Check & Modal Trigger
  const handlePublishClick = () => {
    const errs1 = getStep1Errors();
    const errs2 = getStep2Errors();
    const errs3 = getStep3Errors();

    const groups: StepErrorGroup[] = [];

    if (Object.keys(errs1).length > 0) {
      const list: StepIssue[] = [];
      if (errs1.title) {
        list.push({ field: 'Title', message: errs1.title, targetId: 'exam-wizard-title', step: 1 });
      }
      if (errs1.description) {
        list.push({
          field: 'Syllabus & Instructions',
          message: errs1.description,
          targetId: 'exam-wizard-description',
          step: 1,
        });
      }
      if (errs1.durationMinutes) {
        list.push({
          field: 'Duration',
          message: errs1.durationMinutes,
          targetId: 'exam-wizard-duration',
          step: 1,
        });
      }
      groups.push({ step: 1, stepName: 'Step 1: Exam Details', errors: list });
    }

    if (Object.keys(errs2).length > 0) {
      const list: StepIssue[] = [];
      if (errs2.startWindow) {
        list.push({
          field: 'Start Window',
          message: errs2.startWindow,
          targetId: 'exam-wizard-start-window',
          step: 2,
        });
      }
      if (errs2.endWindow) {
        list.push({
          field: 'End Window',
          message: errs2.endWindow,
          targetId: 'exam-wizard-end-window',
          step: 2,
        });
      }
      if (errs2.minTrustScore) {
        list.push({
          field: 'Trust Score',
          message: errs2.minTrustScore,
          targetId: 'exam-wizard-trust-score',
          step: 2,
        });
      }
      groups.push({ step: 2, stepName: 'Step 2: Windows & Threshold', errors: list });
    }

    if (Object.keys(errs3).length > 0) {
      const list: StepIssue[] = [];
      if (errs3.questions) {
        list.push({
          field: 'Curated Questions',
          message: errs3.questions,
          targetId: 'exam-wizard-new-qtext',
          step: 3,
        });
      }
      groups.push({ step: 3, stepName: 'Step 3: Questions & CSV', errors: list });
    }

    if (groups.length > 0) {
      setTouched({
        title: true,
        description: true,
        durationMinutes: true,
        startWindow: true,
        endWindow: true,
        minTrustScore: true,
        questions: true,
      });
      setPublishErrors(groups);
      setShowPublishModal(true);
      return;
    }

    saveExamMutation.mutate({ isPublished: true });
  };

  const jumpToField = (step: 1 | 2 | 3, targetId: string) => {
    setShowPublishModal(false);
    setCurrentStep(step);
    setTimeout(() => {
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.focus();
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Live "Danger Zone" Calculations based on minTrustScore
  const maxTabSwitchesBeforeTermination = Math.max(1, Math.floor((100 - minTrustScore) / 15));
  const maxDevToolsBeforeTermination = Math.max(0, Math.floor((100 - minTrustScore) / 50));
  const maxNoFaceBeforeTermination = Math.max(1, Math.floor((100 - minTrustScore) / 20));

  const handleSafeClose = () => {
    const isDirty = Boolean(title.trim() || description.trim() || questions.length > 0);
    if (isDirty) {
      if (window.confirm('Discard unsaved exam changes?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleSafeClose}
        size="xl"
        className="max-w-3xl"
        bodyClassName="p-0"
        showCloseButton={false}
        header={
          <div className="p-5 sm:p-6 pb-0">
            {/* Wizard Header + Stepper Progress */}
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand" />
                  <span>{editingExam ? 'Modify Assessment Specification' : 'Architect New Examination'}</span>
                </h3>
                <p className="text-xs font-mono text-muted-foreground">
                  Multi-step configuration wizard with live threshold integrity bounds
                </p>
              </div>
              <button
                type="button"
                onClick={handleSafeClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Animated Stepper Tabs */}
            <div className="grid grid-cols-3 gap-2 border-b border-border/50 py-3 font-mono text-xs">
              {[
                { step: 1, label: '1. Exam Details', isValid: isStep1Valid },
                { step: 2, label: '2. Windows & Threshold', isValid: isStep2Valid },
                { step: 3, label: '3. Questions & CSV', isValid: isStep3Valid },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => handleStepClick(s.step as 1 | 2 | 3)}
                  className={`rounded-xl py-2 px-3 text-center transition-all cursor-pointer ${
                    currentStep === s.step
                      ? 'bg-brand text-white font-medium shadow-sm'
                      : currentStep > s.step && s.isValid
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/30'
                      : 'bg-surface-elevated text-muted-foreground border border-border hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div>
              {currentStep > 1 && (
                <NeonButton
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setCurrentStep((c) => (c - 1) as 1 | 2 | 3)}
                >
                  Back
                </NeonButton>
              )}
            </div>

            <div className="flex items-center gap-2">
              <NeonButton
                variant="secondary"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
                isLoading={saveExamMutation.isPending}
                onClick={handleSaveDraft}
              >
                Save as draft
              </NeonButton>

              {currentStep < 3 ? (
                <NeonButton
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={handleContinue}
                >
                  Continue
                </NeonButton>
              ) : (
                <NeonButton
                  variant="success"
                  size="md"
                  isLoading={saveExamMutation.isPending}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handlePublishClick}
                >
                  {editingExam ? 'Save & Deploy Specifications' : 'Publish & Finalize Assessment'}
                </NeonButton>
              )}
            </div>
          </div>
        }
      >
        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 scrollbar-thin">
          {/* ================================================================ */}
          {/* STEP 1: EXAM DETAILS */}
          {/* ================================================================ */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="exam-wizard-title"
                  className="block text-xs font-mono text-foreground font-semibold mb-1"
                >
                  EXAMINATION TITLE *
                </label>
                <input
                  id="exam-wizard-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, title: true }))}
                  aria-invalid={Boolean(touched.title && step1Errors.title)}
                  placeholder="e.g. CS-401: Distributed Database Systems & ACID Internals"
                  className={`w-full rounded-xl border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-mono transition-colors ${
                    touched.title && step1Errors.title
                      ? 'border-rose-500 ring-1 ring-rose-500/40 focus:border-rose-500'
                      : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
                  }`}
                />
                {touched.title && step1Errors.title && (
                  <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                    <span>{step1Errors.title}</span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="exam-wizard-description"
                    className="block text-xs font-mono text-foreground font-semibold"
                  >
                    SYLLABUS & INSTRUCTIONS *
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      description.trim().length >= 20 ? 'text-emerald-500' : 'text-muted-foreground'
                    }`}
                  >
                    {description.trim().length}/20 chars min
                  </span>
                </div>
                <textarea
                  id="exam-wizard-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, description: true }))}
                  aria-invalid={Boolean(touched.description && step1Errors.description)}
                  rows={3}
                  placeholder="Comprehensive exam scope, proctoring guidelines, and allowed scratchpad policies..."
                  className={`w-full rounded-xl border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none font-mono transition-colors ${
                    touched.description && step1Errors.description
                      ? 'border-rose-500 ring-1 ring-rose-500/40 focus:border-rose-500'
                      : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
                  }`}
                />
                {touched.description && step1Errors.description && (
                  <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                    <span>{step1Errors.description}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="exam-wizard-duration"
                  className="block text-xs font-mono text-foreground font-semibold mb-1"
                >
                  DURATION (MINUTES) *
                </label>
                <input
                  id="exam-wizard-duration"
                  type="number"
                  min={1}
                  max={600}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  onBlur={() => setTouched((prev) => ({ ...prev, durationMinutes: true }))}
                  aria-invalid={Boolean(touched.durationMinutes && step1Errors.durationMinutes)}
                  className={`w-full sm:w-48 rounded-xl border bg-background p-3 text-sm text-foreground focus:outline-none font-mono transition-colors ${
                    touched.durationMinutes && step1Errors.durationMinutes
                      ? 'border-rose-500 ring-1 ring-rose-500/40 focus:border-rose-500'
                      : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
                  }`}
                />
                {touched.durationMinutes && step1Errors.durationMinutes && (
                  <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                    <span>{step1Errors.durationMinutes}</span>
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: SCHEDULE WINDOWS & THRESHOLD SLIDER */}
          {/* ================================================================ */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="exam-wizard-start-window"
                    className="block text-xs font-mono text-foreground font-semibold mb-1"
                  >
                    START WINDOW (CANDIDATES MAY ENTER) *
                  </label>
                  <input
                    id="exam-wizard-start-window"
                    type="datetime-local"
                    value={startWindow}
                    onChange={(e) => setStartWindow(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, startWindow: true }))}
                    aria-invalid={Boolean(touched.startWindow && step2Errors.startWindow)}
                    className={`w-full rounded-xl border bg-background p-3 text-xs text-foreground focus:outline-none font-mono transition-colors ${
                      touched.startWindow && step2Errors.startWindow
                        ? 'border-rose-500 ring-1 ring-rose-500/40 focus:border-rose-500'
                        : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
                    }`}
                  />
                  {touched.startWindow && step2Errors.startWindow && (
                    <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                      <span>{step2Errors.startWindow}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="exam-wizard-end-window"
                    className="block text-xs font-mono text-foreground font-semibold mb-1"
                  >
                    END WINDOW (SESSION CUTOFF) *
                  </label>
                  <input
                    id="exam-wizard-end-window"
                    type="datetime-local"
                    value={endWindow}
                    onChange={(e) => setEndWindow(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, endWindow: true }))}
                    aria-invalid={Boolean(touched.endWindow && step2Errors.endWindow)}
                    className={`w-full rounded-xl border bg-background p-3 text-xs text-foreground focus:outline-none font-mono transition-colors ${
                      touched.endWindow && step2Errors.endWindow
                        ? 'border-rose-500 ring-1 ring-rose-500/40 focus:border-rose-500'
                        : 'border-border focus:border-brand focus:ring-1 focus:ring-brand'
                    }`}
                  />
                  {touched.endWindow && step2Errors.endWindow && (
                    <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                      <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                      <span>{step2Errors.endWindow}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Threshold Slider with Live Danger Zone Preview */}
              <div className="rounded-2xl border border-border bg-surface-elevated/70 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <span>Minimum Authoritative Trust Score: {minTrustScore}% *</span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Crossing below this score triggers instant termination via{' '}
                      <code className="text-rose-500 font-mono">trg_after_violation_insert</code>.
                    </p>
                  </div>
                  <span className="font-mono text-xl font-extrabold text-rose-500 tabular-nums">
                    {minTrustScore}%
                  </span>
                </div>

                <input
                  id="exam-wizard-trust-score"
                  type="range"
                  min={30}
                  max={85}
                  step={5}
                  value={minTrustScore}
                  onChange={(e) => setMinTrustScore(Number(e.target.value))}
                  className="w-full accent-rose-500 h-2 bg-muted rounded-lg cursor-pointer"
                />

                {/* Live "Danger Zone" Visualizer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-rose-500 font-semibold">
                      Danger Zone: 0% to {minTrustScore - 1}% (Auto-Disqualification)
                    </span>
                    <span className="text-emerald-500 font-semibold">
                      Safe Zone: {minTrustScore}% to 100%
                    </span>
                  </div>

                  <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${minTrustScore}%` }}
                      className="bg-gradient-to-r from-rose-600 to-rose-500 flex items-center justify-center text-[9px] font-mono font-bold text-white"
                    >
                      TERMINATE
                    </div>
                    <div
                      style={{ width: `${100 - minTrustScore}%` }}
                      className="bg-gradient-to-r from-amber-500 to-emerald-500 flex items-center justify-center text-[9px] font-mono font-bold text-white"
                    >
                      SAFE
                    </div>
                  </div>
                </div>

                {/* Live Simulation Infraction Calculation */}
                <div className="rounded-xl border border-border bg-background/70 p-3 text-xs font-mono space-y-1 text-muted-foreground">
                  <p className="text-brand font-bold">Rule Calibration Consequences:</p>
                  <p>
                    • A candidate is disqualified after{' '}
                    <strong className="text-foreground">{maxTabSwitchesBeforeTermination + 1}</strong> Tab Switches (-15 pts each).
                  </p>
                  <p>
                    • A candidate is disqualified after{' '}
                    <strong className="text-foreground">{maxNoFaceBeforeTermination + 1}</strong> No-Face incidents (-20 pts each).
                  </p>
                  <p>
                    • A candidate is disqualified after{' '}
                    <strong className="text-foreground">{maxDevToolsBeforeTermination + 1}</strong> DevTools Inspection (-50 pts each).
                  </p>
                </div>
              </div>

              {/* Max Extra Time Configuration */}
              <div className="rounded-2xl border border-border bg-surface-elevated/70 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand" />
                      <span>Max Extra Time Allowed (Minutes)</span>
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Maximum extra duration students can request when their exam time expires. Set to 0 to disable extensions.
                    </p>
                  </div>
                  <span className="font-mono text-xl font-extrabold text-brand tabular-nums">
                    {maxExtensionMins === 0 ? 'Disabled' : `${maxExtensionMins}m`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {[0, 15, 30, 60].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setMaxExtensionMins(preset);
                        setTouched((prev) => ({ ...prev, maxExtensionMins: true }));
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                        maxExtensionMins === preset
                          ? 'bg-brand text-brand-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {preset === 0 ? '0m (Disabled)' : `${preset}m`}
                    </button>
                  ))}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs font-mono text-muted-foreground">Custom:</span>
                    <input
                      id="exam-wizard-max-extension"
                      type="number"
                      min={0}
                      max={120}
                      value={maxExtensionMins}
                      onChange={(e) => {
                        setMaxExtensionMins(Number(e.target.value));
                        setTouched((prev) => ({ ...prev, maxExtensionMins: true }));
                      }}
                      className="w-20 rounded-lg border border-border bg-background p-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
                {touched.maxExtensionMins && step2Errors.maxExtensionMins && (
                  <p className="text-xs font-mono text-rose-500 mt-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 inline shrink-0" />
                    <span>{step2Errors.maxExtensionMins}</span>
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP 3: QUESTIONS & BULK CSV IMPORT */}
          {/* ================================================================ */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand" />
                    <span>Curated Questions ({questions.length} Staged)</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Draft questions manually or bulk-import via CSV
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <NeonButton
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                    onClick={() => {
                      setCsvMode(!csvMode);
                      setParsedRows([]);
                      setCsvError(null);
                    }}
                  >
                    {csvMode ? 'Back to Manual Form' : 'Bulk CSV Import'}
                  </NeonButton>
                </div>
              </div>

              {/* BULK CSV IMPORT PANEL */}
              {csvMode ? (
                <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-4 font-mono text-xs">
                  {/* CSV Sub-Tabs & Template Link */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                    <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border">
                      <button
                        type="button"
                        onClick={() => {
                          setCsvTab('paste');
                          setParsedRows([]);
                          setCsvError(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          csvTab === 'paste'
                            ? 'bg-brand text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        PASTE CSV DATA
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCsvTab('upload');
                          setParsedRows([]);
                          setCsvError(null);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          csvTab === 'upload'
                            ? 'bg-brand text-white shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        UPLOAD CSV FILE
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {csvTab === 'paste' && (
                        <button
                          type="button"
                          onClick={() =>
                            setCsvText(
                              `question_text,option_a,option_b,option_c,option_d,correct_option,marks\n` +
                              `"What does the ACID acronym stand for?","Atomicity Consistency Isolation Durability","Automated Centralized Integrated Data","Array Cluster Index Database","Access Control Identity Domain","A",2\n` +
                              `"Which isolation level prevents dirty reads but allows phantom reads?","READ UNCOMMITTED","READ COMMITTED","REPEATABLE READ","SERIALIZABLE","B",2`
                            )
                          }
                          className="text-[11px] text-brand hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Insert Example CSV</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="text-[11px] text-muted-foreground hover:text-brand hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download template</span>
                      </button>
                    </div>
                  </div>

                  {/* TAB 1: PASTE CSV */}
                  {csvTab === 'paste' && parsedRows.length === 0 && (
                    <div className="space-y-3">
                      <textarea
                        value={csvText}
                        onChange={(e) => setCsvText(e.target.value)}
                        rows={6}
                        placeholder={`question_text,option_a,option_b,option_c,option_d,correct_option,marks\n"What is ACID atomicity?","All operations succeed or all fail","Automatic concurrency","Any database engine","Asynchronous replication","A",2`}
                        className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <NeonButton variant="ghost" size="sm" onClick={() => setCsvMode(false)}>
                          Cancel
                        </NeonButton>
                        <NeonButton
                          variant="primary"
                          size="sm"
                          leftIcon={<Upload className="w-4 h-4" />}
                          onClick={handleParseCsv}
                        >
                          Parse & Stage Questions
                        </NeonButton>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: UPLOAD CSV FILE */}
                  {csvTab === 'upload' && parsedRows.length === 0 && (
                    <div className="space-y-3">
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleFileDrop}
                        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                          isDragging
                            ? 'border-brand bg-brand/10'
                            : 'border-border bg-background/50 hover:border-brand/40'
                        }`}
                      >
                        <Upload className="w-8 h-8 text-brand mx-auto mb-2 opacity-80" />
                        <p className="text-sm font-semibold text-foreground mb-1">
                          Drag and drop your .csv file here
                        </p>
                        <p className="text-[11px] text-muted-foreground mb-3">
                          Supports RFC 4180 format, comma or semicolon delimiters (max 2MB)
                        </p>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={handleFileInputChange}
                          className="hidden"
                        />

                        <NeonButton
                          variant="secondary"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Choose .csv file from your computer
                        </NeonButton>

                        {csvFile && (
                          <div className="mt-3 text-xs font-mono text-emerald-500 font-semibold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2">
                        <NeonButton variant="ghost" size="sm" onClick={() => setCsvMode(false)}>
                          Cancel
                        </NeonButton>
                        <NeonButton
                          variant="primary"
                          size="sm"
                          disabled={!csvFile}
                          leftIcon={<Upload className="w-4 h-4" />}
                          onClick={handleParseCsv}
                        >
                          Parse & Stage Questions
                        </NeonButton>
                      </div>
                    </div>
                  )}

                  {/* CSV ERROR MESSAGE */}
                  {csvError && (
                    <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{csvError}</span>
                    </div>
                  )}

                  {/* CSV PREVIEW TABLE */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-3">
                      {/* Summary Strip */}
                      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-background border border-border">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          {parsedRows.filter((r) => !r.isValid).length === 0 ? (
                            <span className="text-emerald-500 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{parsedRows.length} valid, 0 invalid rows found</span>
                            </span>
                          ) : (
                            <span className="text-amber-500 font-semibold flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              <span>
                                {parsedRows.filter((r) => r.isValid).length} valid,{' '}
                                {parsedRows.filter((r) => !r.isValid).length} invalid rows found — only valid rows will be imported
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <NeonButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setParsedRows([]);
                              setCsvError(null);
                            }}
                          >
                            Cancel / Re-upload
                          </NeonButton>
                          <NeonButton
                            variant="success"
                            size="sm"
                            disabled={parsedRows.filter((r) => r.isValid).length === 0}
                            leftIcon={<CheckCircle2 className="w-4 h-4" />}
                            onClick={handleImportValidRows}
                          >
                            Import {parsedRows.filter((r) => r.isValid).length} Valid{' '}
                            {parsedRows.filter((r) => r.isValid).length === 1 ? 'Row' : 'Rows'}
                          </NeonButton>
                        </div>
                      </div>

                      {/* Scrollable Table */}
                      <div className="max-h-60 overflow-y-auto rounded-xl border border-border/80 overflow-x-auto scrollbar-thin">
                        <table className="w-full text-left text-xs font-mono">
                          <thead className="bg-surface sticky top-0 border-b border-border text-[11px] text-muted-foreground uppercase">
                            <tr>
                              <th className="p-2.5">#</th>
                              <th className="p-2.5">Question Prompt</th>
                              <th className="p-2.5">Option A</th>
                              <th className="p-2.5">Option B</th>
                              <th className="p-2.5">Correct</th>
                              <th className="p-2.5">Marks</th>
                              <th className="p-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {parsedRows.map((row) => (
                              <tr
                                key={row.rowNumber}
                                className={row.isValid ? 'hover:bg-muted/40' : 'bg-rose-500/5 hover:bg-rose-500/10'}
                              >
                                <td className="p-2.5 font-bold text-muted-foreground">{row.rowNumber}</td>
                                <td className="p-2.5 max-w-[200px] truncate text-foreground" title={row.questionText}>
                                  {row.questionText || <span className="text-rose-500 italic">[Empty]</span>}
                                </td>
                                <td className="p-2.5 max-w-[120px] truncate text-muted-foreground" title={row.optionA}>
                                  {row.optionA || <span className="text-rose-500 italic">[Empty]</span>}
                                </td>
                                <td className="p-2.5 max-w-[120px] truncate text-muted-foreground" title={row.optionB}>
                                  {row.optionB || <span className="text-rose-500 italic">[Empty]</span>}
                                </td>
                                <td className="p-2.5">
                                  <span className="font-bold text-emerald-500 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                    {row.correctOption}
                                  </span>
                                </td>
                                <td className="p-2.5 text-muted-foreground">{row.marks}</td>
                                <td className="p-2.5">
                                  {row.isValid ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Valid
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] text-rose-500 font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30"
                                      title={row.errorReason}
                                    >
                                      <AlertCircle className="w-3 h-3" />
                                      {row.errorReason}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MANUAL QUESTION ADD FORM */
                <div className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-3">
                  <input
                    id="exam-wizard-new-qtext"
                    type="text"
                    value={newQText}
                    onChange={(e) => setNewQText(e.target.value)}
                    placeholder="Question prompt..."
                    className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none font-mono"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newOptA}
                      onChange={(e) => setNewOptA(e.target.value)}
                      placeholder="Option A *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newOptB}
                      onChange={(e) => setNewOptB(e.target.value)}
                      placeholder="Option B *"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newOptC}
                      onChange={(e) => setNewOptC(e.target.value)}
                      placeholder="Option C"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-brand focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newOptD}
                      onChange={(e) => setNewOptD(e.target.value)}
                      placeholder="Option D"
                      className="rounded-lg border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-brand focus:outline-none"
                    />
                  </div>

                  {newQError && (
                    <p className="text-xs font-mono text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{newQError}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground">Correct Option:</span>
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                        <label key={opt} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={newCorrect === opt}
                            onChange={() => setNewCorrect(opt)}
                            className="accent-brand"
                          />
                          <span className="text-foreground font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">Marks:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={newMarks}
                        onChange={(e) => setNewMarks(Number(e.target.value))}
                        className="w-14 rounded border border-border bg-background p-1 text-center text-xs text-foreground font-mono focus:border-brand focus:outline-none"
                      />
                      <NeonButton
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                        onClick={handleAddQuestion}
                      >
                        Add
                      </NeonButton>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGED QUESTIONS LIST */}
              {questions.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-3 text-xs font-mono"
                    >
                      <div className="min-w-0 flex-1 pr-3 truncate">
                        <span className="font-bold text-brand mr-2">Q{idx + 1}.</span>
                        <span className="text-foreground truncate">{q.questionText}</span>
                        <div className="text-[10px] text-muted-foreground">
                          Answer: <strong className="text-emerald-500">{q.correctOption}</strong> ({q.marks} pts)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-muted-foreground hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </Modal>

      {/* "BEFORE YOU CAN PUBLISH" REVIEW MODAL */}
      <Modal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        size="lg"
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">Before you can publish</h4>
              <p className="text-xs font-mono text-muted-foreground">
                The following required specifications must be completed before deploying:
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <NeonButton variant="secondary" size="sm" onClick={() => setShowPublishModal(false)}>
              Close
            </NeonButton>
            {publishErrors.length > 0 && publishErrors[0].errors.length > 0 && (
              <NeonButton
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() =>
                  jumpToField(
                    publishErrors[0].errors[0].step,
                    publishErrors[0].errors[0].targetId
                  )
                }
              >
                Fix First Issue
              </NeonButton>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {publishErrors.map((group) => (
            <div
              key={group.step}
              className="rounded-2xl border border-border bg-surface-elevated/70 p-4 space-y-2.5"
            >
              <h5 className="text-xs font-mono font-bold text-brand uppercase tracking-wider">
                {group.stepName}
              </h5>
              <div className="space-y-1.5">
                {group.errors.map((issue, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => jumpToField(issue.step, issue.targetId)}
                    className="w-full text-left p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 transition-colors flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="text-xs font-mono text-foreground">
                        <strong className="text-rose-500 mr-1.5">{issue.field}:</strong>
                        {issue.message}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-brand group-hover:underline shrink-0 flex items-center gap-1">
                      Fix field <ArrowRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
