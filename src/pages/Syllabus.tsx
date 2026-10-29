import { useState } from 'react';
import type { Update } from '../App';
import ChapterChecklist from '../components/ChapterChecklist';
import { chaptersFor } from '../data/chapters';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import { replan } from '../lib/state';
import type { AppState } from '../types';

export default function Syllabus({ state, update }: { state: AppState; update: Update }) {
  const [changed, setChanged] = useState(false);
  const [rebuilt, setRebuilt] = useState(false);
  const exam = EXAMS[state.profile.exam];
  const chapters = chaptersFor(state.profile.exam);
  const overall = chapters.reduce((s, c) => s + (state.progress[c.id] ?? 0), 0) / chapters.length;

  return (
    <main className="page">
      <div className="stack">
        <h1>Syllabus</h1>
        <p className="muted">Progress moves forward as you tick off study tasks in your planner. If you studied something outside the plan, update it here.</p>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="value">{Math.round(overall * 100)}%</span>
          <span className="label">of {exam.name} syllabus</span>
        </div>
        {exam.subjects.map((s) => {
          const list = chapters.filter((c) => c.subject === s);
          const p = list.reduce((sum, c) => sum + (state.progress[c.id] ?? 0), 0) / list.length;
          return (
            <div key={s} className="stat">
              <span className="value">{Math.round(p * 100)}%</span>
              <span className="label">{SUBJECT_NAMES[s]}</span>
              <div className="bar"><i style={{ width: `${p * 100}%` }} /></div>
            </div>
          );
        })}
      </div>

      {changed && (
        <div className="callout callout-accent">
          <p><strong>Your syllabus changed.</strong> Rebuild the plan so the coming weeks match what is actually left. Past days stay as they are.</p>
          <div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                update((s) => replan(s));
                setChanged(false);
                setRebuilt(true);
              }}
            >
              Rebuild my plan
            </button>
          </div>
        </div>
      )}
      {rebuilt && !changed && <div className="callout callout-good small">Plan rebuilt from today.</div>}

      <ChapterChecklist
        exam={state.profile.exam}
        values={state.progress}
        showProgress
        onChange={(changes) => {
          update((s) => ({ ...s, progress: { ...s.progress, ...changes } }));
          setChanged(true);
          setRebuilt(false);
        }}
      />
    </main>
  );
}
