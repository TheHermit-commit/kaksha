import { useEffect, useMemo, useRef, useState } from 'react';
import type { Update } from '../App';
import { CHAPTER_BY_ID } from '../data/chapters';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import { QUESTION_BY_ID } from '../data/questions';
import { todayISO } from '../lib/dates';
import { isCorrect, pickQuestions, scoreMock } from '../lib/mock';
import { href } from '../lib/router';
import { recordMock } from '../lib/state';
import type { AppState, MockResult, Question } from '../types';

type Phase = 'intro' | 'running' | 'result';

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(r).padStart(2, '0')}`;
}

export default function MockTest({ state, update, mockId }: { state: AppState; update: Update; mockId: string }) {
  const spec = state.plan.weeks.flatMap((w) => w.mocks).find((m) => m.id === mockId);
  const existing = state.mockResults.find((r) => r.mockId === mockId);
  const exam = EXAMS[state.profile.exam];
  const questions = useMemo(() => (spec ? pickQuestions(spec, state.profile.exam) : []), [spec, state.profile.exam]);

  const [phase, setPhase] = useState<Phase>(existing ? 'result' : 'intro');
  const [result, setResult] = useState<MockResult | undefined>(existing);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submitted = useRef(false);

  const durationSec = (spec?.durationMin ?? 0) * 60;
  const elapsed = phase === 'running' ? (now - startedAt) / 1000 : 0;
  const remaining = durationSec - elapsed;

  useEffect(() => {
    if (phase !== 'running') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  const submit = () => {
    if (!spec || submitted.current) return;
    submitted.current = true;
    const r = scoreMock({ id: spec.id, title: spec.title, date: todayISO() }, questions, answers, state.profile.exam, Math.round((Date.now() - startedAt) / 1000));
    update((s) => recordMock(s, r));
    setResult(r);
    setPhase('result');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (phase === 'running' && remaining <= 0) submit();
  });

  if (!spec) {
    return (
      <main className="page narrow">
        <h1>Mock not found</h1>
        <p className="muted">This mock is no longer in your plan. It may have moved when the plan was rebuilt.</p>
        <a className="btn" href={href({ name: 'mocks' })}>All mock tests</a>
      </main>
    );
  }

  if (phase === 'intro') {
    const subjects = [...new Set(questions.map((q) => CHAPTER_BY_ID[q.chapterId].subject))];
    return (
      <main className="page narrow">
        <div className="stack">
          <span className="eyebrow">Mock test</span>
          <h1>{spec.title}</h1>
          <p className="muted">{subjects.map((s) => SUBJECT_NAMES[s]).join(', ')}</p>
        </div>
        <div className="stats">
          <div className="stat"><span className="value">{questions.length}</span><span className="label">questions</span></div>
          <div className="stat"><span className="value">{spec.durationMin}</span><span className="label">minutes</span></div>
          <div className="stat"><span className="value">+{exam.marking.correct} / {exam.marking.wrong}</span><span className="label">marking</span></div>
        </div>
        <ul className="stack small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Sit somewhere quiet and keep a rough sheet and pen ready. No calculator, as in the real exam.</li>
          <li>Questions with options have one correct answer. For numerical questions, type the number.</li>
          {exam.marking.numericalWrong === 0 && <li>Wrong numerical answers get no negative marks.</li>}
          <li>The question palette uses the NTA colours: green for answered, red for visited but not answered, purple for marked for review.</li>
          <li>The test submits itself when the timer reaches zero.</li>
        </ul>
        {questions.length < spec.questionCount && (
          <p className="hint">The question bank has {questions.length} questions for these chapters, so this mock is shorter than planned.</p>
        )}
        <div className="row">
          <button
            className="btn btn-primary btn-lg"
            disabled={!questions.length}
            onClick={() => {
              setStartedAt(Date.now());
              setNow(Date.now());
              setVisited(new Set([questions[0].id]));
              setPhase('running');
            }}
          >
            Start the timer
          </button>
          <a className="btn btn-ghost" href={href({ name: 'planner' })}>Not now</a>
        </div>
      </main>
    );
  }

  if (phase === 'result' && result) {
    return <Result result={result} onRetake={() => {
      submitted.current = false;
      setAnswers({});
      setMarked(new Set());
      setCurrent(0);
      setPhase('intro');
    }} />;
  }

  const q = questions[current];
  const go = (i: number) => {
    setCurrent(i);
    setVisited((v) => new Set(v).add(questions[i].id));
  };
  const setAnswer = (value: string) => setAnswers((a) => ({ ...a, [q.id]: value }));
  const clear = () => setAnswers((a) => { const n = { ...a }; delete n[q.id]; return n; });
  const toggleMark = () => setMarked((m) => { const n = new Set(m); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; });
  const answered = (id: string) => answers[id] !== undefined && answers[id].trim() !== '';
  const answeredCount = questions.filter((x) => answered(x.id)).length;

  return (
    <main className="page">
      <div className="exam-bar">
        <div>
          <div style={{ fontWeight: 700 }}>{spec.title}</div>
          <div className="small muted">Question {current + 1} of {questions.length} · {SUBJECT_NAMES[CHAPTER_BY_ID[q.chapterId].subject]}</div>
        </div>
        <span className={`timer${remaining < 300 ? ' low' : ''}`} aria-live="off">{clock(remaining)}</span>
      </div>

      <div className="exam-shell">
        <section className="stack-lg">
          <p className="q-text">{q.text}</p>
          {q.type === 'mcq' ? (
            <div className="options">
              {q.options!.map((o, i) => (
                <button key={i} className="option" aria-pressed={answers[q.id] === String(i)} onClick={() => setAnswer(String(i))}>
                  <span className="bubble">{'ABCD'[i]}</span>
                  <span>{o}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="field" style={{ maxWidth: 260 }}>
              <label htmlFor={`ans-${q.id}`}>Your answer</label>
              <input id={`ans-${q.id}`} className="input num" inputMode="decimal" value={answers[q.id] ?? ''} onChange={(e) => setAnswer(e.target.value.replace(/[^0-9.\-]/g, ''))} placeholder="Type a number" />
            </div>
          )}
          <div className="row">
            <button className="btn btn-primary" onClick={() => go(Math.min(questions.length - 1, current + 1))} disabled={current === questions.length - 1}>Save and next</button>
            <button className="btn" onClick={toggleMark}>{marked.has(q.id) ? 'Unmark' : 'Mark for review'}</button>
            <button className="btn btn-ghost" onClick={clear}>Clear answer</button>
            <button className="btn btn-ghost" onClick={() => go(Math.max(0, current - 1))} disabled={current === 0}>Previous</button>
          </div>
        </section>

        <aside className="stack">
          <span className="eyebrow">Questions</span>
          <div className="palette">
            {questions.map((x, i) => {
              const cls = marked.has(x.id) ? 'p-marked' : answered(x.id) ? 'p-answered' : visited.has(x.id) ? 'p-skipped' : '';
              return (
                <button key={x.id} className={`${cls}${answered(x.id) ? ' has-answer' : ''}${i === current ? ' current' : ''}`} onClick={() => go(i)} aria-label={`Question ${i + 1}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="small muted">{answeredCount} of {questions.length} answered</p>
          {!confirmSubmit ? (
            <button className="btn" onClick={() => setConfirmSubmit(true)}>Submit test</button>
          ) : (
            <div className="callout callout-warn small">
              <p>Submit now? {questions.length - answeredCount} question{questions.length - answeredCount === 1 ? ' is' : 's are'} unanswered.</p>
              <div className="row">
                <button className="btn btn-primary btn-sm" onClick={submit}>Yes, submit</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmSubmit(false)}>Keep going</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Result({ result, onRetake }: { result: MockResult; onRetake: () => void }) {
  const questions: Question[] = result.questionIds.map((id) => QUESTION_BY_ID[id]).filter(Boolean);
  const chapters = Object.entries(result.perChapter)
    .map(([id, v]) => ({ id, ...v, acc: v.correct / v.total }))
    .sort((a, b) => a.acc - b.acc);
  const pct = result.maxScore ? Math.round((Math.max(0, result.score) / result.maxScore) * 100) : 0;

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">Result</span>
        <h1>{result.title}: <span className="num">{result.score}</span> / {result.maxScore}</h1>
        <p className="muted">
          {pct >= 70 ? 'Strong work. Look at the wrong answers anyway; they show exactly what to revise.' : pct >= 40 ? 'A solid base. The chapter table below shows where the marks went.' : 'This is what mocks are for: finding gaps early. The weakest chapters now go to the top of your revision slots.'}
        </p>
      </div>
      <div className="stats">
        <div className="stat"><span className="value">{result.correct}</span><span className="label">correct</span></div>
        <div className="stat"><span className="value">{result.wrong}</span><span className="label">wrong</span></div>
        <div className="stat"><span className="value">{result.skipped}</span><span className="label">skipped</span></div>
        <div className="stat"><span className="value">{clock(result.timeTakenSec)}</span><span className="label">time taken</span></div>
      </div>

      <section className="section">
        <h2>By chapter</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Chapter</th><th className="n">Correct</th><th>Status</th></tr></thead>
            <tbody>
              {chapters.map((c) => (
                <tr key={c.id}>
                  <td>{CHAPTER_BY_ID[c.id]?.name}</td>
                  <td className="n">{c.correct}/{c.total}</td>
                  <td>
                    {c.acc >= 0.75 ? <span className="chip chip-good">Strong</span> : c.acc >= 0.5 ? <span className="chip chip-warn">Revise</span> : <span className="chip chip-bad">Weak, added to revision</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Solutions</h2>
        <div className="stack-lg">
          {questions.map((q, i) => {
            const a = result.answers[q.id];
            const ok = isCorrect(q, a);
            const skipped = a === undefined || a.trim() === '';
            return (
              <div key={q.id} className="stack" style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)' }}>
                <div className="row">
                  <span className="num muted">Q{i + 1}</span>
                  {skipped ? <span className="chip">Skipped</span> : ok ? <span className="chip chip-good">Correct</span> : <span className="chip chip-bad">Wrong</span>}
                  <span className="small muted">{CHAPTER_BY_ID[q.chapterId]?.name}</span>
                </div>
                <p>{q.text}</p>
                {q.type === 'mcq' ? (
                  <div className="options">
                    {q.options!.map((o, j) => {
                      const cls = j === q.answer ? ' correct' : String(j) === a ? ' wrong' : '';
                      return (
                        <div key={j} className={`option${cls}`} style={{ cursor: 'default' }}>
                          <span className="bubble">{'ABCD'[j]}</span>
                          <span>{o}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="small">Your answer: <strong className="num">{skipped ? '—' : a}</strong> · Correct answer: <strong className="num">{q.answer}</strong></p>
                )}
                <div className="solution"><strong>Solution.</strong> {q.solution}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="row">
        <a className="btn btn-primary" href={href({ name: 'planner' })}>Back to planner</a>
        <button className="btn" onClick={onRetake}>Retake this mock</button>
      </div>
    </main>
  );
}
