import type { Question } from '../../types';

export type Draft = Omit<Question, 'id'>;

export function mcq(chapterId: string, text: string, options: string[], answer: number, solution: string): Draft {
  return { chapterId, type: 'mcq', text, options, answer, solution };
}

/** Numerical-answer question, as in JEE Section B. */
export function num(chapterId: string, text: string, answer: number, solution: string): Draft {
  return { chapterId, type: 'num', text, answer, solution };
}
