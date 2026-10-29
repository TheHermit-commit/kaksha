import { booksFor, coachingId } from '../data/books';
import { EXAMS, SUBJECT_NAMES } from '../data/exams';
import type { ExamId, Materials, SubjectId } from '../types';

interface Props {
  exam: ExamId;
  value: Materials;
  onChange: (value: Materials) => void;
}

export default function MaterialsPicker({ exam, value, onChange }: Props) {
  const owned = new Set(value.owned);
  const toggle = (id: string) => {
    const next = new Set(owned);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...value, owned: [...next] });
  };
  const clearSubject = (subject: SubjectId) => {
    const ids = new Set([coachingId(subject), ...booksFor(exam, subject).map((b) => b.id)]);
    onChange({ ...value, owned: value.owned.filter((id) => !ids.has(id)) });
  };

  return (
    <div className="stack-lg">
      {EXAMS[exam].subjects.map((subject) => {
        const books = booksFor(exam, subject);
        const ids = [coachingId(subject), ...books.map((b) => b.id)];
        const nothing = !ids.some((id) => owned.has(id));
        return (
          <div key={subject} className="field">
            <span className="label">{SUBJECT_NAMES[subject]}</span>
            <div className="toggles">
              <button type="button" className="toggle" aria-pressed={nothing} onClick={() => clearSubject(subject)}>
                Only NCERT
              </button>
              <button type="button" className="toggle" aria-pressed={owned.has(coachingId(subject))} onClick={() => toggle(coachingId(subject))}>
                Coaching modules or notes
              </button>
              {books.map((b) => (
                <button key={b.id} type="button" className="toggle" aria-pressed={owned.has(b.id)} onClick={() => toggle(b.id)} title={b.note}>
                  {b.name}
                  {b.depthOnly && <span className="muted"> · advanced</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="field">
        <span className="label">Do you have a chapter-wise PYQ book?</span>
        <div className="seg" role="group" aria-label="PYQ book">
          <button aria-pressed={value.hasPyqBook} onClick={() => onChange({ ...value, hasPyqBook: true })}>Yes</button>
          <button aria-pressed={!value.hasPyqBook} onClick={() => onChange({ ...value, hasPyqBook: false })}>No</button>
        </div>
        <p className="hint">A book with past questions sorted by chapter, from Arihant, MTG, Disha or a similar publisher.</p>
      </div>
    </div>
  );
}
