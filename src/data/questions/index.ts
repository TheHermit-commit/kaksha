import type { ExamId, Question } from '../../types';
import { EXAMS } from '../exams';
import { BIOLOGY } from './biology';
import { CHEMISTRY } from './chemistry';
import type { Draft } from './helpers';
import { MATHS } from './maths';
import { PHYSICS } from './physics';

function withIds(drafts: Draft[]): Question[] {
  const counts: Record<string, number> = {};
  return drafts.map((d) => {
    counts[d.chapterId] = (counts[d.chapterId] ?? 0) + 1;
    return { ...d, id: `${d.chapterId}-q${counts[d.chapterId]}` };
  });
}

export const QUESTIONS: Question[] = withIds([...PHYSICS, ...CHEMISTRY, ...MATHS, ...BIOLOGY]);

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/** Questions usable in a given exam's mocks. NEET has no numerical-answer section. */
export function questionsForExam(exam: ExamId): Question[] {
  return EXAMS[exam].allowsNumerical ? QUESTIONS : QUESTIONS.filter((q) => q.type === 'mcq');
}
