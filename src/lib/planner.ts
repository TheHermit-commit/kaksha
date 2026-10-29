import { resolveSources } from '../data/books';
import { chapterHours, chaptersFor, CHAPTER_BY_ID, trackOf } from '../data/chapters';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import type {
  Chapter,
  ExamId,
  Grade,
  MockSpec,
  Pace,
  Phase,
  Plan,
  PlanSummary,
  SubjectId,
  Task,
  Track,
  Week,
} from '../types';
import { addDays, diffDays, mondayOf, weekdayIndex } from './dates';
import { pyqWording, stageFor, studyWording, type SourceRef } from './wording';

export interface PlanInput {
  exam: ExamId;
  grade: Grade;
  examDate: string;
  /** First day the plan may schedule work on */
  startDate: string;
  hoursPerDay: number;
  studyDays: 5 | 6;
  /** Fraction of each chapter already done, 0..1 */
  progress: Record<string, number>;
  /** Study-time multiplier per week, keyed by Monday */
  capacityFactors?: Record<string, number>;
  /** Chapters to revise first */
  focusChapters?: string[];
  firstWeekNumber?: number;
  /** Main practice source per track; defaults to the recommended books */
  sources?: Record<Track, SourceRef>;
  hasPyqBook?: boolean;
}

/** Share of each study day spent on new chapters; the rest goes to revision. */
export const NEW_SHARE = 0.8;
/** Above this, extra time turns into practice weeks instead of slower chapters. */
const MAX_STRETCH = 1.25;
/** Below this, the plan gives up consolidation weeks and then revision weeks. */
const SQUEEZE_BELOW = 0.85;

export const PHASE_NAMES: Record<Phase, string> = {
  learn: 'Learning',
  consolidate: 'Catch-up and revision',
  practice: 'Practice',
  revision: 'Final revision',
};

function round(value: number, step = 0.25): number {
  return Math.round(value / step) * step;
}

/**
 * Study order within each subject. Class 11 students and droppers go in NCERT order.
 * Class 12 students alternate between a Class 12 chapter (to keep pace with school)
 * and a pending Class 11 chapter. Topics outside the current NCERT books come last.
 */
export function orderChapters(chapters: Chapter[], grade: Grade): Chapter[] {
  const bySubject = new Map<SubjectId, Chapter[]>();
  for (const c of chapters) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
    bySubject.get(c.subject)!.push(c);
  }
  const ordered: Chapter[] = [];
  for (const list of bySubject.values()) {
    const c11 = list.filter((c) => c.classLevel === 11);
    const c12 = list.filter((c) => c.classLevel === 12);
    const extra = list.filter((c) => c.classLevel === 0);
    if (grade === '12') {
      for (let i = 0; i < Math.max(c11.length, c12.length); i++) {
        if (c12[i]) ordered.push(c12[i]);
        if (c11[i]) ordered.push(c11[i]);
      }
    } else {
      ordered.push(...c11, ...c12);
    }
    ordered.push(...extra);
  }
  return ordered;
}

interface WeekFrame {
  start: string;
  end: string;
  studyDates: string[];
  mockDate: string | null;
  midweekDate: string | null;
  restDate: string | null;
  factor: number;
  capacity: number;
}

function frameWeeks(input: PlanInput): WeekFrame[] {
  const frames: WeekFrame[] = [];
  const last = addDays(input.examDate, -1);
  for (let start = mondayOf(input.startDate); start <= last; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const factor = input.capacityFactors?.[start] ?? 1;
    const inRange = (d: string) => d >= input.startDate && d <= last;
    const studyDates: string[] = [];
    for (let i = 0; i < input.studyDays; i++) {
      const d = addDays(start, i);
      if (inRange(d)) studyDates.push(d);
    }
    const sat = addDays(start, 5);
    const wed = addDays(start, 2);
    frames.push({
      start,
      end,
      studyDates,
      mockDate: inRange(end) ? end : null,
      midweekDate: studyDates.includes(wed) ? wed : null,
      restDate: input.studyDays === 5 && inRange(sat) ? sat : null,
      factor,
      capacity: input.hoursPerDay * studyDates.length * factor,
    });
  }
  return frames;
}

function defaultRevisionWeeks(total: number): number {
  if (total <= 2) return 0;
  if (total <= 8) return 1;
  return Math.min(8, Math.max(2, Math.round(total * 0.15)));
}

function assignPhases(total: number, revision: number, withConsolidation: boolean): Phase[] {
  const pre = total - revision;
  const phases: Phase[] = [];
  for (let i = 0; i < total; i++) {
    if (i >= pre) phases.push('revision');
    else if (withConsolidation && pre >= 12 && i % 6 === 5 && i < pre - 1) phases.push('consolidate');
    else phases.push('learn');
  }
  return phases;
}

function paceFor(ratio: number): Pace {
  if (ratio >= 1.2) return 'comfortable';
  if (ratio >= 1) return 'balanced';
  if (ratio >= 0.75) return 'tight';
  return 'very-tight';
}

interface QueueItem {
  chapter: Chapter;
  /** Effective hours for the remaining part */
  total: number;
  left: number;
  /** Progress before this plan, 0..1 */
  startProgress: number;
}

interface Piece {
  item: QueueItem;
  hours: number;
  /** Hours of the chapter scheduled before this piece */
  offset: number;
}

export function buildPlan(input: PlanInput): Plan {
  const exam = EXAMS[input.exam];
  const chapters = orderChapters(chaptersFor(input.exam), input.grade);
  const progressOf = (id: string) => Math.min(1, Math.max(0, input.progress[id] ?? 0));

  const pending = chapters.filter((c) => 1 - progressOf(c.id) > 0.01);
  const baseHours = (c: Chapter) => chapterHours(c, exam.depth) * (1 - progressOf(c.id));
  const hoursNeeded = pending.reduce((sum, c) => sum + baseHours(c), 0);

  const frames = frameWeeks(input);
  const total = frames.length;

  // Fit phases to the time available, giving up buffer weeks before squeezing chapters.
  const learnCapacity = (phases: Phase[]) =>
    frames.reduce((sum, f, i) => sum + (phases[i] === 'learn' ? f.capacity * NEW_SHARE : 0), 0);
  const ratioFor = (cap: number) => (hoursNeeded > 0 ? cap / hoursNeeded : Infinity);

  const defaultRevision = defaultRevisionWeeks(total);
  let revision = defaultRevision;
  let consolidation = true;
  let phases = assignPhases(total, revision, consolidation);
  let ratio = ratioFor(learnCapacity(phases));
  if (ratio < SQUEEZE_BELOW) {
    consolidation = false;
    phases = assignPhases(total, revision, consolidation);
    ratio = ratioFor(learnCapacity(phases));
  }
  const minRevision = total > 2 ? 1 : 0;
  while (ratio < SQUEEZE_BELOW && revision > minRevision) {
    revision--;
    phases = assignPhases(total, revision, consolidation);
    ratio = ratioFor(learnCapacity(phases));
  }
  const scale = Number.isFinite(ratio) ? Math.min(ratio, MAX_STRETCH) : 1;

  const queues = new Map<SubjectId, QueueItem[]>();
  for (const s of exam.subjects) queues.set(s, []);
  for (const c of pending) {
    const h = baseHours(c) * scale;
    queues.get(c.subject)!.push({ chapter: c, total: h, left: h, startProgress: progressOf(c.id) });
  }
  const remaining = () => [...queues.values()].flat().reduce((sum, q) => sum + q.left, 0);
  const sources = input.sources ?? resolveSources(input.exam, exam.subjects, { owned: [], hasPyqBook: false });
  /** Chapters that have had their first study session */
  const started = new Set(chapters.filter((c) => progressOf(c.id) > 0.01).map((c) => c.id));

  // Revision rotation state
  const finished: string[] = chapters.filter((c) => progressOf(c.id) >= 0.99).map((c) => c.id);
  const lastRevised: Record<string, string> = {};
  const focus = [...(input.focusChapters ?? [])];
  const pickRevision = (date: string, exclude: Set<string>): string | null => {
    while (focus.length) {
      const id = focus.shift()!;
      if (CHAPTER_BY_ID[id] && !exclude.has(id)) {
        lastRevised[id] = date;
        return id;
      }
    }
    const candidates = finished.filter((id) => !exclude.has(id));
    if (!candidates.length) return null;
    candidates.sort((a, b) => (lastRevised[a] ?? '').localeCompare(lastRevised[b] ?? ''));
    lastRevised[candidates[0]] = date;
    return candidates[0];
  };

  const fullOrder = interleaveBySubject(chapters);
  let fullRotation = 0;
  const revisionStudyDays = frames.reduce((sum, f, i) => sum + (phases[i] === 'revision' ? f.studyDates.length : 0), 0);
  const perRevisionDay = Math.min(4, Math.max(1, Math.ceil(chapters.length / Math.max(1, revisionStudyDays))));

  const weeks: Week[] = [];
  let learnWeekCount = 0;
  let learningEnds: string | null = null;
  const touched = new Set<string>(finished);
  const firstNumber = input.firstWeekNumber ?? 1;

  frames.forEach((frame, wi) => {
    let phase = phases[wi];
    if (phase === 'learn' && remaining() <= 0.01) phase = 'practice';
    const tasks: Task[] = [];
    const mocks: MockSpec[] = [];
    const weekChapters: { chapterId: string; hours: number }[] = [];
    const dailyHours = input.hoursPerDay * frame.factor;
    const isLastLearnWeek = phase === 'learn' && phases.slice(wi + 1).every((p) => p !== 'learn');
    let n = 0;
    const add = (t: Omit<Task, 'id' | 'done'>) => tasks.push({ ...t, id: `${t.date}-${n++}`, done: false });

    if (phase === 'learn' && frame.studyDates.length) {
      learnWeekCount++;
      const budget = isLastLearnWeek ? Infinity : frame.capacity * NEW_SHARE;
      const remTotal = remaining();
      const piecesBySubject = new Map<SubjectId, Piece[]>();
      for (const [subject, queue] of queues) {
        const remSubject = queue.reduce((s, q) => s + q.left, 0);
        let subjectBudget = budget === Infinity ? remSubject : (budget * remSubject) / remTotal;
        const pieces: Piece[] = [];
        while (subjectBudget > 0.01 && queue.length) {
          const head = queue[0];
          const h = Math.min(subjectBudget, head.left);
          pieces.push({ item: head, hours: h, offset: head.total - head.left });
          head.left -= h;
          subjectBudget -= h;
          if (head.left <= 0.01) {
            queue.shift();
            finished.push(head.chapter.id);
          }
        }
        piecesBySubject.set(subject, pieces);
        for (const p of pieces) {
          touched.add(p.item.chapter.id);
          const existing = weekChapters.find((w) => w.chapterId === p.item.chapter.id);
          if (existing) existing.hours += p.hours;
          else weekChapters.push({ chapterId: p.item.chapter.id, hours: p.hours });
        }
      }
      if (remaining() <= 0.01) learningEnds = frame.end;

      // The last study day of the week is PYQ day: every chapter studied this week gets
      // one day's share of its hours as past-paper practice. The other days are for learning.
      const days = frame.studyDates;
      const pyqDate = days.length >= 2 ? days[days.length - 1] : null;
      const learnDays = pyqDate ? days.slice(0, -1) : days;
      const pyqShare = pyqDate ? 1 / days.length : 0;
      const dayTasks: Omit<Task, 'id' | 'done'>[][] = learnDays.map(() => []);
      const pyqTasks: Omit<Task, 'id' | 'done'>[] = [];
      for (const pieces of piecesBySubject.values()) {
        if (pyqDate) {
          for (const p of pieces) {
            const h = p.hours * pyqShare;
            const share = p.item.total > 0 ? (h / p.item.total) * (1 - p.item.startProgress) : 0;
            const existing = pyqTasks.find((t) => t.chapterId === p.item.chapter.id);
            if (existing) {
              existing.hours += h;
              existing.share = (existing.share ?? 0) + share;
            } else {
              pyqTasks.push({ date: pyqDate, ...pyqWording(p.item.chapter, input.exam, input.hasPyqBook ?? false), subject: p.item.chapter.subject, chapterId: p.item.chapter.id, hours: h, share });
            }
          }
        }
        const learnPieces = pieces.map((p) => ({ ...p, hours: p.hours * (1 - pyqShare) }));
        const subjectTotal = learnPieces.reduce((sum, p) => sum + p.hours, 0);
        const perDay = subjectTotal / learnDays.length;
        let pi = 0;
        let used = 0; // hours of learnPieces[pi] already placed on earlier days
        learnDays.forEach((date, di) => {
          let dayLeft = di === learnDays.length - 1 ? Infinity : perDay;
          while (dayLeft > 0.01 && pi < learnPieces.length) {
            const { item, hours, offset } = learnPieces[pi];
            const h = Math.min(dayLeft, hours - used);
            const portion = 1 - item.startProgress;
            const share = item.total > 0 ? (h / item.total) * portion : 0;
            const progressAfter = item.startProgress + ((offset + used + h) / item.total) * portion;
            const first = !started.has(item.chapter.id);
            started.add(item.chapter.id);
            const stage = stageFor(trackOf(item.chapter), first, progressAfter);
            dayTasks[di].push({
              date,
              ...studyWording(item.chapter, stage, sources[trackOf(item.chapter)]),
              subject: item.chapter.subject,
              chapterId: item.chapter.id,
              hours: h,
              share,
            });
            dayLeft -= h;
            used += h;
            if (hours - used <= 0.01) {
              pi++;
              used = 0;
            }
          }
        });
      }
      const thisWeek = new Set(weekChapters.map((w) => w.chapterId));
      const revisionHours = Math.max(0.25, round(dailyHours * (1 - NEW_SHARE)));
      learnDays.forEach((date, di) => {
        for (const t of mergeSameChapter(dayTasks[di])) add({ ...t, hours: Math.max(0.25, round(t.hours)) });
        add(revisionTask(date, pickRevision(date, thisWeek), revisionHours));
      });
      if (pyqDate) {
        for (const t of pyqTasks) add({ ...t, hours: Math.max(0.25, round(t.hours)) });
        add(revisionTask(pyqDate, pickRevision(pyqDate, thisWeek), revisionHours, true));
      }

      if (frame.mockDate && weekChapters.length) {
        const cumulative = learnWeekCount % 4 === 0;
        if (cumulative) {
          mocks.push(makeMock(frame.mockDate, 'sun', 'cumulative', 'Cumulative mock', [...touched], 25, exam.minutesPerQuestion));
        } else {
          const ids = weekChapters.map((w) => w.chapterId);
          const extra = finished.filter((id) => !ids.includes(id)).slice(-2);
          const all = [...ids, ...extra];
          mocks.push(makeMock(frame.mockDate, 'sun', 'weekly', 'Weekly mock', all, Math.min(25, all.length * 3), exam.minutesPerQuestion));
        }
      }
    } else if ((phase === 'consolidate' || phase === 'practice') && frame.studyDates.length) {
      for (const date of frame.studyDates) {
        if (phase === 'consolidate') {
          const exclude = new Set<string>();
          for (let k = 0; k < 2; k++) {
            const id = pickRevision(date, exclude);
            if (!id) break;
            exclude.add(id);
            add(revisionTask(date, id, round(dailyHours * 0.35)));
          }
          add({
            date,
            kind: 'review',
            title: 'Re-solve wrong questions from your mocks',
            detail: 'Try each one again without looking at the solution, then check.',
            hours: Math.max(0.5, round(dailyHours * 0.3)),
          });
        } else {
          const subject = exam.subjects[weekdayIndex(date) % exam.subjects.length];
          add({
            date,
            kind: 'practice',
            title: `Mixed PYQ practice: ${SUBJECT_NAMES[subject]}`,
            detail: 'Pick a past paper section and solve it under time. Note every concept you got stuck on.',
            subject,
            hours: Math.max(0.5, round(dailyHours * 0.6)),
          });
          add(revisionTask(date, pickRevision(date, new Set()), Math.max(0.25, round(dailyHours * 0.4))));
        }
      }
      if (frame.mockDate) {
        const ids = phase === 'practice' ? chapters.map((c) => c.id) : [...touched];
        const kind = phase === 'practice' ? 'full' : 'cumulative';
        mocks.push(makeMock(frame.mockDate, 'sun', kind, kind === 'full' ? 'Full syllabus mock' : 'Cumulative mock', ids, kind === 'full' ? 30 : 25, exam.minutesPerQuestion));
      }
    } else if (phase === 'revision' && frame.studyDates.length) {
      for (const date of frame.studyDates) {
        if (date === frame.midweekDate) {
          mocks.push(makeMock(date, 'wed', 'full', 'Midweek full mock', chapters.map((c) => c.id), 30, exam.minutesPerQuestion));
          continue;
        }
        const hoursEach = round((dailyHours * 0.85) / perRevisionDay);
        for (let k = 0; k < perRevisionDay; k++) {
          const c = fullOrder[fullRotation % fullOrder.length];
          fullRotation++;
          add({
            date,
            kind: 'revise',
            title: `Revise ${c.name}`,
            detail:
              c.subject === 'maths' || c.subject === 'physics'
                ? 'Go through your notes and formula sheet, then do 10 quick PYQs.'
                : 'Go through your notes and NCERT highlights, then do 10 quick PYQs.',
            subject: c.subject,
            chapterId: c.id,
            hours: Math.max(0.25, hoursEach),
          });
        }
      }
      if (frame.mockDate) {
        mocks.push(makeMock(frame.mockDate, 'sun', 'full', 'Full syllabus mock', chapters.map((c) => c.id), 30, exam.minutesPerQuestion));
      }
    }

    for (const m of mocks) {
      add({ date: m.date, kind: 'mock', title: m.title, detail: `${m.questionCount} questions · ${m.durationMin} minutes`, hours: round(m.durationMin / 60), mockId: m.id });
      add({ date: m.date, kind: 'review', title: 'Review the mock', detail: 'Read the solution of every wrong or skipped question and note the concept behind it.', hours: 1 });
    }
    if (frame.restDate) {
      add({ date: frame.restDate, kind: 'rest', title: 'Rest day', detail: 'Take the day off, or catch up on anything you missed this week.', hours: 0 });
    }
    tasks.sort((a, b) => a.date.localeCompare(b.date));

    weeks.push({
      start: frame.start,
      end: frame.end,
      number: firstNumber + wi,
      phase,
      factor: frame.factor,
      chapters: weekChapters.map((w) => ({ ...w, hours: round(w.hours, 0.5) })),
      tasks,
      mocks,
      note: weekNote(frame.factor),
    });
  });

  const count = (p: Phase) => weeks.filter((w) => w.phase === p).length;
  const perSubject = exam.subjects.map((subject) => {
    const list = pending.filter((c) => c.subject === subject);
    return { subject, chapters: list.length, hours: Math.round(list.reduce((s, c) => s + baseHours(c), 0)) };
  });
  const summary: PlanSummary = {
    totalWeeks: total,
    learnWeeks: count('learn'),
    consolidationWeeks: count('consolidate'),
    practiceWeeks: count('practice'),
    revisionWeeks: count('revision'),
    revisionReduced: revision < defaultRevision,
    chaptersLeft: pending.length,
    hoursNeeded: Math.round(hoursNeeded),
    hoursAvailable: Math.round(learnCapacity(phases)),
    ratio: Number.isFinite(ratio) ? ratio : 99,
    pace: paceFor(ratio),
    learningEnds,
    perSubject,
  };
  return { createdAt: input.startDate, weeks, summary };
}

/** Joins consecutive tasks on the same chapter so a day shows one line per chapter. */
function mergeSameChapter<T extends { chapterId?: string; hours: number; share?: number; kind: string; title: string; detail?: string }>(list: T[]): T[] {
  const out: T[] = [];
  for (const t of list) {
    const prev = out[out.length - 1];
    if (prev && prev.chapterId === t.chapterId) {
      prev.hours += t.hours;
      prev.share = (prev.share ?? 0) + (t.share ?? 0);
      prev.kind = t.kind;
      prev.title = t.title;
      prev.detail = t.detail;
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

function revisionTask(date: string, chapterId: string | null, hours: number, pyq = false): Omit<Task, 'id' | 'done'> {
  if (chapterId && pyq) {
    const c = CHAPTER_BY_ID[chapterId];
    return { date, kind: 'pyq', title: `PYQs from an earlier chapter: ${c.name}`, detail: 'Ten quick past-paper questions to check you still remember it.', subject: c.subject, chapterId, hours };
  }
  if (!chapterId) {
    return { date, kind: 'revise', title: 'Revise this week’s notes', detail: 'Read through your notes and formula list from the start of the week.', hours };
  }
  const c = CHAPTER_BY_ID[chapterId];
  return {
    date,
    kind: 'revise',
    title: `Revise ${c.name}`,
    detail: 'Write down what you remember first, then check it against your notes.',
    subject: c.subject,
    chapterId,
    hours,
  };
}

function makeMock(date: string, slot: string, kind: MockSpec['kind'], title: string, chapterIds: string[], count: number, minutesPerQuestion: number): MockSpec {
  const questionCount = Math.max(5, count);
  return {
    id: `${mondayOf(date)}-${slot}`,
    date,
    kind,
    title,
    chapterIds: [...new Set(chapterIds)],
    questionCount,
    durationMin: Math.max(10, Math.round(questionCount * minutesPerQuestion)),
  };
}

function interleaveBySubject(chapters: Chapter[]): Chapter[] {
  const groups = new Map<SubjectId, Chapter[]>();
  for (const c of chapters) {
    if (!groups.has(c.subject)) groups.set(c.subject, []);
    groups.get(c.subject)!.push(c);
  }
  const lists = [...groups.values()];
  const out: Chapter[] = [];
  for (let i = 0; out.length < chapters.length; i++) {
    for (const l of lists) if (l[i]) out.push(l[i]);
  }
  return out;
}

function weekNote(factor: number): string | undefined {
  if (factor < 0.98) return `Lighter week: about ${Math.round(factor * 100)}% of your usual study time.`;
  if (factor > 1.02) return `Heavier week: about ${Math.round(factor * 100)}% of your usual study time.`;
  return undefined;
}

export function weeksUntil(fromDate: string, examDate: string): number {
  return Math.max(0, Math.ceil(diffDays(fromDate, examDate) / 7));
}
