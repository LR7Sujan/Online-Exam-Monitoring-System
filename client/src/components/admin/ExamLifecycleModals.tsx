import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  FileEdit,
  Globe,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { NeonButton } from '../ui/NeonButton';
import { Link } from 'react-router-dom';

// ============================================================================
// 1. UNPUBLISH CONFIRMATION MODAL
// ============================================================================

export interface UnpublishConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: {
    id: number;
    title: string;
    active_sessions?: number;
  } | null;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
}

export function UnpublishConfirmModal({
  isOpen,
  onClose,
  exam,
  onConfirm,
  isLoading = false,
}: UnpublishConfirmModalProps) {
  if (!exam) return null;

  const hasActiveSessions = (exam.active_sessions ?? 0) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2 text-rose-500 font-mono text-sm">
          {hasActiveSessions ? (
            <ShieldAlert className="w-5 h-5 text-rose-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
          <span>{hasActiveSessions ? 'Unpublish Blocked: Active Sessions' : 'Unpublish Examination'}</span>
        </div>
      }
      footer={
        hasActiveSessions ? (
          <div className="flex items-center justify-between w-full">
            <Link
              to="/proctor"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-brand hover:underline"
            >
              <span>View Active Sessions in Live Monitor</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <NeonButton variant="secondary" size="sm" onClick={onClose}>
              Dismiss
            </NeonButton>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2.5 w-full">
            <NeonButton variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </NeonButton>
            <NeonButton
              variant="danger"
              size="sm"
              onClick={onConfirm}
              isLoading={isLoading}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Unpublish Exam
            </NeonButton>
          </div>
        )
      }
    >
      <div className="space-y-4 font-mono text-xs">
        {hasActiveSessions ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
            <p className="text-foreground leading-relaxed">
              Cannot unpublish <strong className="text-rose-400 font-bold">&quot;{exam.title}&quot;</strong>.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              There {exam.active_sessions === 1 ? 'is' : 'are'}{' '}
              <strong className="text-rose-400 font-bold">{exam.active_sessions} student session(s)</strong> currently{' '}
              <span className="text-amber-400 font-bold">IN_PROGRESS</span>. Unpublishing now would disrupt ongoing examinations and terminate student telemetry feeds.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Please wait for all candidates to submit their answers or conclude their sessions before unpublishing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-foreground text-sm leading-relaxed">
              Unpublish <strong className="text-foreground font-bold">&quot;{exam.title}&quot;</strong>?
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Students will no longer see or start this examination. Once unpublished, you will be able to modify assessment parameters and edit the question bank.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================================
// 2. DELETE CONFIRMATION MODAL (WITH TYPED TITLE)
// ============================================================================

export interface DeleteExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: {
    id: number;
    title: string;
    total_sessions?: number;
  } | null;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
}

export function DeleteExamModal({
  isOpen,
  onClose,
  exam,
  onConfirm,
  isLoading = false,
  error,
}: DeleteExamModalProps) {
  const [typedTitle, setTypedTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTypedTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!exam) return null;

  const isConfirmed =
    typedTitle.trim() === exam.title.trim() ||
    typedTitle.trim().toUpperCase() === 'DELETE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div className="flex items-center gap-2 text-rose-500 font-mono text-sm">
          <Trash2 className="w-5 h-5 text-rose-500" />
          <span>Delete Examination Permanently</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <NeonButton variant="secondary" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </NeonButton>
          <NeonButton
            variant="danger"
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
            disabled={!isConfirmed || isLoading}
            leftIcon={<Trash2 className="w-4 h-4" />}
          >
            Delete Permanently
          </NeonButton>
        </div>
      }
    >
      <div className="space-y-4 font-mono text-xs">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 space-y-2">
          <p className="text-foreground leading-relaxed font-semibold">
            This permanently deletes <span className="text-rose-400 font-bold">&quot;{exam.title}&quot;</span> and its questions. This cannot be undone.
          </p>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Note: Examinations with recorded student sessions or audit trails cannot be deleted to preserve DBMS forensic immutability guarantees.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="confirm-delete-input" className="block text-muted-foreground text-xs">
            To confirm, please type <strong className="text-foreground">{exam.title}</strong> (or <strong className="text-foreground">DELETE</strong>) below:
          </label>
          <input
            ref={inputRef}
            id="confirm-delete-input"
            type="text"
            value={typedTitle}
            onChange={(e) => setTypedTitle(e.target.value)}
            placeholder={exam.title}
            className="w-full rounded-xl border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground font-mono focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// 3. STATUS DROPDOWN MENU FOR CARDS & DETAIL PAGE
// ============================================================================

export interface ExamStatusMenuProps {
  exam: {
    id: number;
    title: string;
    is_published: boolean | number;
    description?: string | null;
    duration_minutes?: number;
    start_window?: string;
    end_window?: string;
    min_trust_score?: number;
    question_count?: number;
  };
  onPublish: () => void;
  onUnpublish?: () => void;
  onDelete: () => void;
}

export function ExamStatusMenu({
  exam,
  onPublish,
  onDelete,
}: ExamStatusMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isPublished = Boolean(exam.is_published);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        <Globe className="w-3 h-3" />
        <span>PUBLISHED</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Status menu"
      >
        <FileEdit className="w-3 h-3" />
        <span>DRAFT</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-1.5 z-50 w-48 rounded-xl border border-border bg-surface-elevated/95 backdrop-blur-md p-1 shadow-2xl text-xs font-mono space-y-0.5 focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
            }}
            className="w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Keep as draft</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onPublish();
            }}
            className="w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish</span>
          </button>

          <div className="border-t border-border my-1" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            className="w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete permanently</span>
          </button>
        </div>
      )}
    </div>
  );
}
