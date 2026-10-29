import { useState } from 'react';
import type { Update } from '../App';
import MaterialsPicker from '../components/MaterialsPicker';
import { EXAMS, GRADE_NAMES } from '../data/exams';
import { addDays, addMonths, formatDate, todayISO } from '../lib/dates';
import { clearState, replan } from '../lib/state';
import type { AppState } from '../types';

export default function ProfilePage({ state, update, onReset }: { state: AppState; update: Update; onReset: () => void }) {
  const { profile } = state;
  const today = todayISO();
  const [examDate, setExamDate] = useState(profile.examDate);
  const [hours, setHours] = useState(profile.hoursPerDay);
  const [studyDays, setStudyDays] = useState(profile.studyDays);
  const [materials, setMaterials] = useState(profile.materials);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = examDate !== profile.examDate || hours !== profile.hoursPerDay || studyDays !== profile.studyDays || JSON.stringify(materials) !== JSON.stringify(profile.materials);
  const dateOk = examDate >= addDays(today, 7);

  return (
    <main className="page narrow">
      <div className="stack">
        <h1>Profile</h1>
        <p className="muted">
          {profile.name} · {GRADE_NAMES[profile.grade]} · {EXAMS[profile.exam].name}
        </p>
      </div>

      <section className="section">
        <h2>Plan settings</h2>
        <div className="field">
          <label htmlFor="exam-date">Exam date</label>
          <input id="exam-date" type="date" className="input" style={{ maxWidth: 220 }} value={examDate} min={addDays(today, 7)} max={addMonths(today, 25)} onChange={(e) => { setExamDate(e.target.value); setSaved(false); }} />
          {!dateOk && <span className="hint" style={{ color: 'var(--bad)' }}>Choose a date at least a week from today.</span>}
        </div>
        <div className="field">
          <span className="label">Usual study hours per day</span>
          <input type="range" min={1} max={12} step={0.5} value={hours} onChange={(e) => { setHours(Number(e.target.value)); setSaved(false); }} aria-label="Study hours per day" />
          <strong className="num small">{hours} h a day</strong>
        </div>
        <div className="field">
          <span className="label">Study days per week</span>
          <div className="seg" role="group" aria-label="Study days per week">
            <button aria-pressed={studyDays === 6} onClick={() => { setStudyDays(6); setSaved(false); }}>Mon–Sat</button>
            <button aria-pressed={studyDays === 5} onClick={() => { setStudyDays(5); setSaved(false); }}>Mon–Fri</button>
          </div>
        </div>
        <div className="field">
          <span className="label">Study material</span>
          <p className="hint">Got a new book? Select it and your tasks will use it from today.</p>
          <MaterialsPicker exam={profile.exam} value={materials} onChange={(m) => { setMaterials(m); setSaved(false); }} />
        </div>
        <div className="row">
          <button
            className="btn btn-primary"
            disabled={!dirty || !dateOk}
            onClick={() => {
              update((s) => replan({ ...s, profile: { ...s.profile, examDate, hoursPerDay: hours, studyDays, materials } }));
              setSaved(true);
            }}
          >
            Save and rebuild plan
          </button>
          {saved && <span className="small" style={{ color: 'var(--good)' }}>Saved. Your plan now runs to {formatDate(examDate, true)}.</span>}
        </div>
      </section>

      <section className="section">
        <h2>Your data</h2>
        <p className="muted small">Everything is saved in this browser on this device. Clearing browser data or switching devices will start you fresh.</p>
        {!confirmReset ? (
          <div><button className="btn btn-danger" onClick={() => setConfirmReset(true)}>Start over</button></div>
        ) : (
          <div className="callout callout-bad">
            <p>This deletes your plan, progress, mock results and check-ins. It cannot be undone.</p>
            <div className="row">
              <button className="btn btn-danger" onClick={() => { clearState(); onReset(); window.location.hash = ''; }}>Delete everything</button>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
