import crypto from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { AnswerOption } from '../types/api.js';

export interface GeneratedPaper {
  paper_code: string;
  question_order: number[];
  option_maps: Record<string, AnswerOption[]>;
  paper_hash: string;
}

export interface PermutationNotice {
  questionCount: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxUniquePapers: number;
  isSmallExam: boolean;
  notice: string | null;
}

const ALL_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D'];

/**
 * Performs a cryptographically random Fisher-Yates shuffle.
 */
export function cryptoShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}

/**
 * Computes factorial n! safely.
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
    // Cap to safe integer
    if (res > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  }
  return res;
}

/**
 * Calculates the total unique paper permutations possible for an assessment.
 */
export function calculateExamPermutations(
  questionCount: number,
  shuffleQuestions = true,
  shuffleOptions = true
): PermutationNotice {
  if (questionCount <= 0) {
    return {
      questionCount: 0,
      shuffleQuestions,
      shuffleOptions,
      maxUniquePapers: 1,
      isSmallExam: true,
      notice: 'Only 1 unique paper possible for 0 questions',
    };
  }

  const qPerms = shuffleQuestions ? factorial(questionCount) : 1;
  // 4! = 24 permutations per question
  let optPerms = 1;
  if (shuffleOptions) {
    for (let i = 0; i < questionCount; i++) {
      optPerms *= 24;
      if (optPerms > Number.MAX_SAFE_INTEGER) {
        optPerms = Number.MAX_SAFE_INTEGER;
        break;
      }
    }
  }

  const total = Math.min(Number.MAX_SAFE_INTEGER, qPerms * optPerms);
  // Deemed small if total permutations < 1000 (e.g. 1 or 2 questions with options unshuffled)
  const isSmallExam = total < 1000;
  const notice = isSmallExam
    ? `Only ${total.toLocaleString()} unique ${total === 1 ? 'paper' : 'papers'} possible for ${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`
    : null;

  return {
    questionCount,
    shuffleQuestions,
    shuffleOptions,
    maxUniquePapers: total,
    isSmallExam,
    notice,
  };
}

/**
 * Generates an uppercase 4-character alphanumeric paper code (e.g. "7F3K" displayed as "Paper 7F3K").
 */
export function generatePaperCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 unambiguous set
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return `Paper ${code}`;
}

/**
 * Computes a deterministic SHA-256 hash of question order and option maps.
 */
export function hashPaper(
  questionOrder: number[],
  optionMaps: Record<string, AnswerOption[]>,
  salt = ''
): string {
  const canonical = JSON.stringify({
    question_order: questionOrder,
    option_maps: optionMaps,
    salt,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Generates a unique paper configuration for a new exam session, ensuring
 * that two candidates on the same assessment never get the exact same paper.
 * If the permutation space is small and exhausted, falls back with best effort.
 */
export async function generateUniquePaperForExam(
  conn: PoolConnection,
  examId: number,
  shuffleQuestions = true,
  shuffleOptions = true
): Promise<GeneratedPaper> {
  const [questionRows] = await conn.execute<RowDataPacket[]>(
    'SELECT id, order_index FROM Questions WHERE exam_id = ? ORDER BY order_index ASC, id ASC',
    [examId]
  );

  const rawQuestionIds: number[] = questionRows.map((q) => Number(q.id));

  if (rawQuestionIds.length === 0) {
    const code = generatePaperCode();
    const hash = hashPaper([], {});
    return {
      paper_code: code,
      question_order: [],
      option_maps: {},
      paper_hash: hash,
    };
  }

  // Retry loop: up to 20 attempts to find an unallocated paper permutation
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const qOrder = shuffleQuestions ? cryptoShuffle(rawQuestionIds) : [...rawQuestionIds];
    const oMaps: Record<string, AnswerOption[]> = {};

    for (const qId of qOrder) {
      oMaps[String(qId)] = shuffleOptions ? cryptoShuffle(ALL_OPTIONS) : [...ALL_OPTIONS];
    }

    const paperHash = hashPaper(qOrder, oMaps);
    const paperCode = generatePaperCode();

    // Check collision against existing sessions on this exam
    const [dupRows] = await conn.execute<RowDataPacket[]>(
      'SELECT id FROM Exam_Sessions WHERE exam_id = ? AND paper_hash = ? LIMIT 1',
      [examId, paperHash]
    );

    if (dupRows.length === 0) {
      return {
        paper_code: paperCode,
        question_order: qOrder,
        option_maps: oMaps,
        paper_hash: paperHash,
      };
    }
  }

  // If 20 attempts all collided (e.g. 1 question unshuffled with only 1 possible permutation),
  // assign best-effort permutation with a collision discriminator to preserve DB uniqueness constraint.
  console.warn(
    `[PaperGenerator] Permutation space exhausted for exam #${examId} after 20 attempts. Assigning best-effort paper.`
  );

  const fallbackOrder = shuffleQuestions ? cryptoShuffle(rawQuestionIds) : [...rawQuestionIds];
  const fallbackMaps: Record<string, AnswerOption[]> = {};
  for (const qId of fallbackOrder) {
    fallbackMaps[String(qId)] = shuffleOptions ? cryptoShuffle(ALL_OPTIONS) : [...ALL_OPTIONS];
  }

  const disambiguator = crypto.randomBytes(6).toString('hex');
  const fallbackHash = hashPaper(fallbackOrder, fallbackMaps, disambiguator);
  const fallbackCode = generatePaperCode();

  return {
    paper_code: fallbackCode,
    question_order: fallbackOrder,
    option_maps: fallbackMaps,
    paper_hash: fallbackHash,
  };
}

/**
 * Maps question options from canonical DB layout into student's displayed layout.
 * Removes correct_option and never leaks option mapping.
 */
export function mapQuestionForStudent<T extends {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number | string;
  order_index?: number;
  correct_option?: unknown;
}>(question: T, optionMap?: AnswerOption[], displayIndex?: number) {
  const orig: Record<AnswerOption, string> = {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d,
  };

  const map = optionMap && optionMap.length === 4 ? optionMap : ALL_OPTIONS;

  // Clone and exclude correct_option
  const { correct_option: _stripCorrect, ...rest } = question;
  void _stripCorrect;

  return {
    ...rest,
    option_a: orig[map[0]],
    option_b: orig[map[1]],
    option_c: orig[map[2]],
    option_d: orig[map[3]],
    order_index: displayIndex !== undefined ? displayIndex : question.order_index,
  };
}

/**
 * Maps student's chosen DISPLAYED option letter ('A'..'D') back to the ORIGINAL database letter.
 */
export function mapDisplayedToOriginalAnswer(
  displayedOption: string,
  optionMap?: AnswerOption[]
): AnswerOption {
  const upper = displayedOption.trim().toUpperCase() as AnswerOption;
  if (!ALL_OPTIONS.includes(upper)) {
    throw new Error(`Invalid option letter: ${displayedOption}`);
  }

  const map = optionMap && optionMap.length === 4 ? optionMap : ALL_OPTIONS;
  const idx = ALL_OPTIONS.indexOf(upper);
  return map[idx];
}

/**
 * Maps the ORIGINAL database stored letter back to the student's DISPLAYED option letter.
 */
export function mapOriginalToDisplayedAnswer(
  storedOption: string,
  optionMap?: AnswerOption[]
): AnswerOption {
  const upper = storedOption.trim().toUpperCase() as AnswerOption;
  if (!ALL_OPTIONS.includes(upper)) {
    return 'A';
  }

  const map = optionMap && optionMap.length === 4 ? optionMap : ALL_OPTIONS;
  const idx = map.indexOf(upper);
  if (idx === -1) return upper;
  return ALL_OPTIONS[idx];
}
