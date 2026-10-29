import { chapterHours, chaptersFor } from '../data/chapters';
import { CHAPTERS } from '../data/chapters';
import { QUESTIONS } from '../data/questions';
import { applyCheckIn, createState, toggleTask } from './state';
import { evaluateCheckIn } from './checkin';
import { pickQuestions, scoreMock } from './mock';
import { buildPlan } from './planner';
import { addDays } from './dates';
import type { Profile } from '../types';

const TODAY = '2026-10-29'; // a Thursday

function input(overrides: Partial<Parameters<typeof buildPlan>[0]> = {}) {
  return {
    exam: 'jee-main' as const,
    grade: '12' as const,
    examDate: '2027-04-01',
    startDate: TODAY,
    hoursPerDay: 6,
    studyDays: 6 as const,
    progress: {},
    ...overrides,
  };
}

function scheduledShare(plan: ReturnType<typeof buildPlan>) {
  const shares: Record<string, number> = {};
  for (const w of plan.weeks) for (const t of w.tasks) if (t.chapterId && t.share) shares[t.chapterId] = (shares[t.chapterId] ?? 0) + t.share;
  return shares;
}

describe('buildPlan', () => {
  it('schedules every remaining chapter exactly once in full', () => {
    const plan = buildPlan(input());
    const shares = scheduledShare(plan);
    for (const c of chaptersFor('jee-main')) expect(shares[c.id]).toBeCloseTo(1, 2);
  });

  it('only schedules what is left of partly done chapters', () => {
    const progress = { 'p11-01': 1, 'p11-02': 0.5 };
    const shares = scheduledShare(buildPlan(input({ progress })));
    expect(shares['p11-01']).toBeUndefined();
    expect(shares['p11-02']).toBeCloseTo(0.5, 2);
  });

  it('never schedules tasks before the start date or on or after the exam date', () => {
    const plan = buildPlan(input());
    for (const w of plan.weeks) for (const t of w.tasks) {
      expect(t.date >= TODAY).toBe(true);
      expect(t.date < '2027-04-01').toBe(true);
    }
  });

  it('puts the revision phase at the end and a mock on most Sundays', () => {
    const plan = buildPlan(input());
    const phases = plan.weeks.map((w) => w.phase);
    const firstRevision = phases.indexOf('revision');
    expect(firstRevision).toBeGreaterThan(0);
    expect(phases.slice(firstRevision).every((p) => p === 'revision')).toBe(true);
    const withMock = plan.weeks.filter((w) => w.mocks.length).length;
    expect(withMock).toBeGreaterThanOrEqual(plan.weeks.length - 2);
  });

  it('turns spare time into practice weeks for a long timeline', () => {
    const plan = buildPlan(input({ grade: '11', examDate: '2028-04-01', hoursPerDay: 6 }));
    expect(plan.summary.pace).toBe('comfortable');
    expect(plan.summary.practiceWeeks).toBeGreaterThan(0);
  });

  it('flags a very tight plan and shrinks revision before squeezing chapters', () => {
    const plan = buildPlan(input({ examDate: '2027-01-07', hoursPerDay: 4 }));
    expect(plan.summary.pace).toBe('very-tight');
    expect(plan.summary.revisionWeeks).toBe(1);
    expect(plan.summary.revisionReduced).toBe(true);
    const shares = scheduledShare(plan);
    expect(Object.values(shares).every((s) => s > 0.99)).toBe(true);
  });

  it('keeps daily study close to the hours the student chose', () => {
    const plan = buildPlan(input());
    const week = plan.weeks.find((w) => w.phase === 'learn' && w.tasks.length > 10)!;
    const byDay: Record<string, number> = {};
    for (const t of week.tasks) if (t.kind !== 'mock' && t.kind !== 'review') byDay[t.date] = (byDay[t.date] ?? 0) + t.hours;
    for (const h of Object.values(byDay)) expect(h).toBeLessThanOrEqual(6 * 1.3 + 0.5);
  });

  it('uses a planned Class-12 then Class-11 order for Class 12 students', () => {
    const plan = buildPlan(input());
    const first = plan.weeks[0].chapters.map((c) => c.chapterId);
    expect(first.some((id) => id.startsWith('p12'))).toBe(true);
  });
});

describe('question bank', () => {
  it('has questions for every chapter with valid answers', () => {
    for (const c of CHAPTERS) {
      const qs = QUESTIONS.filter((q) => q.chapterId === c.id);
      expect(qs.length, c.id).toBeGreaterThanOrEqual(2);
      for (const q of qs) {
        if (q.type === 'mcq') {
          expect(q.options?.length).toBe(4);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(4);
        }
      }
    }
  });

  it('gives NEET at least two single-correct questions per physics and chemistry chapter', () => {
    for (const c of chaptersFor('neet')) {
      const qs = QUESTIONS.filter((q) => q.chapterId === c.id && q.type === 'mcq');
      expect(qs.length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('picks the same questions for the same mock and balances subjects', () => {
    const spec = { id: 'x', date: TODAY, kind: 'full' as const, title: 'Full', chapterIds: chaptersFor('neet').map((c) => c.id), questionCount: 30, durationMin: 30 };
    const a = pickQuestions(spec, 'neet');
    const b = pickQuestions(spec, 'neet');
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(a).toHaveLength(30);
    expect(a.every((q) => q.type === 'mcq')).toBe(true);
    const subjects = new Set(a.map((q) => q.chapterId[0]));
    expect(subjects).toEqual(new Set(['p', 'c', 'b']));
  });

  it('scores +4 / −1 for JEE Main', () => {
    const qs = QUESTIONS.filter((q) => q.chapterId === 'p12-03');
    const answers: Record<string, string> = {};
    answers[qs[0].id] = String(qs[0].answer); // correct mcq
    answers[qs[1].id] = '999'; // wrong numerical
    const r = scoreMock({ id: 'm', title: 't', date: TODAY }, qs, answers, 'jee-main', 60);
    expect(r.score).toBe(3);
    expect(r.correct).toBe(1);
    expect(r.wrong).toBe(1);
    expect(r.skipped).toBe(1);
  });
});

describe('check-in rules', () => {
  const ctx = { name: 'Asha', hoursPerDay: 6, lastWeekCompletion: 0.8, weakChapterNames: [] };
  const calm = { hoursAvailable: 6, stress: 2 as const, sleep: '7plus' as const, school: 'none' as const, pace: 'right' as const, note: '' };

  it('keeps the plan when everything is fine', () => {
    expect(evaluateCheckIn(calm, ctx).factor).toBe(1);
  });

  it('lightens the load for school exams and high stress', () => {
    const out = evaluateCheckIn({ ...calm, school: 'heavy', stress: 5 }, ctx);
    expect(out.factor).toBeLessThan(0.5);
    expect(out.extendNextWeek).toBe(true);
    expect(out.showHelpline).toBe(true);
  });

  it('shows the helpline when the note mentions self-harm', () => {
    const out = evaluateCheckIn({ ...calm, note: 'I feel like I want to die' }, ctx);
    expect(out.showHelpline).toBe(true);
    expect(out.factor).toBeLessThanOrEqual(0.5);
  });
});

describe('app state', () => {
  const profile: Profile = { name: 'Asha', grade: '12', exam: 'neet', examDate: '2027-05-02', hoursPerDay: 6, studyDays: 6, materials: { owned: [], hasPyqBook: false }, createdAt: TODAY };

  it('ticking a study task moves chapter progress and unticking restores it', () => {
    const s = createState(profile, {}, TODAY);
    const task = s.plan.weeks[0].tasks.find((t) => t.share)!;
    const ticked = toggleTask(s, task.id);
    expect(ticked.progress[task.chapterId!]).toBeCloseTo(task.share!, 5);
    expect(toggleTask(ticked, task.id).progress[task.chapterId!]).toBeCloseTo(0, 5);
  });

  it('a stressful check-in lightens the coming week but keeps the whole syllabus', () => {
    const s = createState(profile, {}, TODAY);
    const { state: next } = applyCheckIn(s, { hoursAvailable: 6, stress: 4, sleep: 'under6', school: 'heavy', pace: 'right', note: '' }, TODAY);
    const hours = (st: typeof s) => st.plan.weeks[1].tasks.filter((t) => t.kind === 'learn' || t.kind === 'practice').reduce((a, t) => a + t.hours, 0);
    expect(hours(next)).toBeLessThan(hours(s));
    const shares: Record<string, number> = {};
    for (const w of next.plan.weeks) for (const t of w.tasks) if (t.chapterId && t.share) shares[t.chapterId] = (shares[t.chapterId] ?? 0) + t.share;
    for (const c of chaptersFor('neet')) expect(shares[c.id]).toBeCloseTo(1, 2);
    expect(next.checkins).toHaveLength(1);
  });

  it('estimates sensible total hours', () => {
    const total = chaptersFor('jee-main').reduce((s, c) => s + chapterHours(c), 0);
    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(1400);
  });
});

describe('study material rules', () => {
  const plan = buildPlan(input({ exam: 'jee-main', grade: '11' }));
  const tasks = plan.weeks.flatMap((w) => w.tasks);
  const study = tasks.filter((t) => t.kind === 'learn' || t.kind === 'practice');
  const chapterOf = (id?: string) => CHAPTERS.find((c) => c.id === id)!;

  it('never sends maths students to NCERT', () => {
    expect(study.filter((t) => t.subject === 'maths').some((t) => /NCERT/.test(t.title + t.detail))).toBe(false);
  });

  it('uses NCERT for physics only on the first session of each chapter', () => {
    const ncert = study.filter((t) => t.subject === 'physics' && /NCERT first read/.test(t.title));
    const perChapter = new Map<string, number>();
    for (const t of ncert) perChapter.set(t.chapterId!, (perChapter.get(t.chapterId!) ?? 0) + 1);
    expect([...perChapter.values()].every((n) => n === 1)).toBe(true);
    expect(perChapter.size).toBe(chaptersFor('jee-main').filter((c) => c.subject === 'physics').length);
  });

  it('keeps NCERT line by line for organic and inorganic chemistry, and light for physical', () => {
    const chem = study.filter((t) => t.subject === 'chemistry');
    const heavy = chem.filter((t) => ['organic', 'inorganic'].includes(chapterOf(t.chapterId).branch!));
    expect(heavy.every((t) => /NCERT/.test(t.title))).toBe(true);
    const physical = chem.filter((t) => chapterOf(t.chapterId).branch === 'physical');
    const ncertPhysical = physical.filter((t) => /NCERT/.test(t.title));
    expect(ncertPhysical.length).toBeLessThan(physical.length / 3);
  });

  it('makes the last study day of a full week a PYQ day', () => {
    const week = plan.weeks.find((w) => w.phase === 'learn' && w.tasks.some((t) => t.date === w.start))!;
    const saturday = week.tasks.filter((t) => t.date === addDays(week.start, 5));
    expect(saturday.length).toBeGreaterThan(0);
    expect(saturday.every((t) => t.kind === 'pyq')).toBe(true);
  });

  it('names the student’s own book in tasks', () => {
    const own = buildPlan(input({ sources: { physics: { short: 'H.C. Verma', owned: true }, maths: { short: 'Cengage Maths', owned: true }, physical: { short: 'N. Awasthi', owned: true }, organic: { short: 'M.S. Chouhan', owned: true }, inorganic: { short: 'V.K. Jaiswal', owned: true }, biology: { short: '-', owned: true } } }));
    const titles = own.weeks.flatMap((w) => w.tasks).map((t) => t.title + ' ' + (t.detail ?? ''));
    expect(titles.some((t) => t.includes('H.C. Verma'))).toBe(true);
    expect(titles.some((t) => t.includes('Exemplar'))).toBe(false);
  });
});

describe('videos', () => {
  it('has at least one video for every chapter of every exam', async () => {
    const { videosFor } = await import('../data/videos');
    for (const exam of ['jee-main', 'jee-advanced', 'neet'] as const) {
      for (const c of chaptersFor(exam)) expect(videosFor(c.id, exam).length, `${exam} ${c.id}`).toBeGreaterThan(0);
    }
  });

  it('puts a PYQ video first when asked for one', async () => {
    const { videosFor } = await import('../data/videos');
    expect(videosFor('p11-06', 'jee-main', 'pyq')[0].kind).toBe('pyq');
  });
});
