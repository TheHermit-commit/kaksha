export type ExamId = 'jee-main' | 'jee-advanced' | 'neet';
export type Grade = '11' | '12' | 'dropper';
export type SubjectId = 'physics' | 'chemistry' | 'maths' | 'biology';
export type ChemBranch = 'physical' | 'inorganic' | 'organic';
/** A study track: a subject, with chemistry split into its three branches. */
export type Track = 'physics' | 'maths' | 'biology' | ChemBranch;

export interface Chapter {
  id: string;
  subject: SubjectId;
  /** 11 or 12 for NCERT chapters; 0 for syllabus topics outside the current NCERT books */
  classLevel: 11 | 12 | 0;
  /** Chapter number in the current (rationalised) NCERT textbook */
  number?: number;
  name: string;
  /** 3 = high yield, 2 = regular, 1 = lighter */
  weight: 1 | 2 | 3;
  exams: ExamId[];
  /** Chemistry only */
  branch?: ChemBranch;
  note?: string;
}

export interface Profile {
  name: string;
  grade: Grade;
  exam: ExamId;
  examDate: string; // YYYY-MM-DD
  hoursPerDay: number;
  studyDays: 5 | 6;
  materials: Materials;
  createdAt: string;
}

export interface Materials {
  /** Book ids from data/books.ts, plus 'coaching-<subject>' for any institute's modules */
  owned: string[];
  hasPyqBook: boolean;
}

export type TaskKind = 'learn' | 'practice' | 'pyq' | 'revise' | 'mock' | 'review' | 'rest';

export interface Task {
  id: string;
  date: string;
  kind: TaskKind;
  title: string;
  detail?: string;
  subject?: SubjectId;
  chapterId?: string;
  hours: number;
  /** Fraction of the chapter this task covers (learn / practice only) */
  share?: number;
  mockId?: string;
  done: boolean;
}

export type MockKind = 'weekly' | 'cumulative' | 'full';

export interface MockSpec {
  id: string;
  date: string;
  kind: MockKind;
  title: string;
  chapterIds: string[];
  questionCount: number;
  durationMin: number;
}

export type Phase = 'learn' | 'consolidate' | 'practice' | 'revision';

export interface Week {
  start: string; // Monday
  end: string; // Sunday
  number: number;
  phase: Phase;
  factor: number;
  chapters: { chapterId: string; hours: number }[];
  tasks: Task[];
  mocks: MockSpec[];
  note?: string;
}

export type Pace = 'comfortable' | 'balanced' | 'tight' | 'very-tight';

export interface PlanSummary {
  totalWeeks: number;
  learnWeeks: number;
  consolidationWeeks: number;
  practiceWeeks: number;
  revisionWeeks: number;
  revisionReduced: boolean;
  chaptersLeft: number;
  hoursNeeded: number;
  hoursAvailable: number;
  ratio: number;
  pace: Pace;
  learningEnds: string | null;
  perSubject: { subject: SubjectId; chapters: number; hours: number }[];
}

export interface Plan {
  createdAt: string;
  weeks: Week[];
  summary: PlanSummary;
}

export interface Question {
  id: string;
  chapterId: string;
  type: 'mcq' | 'num';
  text: string;
  options?: string[];
  /** Option index for mcq, numeric value for num */
  answer: number;
  solution: string;
}

export interface MockResult {
  mockId: string;
  title: string;
  date: string;
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTakenSec: number;
  questionIds: string[];
  answers: Record<string, string>;
  perChapter: Record<string, { correct: number; total: number }>;
}

export interface CheckInAnswers {
  hoursAvailable: number;
  stress: 1 | 2 | 3 | 4 | 5;
  sleep: 'under6' | '6to7' | '7plus';
  school: 'none' | 'some' | 'heavy';
  pace: 'slow' | 'right' | 'fast';
  note: string;
}

export interface CheckInEntry {
  id: string;
  date: string;
  answers: CheckInAnswers;
  reply: string[];
  changes: string[];
  showHelpline: boolean;
}

export interface AppState {
  version: 1;
  profile: Profile;
  /** Fraction of each chapter completed, 0..1 */
  progress: Record<string, number>;
  plan: Plan;
  mockResults: MockResult[];
  checkins: CheckInEntry[];
  /** Study-time multiplier per week, keyed by the week's Monday */
  capacityFactors: Record<string, number>;
  /** Chapters the trainer asked to revise first (weak in mocks) */
  focusChapters: string[];
}
