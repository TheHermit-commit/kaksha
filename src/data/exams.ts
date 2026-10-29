import type { ExamId, Grade, SubjectId } from '../types';

export interface ExamInfo {
  id: ExamId;
  name: string;
  shortName: string;
  subjects: SubjectId[];
  pattern: string;
  marking: { correct: number; wrong: number; numericalWrong: number };
  /** Minutes allowed per question in the real paper, used to time mocks */
  minutesPerQuestion: number;
  allowsNumerical: boolean;
  /** Extra study depth compared with a JEE Main / NEET pass over the chapter */
  depth: number;
  officialSite: string;
  strategy: string[];
}

export const EXAMS: Record<ExamId, ExamInfo> = {
  'jee-main': {
    id: 'jee-main',
    name: 'JEE Main',
    shortName: 'JEE Main',
    subjects: ['physics', 'chemistry', 'maths'],
    pattern: '75 questions · 300 marks · 3 hours · +4 / −1',
    marking: { correct: 4, wrong: -1, numericalWrong: -1 },
    minutesPerQuestion: 2.4,
    allowsNumerical: true,
    depth: 1,
    officialSite: 'https://jeemain.nta.nic.in',
    strategy: [
      'Chemistry is the most scoring subject. Read the NCERT text line by line, especially inorganic chemistry.',
      'Questions repeat ideas from past papers. Solving PYQs chapter by chapter is the best practice you can get for free.',
      'Speed matters: about 2.4 minutes per question. Weekly timed mocks build that habit.',
    ],
  },
  'jee-advanced': {
    id: 'jee-advanced',
    name: 'JEE Advanced',
    shortName: 'JEE Adv.',
    subjects: ['physics', 'chemistry', 'maths'],
    pattern: '2 papers × 3 hours · pattern changes each year · partial marking in some sections',
    marking: { correct: 3, wrong: -1, numericalWrong: 0 },
    minutesPerQuestion: 3,
    allowsNumerical: true,
    depth: 1.3,
    officialSite: 'https://jeeadv.ac.in',
    strategy: [
      'You need to clear JEE Main first, so this plan covers the full Main syllabus with extra depth for Advanced.',
      'Advanced questions mix two or three concepts. Learn why a formula works, not just the formula.',
      'Check the official JEE Advanced syllabus on jeeadv.ac.in. It has a few topics beyond the current NCERT books.',
    ],
  },
  neet: {
    id: 'neet',
    name: 'NEET UG',
    shortName: 'NEET',
    subjects: ['physics', 'chemistry', 'biology'],
    pattern: '180 questions · 720 marks · 3 hours · +4 / −1',
    marking: { correct: 4, wrong: -1, numericalWrong: -1 },
    minutesPerQuestion: 1,
    allowsNumerical: false,
    depth: 1,
    officialSite: 'https://neet.nta.nic.in',
    strategy: [
      'Biology is half the paper (360 of 720 marks), and almost every question comes straight from NCERT lines, diagrams and tables.',
      'You get one minute per question. Physics is where time runs out, so practise numericals under a timer.',
      'Re-read NCERT Biology at least three times before the exam. The revision phase of your plan is built for this.',
    ],
  },
};

export const SUBJECT_NAMES: Record<SubjectId, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  maths: 'Mathematics',
  biology: 'Biology',
};

export const GRADE_NAMES: Record<Grade, string> = {
  '11': 'Class 11',
  '12': 'Class 12',
  dropper: 'Passed Class 12 (dropper)',
};

export const DEFAULT_HOURS: Record<Grade, number> = { '11': 4, '12': 5, dropper: 8 };
