import { trackOf } from '../data/chapters';
import { PYQ_BOOK_HINT } from '../data/books';
import type { Chapter, ExamId, TaskKind, Track } from '../types';

/**
 * How much each track leans on NCERT:
 * - maths: not at all; the reference book or coaching module from day one
 * - physics: NCERT only for the first session of a chapter, then the reference book
 * - physical chemistry: a short NCERT skim at the start, then numericals from the book
 * - inorganic, organic chemistry and biology: NCERT line by line throughout
 */
export type Stage = 'intro' | 'theory' | 'exercises';

export interface SourceRef {
  short: string;
  owned: boolean;
}

interface Wording {
  kind: TaskKind;
  title: string;
  detail: string;
}

const NCERT_HEAVY: Track[] = ['inorganic', 'organic', 'biology'];

export function stageFor(track: Track, isFirstSession: boolean, progressAfter: number): Stage {
  if (isFirstSession && (track === 'physics' || track === 'physical')) return 'intro';
  return progressAfter > 0.5 ? 'exercises' : 'theory';
}

function fallback(src: SourceRef, track: Track): string {
  if (src.owned) return '';
  return track === 'maths'
    ? ` No ${src.short} yet? Borrow a senior’s copy or use a library reference book until you get one.`
    : ` No ${src.short} yet? Use NCERT Exemplar problems until you get it.`;
}

export function studyWording(chapter: Chapter, stage: Stage, src: SourceRef): Wording {
  const track = trackOf(chapter);
  const ch = chapter.name;
  const book = src.short;

  if (NCERT_HEAVY.includes(track)) {
    if (stage !== 'exercises') {
      const how =
        track === 'organic'
          ? 'Write every reaction and mechanism into your reaction notebook.'
          : track === 'inorganic'
            ? 'Read every line, table and exception, and note the facts you must remember.'
            : 'Read every line, diagram and table, and highlight facts the exam can ask.';
      return { kind: 'learn', title: `NCERT line by line: ${ch}`, detail: how };
    }
    const mcqs = track === 'biology' ? 'MCQs' : 'questions';
    return {
      kind: 'practice',
      title: `NCERT + ${book}: ${ch}`,
      detail: `Re-read your NCERT notes, do the NCERT exercises, then ${book} ${mcqs} on this chapter.${fallback(src, track)}`,
    };
  }

  if (stage === 'intro') {
    return track === 'physics'
      ? { kind: 'learn', title: `NCERT first read: ${ch}`, detail: `Read the NCERT chapter once for the basic ideas, then start the theory in ${book}.${fallback(src, track)}` }
      : { kind: 'learn', title: `${ch}: NCERT skim, then ${book}`, detail: `Skim the NCERT summary for about 20 minutes, then learn the concepts and formulas from ${book}.${fallback(src, track)}` };
  }
  if (stage === 'theory') {
    const how = track === 'maths' ? 'Theory and solved examples, then the first level of exercises.' : track === 'physics' ? 'Theory and solved examples. Derive the key results yourself.' : 'Concepts and solved numericals.';
    return { kind: 'learn', title: `Learn ${ch} from ${book}`, detail: `${how}${fallback(src, track)}` };
  }
  const what = track === 'physical' ? 'Numericals' : 'Exercises';
  return {
    kind: 'practice',
    title: `${what} from ${book}: ${ch}`,
    detail: `Work level by level and mark every question you could not solve.${fallback(src, track)}`,
  };
}

export function pyqWording(chapter: Chapter, exam: ExamId, hasPyqBook: boolean): Wording {
  const papers = exam === 'jee-advanced' ? 'JEE Main and Advanced PYQs' : 'PYQs';
  const where = hasPyqBook
    ? 'from your PYQ book'
    : `from the official past papers (free on the NTA website). It is much easier with ${PYQ_BOOK_HINT[exam]}`;
  return {
    kind: 'pyq',
    title: `PYQs: ${chapter.name}`,
    detail: `Solve this chapter’s ${papers} ${where}. Time yourself and mark every one you get wrong.`,
  };
}
