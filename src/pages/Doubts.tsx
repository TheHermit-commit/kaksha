import { useEffect, useMemo, useRef, useState } from 'react';
import TutorText from '../components/TutorText';
import { CHAPTER_BY_ID, chaptersFor } from '../data/chapters';
import { EXAMS, GRADE_NAMES, SUBJECT_NAMES } from '../data/exams';
import { dayName, formatDate, todayISO } from '../lib/dates';
import { compressImage, loadDoubts, newDoubtId, saveDoubts, toTutorImages, tutorTurns, type Doubt, type DoubtMessage } from '../lib/doubts';
import { askTutor, TutorError } from '../lib/tutor';
import { firstTurn, followUpTurn, FULL_SOLUTION, NEXT_HINT, type DoubtMode } from '../lib/tutorPrompt';
import type { AppState, SubjectId } from '../types';

type Wants = 'hint' | 'solution' | 'answer';
type StudentMessage = DoubtMessage & { wants?: Wants };

const MAX_PHOTOS = 3;

export default function Doubts({ state }: { state: AppState }) {
  const [doubts, setDoubts] = useState<Doubt[]>(loadDoubts);
  const [tab, setTab] = useState<'ask' | 'history'>('ask');
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingRun, setPendingRun] = useState<string | null>(null);

  const persist = (fn: (list: Doubt[]) => Doubt[]) => setDoubts((prev) => saveDoubts(fn(prev)));
  const open = doubts.find((d) => d.id === openId) ?? null;

  if (open) {
    return (
      <Thread
        key={open.id}
        state={state}
        doubt={open}
        autoRun={pendingRun === open.id}
        onAutoRunDone={() => setPendingRun(null)}
        onChange={(d) => persist((list) => list.map((x) => (x.id === d.id ? d : x)))}
        onDelete={() => {
          persist((list) => list.filter((x) => x.id !== open.id));
          setOpenId(null);
          setTab('history');
        }}
        onBack={() => {
          setOpenId(null);
          setTab('history');
        }}
      />
    );
  }

  return (
    <main className="page">
      <div className="stack">
        <h1>Doubts</h1>
        <p className="muted" style={{ maxWidth: '64ch' }}>
          Stuck on a question from your book, module or a PYQ? Type it or add a photo. Ask for a hint to keep trying yourself, or the full solution when you are done trying.
        </p>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}>Ask a doubt</button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
          My doubts <span className="muted small">· {doubts.length}</span>
        </button>
      </div>
      {tab === 'ask' ? (
        <AskForm
          state={state}
          onSubmit={(d) => {
            persist((list) => [d, ...list]);
            setPendingRun(d.id);
            setOpenId(d.id);
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <History state={state} doubts={doubts} onOpen={(id) => { setOpenId(id); window.scrollTo(0, 0); }} />
      )}
    </main>
  );
}

function AskForm({ state, onSubmit }: { state: AppState; onSubmit: (d: Doubt) => void }) {
  const exam = state.profile.exam;
  const subjects = EXAMS[exam].subjects;
  const [subject, setSubject] = useState<SubjectId>(subjects[0]);
  const [chapterId, setChapterId] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [busyPhotos, setBusyPhotos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const chapters = chaptersFor(exam).filter((c) => c.subject === subject);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError('');
    setBusyPhotos(true);
    const room = MAX_PHOTOS - photos.length;
    const picked = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room);
    if (files.length > room) setPhotoError(`You can attach up to ${MAX_PHOTOS} photos.`);
    try {
      const urls = await Promise.all(picked.map((f) => compressImage(f)));
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      setPhotoError((e as Error).message);
    } finally {
      setBusyPhotos(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const ready = (question.trim().length > 0 || photos.length > 0) && !busyPhotos;
  const submit = (mode: DoubtMode) => {
    if (!ready) return;
    const first: StudentMessage = {
      role: 'student',
      kind: 'question',
      text: question.trim(),
      prompt: firstTurn(question, mode, photos.length > 0),
      wants: mode,
    };
    onSubmit({
      id: newDoubtId(),
      createdAt: new Date().toISOString(),
      date: todayISO(),
      subject,
      chapterId: chapterId || null,
      question: question.trim(),
      images: photos,
      messages: [first],
      solutionShown: false,
      resolved: false,
    });
  };

  return (
    <section className="stack-lg" style={{ maxWidth: 720 }}>
      <div className="field">
        <span className="label">Subject</span>
        <div className="seg" role="group" aria-label="Subject">
          {subjects.map((s) => (
            <button key={s} aria-pressed={subject === s} onClick={() => { setSubject(s); setChapterId(''); }}>{SUBJECT_NAMES[s]}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="doubt-chapter">Chapter</label>
        <select id="doubt-chapter" className="input" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          <option value="">Not sure which chapter</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.classLevel ? `Class ${c.classLevel} · ` : ''}{c.name}</option>
          ))}
        </select>
        <p className="hint">Your doubts are saved by chapter, so you can revise from them later.</p>
      </div>

      <div className="field">
        <label htmlFor="doubt-text">Your question</label>
        <textarea
          id="doubt-text"
          className="input"
          style={{ minHeight: 130 }}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={4000}
          placeholder="Type the question, and what you tried. For example: A block of 2 kg slides down a 30° incline with μ = 0.2. I got the acceleration as 5 m/s² but the answer says 3.3."
        />
      </div>

      <div className="field">
        <span className="label">Photo of the question <span className="muted small">(optional, up to {MAX_PHOTOS})</span></span>
        <div className="row">
          {photos.map((p, i) => (
            <div key={i} className="photo-thumb">
              <img src={p} alt={`Photo ${i + 1} of the question`} />
              <button className="btn btn-sm" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>Remove</button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="btn" htmlFor="doubt-photo">{busyPhotos ? 'Adding…' : photos.length ? 'Add another photo' : 'Add a photo'}</label>
          )}
          <input id="doubt-photo" ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
        </div>
        <p className="hint">Make sure the whole question and any diagram are in the frame and in focus.</p>
        {photoError && <p className="small" style={{ color: 'var(--bad)' }}>{photoError}</p>}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="label">What do you want?</span>
        <div className="row">
          <button className="btn btn-primary btn-lg" disabled={!ready} onClick={() => submit('hint')}>Give me a hint</button>
          <button className="btn btn-lg" disabled={!ready} onClick={() => submit('solution')}>Show full solution</button>
        </div>
        <p className="hint">A hint gives you the next step only, so you can still solve it yourself. You can ask for more hints or the full solution after.</p>
      </div>
    </section>
  );
}

function Thread({
  state,
  doubt,
  autoRun,
  onAutoRunDone,
  onChange,
  onDelete,
  onBack,
}: {
  state: AppState;
  doubt: Doubt;
  autoRun: boolean;
  onAutoRunDone: () => void;
  onChange: (d: Doubt) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const latest = useRef(doubt);
  latest.current = doubt;

  const chapter = doubt.chapterId ? CHAPTER_BY_ID[doubt.chapterId] : null;
  const running = streaming !== null;
  const last = doubt.messages[doubt.messages.length - 1];
  const awaitingTutor = last?.role === 'student';

  const run = async (d: Doubt) => {
    setError('');
    setStreaming('');
    controller.current = new AbortController();
    const wants = (d.messages[d.messages.length - 1] as StudentMessage).wants ?? 'answer';
    try {
      const text = await askTutor({
        ctx: {
          examName: EXAMS[state.profile.exam].name,
          gradeName: GRADE_NAMES[state.profile.grade],
          subjectName: SUBJECT_NAMES[d.subject],
          chapterName: d.chapterId ? CHAPTER_BY_ID[d.chapterId]?.name ?? null : null,
        },
        turns: tutorTurns(d),
        images: toTutorImages(d.images),
        onText: (t) => setStreaming(t),
        signal: controller.current.signal,
      });
      const reply: DoubtMessage = { role: 'tutor', kind: wants === 'solution' ? 'solution' : wants === 'hint' ? 'hint' : 'answer', text };
      onChange({ ...latest.current, messages: [...latest.current.messages, reply], solutionShown: latest.current.solutionShown || wants === 'solution' });
    } catch (e) {
      setError(e instanceof TutorError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setStreaming(null);
      controller.current = null;
    }
  };

  // Ask the tutor once when the doubt opens straight after being asked. The refs keep
  // React's development double-mount from sending it twice or aborting it early.
  const started = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (autoRun && !started.current) {
      started.current = true;
      onAutoRunDone();
      run(doubt);
    }
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) controller.current?.abort();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (msg: StudentMessage) => {
    const next = { ...doubt, messages: [...doubt.messages, msg], resolved: false };
    onChange(next);
    run(next);
  };

  return (
    <main className="page narrow">
      <div className="spread">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← My doubts</button>
        <span className="small muted">{dayName(doubt.date)} {formatDate(doubt.date, true)}</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="eyebrow">
          {SUBJECT_NAMES[doubt.subject]} · {chapter?.name ?? 'Chapter not given'}
        </span>
        <div className="row">
          {doubt.resolved ? <span className="chip chip-good">Solved</span> : <span className="chip chip-warn">Open</span>}
          {doubt.solutionShown && <span className="chip">Full solution seen</span>}
        </div>
      </div>

      <section className="stack-lg">
        {doubt.messages.map((m, i) =>
          m.role === 'student' ? (
            <div key={i} className="bubble-row me">
              <div className="msg">
                {i === 0 && doubt.images.length > 0 && (
                  <div className="row">
                    {doubt.images.map((src, j) => (
                      <a key={j} href={src} target="_blank" rel="noreferrer" className="photo-thumb small-thumb">
                        <img src={src} alt={`Question photo ${j + 1}`} />
                      </a>
                    ))}
                  </div>
                )}
                {i === 0 && doubt.imagesRemoved && <span className="small muted">Photos were removed to free up storage.</span>}
                {m.text ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span> : null}
                <span className="small muted">
                  {m.kind === 'question'
                    ? (m as StudentMessage).wants === 'hint' ? 'Asked for a hint' : 'Asked for the full solution'
                    : m.kind === 'next-hint' ? 'Asked for the next hint' : m.kind === 'solution' ? 'Asked for the full solution' : ''}
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="bubble-row coach">
              <div className="msg">
                <span className={`chip ${m.kind === 'solution' ? 'chip-accent' : m.kind === 'hint' ? 'chip-warn' : ''}`}>
                  {m.kind === 'solution' ? 'Full solution' : m.kind === 'hint' ? 'Hint' : 'Tutor'}
                </span>
                <TutorText text={m.text} />
              </div>
            </div>
          ),
        )}
        {running && (
          <div className="bubble-row coach">
            <div className="msg" aria-live="polite">
              {streaming ? <TutorText text={streaming} /> : <span className="muted">Reading your question…</span>}
              <div><button className="btn btn-ghost btn-sm" onClick={() => controller.current?.abort()}>Stop</button></div>
            </div>
          </div>
        )}
      </section>

      {awaitingTutor && !running && !error && (
        <div><button className="btn btn-primary" onClick={() => run(doubt)}>Get the answer</button></div>
      )}

      {error && (
        <div className="callout callout-bad">
          <p>{error}</p>
          {awaitingTutor && <div><button className="btn btn-sm" onClick={() => run(doubt)}>Try again</button></div>}
        </div>
      )}

      {!running && !awaitingTutor && (
        <section className="stack">
          <div className="row">
            {!doubt.solutionShown && (
              <>
                <button className="btn btn-primary" onClick={() => send({ role: 'student', kind: 'next-hint', text: 'Next hint, please.', prompt: NEXT_HINT, wants: 'hint' })}>
                  Next hint
                </button>
                <button className="btn" onClick={() => send({ role: 'student', kind: 'solution', text: 'Show me the full solution.', prompt: FULL_SOLUTION, wants: 'solution' })}>
                  Show full solution
                </button>
              </>
            )}
            <button className="btn btn-ghost" onClick={() => onChange({ ...doubt, resolved: !doubt.resolved })}>
              {doubt.resolved ? 'Mark as still open' : 'Got it, mark as solved'}
            </button>
          </div>
          <div className="field">
            <label htmlFor="follow-up">Ask a follow-up</label>
            <textarea
              id="follow-up"
              className="input"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              maxLength={2000}
              placeholder="For example: why did we take the normal force as mg cos θ here?"
            />
          </div>
          <div>
            <button
              className="btn"
              disabled={!followUp.trim()}
              onClick={() => {
                send({ role: 'student', kind: 'followup', text: followUp.trim(), prompt: followUpTurn(followUp, doubt.solutionShown), wants: 'answer' });
                setFollowUp('');
              }}
            >
              Send follow-up
            </button>
          </div>
        </section>
      )}

      <section className="section">
        {!confirmDelete ? (
          <div><button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(true)}>Delete this doubt</button></div>
        ) : (
          <div className="callout callout-bad small">
            <p>Delete this doubt and its answers?</p>
            <div className="row">
              <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
        )}
        <p className="hint">AI tutors can make mistakes. If an answer disagrees with your book’s answer key, check both carefully.</p>
      </section>
    </main>
  );
}

function History({ state, doubts, onOpen }: { state: AppState; doubts: Doubt[]; onOpen: (id: string) => void }) {
  const exam = state.profile.exam;
  const [groupBy, setGroupBy] = useState<'chapter' | 'day'>('chapter');
  const [subject, setSubject] = useState<SubjectId | 'all'>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doubts
      .filter((d) => subject === 'all' || d.subject === subject)
      .filter((d) => !q || d.messages.some((m) => m.text.toLowerCase().includes(q)) || (d.chapterId && CHAPTER_BY_ID[d.chapterId]?.name.toLowerCase().includes(q)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [doubts, subject, query]);

  const groups = useMemo(() => {
    const map = new Map<string, { title: string; order: number; items: Doubt[] }>();
    const chapterOrder = new Map(chaptersFor(exam).map((c, i) => [c.id, i]));
    for (const d of filtered) {
      let key: string;
      let title: string;
      let order: number;
      if (groupBy === 'day') {
        key = d.date;
        title = `${dayName(d.date)} ${formatDate(d.date, true)}`;
        order = -Number(d.date.replace(/-/g, ''));
      } else if (d.chapterId && CHAPTER_BY_ID[d.chapterId]) {
        key = d.chapterId;
        title = `${SUBJECT_NAMES[d.subject]} · ${CHAPTER_BY_ID[d.chapterId].name}`;
        order = chapterOrder.get(d.chapterId) ?? 999;
      } else {
        key = `none-${d.subject}`;
        title = `${SUBJECT_NAMES[d.subject]} · Chapter not given`;
        order = 1000;
      }
      if (!map.has(key)) map.set(key, { title, order, items: [] });
      map.get(key)!.items.push(d);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [filtered, groupBy, exam]);

  if (!doubts.length) {
    return (
      <div className="callout">
        <p><strong>No doubts yet.</strong> When you ask one, it is saved here by chapter and by day, so you can go back to it while revising.</p>
      </div>
    );
  }

  const openCount = doubts.filter((d) => !d.resolved).length;

  return (
    <section className="stack-lg">
      <div className="spread">
        <div className="row">
          <div className="seg" role="group" aria-label="Group doubts">
            <button aria-pressed={groupBy === 'chapter'} onClick={() => setGroupBy('chapter')}>By chapter</button>
            <button aria-pressed={groupBy === 'day'} onClick={() => setGroupBy('day')}>By day</button>
          </div>
          <div className="seg" role="group" aria-label="Filter by subject">
            <button aria-pressed={subject === 'all'} onClick={() => setSubject('all')}>All</button>
            {EXAMS[exam].subjects.map((s) => (
              <button key={s} aria-pressed={subject === s} onClick={() => setSubject(s)}>{SUBJECT_NAMES[s]}</button>
            ))}
          </div>
        </div>
        <input className="input" style={{ maxWidth: 260 }} type="search" placeholder="Search your doubts" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search your doubts" />
      </div>
      <p className="small muted">{doubts.length} doubt{doubts.length === 1 ? '' : 's'} saved · {openCount} still open</p>

      {groups.map((g) => (
        <div key={g.title} className="stack" style={{ gap: 6 }}>
          <div className="spread">
            <h3>{g.title}</h3>
            <span className="small muted">{g.items.length}</span>
          </div>
          <div className="list">
            {g.items.map((d) => {
              const preview = d.question || (d.images.length ? 'Question in photo' : 'Question');
              const ch = d.chapterId ? CHAPTER_BY_ID[d.chapterId] : null;
              return (
                <button key={d.id} className="list-row doubt-row" onClick={() => onOpen(d.id)}>
                  {d.images[0] ? <img className="doubt-mini" src={d.images[0]} alt="" /> : null}
                  <span className="grow">
                    <span className="doubt-preview">{preview}</span>
                    <span className="small muted">
                      {groupBy === 'chapter' ? `${dayName(d.date)} ${formatDate(d.date)}` : `${SUBJECT_NAMES[d.subject]} · ${ch?.name ?? 'Chapter not given'}`}
                      {' · '}
                      {d.messages.filter((m) => m.role === 'tutor').length} answer{d.messages.filter((m) => m.role === 'tutor').length === 1 ? '' : 's'}
                    </span>
                  </span>
                  {d.resolved ? <span className="chip chip-good">Solved</span> : <span className="chip chip-warn">Open</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.length && <p className="muted">No doubts match this filter.</p>}
    </section>
  );
}
