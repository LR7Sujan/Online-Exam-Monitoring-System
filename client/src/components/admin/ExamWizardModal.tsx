import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { NeonButton } from '../ui/NeonButton';
import { api } from '../../lib/api';
import type { AnswerOption, ExamItem } from '../../types/domain';

interface ExamWizardModalProps {
  isOpen: boolean;
  editingExam?: ExamItem | null;
  onClose: () => void;
  onSuccess: (exam: ExamItem) => void;
}

interface QuestionDraft {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: AnswerOption;
  marks: number;
}

export function ExamWizardModal({
  isOpen,
  editingExam,
  onClose,
  onSuccess,
}: ExamWizardModalProps) {
  const queryClient = useQueryClient();
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

  // Step 3: Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [csvText, setCsvText] = useState('');
  const [csvMode, setCsvMode] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // New Question Form state
  const [newQText, setNewQText] = useState('');
  const [newOptA, setNewOptA] = useState('');
  const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState('');
  const [newOptD, setNewOptD] = useState('');
  const [newCorrect, setNewCorrect] = useState<AnswerOption>('A');
  const [newMarks, setNewMarks] = useState(2);

  // Save Exam Mutation
  const saveExamMutation = useMutation({
    mutationFn: async () => {
      let savedExam: ExamItem;
      const payload = {
        title,
        description,
        durationMinutes: Number(durationMinutes),
        minTrustScore: Number(minTrustScore),
        startWindow: new Date(startWindow).toISOString(),
        endWindow: new Date(endWindow).toISOString(),
        isPublished: true,
      };

      if (editingExam) {
        savedExam = await api.patch<ExamItem>(`/exams/${editingExam.id}`, payload);
      } else {
        savedExam = await api.post<ExamItem>('/exams', payload);
      }

      // If new questions exist, save them via bulk endpoint
      if (questions.length > 0) {
        await api.post(`/exams/${savedExam.id}/questions/bulk`, {
          questions: questions.map((q) => ({
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            marks: q.marks,
          })),
        });
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
    if (!newQText.trim() || !newOptA.trim() || !newOptB.trim()) return;
    setQuestions((prev) => [
      ...prev,
      {
        questionText: newQText,
        optionA: newOptA,
        optionB: newOptB,
        optionC: newOptC || 'N/A',
        optionD: newOptD || 'N/A',
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
  };

  // Parse CSV Import
  const handleParseCsv = () => {
    setCsvError(null);
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length === 0) return;

      const parsed: QuestionDraft[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || (i === 0 && line.toLowerCase().includes('question_text'))) continue;

        // Simple CSV splitter handling quotes
        const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length >= 6) {
          const opt = parts[5].toUpperCase() as AnswerOption;
          const validOpt = ['A', 'B', 'C', 'D'].includes(opt) ? opt : 'A';
          parsed.push({
            questionText: parts[0],
            optionA: parts[1],
            optionB: parts[2],
            optionC: parts[3] || 'N/A',
            optionD: parts[4] || 'N/A',
            correctOption: validOpt,
            marks: parts[6] ? Number(parts[6]) || 1 : 1,
          });
        }
      }

      if (parsed.length === 0) {
        setCsvError('No valid question rows found. Ensure CSV has: question_text, optA, optB, optC, optD, correct_opt (A/B/C/D), marks');
        return;
      }

      setQuestions((prev) => [...prev, ...parsed]);
      setCsvText('');
      setCsvMode(false);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    }
  };

  // Live "Danger Zone" Calculations based on minTrustScore
  const maxTabSwitchesBeforeTermination = Math.max(1, Math.floor((100 - minTrustScore) / 15));
  const maxDevToolsBeforeTermination = Math.max(0, Math.floor((100 - minTrustScore) / 50));
  const maxNoFaceBeforeTermination = Math.max(1, Math.floor((100 - minTrustScore) / 20));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#05060E]/85 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0C0E1C] p-6 sm:p-7 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Wizard Header + Stepper Progress */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan" />
              <span>{editingExam ? 'Modify Assessment Specification' : 'Architect New Examination'}</span>
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Multi-step configuration wizard with live threshold integrity bounds
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Animated Stepper Tabs */}
        <div className="grid grid-cols-3 gap-2 border-b border-white/5 py-3 font-mono text-xs">
          {[
            { step: 1, label: '1. Exam Details' },
            { step: 2, label: '2. Windows & Threshold' },
            { step: 3, label: '3. Questions & CSV' },
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => setCurrentStep(s.step as 1 | 2 | 3)}
              className={`rounded-xl py-2 px-3 text-center transition-all ${
                currentStep === s.step
                  ? 'bg-cyan text-void font-bold shadow-glow-cyan-sm'
                  : currentStep > s.step
                  ? 'bg-emerald/15 text-emerald font-semibold border border-emerald/30'
                  : 'bg-white/5 text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Wizard Step Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 scrollbar-thin scrollbar-thumb-white/10">
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
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
                  EXAMINATION TITLE *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CS-401: Distributed Database Systems & ACID Internals"
                  className="w-full rounded-xl border border-white/10 bg-[#070812] p-3 text-sm text-white placeholder-slate-500 focus:border-cyan focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
                  SYLLABUS & INSTRUCTIONS
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Comprehensive exam scope, proctoring guidelines, and allowed scratchpad policies..."
                  className="w-full rounded-xl border border-white/10 bg-[#070812] p-3 text-xs text-white placeholder-slate-500 focus:border-cyan focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
                  DURATION (MINUTES) *
                </label>
                <input
                  type="number"
                  min={10}
                  max={360}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full sm:w-48 rounded-xl border border-white/10 bg-[#070812] p-3 text-sm text-white focus:border-cyan focus:outline-none font-mono"
                />
              </div>
            </motion.div>
          )}

          {/* ================================================================ */}
          {/* STEP 2: SCHEDULE WINDOWS & THRESHOLD SLIDER WITH LIVE DANGER ZONE */}
          {/* ================================================================ */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
                    START WINDOW (CANDIDATES MAY ENTER) *
                  </label>
                  <input
                    type="datetime-local"
                    value={startWindow}
                    onChange={(e) => setStartWindow(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#070812] p-3 text-xs text-white focus:border-cyan focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-300 font-semibold mb-1">
                    END WINDOW (SESSION CUTOFF) *
                  </label>
                  <input
                    type="datetime-local"
                    value={endWindow}
                    onChange={(e) => setEndWindow(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#070812] p-3 text-xs text-white focus:border-cyan focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Threshold Slider with Live Danger Zone Preview */}
              <div className="rounded-2xl border border-white/10 bg-[#070814]/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-magenta" />
                      <span>Minimum Authoritative Trust Score: {minTrustScore}%</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Crossing below this score triggers instant termination via <code className="text-magenta">trg_after_violation_insert</code>.
                    </p>
                  </div>
                  <span className="font-mono text-xl font-extrabold text-magenta">
                    {minTrustScore}%
                  </span>
                </div>

                {/* Slider Control */}
                <input
                  type="range"
                  min={30}
                  max={85}
                  step={5}
                  value={minTrustScore}
                  onChange={(e) => setMinTrustScore(Number(e.target.value))}
                  className="w-full accent-magenta h-2 bg-white/10 rounded-lg cursor-pointer"
                />

                {/* Live "Danger Zone" Visualizer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-magenta font-semibold">
                      Danger Zone: 0% to {minTrustScore - 1}% (Auto-Disqualification)
                    </span>
                    <span className="text-emerald font-semibold">
                      Safe Zone: {minTrustScore}% to 100%
                    </span>
                  </div>

                  <div className="h-4 w-full rounded-full bg-white/10 overflow-hidden flex">
                    <div
                      style={{ width: `${minTrustScore}%` }}
                      className="bg-gradient-to-r from-magenta to-rose-600 shadow-glow-magenta-sm flex items-center justify-center text-[9px] font-mono font-bold text-white"
                    >
                      TERMINATE
                    </div>
                    <div
                      style={{ width: `${100 - minTrustScore}%` }}
                      className="bg-gradient-to-r from-amber to-emerald flex items-center justify-center text-[9px] font-mono font-bold text-void"
                    >
                      SAFE
                    </div>
                  </div>
                </div>

                {/* Live Simulation Infraction Calculation */}
                <div className="rounded-xl border border-white/5 bg-black/40 p-3 text-xs font-mono space-y-1 text-slate-300">
                  <p className="text-cyan font-bold">Rule Calibration Consequences:</p>
                  <p>• A candidate is disqualified after <strong className="text-white">{maxTabSwitchesBeforeTermination + 1}</strong> Tab Switches (-15 pts each).</p>
                  <p>• A candidate is disqualified after <strong className="text-white">{maxNoFaceBeforeTermination + 1}</strong> No-Face incidents (-20 pts each).</p>
                  <p>• A candidate is disqualified after <strong className="text-white">{maxDevToolsBeforeTermination + 1}</strong> DevTools Inspection (-50 pts each).</p>
                </div>
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
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan" />
                    <span>Curated Questions ({questions.length} Staged)</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Draft questions or bulk-import via CSV
                  </p>
                </div>

                <NeonButton
                  variant="secondary"
                  size="sm"
                  leftIcon={<FileSpreadsheet className="w-4 h-4" />}
                  onClick={() => setCsvMode(!csvMode)}
                >
                  {csvMode ? 'Back to Manual Form' : 'Bulk CSV Import'}
                </NeonButton>
              </div>

              {/* BULK CSV IMPORT PANEL */}
              {csvMode ? (
                <div className="rounded-2xl border border-cyan/40 bg-[#070914] p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold text-cyan">PASTE CSV DATA</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCsvText(
                          `question_text,option_a,option_b,option_c,option_d,correct_option,marks\n` +
                          `"What does the ACID acronym stand for?","Atomicity Consistency Isolation Durability","Automated Centralized Integrated Data","Array Cluster Index Database","Access Control Identity Domain","A",2\n` +
                          `"Which isolation level prevents dirty reads but allows phantom reads?","READ UNCOMMITTED","READ COMMITTED","REPEATABLE READ","SERIALIZABLE","B",2`
                        )
                      }
                      className="text-[10px] text-cyan hover:underline"
                    >
                      Insert Example CSV
                    </button>
                  </div>

                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    rows={6}
                    placeholder={`question_text,option_a,option_b,option_c,option_d,correct_option,marks\n"Question 1","Option A","Option B","Option C","Option D","A",2`}
                    className="w-full rounded-xl border border-white/10 bg-[#04050A] p-3 text-xs text-white focus:border-cyan focus:outline-none"
                  />

                  {csvError && <p className="text-xs text-magenta">{csvError}</p>}

                  <div className="flex justify-end gap-2">
                    <NeonButton variant="ghost" size="sm" onClick={() => setCsvMode(false)}>
                      Cancel
                    </NeonButton>
                    <NeonButton variant="primary" size="sm" leftIcon={<Upload className="w-4 h-4" />} onClick={handleParseCsv}>
                      Parse & Stage Questions
                    </NeonButton>
                  </div>
                </div>
              ) : (
                /* MANUAL QUESTION ADD FORM */
                <div className="rounded-2xl border border-white/10 bg-[#070814] p-4 space-y-3">
                  <input
                    type="text"
                    value={newQText}
                    onChange={(e) => setNewQText(e.target.value)}
                    placeholder="Question prompt..."
                    className="w-full rounded-xl border border-white/10 bg-[#04050A] p-2.5 text-xs text-white focus:border-cyan focus:outline-none font-mono"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newOptA}
                      onChange={(e) => setNewOptA(e.target.value)}
                      placeholder="Option A *"
                      className="rounded-lg border border-white/10 bg-[#04050A] p-2 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      value={newOptB}
                      onChange={(e) => setNewOptB(e.target.value)}
                      placeholder="Option B *"
                      className="rounded-lg border border-white/10 bg-[#04050A] p-2 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      value={newOptC}
                      onChange={(e) => setNewOptC(e.target.value)}
                      placeholder="Option C"
                      className="rounded-lg border border-white/10 bg-[#04050A] p-2 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      value={newOptD}
                      onChange={(e) => setNewOptD(e.target.value)}
                      placeholder="Option D"
                      className="rounded-lg border border-white/10 bg-[#04050A] p-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-slate-400">Correct Option:</span>
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                        <label key={opt} className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={newCorrect === opt}
                            onChange={() => setNewCorrect(opt)}
                            className="accent-cyan"
                          />
                          <span className="text-white font-bold">{opt}</span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">Marks:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={newMarks}
                        onChange={(e) => setNewMarks(Number(e.target.value))}
                        className="w-14 rounded border border-white/10 bg-[#04050A] p-1 text-center text-xs text-white font-mono"
                      />
                      <NeonButton variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddQuestion}>
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
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-[#090B18] p-3 text-xs font-mono"
                    >
                      <div className="min-w-0 flex-1 pr-3 truncate">
                        <span className="font-bold text-cyan mr-2">Q{idx + 1}.</span>
                        <span className="text-white truncate">{q.questionText}</span>
                        <div className="text-[10px] text-slate-400">
                          Answer: <strong className="text-emerald">{q.correctOption}</strong> ({q.marks} pts)
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 rounded text-slate-400 hover:text-magenta"
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

        {/* Wizard Footer Controls */}
        <div className="border-t border-white/10 pt-4 flex items-center justify-between">
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
            {currentStep < 3 ? (
              <NeonButton
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => setCurrentStep((c) => (c + 1) as 1 | 2 | 3)}
              >
                Continue
              </NeonButton>
            ) : (
              <NeonButton
                variant="success"
                size="md"
                isLoading={saveExamMutation.isPending}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => saveExamMutation.mutate()}
              >
                {editingExam ? 'Save & Deploy Specifications' : 'Publish & Finalize Assessment'}
              </NeonButton>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
