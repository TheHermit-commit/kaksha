import { EXAMS } from '../data/exams';
import { dayName, formatDate, todayISO } from '../lib/dates';
import { href } from '../lib/router';
import type { AppState, MockSpec } from '../types';

const KIND_LABEL: Record<MockSpec['kind'], string> = {
  weekly: 'This week’s chapters',
  cumulative: 'Everything so far',
  full: 'Full syllabus',
};

export default function Mocks({ state }: { state: AppState }) {
  const today = todayISO();
  const exam = EXAMS[state.profile.exam];
  const all = state.plan.weeks.flatMap((w) => w.mocks.map((m) => ({ ...m, week: w.number })));
  const results = new Map(state.mockResults.map((r) => [r.mockId, r]));
  const pending = all.filter((m) => !results.has(m.id));
  const due = pending.filter((m) => m.date <= today);
  const upcoming = pending.filter((m) => m.date > today).slice(0, 4);
  const taken = [...state.mockResults].sort((a, b) => b.date.localeCompare(a.date));

  const avg = taken.length ? taken.reduce((s, r) => s + r.score / r.maxScore, 0) / taken.length : null;

  return (
    <main className="page">
      <div className="stack">
        <h1>Mock tests</h1>
        <p className="muted" style={{ maxWidth: '64ch' }}>
          Every mock is timed and marked like {exam.name} ({exam.pattern.split('·').pop()?.trim()}). Questions are written in the style of past papers and drawn from the chapters you have covered.
        </p>
      </div>

      {taken.length > 0 && (
        <div className="stats">
          <div className="stat"><span className="value">{taken.length}</span><span className="label">mocks taken</span></div>
          <div className="stat"><span className="value">{Math.round((avg ?? 0) * 100)}%</span><span className="label">average score</span></div>
          <div className="stat"><span className="value">{due.length}</span><span className="label">waiting for you</span></div>
        </div>
      )}

      {due.length > 0 && (
        <section className="section">
          <h2>Ready to take</h2>
          <MockList items={due} />
        </section>
      )}

      <section className="section">
        <h2>Coming up</h2>
        {upcoming.length ? <MockList items={upcoming} early /> : <p className="muted">No more mocks are scheduled.</p>}
      </section>

      <section className="section">
        <h2>Your results</h2>
        {taken.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mock</th><th>Date</th><th className="n">Score</th><th className="n">Correct</th><th className="n">Wrong</th><th /></tr>
              </thead>
              <tbody>
                {taken.map((r) => (
                  <tr key={r.mockId}>
                    <td>{r.title}</td>
                    <td>{formatDate(r.date)}</td>
                    <td className="n">{r.score}/{r.maxScore}</td>
                    <td className="n">{r.correct}</td>
                    <td className="n">{r.wrong}</td>
                    <td><a href={href({ name: 'mock', id: r.mockId })}>Review</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Your first mock is on Sunday. Results and weak chapters will show up here.</p>
        )}
      </section>
    </main>
  );
}

function MockList({ items, early }: { items: (MockSpec & { week: number })[]; early?: boolean }) {
  return (
    <div className="list">
      {items.map((m) => (
        <div key={m.id} className="list-row">
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{m.title} <span className="chip">{KIND_LABEL[m.kind]}</span></div>
            <div className="small muted">
              Week {m.week} · {dayName(m.date)} {formatDate(m.date)} · {m.questionCount} questions · {m.durationMin} min
            </div>
          </div>
          <a className={`btn btn-sm${early ? '' : ' btn-primary'}`} href={href({ name: 'mock', id: m.id })}>
            {early ? 'Take early' : 'Start'}
          </a>
        </div>
      ))}
    </div>
  );
}
