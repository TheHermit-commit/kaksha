import { resolveSources } from '../data/books';
import { CHAPTER_BY_ID } from '../data/chapters';
import { EXAMS } from '../data/exams';
import type { AppState, CheckInAnswers, CheckInEntry, MockResult, Plan, Profile, Week } from '../types';
import { evaluateCheckIn } from './checkin';
import { addDays, mondayOf, todayISO } from './dates';
import { weakChapters } from './mock';
import { buildPlan } from './planner';

const STORAGE_KEY = 'kaksha:v1';

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1) return null;
    // Saved before the study-material question existed
    parsed.profile.materials ??= { owned: [], hasPyqBook: false };
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the app keeps working for this session.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function planFrom(profile: Profile, state: Pick<AppState, 'progress' | 'capacityFactors' | 'focusChapters'>, startDate: string, firstWeekNumber = 1): Plan {
  return buildPlan({
    exam: profile.exam,
    grade: profile.grade,
    examDate: profile.examDate,
    startDate,
    hoursPerDay: profile.hoursPerDay,
    studyDays: profile.studyDays,
    progress: state.progress,
    capacityFactors: state.capacityFactors,
    focusChapters: state.focusChapters,
    firstWeekNumber,
    sources: resolveSources(profile.exam, EXAMS[profile.exam].subjects, profile.materials),
    hasPyqBook: profile.materials.hasPyqBook,
  });
}

export function createState(profile: Profile, progress: Record<string, number>, today = todayISO()): AppState {
  const base = { progress, capacityFactors: {}, focusChapters: [] };
  return {
    version: 1,
    profile,
    ...base,
    plan: planFrom(profile, base, today),
    mockResults: [],
    checkins: [],
  };
}

/** Replans from today, or from tomorrow if something was already ticked off today. Past days are kept. */
export function replan(state: AppState, today = todayISO()): AppState {
  const doneToday = state.plan.weeks.some((w) => w.tasks.some((t) => t.date === today && t.done));
  const start = doneToday ? addDays(today, 1) : today;
  const startMonday = mondayOf(start);

  const kept: Week[] = state.plan.weeks.filter((w) => w.end < start);
  const partial = state.plan.weeks.find((w) => w.start === startMonday);
  const firstNumber = partial?.number ?? (kept.length ? kept[kept.length - 1].number + 1 : 1);
  const fresh = planFrom(state.profile, state, start, firstNumber);

  if (partial && fresh.weeks[0]?.start === startMonday) {
    const earlier = partial.tasks.filter((t) => t.date < start);
    const takenMocks = new Set(state.mockResults.map((r) => r.mockId));
    const keptMocks = partial.mocks.filter((m) => m.date < start || takenMocks.has(m.id));
    const head = fresh.weeks[0];
    fresh.weeks[0] = {
      ...head,
      tasks: [...earlier, ...head.tasks.filter((t) => !t.mockId || !keptMocks.some((m) => m.id === t.mockId))],
      mocks: [...keptMocks, ...head.mocks.filter((m) => !keptMocks.some((k) => k.id === m.id))],
      chapters: mergeChapters(partial.chapters, head.chapters),
    };
  }
  return {
    ...state,
    plan: { createdAt: state.plan.createdAt, weeks: [...kept, ...fresh.weeks], summary: fresh.summary },
  };
}

function mergeChapters(a: Week['chapters'], b: Week['chapters']): Week['chapters'] {
  const out = a.map((c) => ({ ...c }));
  for (const c of b) {
    const existing = out.find((o) => o.chapterId === c.chapterId);
    if (!existing) out.push({ ...c });
  }
  return out;
}

export function toggleTask(state: AppState, taskId: string): AppState {
  const progress = { ...state.progress };
  const weeks = state.plan.weeks.map((w) => {
    if (!w.tasks.some((t) => t.id === taskId)) return w;
    return {
      ...w,
      tasks: w.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const done = !t.done;
        if (t.chapterId && t.share) {
          const delta = done ? t.share : -t.share;
          progress[t.chapterId] = Math.min(1, Math.max(0, (progress[t.chapterId] ?? 0) + delta));
        }
        return { ...t, done };
      }),
    };
  });
  return { ...state, progress, plan: { ...state.plan, weeks } };
}

export function setChapterProgress(state: AppState, chapterId: string, value: number): AppState {
  return { ...state, progress: { ...state.progress, [chapterId]: value } };
}

export function recordMock(state: AppState, result: MockResult): AppState {
  const others = state.mockResults.filter((r) => r.mockId !== result.mockId);
  const mockResults = [...others, result];
  const weeks = state.plan.weeks.map((w) => ({
    ...w,
    tasks: w.tasks.map((t) => (t.mockId === result.mockId ? { ...t, done: true } : t)),
  }));
  return {
    ...state,
    mockResults,
    focusChapters: weakChapters(mockResults).map((w) => w.chapterId),
    plan: { ...state.plan, weeks },
  };
}

/** Share of the most recent finished week's study tasks that were ticked off. */
export function lastWeekCompletion(state: AppState, today = todayISO()): number | null {
  const thisMonday = mondayOf(today);
  const last = state.plan.weeks.filter((w) => w.start < thisMonday).pop();
  if (!last) return null;
  const tasks = last.tasks.filter((t) => t.kind !== 'rest');
  if (!tasks.length) return null;
  return tasks.filter((t) => t.done).length / tasks.length;
}

export function applyCheckIn(state: AppState, answers: CheckInAnswers, today = todayISO()): { state: AppState; entry: CheckInEntry } {
  const weak = weakChapters(state.mockResults);
  const outcome = evaluateCheckIn(answers, {
    name: state.profile.name,
    hoursPerDay: state.profile.hoursPerDay,
    lastWeekCompletion: lastWeekCompletion(state, today),
    weakChapterNames: weak.map((w) => CHAPTER_BY_ID[w.chapterId]?.name).filter(Boolean),
  });

  // The new load covers the next 7 days: the rest of this week and the week after.
  const thisMonday = mondayOf(today);
  const nextMonday = addDays(thisMonday, 7);
  const capacityFactors = { ...state.capacityFactors, [thisMonday]: outcome.factor, [nextMonday]: outcome.factor };
  if (outcome.extendNextWeek) {
    capacityFactors[addDays(nextMonday, 7)] = Math.min(1, outcome.factor + 0.15);
  }

  const before = state.plan.summary;
  const next = replan({ ...state, capacityFactors, focusChapters: weak.map((w) => w.chapterId) }, today);
  const after = next.plan.summary;
  const changes = [...outcome.changes];
  if (after.revisionReduced && !before.revisionReduced) {
    changes.push(`To keep your exam date, the final revision phase is now ${after.revisionWeeks} week${after.revisionWeeks === 1 ? '' : 's'}.`);
  }
  if ((after.pace === 'tight' || after.pace === 'very-tight') && before.pace !== after.pace) {
    changes.push('The weeks ahead are now tighter. Add some study time once things settle, if you can.');
  }

  const entry: CheckInEntry = {
    id: `${today}-${state.checkins.length + 1}`,
    date: today,
    answers,
    reply: outcome.reply,
    changes,
    showHelpline: outcome.showHelpline,
  };
  return { state: { ...next, checkins: [...state.checkins, entry] }, entry };
}

export function currentWeekIndex(state: AppState, today = todayISO()): number {
  const i = state.plan.weeks.findIndex((w) => w.start <= today && today <= w.end);
  if (i >= 0) return i;
  return today < (state.plan.weeks[0]?.start ?? today) ? 0 : Math.max(0, state.plan.weeks.length - 1);
}
