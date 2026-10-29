import type { ChemBranch, Chapter, ExamId, SubjectId, Track } from '../types';

const JEE: ExamId[] = ['jee-main', 'jee-advanced'];
const ALL: ExamId[] = ['jee-main', 'jee-advanced', 'neet'];
const NEET: ExamId[] = ['neet'];

type Row = [number, string, 1 | 2 | 3];

function book(subject: SubjectId, classLevel: 11 | 12, exams: ExamId[], rows: Row[]): Chapter[] {
  const prefix = subject[0];
  return rows.map(([number, name, weight]) => ({
    id: `${prefix}${classLevel}-${String(number).padStart(2, '0')}`,
    subject,
    classLevel,
    number,
    name,
    weight,
    exams,
  }));
}

// Chapter lists follow the current rationalised NCERT textbooks.
export const CHAPTERS: Chapter[] = [
  ...book('physics', 11, ALL, [
    [1, 'Units and Measurement', 1],
    [2, 'Motion in a Straight Line', 2],
    [3, 'Motion in a Plane', 2],
    [4, 'Laws of Motion', 2],
    [5, 'Work, Energy and Power', 2],
    [6, 'System of Particles and Rotational Motion', 3],
    [7, 'Gravitation', 2],
    [8, 'Mechanical Properties of Solids', 1],
    [9, 'Mechanical Properties of Fluids', 2],
    [10, 'Thermal Properties of Matter', 2],
    [11, 'Thermodynamics', 3],
    [12, 'Kinetic Theory', 2],
    [13, 'Oscillations', 2],
    [14, 'Waves', 2],
  ]),
  ...book('physics', 12, ALL, [
    [1, 'Electric Charges and Fields', 3],
    [2, 'Electrostatic Potential and Capacitance', 3],
    [3, 'Current Electricity', 3],
    [4, 'Moving Charges and Magnetism', 3],
    [5, 'Magnetism and Matter', 1],
    [6, 'Electromagnetic Induction', 2],
    [7, 'Alternating Current', 2],
    [8, 'Electromagnetic Waves', 1],
    [9, 'Ray Optics and Optical Instruments', 3],
    [10, 'Wave Optics', 2],
    [11, 'Dual Nature of Radiation and Matter', 2],
    [12, 'Atoms', 2],
    [13, 'Nuclei', 2],
    [14, 'Semiconductor Electronics', 2],
  ]),
  {
    id: 'p0-exp',
    subject: 'physics',
    classLevel: 0,
    name: 'Experimental Skills',
    weight: 1,
    exams: ['jee-main'],
    note: 'In the JEE Main syllabus: vernier calipers, screw gauge and the standard lab experiments.',
  },
  ...book('chemistry', 11, ALL, [
    [1, 'Some Basic Concepts of Chemistry', 2],
    [2, 'Structure of Atom', 2],
    [3, 'Classification of Elements and Periodicity in Properties', 1],
    [4, 'Chemical Bonding and Molecular Structure', 3],
    [5, 'Thermodynamics', 3],
    [6, 'Equilibrium', 3],
    [7, 'Redox Reactions', 1],
    [8, 'Organic Chemistry: Some Basic Principles and Techniques', 3],
    [9, 'Hydrocarbons', 2],
  ]),
  ...book('chemistry', 12, ALL, [
    [1, 'Solutions', 2],
    [2, 'Electrochemistry', 3],
    [3, 'Chemical Kinetics', 3],
    [4, 'The d- and f-Block Elements', 2],
    [5, 'Coordination Compounds', 3],
    [6, 'Haloalkanes and Haloarenes', 2],
    [7, 'Alcohols, Phenols and Ethers', 2],
    [8, 'Aldehydes, Ketones and Carboxylic Acids', 3],
    [9, 'Amines', 2],
    [10, 'Biomolecules', 2],
  ]),
  {
    id: 'c0-pblock',
    subject: 'chemistry',
    classLevel: 0,
    name: 'p-Block Elements (Groups 13 to 18)',
    weight: 2,
    exams: ALL,
    note: 'Still in the exam syllabus but removed from the current NCERT books. Use the older NCERT edition (Class 11 Ch. 11 and Class 12 Ch. 7).',
  },
  {
    id: 'c0-prac',
    subject: 'chemistry',
    classLevel: 0,
    name: 'Principles Related to Practical Chemistry',
    weight: 1,
    exams: ['jee-main'],
    note: 'In the JEE Main syllabus: detection of elements, functional group tests and titrations.',
  },
  ...book('maths', 11, JEE, [
    [1, 'Sets', 1],
    [2, 'Relations and Functions', 2],
    [3, 'Trigonometric Functions', 2],
    [4, 'Complex Numbers and Quadratic Equations', 3],
    [6, 'Permutations and Combinations', 2],
    [7, 'Binomial Theorem', 2],
    [8, 'Sequences and Series', 3],
    [9, 'Straight Lines', 2],
    [10, 'Conic Sections', 3],
    [11, 'Introduction to Three Dimensional Geometry', 1],
    [12, 'Limits and Derivatives', 2],
    [13, 'Statistics', 1],
    [14, 'Probability', 2],
  ]),
  ...book('maths', 12, JEE, [
    [1, 'Relations and Functions', 2],
    [2, 'Inverse Trigonometric Functions', 1],
    [3, 'Matrices', 2],
    [4, 'Determinants', 2],
    [5, 'Continuity and Differentiability', 2],
    [6, 'Application of Derivatives', 3],
    [7, 'Integrals', 3],
    [8, 'Application of Integrals', 2],
    [9, 'Differential Equations', 2],
    [10, 'Vector Algebra', 2],
    [11, 'Three Dimensional Geometry', 3],
    [13, 'Probability', 3],
  ]),
  ...book('biology', 11, NEET, [
    [1, 'The Living World', 1],
    [2, 'Biological Classification', 2],
    [3, 'Plant Kingdom', 2],
    [4, 'Animal Kingdom', 3],
    [5, 'Morphology of Flowering Plants', 2],
    [6, 'Anatomy of Flowering Plants', 2],
    [7, 'Structural Organisation in Animals', 1],
    [8, 'Cell: The Unit of Life', 3],
    [9, 'Biomolecules', 2],
    [10, 'Cell Cycle and Cell Division', 3],
    [11, 'Photosynthesis in Higher Plants', 2],
    [12, 'Respiration in Plants', 2],
    [13, 'Plant Growth and Development', 1],
    [14, 'Breathing and Exchange of Gases', 2],
    [15, 'Body Fluids and Circulation', 2],
    [16, 'Excretory Products and their Elimination', 2],
    [17, 'Locomotion and Movement', 1],
    [18, 'Neural Control and Coordination', 2],
    [19, 'Chemical Coordination and Integration', 2],
  ]),
  ...book('biology', 12, NEET, [
    [1, 'Sexual Reproduction in Flowering Plants', 2],
    [2, 'Human Reproduction', 3],
    [3, 'Reproductive Health', 2],
    [4, 'Principles of Inheritance and Variation', 3],
    [5, 'Molecular Basis of Inheritance', 3],
    [6, 'Evolution', 2],
    [7, 'Human Health and Disease', 2],
    [8, 'Microbes in Human Welfare', 1],
    [9, 'Biotechnology: Principles and Processes', 3],
    [10, 'Biotechnology and its Applications', 2],
    [11, 'Organisms and Populations', 2],
    [12, 'Ecosystem', 2],
    [13, 'Biodiversity and Conservation', 2],
  ]),
];

const CHEM_BRANCH: Record<string, ChemBranch> = {
  'c11-01': 'physical', 'c11-02': 'physical', 'c11-05': 'physical', 'c11-06': 'physical', 'c11-07': 'physical',
  'c12-01': 'physical', 'c12-02': 'physical', 'c12-03': 'physical',
  'c11-03': 'inorganic', 'c11-04': 'inorganic', 'c12-04': 'inorganic', 'c12-05': 'inorganic', 'c0-pblock': 'inorganic', 'c0-prac': 'inorganic',
  'c11-08': 'organic', 'c11-09': 'organic', 'c12-06': 'organic', 'c12-07': 'organic', 'c12-08': 'organic', 'c12-09': 'organic', 'c12-10': 'organic',
};
for (const c of CHAPTERS) if (c.subject === 'chemistry') c.branch = CHEM_BRANCH[c.id];

export function trackOf(chapter: Chapter): Track {
  return chapter.subject === 'chemistry' ? chapter.branch! : (chapter.subject as Track);
}

export const CHAPTER_BY_ID: Record<string, Chapter> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

export function chaptersFor(exam: ExamId): Chapter[] {
  return CHAPTERS.filter((c) => c.exams.includes(exam));
}

const BASE_HOURS: Record<SubjectId, Record<1 | 2 | 3, number>> = {
  physics: { 1: 9, 2: 14, 3: 20 },
  maths: { 1: 9, 2: 14, 3: 20 },
  chemistry: { 1: 8, 2: 12, 3: 16 },
  biology: { 1: 7, 2: 10, 3: 14 },
};

/** Estimated hours to learn a chapter from scratch: NCERT, notes, exercises and PYQs. */
export function chapterHours(chapter: Chapter, depth = 1): number {
  return BASE_HOURS[chapter.subject][chapter.weight] * depth;
}

export function chapterLabel(chapter: Chapter): string {
  if (chapter.classLevel === 0) return 'Extra topic';
  return `Class ${chapter.classLevel} · Ch. ${chapter.number}`;
}
