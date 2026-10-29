import { useMemo, useState } from 'react';
import ChapterChecklist from '../components/ChapterChecklist';
import MaterialsPicker from '../components/MaterialsPicker';
import { chapterHours, chaptersFor } from '../data/chapters';
import { DEFAULT_HOURS, EXAMS, GRADE_NAMES } from '../data/exams';
import { addDays, addMonths, diffDays, formatDate, formatMonthYear, todayISO } from '../lib/dates';
import { buildPlan } from '../lib/planner';
import type { ExamId, Grade, Materials, Profile } from '../types';
import { PaceChip } from '../components/PaceChip';

interface Props {
  onDone: (profile: Profile, progress: Record<string, number>) => void;
}

const EXAM_ORDER: ExamId[] = ['jee-main', 'jee-advanced', 'neet'];
const GRADES: { id: Grade; hint: string }[] = [
  { id: '11', hint: 'Just started the two-year journey' },
  { id: '12', hint: 'Balancing boards and the entrance exam' },
  { id: 'dropper', hint: 'Taking a year to prepare full time' },
];

/** Typical months left, used as the starting point of the time slider. */
function suggestedMonths(grade: Grade): number {
  return grade === '11' ? 18 : grade === '12' ? 6 : 8;
}

export default function Onboarding({ onDone }: Props) {
  const today = todayISO();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<Grade | null>(null);
  const [exam, setExam] = useState<ExamId | null>(null);

  const [months, setMonths] = useState(8);
  const [exactDate, setExactDate] = useState('');
  const [useExact, setUseExact] = useState(false);
  const [hours, setHours] = useState(6);
  const [studyDays, setStudyDays] = useState<5 | 6>(6);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [materials, setMaterials] = useState<Materials>({ owned: [], hasPyqBook: false });

  const examDate = useExact && exactDate ? exactDate : addMonths(today, months);
  const days = diffDays(today, examDate);
  const dateValid = days >= 14 && days <= 366 * 2 + 31;

  const goToStep2 = () => {
    if (!grade || !exam) return;
    setMonths(suggestedMonths(grade));
    setHours(DEFAULT_HOURS[grade]);
    setProgress({});
    setStep(2);
    window.scrollTo(0, 0);
  };

  const preview = useMemo(() => {
    if (!exam || !grade || !dateValid) return null;
    return buildPlan({ exam, grade, examDate, startDate: today, hoursPerDay: hours, studyDays, progress }).summary;
  }, [exam, grade, examDate, today, hours, studyDays, progress, dateValid]);

  if (step === 1) {
    const ready = name.trim() && grade && exam;
    return (
      <main className="page narrow">
        <div className="steps"><span className="dot on" /><span className="dot" /><span className="dot" /> <span>Step <b>1</b> of 3</span></div>
        <div className="stack">
          <h1>Your own study plan, without coaching fees</h1>
          <p className="muted">Kaksha builds a week-by-week plan from the NCERT syllabus, with a mock test every Sunday and a trainer that adjusts the plan when life gets busy. It is free.</p>
        </div>

        <div className="field">
          <label htmlFor="name">What should we call you?</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" maxLength={40} />
        </div>

        <div className="field">
          <span className="label">Which class are you in?</span>
          <div className="choices">
            {GRADES.map((g) => (
              <button key={g.id} type="button" className="choice" aria-pressed={grade === g.id} onClick={() => setGrade(g.id)}>
                <strong>{GRADE_NAMES[g.id]}</strong>
                <span>{g.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">Which exam are you preparing for?</span>
          <div className="choices">
            {EXAM_ORDER.map((id) => (
              <button key={id} type="button" className="choice" aria-pressed={exam === id} onClick={() => setExam(id)}>
                <strong>{EXAMS[id].name}</strong>
                <span>{EXAMS[id].pattern}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary btn-lg" disabled={!ready} onClick={goToStep2}>Continue</button>
        </div>
      </main>
    );
  }

  const examInfo = EXAMS[exam!];

  if (step === 2) {
    return (
      <main className="page narrow">
        <div className="steps"><span className="dot on" /><span className="dot on" /><span className="dot" /> <span>Step <b>2</b> of 3</span></div>
        <div className="stack">
          <h1>What do you study from?</h1>
          <p className="muted">
            NCERT is only the starting point. Your plan builds each week around a proper reference book or coaching module, so pick everything you can use, even borrowed copies. If you only have NCERT, that is fine: the next step suggests one book per subject.
          </p>
        </div>
        <MaterialsPicker exam={exam!} value={materials} onChange={setMaterials} />
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
          <button className="btn btn-primary btn-lg" onClick={() => { setStep(3); window.scrollTo(0, 0); }}>Continue</button>
        </div>
      </main>
    );
  }

  const left = chaptersFor(exam!).filter((c) => (progress[c.id] ?? 0) < 0.99);
  const hoursLeft = Math.round(left.reduce((s, c) => s + chapterHours(c, examInfo.depth) * (1 - (progress[c.id] ?? 0)), 0));

  return (
    <main className="page">
      <div className="steps"><span className="dot on" /><span className="dot on" /><span className="dot on" /> <span>Step <b>3</b> of 3</span></div>
      <div className="stack">
        <h1>How much time do you have, {name.trim()}?</h1>
        <p className="muted">This sets the length of your plan. You can change it later from your profile.</p>
      </div>

      <section className="section">
        <div className="field">
          <span className="label">Time left until {examInfo.name}</span>
          {!useExact ? (
            <>
              <input type="range" min={1} max={24} step={1} value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Months until the exam" />
              <div className="spread small">
                <span className="muted">1 month</span>
                <strong className="num">{months} month{months === 1 ? '' : 's'}</strong>
                <span className="muted">2 years</span>
              </div>
            </>
          ) : (
            <input type="date" className="input" style={{ maxWidth: 220 }} value={exactDate} min={addDays(today, 14)} max={addMonths(today, 25)} onChange={(e) => setExactDate(e.target.value)} />
          )}
          <div className="row small">
            {dateValid ? (
              <span className="muted">Exam around <strong>{useExact ? formatDate(examDate, true) : formatMonthYear(examDate)}</strong> · about {Math.round(days / 7)} weeks from today</span>
            ) : (
              <span style={{ color: 'var(--bad)' }}>Pick a date between 2 weeks and 2 years from today.</span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setUseExact(!useExact)}>
              {useExact ? 'Choose in months instead' : 'I know the exact date'}
            </button>
          </div>
          <p className="hint">Check official dates on <a href={examInfo.officialSite} target="_blank" rel="noreferrer">{examInfo.officialSite.replace('https://', '')}</a>.</p>
        </div>

        <div className="field">
          <span className="label">How many hours can you study on a normal day, outside school?</span>
          <input type="range" min={1} max={12} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Study hours per day" />
          <div className="spread small">
            <span className="muted">1 h</span>
            <strong className="num">{hours} h a day</strong>
            <span className="muted">12 h</span>
          </div>
          <p className="hint">Be honest rather than ambitious. A plan you can keep beats one you drop after two weeks.</p>
        </div>

        <div className="field">
          <span className="label">Study days per week</span>
          <div className="seg" role="group" aria-label="Study days per week">
            <button aria-pressed={studyDays === 6} onClick={() => setStudyDays(6)}>Mon–Sat</button>
            <button aria-pressed={studyDays === 5} onClick={() => setStudyDays(5)}>Mon–Fri, Saturday off</button>
          </div>
          <p className="hint">Sunday is always mock test day.</p>
        </div>
      </section>

      <section className="section">
        <div className="stack">
          <h2>How much of the syllabus is left?</h2>
          <p className="muted">These are the NCERT chapters for {examInfo.name}. Mark what you have already finished properly, meaning you could solve PYQs on it.</p>
        </div>
        <ChapterChecklist exam={exam!} values={progress} onChange={(c) => setProgress((p) => ({ ...p, ...c }))} />
      </section>

      <div className="footer-bar">
        <div className="spread">
          <div className="small">
            <strong>{left.length} chapters left</strong> <span className="muted">· about {hoursLeft} hours of study</span>
            {preview && <> · <PaceChip pace={preview.pace} /></>}
          </div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
            <button
              className="btn btn-primary btn-lg"
              disabled={!dateValid}
              onClick={() =>
                onDone(
                  { name: name.trim(), grade: grade!, exam: exam!, examDate, hoursPerDay: hours, studyDays, materials, createdAt: today },
                  progress,
                )
              }
            >
              Build my plan
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
