import { useState } from 'react';
import type { Update } from '../App';
import TodayPanel from '../components/TodayPanel';
import { CHAPTER_BY_ID } from '../data/chapters';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import { dayName, diffDays, formatDate, todayISO } from '../lib/dates';
import { PHASE_NAMES } from '../lib/planner';
import { href, navigate } from '../lib/router';
import { currentWeekIndex, toggleTask } from '../lib/state';
import type { AppState, Task } from '../types';

function hoursLabel(h: number): string {
  const minutes = Math.round(h * 4) * 15;
  if (minutes <= 0) return '';
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

export default function Planner({ state, update }: { state: AppState; update: Update }) {
  const today = todayISO();
  const current = currentWeekIndex(state, today);
  const [index, setIndex] = useState(current);
  const weeks = state.plan.weeks;
  const week = weeks[Math.min(index, weeks.length - 1)];
  const exam = EXAMS[state.profile.exam];
  const daysLeft = diffDays(today, state.profile.examDate);

  if (!week) {
    return (
      <main className="page narrow">
        <h1>Your plan has ended</h1>
        <p className="muted">The exam date in your profile has passed. Set a new date to build a fresh plan.</p>
        <a className="btn btn-primary" href={href({ name: 'profile' })}>Go to profile</a>
      </main>
    );
  }

  const results = new Map(state.mockResults.map((r) => [r.mockId, r]));
  const studyTasks = week.tasks.filter((t) => t.kind !== 'rest');
  const doneCount = studyTasks.filter((t) => t.done).length;
  const missed = weeks
    .flatMap((w) => w.tasks)
    .filter((t) => t.date < today && !t.done && (t.kind === 'learn' || t.kind === 'practice')).length;

  const byDate = new Map<string, Task[]>();
  for (const t of week.tasks) {
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date)!.push(t);
  }

  return (
    <main className="page">
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">
            Week {week.number} of {weeks[weeks.length - 1].number} · {PHASE_NAMES[week.phase]}
          </span>
          <h1>{formatDate(week.start)} – {formatDate(week.end)}</h1>
        </div>
        <div className="stack" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="num" style={{ fontSize: '1.6rem' }}>{Math.max(0, daysLeft)}</span>
          <span className="small muted">days to {exam.name}</span>
        </div>
      </div>

      <div className="spread">
        <div className="row">
          <button className="btn btn-sm" disabled={index <= 0} onClick={() => setIndex(index - 1)} aria-label="Previous week">← Previous</button>
          <button className="btn btn-sm" disabled={index === current} onClick={() => setIndex(current)}>This week</button>
          <button className="btn btn-sm" disabled={index >= weeks.length - 1} onClick={() => setIndex(index + 1)} aria-label="Next week">Next →</button>
        </div>
        <div className="row" style={{ minWidth: 200 }}>
          <div className="bar" style={{ flex: 1, minWidth: 120 }}>
            <i style={{ width: `${studyTasks.length ? (doneCount / studyTasks.length) * 100 : 0}%` }} />
          </div>
          <span className="small num muted">{doneCount}/{studyTasks.length} done</span>
        </div>
      </div>

      {index === current && today >= week.start && today <= week.end && (
        <TodayPanel today={today} tasks={week.tasks.filter((t) => t.date === today)} exam={state.profile.exam} />
      )}

      {week.note && <div className="callout callout-accent small">{week.note}</div>}
      {missed > 0 && index === current && (
        <div className="callout callout-warn">
          <p>
            <strong>{missed} study task{missed === 1 ? '' : 's'} from earlier days {missed === 1 ? 'is' : 'are'} unfinished.</strong> That happens. Check in with your trainer and the plan will move them into the coming weeks.
          </p>
          <div><a className="btn btn-sm" href={href({ name: 'trainer' })}>Check in now</a></div>
        </div>
      )}

      {week.chapters.length > 0 && (
        <section className="stack">
          <span className="eyebrow">Chapters this week</span>
          <div className="row">
            {week.chapters.map((c) => {
              const ch = CHAPTER_BY_ID[c.chapterId];
              return (
                <span key={c.chapterId} className="chip" title={SUBJECT_NAMES[ch.subject]}>
                  <span className={`subject-dot s-${ch.subject}`} /> {ch.name} <span className="num">· {c.hours} h</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      <section>
        {[...byDate.entries()].map(([date, tasks]) => (
          <div key={date} id={date === today ? 'today-tasks' : undefined} className={`day${date === today ? ' today' : ''}`}>
            <div className="day-head">
              <h3>{dayName(date)} {formatDate(date)}</h3>
              {date === today && <span className="chip chip-accent">Today</span>}
              {tasks.length > 0 && tasks.every((t) => t.kind === 'pyq') && <span className="chip chip-warn">PYQ day</span>}
              <span className="small muted num">
                {hoursLabel(tasks.reduce((sum, t) => sum + t.hours, 0))}
              </span>
            </div>
            {tasks.map((t) => {
              if (t.kind === 'mock') {
                const r = results.get(t.mockId!);
                return (
                  <div key={t.id} className="task task-mock">
                    <div className="body">
                      <div className="title">{t.title}</div>
                      <div className="meta">{t.detail}</div>
                    </div>
                    {r ? (
                      <a className="btn btn-sm" href={href({ name: 'mock', id: t.mockId! })}>
                        Score <span className="num">{r.score}/{r.maxScore}</span>
                      </a>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => navigate({ name: 'mock', id: t.mockId! })}>
                        {date > today ? 'Take early' : 'Start mock'}
                      </button>
                    )}
                  </div>
                );
              }
              const missedTask = !t.done && t.date < today && t.kind !== 'rest';
              return (
                <label key={t.id} className={`task${t.done ? ' done' : ''}${t.kind === 'rest' ? ' task-rest' : ''}`}>
                  {t.kind !== 'rest' ? (
                    <input type="checkbox" checked={t.done} onChange={() => update((s) => toggleTask(s, t.id))} />
                  ) : (
                    <span style={{ width: 18 }} />
                  )}
                  <span className="body">
                    <span className="title">{t.title}</span>
                    <span className="meta">
                      {t.subject && <><span className={`subject-dot s-${t.subject}`} />{SUBJECT_NAMES[t.subject]}</>}
                      {t.detail && <span>{t.detail}</span>}
                      {missedTask && <span className="chip chip-warn">Missed</span>}
                    </span>
                  </span>
                  <span className="hours">{hoursLabel(t.hours)}</span>
                </label>
              );
            })}
          </div>
        ))}
        {byDate.size === 0 && <p className="muted">Nothing is scheduled this week.</p>}
      </section>
    </main>
  );
}
