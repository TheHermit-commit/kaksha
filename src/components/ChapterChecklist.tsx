import { useState } from 'react';
import { chapterLabel, chaptersFor } from '../data/chapters';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import type { Chapter, ExamId, SubjectId } from '../types';

const LEVELS: { value: number; label: string }[] = [
  { value: 0, label: 'Not started' },
  { value: 0.5, label: 'Halfway' },
  { value: 1, label: 'Done' },
];

function levelOf(p: number): number {
  if (p >= 0.99) return 1;
  if (p > 0.01) return 0.5;
  return 0;
}

interface Props {
  exam: ExamId;
  values: Record<string, number>;
  onChange: (changes: Record<string, number>) => void;
  showProgress?: boolean;
}

export default function ChapterChecklist({ exam, values, onChange, showProgress }: Props) {
  const subjects = EXAMS[exam].subjects;
  const [subject, setSubject] = useState<SubjectId>(subjects[0]);
  const chapters = chaptersFor(exam).filter((c) => c.subject === subject);
  const value = (c: Chapter) => values[c.id] ?? 0;
  const setAll = (list: Chapter[], v: number) => onChange(Object.fromEntries(list.map((c) => [c.id, v])));
  const groups: { title: string; list: Chapter[] }[] = [
    { title: 'Class 11 NCERT', list: chapters.filter((c) => c.classLevel === 11) },
    { title: 'Class 12 NCERT', list: chapters.filter((c) => c.classLevel === 12) },
    { title: 'Also in the exam syllabus', list: chapters.filter((c) => c.classLevel === 0) },
  ].filter((g) => g.list.length);

  return (
    <div className="stack">
      <div className="tabs" role="tablist">
        {subjects.map((s) => {
          const list = chaptersFor(exam).filter((c) => c.subject === s);
          const left = list.filter((c) => (values[c.id] ?? 0) < 0.99).length;
          return (
            <button key={s} role="tab" aria-selected={s === subject} onClick={() => setSubject(s)}>
              {SUBJECT_NAMES[s]} <span className="muted small">· {left} left</span>
            </button>
          );
        })}
      </div>
      {groups.map((g) => (
        <div key={g.title} className="stack">
          <div className="spread">
            <span className="eyebrow">{g.title}</span>
            <div className="row">
              <button className="btn btn-ghost btn-sm" onClick={() => setAll(g.list, 0)}>Mark all not started</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAll(g.list, 1)}>Mark all done</button>
            </div>
          </div>
          <div className="list">
            {g.list.map((c) => (
              <div key={c.id} className="list-row">
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>
                    {c.name} {c.weight === 3 && <span className="chip chip-accent">High weightage</span>}
                  </div>
                  <div className="small muted">{c.note ?? chapterLabel(c)}</div>
                  {showProgress && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <div className="bar" style={{ flex: 1, maxWidth: 220 }}>
                        <i style={{ width: `${Math.round(value(c) * 100)}%` }} />
                      </div>
                      <span className="small num muted">{Math.round(value(c) * 100)}%</span>
                    </div>
                  )}
                </div>
                <div className="seg" role="group" aria-label={`Status of ${c.name}`}>
                  {LEVELS.map((l) => (
                    <button key={l.value} aria-pressed={levelOf(value(c)) === l.value} onClick={() => onChange({ [c.id]: l.value })}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
