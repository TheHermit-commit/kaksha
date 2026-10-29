import type { ExamId, Materials, SubjectId, Track } from '../types';

export interface Book {
  id: string;
  name: string;
  /** Short name used inside daily tasks */
  short: string;
  subject: SubjectId;
  tracks: Track[];
  exams: ExamId[];
  /** One line on what the book is good for */
  note: string;
  /** Depth book suggested later, never a student's main practice source */
  depthOnly?: boolean;
}

const JEE: ExamId[] = ['jee-main', 'jee-advanced'];
const ALL: ExamId[] = ['jee-main', 'jee-advanced', 'neet'];
const CHEM: Track[] = ['physical', 'inorganic', 'organic'];

/** Listed in order of preference when a student owns more than one. */
export const BOOKS: Book[] = [
  { id: 'physics-galaxy', name: 'Physics Galaxy (Ashish Arora)', short: 'Physics Galaxy', subject: 'physics', tracks: ['physics'], exams: JEE, note: 'Clear theory and a big bank of JEE-level problems, chapter by chapter.' },
  { id: 'cengage-physics', name: 'Cengage Physics (B.M. Sharma)', short: 'Cengage Physics', subject: 'physics', tracks: ['physics'], exams: JEE, note: 'Theory with graded exercises for Main and Advanced.' },
  { id: 'dc-pandey', name: 'Understanding Physics (D.C. Pandey, Arihant)', short: 'D.C. Pandey', subject: 'physics', tracks: ['physics'], exams: JEE, note: 'Detailed theory and many solved examples.' },
  { id: 'dc-pandey-neet', name: 'Objective Physics for NEET (D.C. Pandey, Arihant)', short: 'D.C. Pandey', subject: 'physics', tracks: ['physics'], exams: ['neet'], note: 'NEET-level MCQs for every chapter, with short theory.' },
  { id: 'hcv', name: 'Concepts of Physics (H.C. Verma)', short: 'H.C. Verma', subject: 'physics', tracks: ['physics'], exams: ALL, note: 'The classic for building concepts. Its exercises are excellent practice.' },
  { id: 'mtg-fingertips-phy', name: 'Objective NCERT at your Fingertips: Physics (MTG)', short: 'MTG Fingertips', subject: 'physics', tracks: ['physics'], exams: ['neet'], note: 'NCERT-based MCQs, useful for NEET.' },
  { id: 'irodov', name: 'Problems in General Physics (I.E. Irodov)', short: 'Irodov', subject: 'physics', tracks: ['physics'], exams: ['jee-advanced'], note: 'Very hard problems. Pick only after your basics are strong.', depthOnly: true },

  { id: 'cengage-maths', name: 'Cengage Mathematics (G. Tewani)', short: 'Cengage Maths', subject: 'maths', tracks: ['maths'], exams: JEE, note: 'Chapter-wise theory and exercises covering every JEE question type.' },
  { id: 'arihant-maths', name: 'Skills in Mathematics (Amit M. Agarwal, Arihant)', short: 'Arihant Maths', subject: 'maths', tracks: ['maths'], exams: JEE, note: 'Topic-wise books with lots of solved examples.' },
  { id: 'rd-sharma', name: 'Objective Mathematics (R.D. Sharma)', short: 'R.D. Sharma Objective', subject: 'maths', tracks: ['maths'], exams: JEE, note: 'Large set of objective questions for JEE Main practice.' },
  { id: 'black-book', name: 'Advanced Problems in Mathematics (Vikas Gupta, “Black Book”)', short: 'Black Book', subject: 'maths', tracks: ['maths'], exams: ['jee-advanced'], note: 'Advanced-level problems for the final push.', depthOnly: true },

  { id: 'n-awasthi', name: 'Problems in Physical Chemistry (N. Awasthi)', short: 'N. Awasthi', subject: 'chemistry', tracks: ['physical'], exams: ALL, note: 'The standard numerical practice book for physical chemistry.' },
  { id: 'ms-chouhan', name: 'Problems in Organic Chemistry (M.S. Chouhan)', short: 'M.S. Chouhan', subject: 'chemistry', tracks: ['organic'], exams: ALL, note: 'Graded organic problems: reactions, mechanisms and conversions.' },
  { id: 'vk-jaiswal', name: 'Problems in Inorganic Chemistry (V.K. Jaiswal)', short: 'V.K. Jaiswal', subject: 'chemistry', tracks: ['inorganic'], exams: JEE, note: 'Inorganic questions that test NCERT facts in JEE style.' },
  { id: 'op-tandon', name: 'O.P. Tandon Chemistry (G.R. Bathla)', short: 'O.P. Tandon', subject: 'chemistry', tracks: CHEM, exams: ALL, note: 'Covers physical, organic and inorganic chemistry in one series.' },
  { id: 'mtg-fingertips-chem', name: 'Objective NCERT at your Fingertips: Chemistry (MTG)', short: 'MTG Fingertips', subject: 'chemistry', tracks: CHEM, exams: ['neet'], note: 'NCERT line-based MCQs, ideal for NEET chemistry.' },
  { id: 'jd-lee', name: 'Concise Inorganic Chemistry (J.D. Lee, adapted)', short: 'J.D. Lee', subject: 'chemistry', tracks: ['inorganic'], exams: ['jee-advanced'], note: 'Deeper inorganic reading once NCERT is solid.', depthOnly: true },

  { id: 'mtg-fingertips-bio', name: 'Objective NCERT at your Fingertips: Biology (MTG)', short: 'MTG Fingertips', subject: 'biology', tracks: ['biology'], exams: ['neet'], note: 'Thousands of MCQs written from NCERT lines. The most useful NEET biology book.' },
  { id: 'trueman', name: 'Trueman’s Elementary Biology', short: 'Trueman', subject: 'biology', tracks: ['biology'], exams: ['neet'], note: 'Extra explanation beyond NCERT for tough topics.' },
];

/** Coaching material is recorded per subject: a student may have modules for one subject only. */
export function coachingId(subject: SubjectId): string {
  return `coaching-${subject}`;
}
const COACHING = { name: 'Coaching modules or notes', short: 'your coaching module' };

export const BOOK_BY_ID: Record<string, Book> = Object.fromEntries(BOOKS.map((b) => [b.id, b]));

/** What to buy when a student has nothing beyond NCERT for a track. */
const RECOMMENDED: Record<ExamId, Partial<Record<Track, string>>> = {
  'jee-main': { physics: 'physics-galaxy', maths: 'cengage-maths', physical: 'n-awasthi', organic: 'ms-chouhan', inorganic: 'vk-jaiswal' },
  'jee-advanced': { physics: 'physics-galaxy', maths: 'cengage-maths', physical: 'n-awasthi', organic: 'ms-chouhan', inorganic: 'vk-jaiswal' },
  neet: { physics: 'dc-pandey-neet', physical: 'n-awasthi', organic: 'mtg-fingertips-chem', inorganic: 'mtg-fingertips-chem', biology: 'mtg-fingertips-bio' },
};

export const TRACK_NAMES: Record<Track, string> = {
  physics: 'Physics',
  maths: 'Mathematics',
  biology: 'Biology',
  physical: 'Physical chemistry',
  inorganic: 'Inorganic chemistry',
  organic: 'Organic chemistry',
};

export function tracksFor(subjects: SubjectId[]): Track[] {
  return subjects.flatMap((s): Track[] => (s === 'chemistry' ? ['physical', 'inorganic', 'organic'] : [s as Track]));
}

export function booksFor(exam: ExamId, subject: SubjectId): Book[] {
  return BOOKS.filter((b) => b.subject === subject && b.exams.includes(exam));
}

export interface Source {
  /** Book id, or 'coaching' */
  id: string;
  name: string;
  short: string;
  owned: boolean;
}

/** The main practice source for each track: coaching modules, else an owned book, else the one to buy. */
export function resolveSources(exam: ExamId, subjects: SubjectId[], materials: Materials): Record<Track, Source> {
  const out = {} as Record<Track, Source>;
  const owned = new Set(materials.owned);
  for (const track of tracksFor(subjects)) {
    const subject: SubjectId = track === 'physics' || track === 'maths' || track === 'biology' ? track : 'chemistry';
    if (owned.has(coachingId(subject))) {
      out[track] = { id: coachingId(subject), ...COACHING, owned: true };
      continue;
    }
    const mine = BOOKS.find((b) => owned.has(b.id) && b.tracks.includes(track) && b.exams.includes(exam) && !b.depthOnly);
    if (mine) {
      out[track] = { id: mine.id, name: mine.name, short: mine.short, owned: true };
      continue;
    }
    const rec = BOOK_BY_ID[RECOMMENDED[exam][track]!];
    out[track] = { id: rec.id, name: rec.name, short: rec.short, owned: false };
  }
  return out;
}

/** Books the student should get, one per missing track (shared books listed once). */
export function booksToBuy(exam: ExamId, subjects: SubjectId[], materials: Materials): { book: Book; tracks: Track[] }[] {
  const sources = resolveSources(exam, subjects, materials);
  const list: { book: Book; tracks: Track[] }[] = [];
  for (const [track, src] of Object.entries(sources) as [Track, Source][]) {
    if (src.owned) continue;
    const existing = list.find((l) => l.book.id === src.id);
    if (existing) existing.tracks.push(track);
    else list.push({ book: BOOK_BY_ID[src.id], tracks: [track] });
  }
  return list;
}

/** Depth books for JEE Advanced that the student does not have yet. */
export function depthBooks(exam: ExamId, materials: Materials): Book[] {
  return BOOKS.filter((b) => b.depthOnly && b.exams.includes(exam) && !materials.owned.includes(b.id));
}

export const PYQ_BOOK_HINT: Record<ExamId, string> = {
  'jee-main': 'a chapter-wise JEE Main PYQ book (Arihant, MTG or Disha all publish one)',
  'jee-advanced': 'chapter-wise JEE Main and JEE Advanced PYQ books (Arihant, MTG or Disha)',
  neet: 'a chapter-wise NEET PYQ book (MTG, Arihant or Disha all publish one)',
};
