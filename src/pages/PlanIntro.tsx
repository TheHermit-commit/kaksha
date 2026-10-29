import { PACE_TEXT, PaceChip } from '../components/PaceChip';
import { booksToBuy, depthBooks, PYQ_BOOK_HINT, resolveSources, TRACK_NAMES, tracksFor } from '../data/books';
import { CHAPTER_BY_ID } from '../data/chapters';
import { EXAMS, GRADE_NAMES, SUBJECT_NAMES } from '../data/exams';
import { addDays, diffDays, formatDate, todayISO } from '../lib/dates';
import { NEW_SHARE, PHASE_NAMES } from '../lib/planner';
import { navigate } from '../lib/router';
import { currentWeekIndex } from '../lib/state';
import type { AppState, Pace, Phase, Track } from '../types';

const PACE_ADVICE: Record<Pace, string> = {
  comfortable:
    'You have more time than the syllabus needs. Each chapter gets extra practice time, and once the syllabus is done you move to full-length PYQ practice before the final revision.',
  balanced: 'Your time and syllabus match well. Stick to the daily plan and check in every Sunday so small slips do not pile up.',
  tight:
    'The syllabus fits, but only just. Each chapter gets a little less time than ideal, so focus on NCERT and the high-weightage chapters first. Adding even 30 minutes a day would make a real difference.',
  'very-tight':
    'There is less time than the syllabus normally needs. The plan still covers every chapter, but quickly. If you can, add study time from your profile, and give high-weightage chapters your full attention while covering lighter chapters at a basic level.',
};

const PHASE_CLASS: Record<Phase, string> = {
  learn: 'ph-learn',
  consolidate: 'ph-consolidate',
  practice: 'ph-practice',
  revision: 'ph-revision',
};

export default function PlanIntro({ state }: { state: AppState }) {
  const { profile, plan } = state;
  const s = plan.summary;
  const exam = EXAMS[profile.exam];
  const today = todayISO();
  const daysLeft = diffDays(today, profile.examDate);
  const weeklyHours = Math.round(profile.hoursPerDay * profile.studyDays);
  const upcoming = plan.weeks.slice(currentWeekIndex(state, today));
  const thisWeek = upcoming[0];

  // Group consecutive weeks of the same phase into timeline segments.
  const segments: { phase: Phase; weeks: number; from: string; to: string }[] = [];
  const lastDay = addDays(profile.examDate, -1);
  for (const w of upcoming) {
    const last = segments[segments.length - 1];
    const phase = w.phase === 'consolidate' ? 'learn' : w.phase;
    const from = w.start < today ? today : w.start;
    const to = w.end > lastDay ? lastDay : w.end;
    if (last && last.phase === phase) {
      last.weeks++;
      last.to = to;
    } else segments.push({ phase, weeks: 1, from, to });
  }
  const learnSeg = segments.find((x) => x.phase === 'learn');
  const practiceSeg = segments.find((x) => x.phase === 'practice');
  const revisionSeg = segments.find((x) => x.phase === 'revision');

  return (
    <main className="page">
      <div className="stack">
        <span className="eyebrow">{GRADE_NAMES[profile.grade]} · {exam.name}</span>
        <h1>{profile.name}, here is your plan</h1>
        <p className="muted" style={{ maxWidth: '62ch' }}>
          Your exam is on <strong>{formatDate(profile.examDate, true)}</strong>, {daysLeft} days from today. Here is how we will use that time.
        </p>
      </div>

      <div className="stats">
        <div className="stat"><span className="value">{upcoming.length}</span><span className="label">weeks to go</span></div>
        <div className="stat"><span className="value">{s.chaptersLeft}</span><span className="label">chapters left</span></div>
        <div className="stat"><span className="value">{s.hoursNeeded}</span><span className="label">hours of study needed</span></div>
        <div className="stat"><span className="value">{weeklyHours}</span><span className="label">hours a week you study</span></div>
      </div>

      <div className={`callout ${PACE_TEXT[s.pace].tone.replace('chip', 'callout')}`}>
        <div className="row"><PaceChip pace={s.pace} /></div>
        <p>{PACE_ADVICE[s.pace]}</p>
        {s.revisionReduced && <p className="small">To fit the syllabus in, the final revision phase is shorter than usual ({s.revisionWeeks} week{s.revisionWeeks === 1 ? '' : 's'}).</p>}
      </div>

      <section className="section">
        <h2>Your phases</h2>
        <div className="timeline" role="img" aria-label="Plan timeline by phase">
          {segments.map((seg, i) => (
            <div key={i} className={PHASE_CLASS[seg.phase]} style={{ flex: seg.weeks }} title={`${PHASE_NAMES[seg.phase]}: ${seg.weeks} weeks`}>
              {seg.weeks >= 3 ? PHASE_NAMES[seg.phase] : ''}
            </div>
          ))}
        </div>
        <div className="legend">
          <span><i className="ph-learn" />Learning</span>
          {practiceSeg && <span><i className="ph-practice" />Practice</span>}
          <span><i className="ph-revision" />Final revision</span>
        </div>
        <div className="list">
          {learnSeg && (
            <div className="list-row">
              <div className="grow">
                <h3>1. Learn the remaining syllabus</h3>
                <p className="muted small">
                  {formatDate(learnSeg.from)} – {formatDate(learnSeg.to)} · {learnSeg.weeks} weeks
                  {s.consolidationWeeks > 0 && `, including ${s.consolidationWeeks} catch-up week${s.consolidationWeeks === 1 ? '' : 's'}`}
                </p>
                <p>
                  You study all your subjects in parallel, a few chapters at a time, in NCERT order
                  {profile.grade === '12' ? ', alternating Class 12 chapters (to keep pace with school) with the Class 11 chapters you still need' : ''}.
                  Each chapter moves from theory to exercises in your main book, and every week ends with PYQs on what you studied.
                  {s.consolidationWeeks > 0 && ' Every sixth week is a lighter catch-up week for revision and re-solving mock mistakes.'}
                </p>
              </div>
            </div>
          )}
          {practiceSeg && (
            <div className="list-row">
              <div className="grow">
                <h3>2. Practise full papers</h3>
                <p className="muted small">{formatDate(practiceSeg.from)} – {formatDate(practiceSeg.to)} · {practiceSeg.weeks} weeks</p>
                <p>You will finish the syllabus early, so these weeks go to timed PYQ sections, revision and a full-syllabus mock every Sunday.</p>
              </div>
            </div>
          )}
          {revisionSeg && (
            <div className="list-row">
              <div className="grow">
                <h3>{practiceSeg ? 3 : 2}. Final revision</h3>
                <p className="muted small">{formatDate(revisionSeg.from)} – {formatDate(revisionSeg.to)} · {revisionSeg.weeks} week{revisionSeg.weeks === 1 ? '' : 's'}</p>
                <p>No new chapters. You revise the whole syllabus in rotation and take two full mocks a week (Wednesday and Sunday).</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h2>How each week works</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th scope="row">{profile.studyDays === 6 ? 'Mon – Fri' : 'Mon – Thu'}</th>
                <td>
                  About {profile.hoursPerDay} h a day: {Math.round(NEW_SHARE * 100)}% learning this week’s chapters from your books and {Math.round((1 - NEW_SHARE) * 100)}% revising an earlier chapter, so nothing is forgotten.
                </td>
              </tr>
              <tr>
                <th scope="row">{profile.studyDays === 6 ? 'Saturday' : 'Friday'}</th>
                <td>PYQ day. Past-paper questions on every chapter you studied that week, plus a few from an older chapter.</td>
              </tr>
              {profile.studyDays === 5 && (
                <tr><th scope="row">Saturday</th><td>Rest, or catch up on anything you missed.</td></tr>
              )}
              <tr>
                <th scope="row">Sunday</th>
                <td>
                  A timed mock on that week’s chapters, marked {exam.marking.correct > 0 ? `+${exam.marking.correct}` : ''} / {exam.marking.wrong} like the real exam, then an hour reviewing mistakes. Every fourth week the mock covers everything so far.
                </td>
              </tr>
              <tr>
                <th scope="row">Check-in</th>
                <td>Tell your trainer how the week went. If school, stress or sleep got in the way, it rearranges the weeks ahead.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <StudyMaterial state={state} />

      <section className="section">
        <h2>Where your hours go</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Subject</th><th className="n">Chapters left</th><th className="n">Study hours</th></tr>
            </thead>
            <tbody>
              {s.perSubject.map((p) => (
                <tr key={p.subject}>
                  <td><span className={`subject-dot s-${p.subject}`} /> {SUBJECT_NAMES[p.subject]}</td>
                  <td className="n">{p.chapters}</td>
                  <td className="n">{p.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Hours are estimates. Heavier chapters such as Rotational Motion or Electrostatics get more time than lighter ones.</p>
      </section>

      <section className="section">
        <h2>Tips for {exam.name}</h2>
        <ul className="stack" style={{ margin: 0, paddingLeft: 20 }}>
          {exam.strategy.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      {thisWeek && thisWeek.chapters.length > 0 && (
        <section className="section">
          <h2>This week you start with</h2>
          <div className="row">
            {thisWeek.chapters.map((c) => (
              <span key={c.chapterId} className="chip">
                <span className={`subject-dot s-${CHAPTER_BY_ID[c.chapterId].subject}`} /> {CHAPTER_BY_ID[c.chapterId].name}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="row">
        <button className="btn btn-primary btn-lg" onClick={() => navigate({ name: 'planner' })}>Open my weekly planner</button>
      </div>
    </main>
  );
}

const NCERT_ROLE: Record<Track, string> = {
  physics: 'NCERT once at the start of each chapter, then this book',
  maths: 'No NCERT. Straight to this book',
  physical: 'A short NCERT skim, then numericals from this book',
  inorganic: 'NCERT line by line, then questions from this book',
  organic: 'NCERT line by line, then questions from this book',
  biology: 'NCERT line by line, then MCQs from this book',
};

function StudyMaterial({ state }: { state: AppState }) {
  const { exam, materials } = state.profile;
  const subjects = EXAMS[exam].subjects;
  const sources = resolveSources(exam, subjects, materials);
  const toBuy = booksToBuy(exam, subjects, materials);
  const depth = depthBooks(exam, materials);

  return (
    <section className="section">
      <h2>Your study material</h2>
      <p className="muted" style={{ maxWidth: '64ch' }}>NCERT is where you start. Most of the week runs on one main book or module per subject.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Subject</th><th>Main source</th><th>How NCERT is used</th></tr>
          </thead>
          <tbody>
            {tracksFor(subjects).map((t) => (
              <tr key={t}>
                <td>{TRACK_NAMES[t]}</td>
                <td>
                  {sources[t].name} {sources[t].owned ? <span className="chip chip-good">You have it</span> : <span className="chip chip-warn">To get</span>}
                </td>
                <td className="small">{NCERT_ROLE[t]}</td>
              </tr>
            ))}
            <tr>
              <td>PYQs</td>
              <td>
                {materials.hasPyqBook ? (
                  <>Your PYQ book <span className="chip chip-good">You have it</span></>
                ) : (
                  <>A chapter-wise PYQ book <span className="chip chip-warn">To get</span></>
                )}
              </td>
              <td className="small">Every PYQ day and the final revision</td>
            </tr>
          </tbody>
        </table>
      </div>

      {(toBuy.length > 0 || !materials.hasPyqBook) && (
        <div className="callout callout-accent">
          <h3>Books worth getting</h3>
          <ul className="stack" style={{ margin: 0, paddingLeft: 20, gap: 6 }}>
            {toBuy.map(({ book, tracks }) => (
              <li key={book.id}>
                <strong>{book.name}</strong> for {tracks.map((t) => TRACK_NAMES[t].toLowerCase()).join(', ')}. {book.note}
              </li>
            ))}
            {!materials.hasPyqBook && <li><strong>A PYQ book:</strong> {PYQ_BOOK_HINT[exam]}. Until then, official past papers are free on the NTA website.</li>}
          </ul>
          <p className="small">
            You only need one book per subject. Ask seniors for second-hand copies, check your school or public library, or buy an older edition. The questions barely change. Until a book arrives, your tasks fall back to free material.
          </p>
        </div>
      )}
      {depth.length > 0 && (
        <p className="small muted">
          For JEE Advanced, once your basics are strong: {depth.map((b) => b.name).join(', ')}.
        </p>
      )}
    </section>
  );
}
