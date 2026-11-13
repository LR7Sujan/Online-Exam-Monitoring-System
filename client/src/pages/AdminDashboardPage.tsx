import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Database,
  GraduationCap,
  Plus,
  Scale,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import { AdminOverviewDashboard } from '../components/admin/AdminOverviewDashboard';
import { ExamWizardModal } from '../components/admin/ExamWizardModal';
import { ViolationRulesManager } from '../components/admin/ViolationRulesManager';
import { UsersManagerTable } from '../components/admin/UsersManagerTable';
import { ResultsAndExportTable } from '../components/admin/ResultsAndExportTable';
import { NeonButton } from '../components/ui/NeonButton';
import { api } from '../lib/api';
import type { DbTelemetry, ExamItem, QuestionItem } from '../types/domain';

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

  // Exam Management States
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

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

  const togglePublishMutation = useMutation({
    mutationFn: (vars: { examId: number; isPublished: boolean }) =>
      api.patch(`/exams/${vars.examId}`, { isPublished: vars.isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exams-overview'] });
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
    <div className="min-h-screen bg-[#070810] text-slate-100 flex flex-col">
      <div className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header & Navigation Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-violet opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet" />
              </span>
              <span className="font-mono text-xs uppercase tracking-widest text-violet-400 font-bold">
                Governance & Intelligence Deck
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Administrator Console
            </h1>
          </div>

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-[#0C0E1C] p-1.5 shadow-lg overflow-x-auto scrollbar-none">
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
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-mono font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-cyan text-void shadow-glow-cyan-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-cyan" />
                  <span>Curated Assessment Directory</span>
                </h3>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Configure assessment windows, duration, questions, and authoritative integrity thresholds
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {exams.map((exam) => {
                const isPublished = Boolean(exam.is_published);
                const isSelected = selectedExamId === exam.id;

                return (
                  <div
                    key={exam.id}
                    className={`rounded-2xl border p-5 backdrop-blur-xl transition-all space-y-4 ${
                      isSelected
                        ? 'border-cyan bg-[#0E122A] shadow-glow-cyan-sm'
                        : 'border-white/10 bg-[#0C0E1C]/90 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] text-cyan font-semibold">
                          EXAM #{exam.id}
                        </span>
                        <h4 className="text-base font-bold text-white truncate" title={exam.title}>
                          {exam.title}
                        </h4>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                          isPublished
                            ? 'bg-emerald/15 text-emerald border border-emerald/30'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        }`}
                      >
                        {isPublished ? 'PUBLISHED' : 'DRAFT'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                      {exam.description || 'No detailed instructions provided.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-b border-white/5 py-2.5 text-slate-300">
                      <div>
                        <span className="text-slate-400 text-[10px]">DURATION:</span>
                        <div className="font-bold text-white">{exam.duration_minutes} mins</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">MIN TRUST:</span>
                        <div className="font-bold text-magenta">{exam.min_trust_score}%</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">QUESTIONS:</span>
                        <div className="font-bold text-cyan">{exam.question_count ?? 20}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">TOTAL MARKS:</span>
                        <div className="font-bold text-emerald">{exam.total_marks ?? 40}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedExamId(isSelected ? null : exam.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all ${
                          isSelected
                            ? 'bg-cyan/20 text-cyan border border-cyan/40'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {isSelected ? 'Close Questions' : 'Inspect Questions'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExam(exam);
                            setWizardOpen(true);
                          }}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            togglePublishMutation.mutate({
                              examId: exam.id,
                              isPublished: !isPublished,
                            })
                          }
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold transition-colors ${
                            isPublished
                              ? 'text-rose-400 hover:bg-rose-500/10'
                              : 'text-emerald hover:bg-emerald/10'
                          }`}
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Questions Inspection Panel */}
            {selectedExamId && selectedExamData && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-cyan/40 bg-[#0C0E1C]/95 p-5 backdrop-blur-xl shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono">
                      Exam Questions: {selectedExamData.exam.title}
                    </h4>
                    <p className="text-xs font-mono text-slate-400">
                      {selectedExamData.questions.length} Questions Configured
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExamId(null)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto scrollbar-thin">
                  {selectedExamData.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-white/5 bg-[#070914] p-3 text-xs font-mono flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-white font-semibold">
                          <span className="text-cyan font-bold mr-2">Q{idx + 1}.</span>
                          {q.question_text}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1">
                          <div className={q.correct_option === 'A' ? 'text-emerald font-bold' : ''}>A: {q.option_a}</div>
                          <div className={q.correct_option === 'B' ? 'text-emerald font-bold' : ''}>B: {q.option_b}</div>
                          <div className={q.correct_option === 'C' ? 'text-emerald font-bold' : ''}>C: {q.option_c}</div>
                          <div className={q.correct_option === 'D' ? 'text-emerald font-bold' : ''}>D: {q.option_d}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded bg-emerald/20 border border-emerald/40 px-2 py-0.5 text-[10px] font-bold text-emerald">
                          Key: {q.correct_option ?? 'N/A'}
                        </span>
                        <span className="text-slate-400 text-[10px]">{q.marks} pts</span>
                        <button
                          type="button"
                          onClick={() =>
                            deleteQuestionMutation.mutate({
                              examId: selectedExamId,
                              questionId: q.id,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-magenta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
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
            <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 backdrop-blur-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan" />
                <span>Authoritative MySQL DBMS Telemetry (Information Schema)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Live introspection of triggers, stored procedures, SQL views, and physical tables
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Triggers */}
              <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 space-y-3">
                <h4 className="font-bold text-cyan text-xs uppercase tracking-wider">
                  Active Database Triggers
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.triggers ?? []).map((t, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-[#070812] p-2.5 flex items-center justify-between">
                      <span className="font-bold text-white">{t.TRIGGER_NAME}</span>
                      <span className="text-[10px] text-magenta font-semibold">
                        {t.ACTION_TIMING} {t.EVENT_MANIPULATION} ON {t.EVENT_OBJECT_TABLE}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stored Procedures */}
              <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 space-y-3">
                <h4 className="font-bold text-violet text-xs uppercase tracking-wider">
                  Transactional Stored Procedures
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.routines ?? []).map((r, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-[#070812] p-2.5 flex items-center justify-between">
                      <span className="font-bold text-white">{r.ROUTINE_NAME}</span>
                      <span className="text-[10px] text-cyan font-semibold">
                        {r.ROUTINE_TYPE}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Views */}
              <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 space-y-3">
                <h4 className="font-bold text-emerald text-xs uppercase tracking-wider">
                  Authoritative SQL Views
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.views ?? []).map((v, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-[#070812] p-2.5 flex items-center justify-between">
                      <span className="font-bold text-white">{v.TABLE_NAME}</span>
                      <span className="text-[10px] text-emerald font-semibold">
                        VIEW (UPDATABLE: {v.IS_UPDATABLE})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tables */}
              <div className="rounded-2xl border border-white/10 bg-[#0C0E1C]/90 p-5 space-y-3">
                <h4 className="font-bold text-amber text-xs uppercase tracking-wider">
                  Physical Storage Tables
                </h4>
                <div className="space-y-2">
                  {(dbTelemetryQuery.data?.tables ?? []).map((tb, idx) => (
                    <div key={idx} className="rounded-xl border border-white/5 bg-[#070812] p-2.5 flex items-center justify-between">
                      <span className="font-bold text-white">{tb.TABLE_NAME}</span>
                      <span className="text-[10px] text-slate-400">
                        ~{tb.TABLE_ROWS} rows ({tb.ENGINE})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}

export default AdminDashboardPage;
