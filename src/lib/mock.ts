import { CHAPTER_BY_ID } from '../data/chapters';
import { EXAMS } from '../data/exams';
import { questionsForExam } from '../data/questions';
import type { ExamId, MockResult, MockSpec, Question, SubjectId } from '../types';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks a mock's questions: balanced across subjects, then across chapters, so a
 * full-syllabus mock samples widely. The same mock always gets the same questions.
 */
export function pickQuestions(spec: MockSpec, exam: ExamId): Question[] {
  const rand = seededRandom(hash(spec.id));
  const wanted = new Set(spec.chapterIds);
  const byChapter = new Map<string, Question[]>();
  for (const q of questionsForExam(exam)) {
    if (!wanted.has(q.chapterId)) continue;
    if (!byChapter.has(q.chapterId)) byChapter.set(q.chapterId, []);
    byChapter.get(q.chapterId)!.push(q);
  }
  const bySubject = new Map<SubjectId, Question[][]>();
  for (const [chapterId, list] of shuffle([...byChapter.entries()], rand)) {
    const subject = CHAPTER_BY_ID[chapterId].subject;
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject)!.push(shuffle(list, rand));
  }
  const cursors = new Map<SubjectId, number>();
  const picked: Question[] = [];
  let progress = true;
  while (picked.length < spec.questionCount && progress) {
    progress = false;
    for (const [subject, chapters] of bySubject) {
      if (picked.length >= spec.questionCount) break;
      // Take the next question from the next chapter of this subject that still has one.
      for (let tries = 0; tries < chapters.length; tries++) {
        const c = (cursors.get(subject) ?? 0) % chapters.length;
        cursors.set(subject, c + 1);
        const q = chapters[c].shift();
        if (q) {
          picked.push(q);
          progress = true;
          break;
        }
      }
    }
  }
  return picked;
}

export function isCorrect(q: Question, answer: string | undefined): boolean {
  if (answer === undefined || answer.trim() === '') return false;
  if (q.type === 'mcq') return Number(answer) === q.answer;
  const value = Number(answer.trim());
  return Number.isFinite(value) && Math.abs(value - q.answer) <= Math.max(0.01, Math.abs(q.answer) * 0.001);
}

export function scoreMock(
  spec: Pick<MockSpec, 'id' | 'title' | 'date'>,
  questions: Question[],
  answers: Record<string, string>,
  exam: ExamId,
  timeTakenSec: number,
): MockResult {
  const { marking } = EXAMS[exam];
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const perChapter: MockResult['perChapter'] = {};
  for (const q of questions) {
    const a = answers[q.id];
    const entry = (perChapter[q.chapterId] ??= { correct: 0, total: 0 });
    entry.total++;
    if (a === undefined || a.trim() === '') {
      skipped++;
    } else if (isCorrect(q, a)) {
      correct++;
      entry.correct++;
      score += marking.correct;
    } else {
      wrong++;
      score += q.type === 'num' ? marking.numericalWrong : marking.wrong;
    }
  }
  return {
    mockId: spec.id,
    title: spec.title,
    date: spec.date,
    score,
    maxScore: questions.length * marking.correct,
    correct,
    wrong,
    skipped,
    timeTakenSec,
    questionIds: questions.map((q) => q.id),
    answers,
    perChapter,
  };
}

/** Chapters scored under 50% (with at least 2 questions) across the latest properly attempted mocks, weakest first. */
export function weakChapters(results: MockResult[], latest = 3): { chapterId: string; accuracy: number }[] {
  const totals: Record<string, { correct: number; total: number }> = {};
  // A mock abandoned after a few questions says little about which chapters are weak.
  const attempted = results.filter((r) => r.correct + r.wrong >= 0.5 * r.questionIds.length);
  for (const r of attempted.slice(-latest)) {
    for (const [id, v] of Object.entries(r.perChapter)) {
      const t = (totals[id] ??= { correct: 0, total: 0 });
      t.correct += v.correct;
      t.total += v.total;
    }
  }
  return Object.entries(totals)
    .filter(([, v]) => v.total >= 2 && v.correct / v.total < 0.5)
    .map(([chapterId, v]) => ({ chapterId, accuracy: v.correct / v.total }))
    .sort((a, b) => a.accuracy - b.accuracy);
}
