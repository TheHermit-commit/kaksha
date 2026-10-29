import { CHAPTER_BY_ID } from '../data/chapters';
import { SUBJECT_NAMES } from '../data/exams';
import { videosFor, videoUrl, youtubeSearchUrl } from '../data/videos';
import { dayName, formatDate } from '../lib/dates';
import type { ExamId, Task } from '../types';

const STUDY_KINDS = new Set(['learn', 'practice', 'pyq', 'revise']);
/** New chapters first, then PYQs, then revision of older chapters. */
const PRIORITY: Record<string, number> = { learn: 0, practice: 0, pyq: 1, revise: 2 };

interface Props {
  today: string;
  tasks: Task[];
  exam: ExamId;
}

export default function TodayPanel({ today, tasks, exam }: Props) {
  const study = tasks.filter((t) => STUDY_KINDS.has(t.kind));
  const left = study.filter((t) => !t.done);
  const hoursLeft = left.reduce((s, t) => s + t.hours, 0);

  // One entry per chapter studied today, most important first, at most three.
  const chapters: { chapterId: string; kind: Task['kind'] }[] = [];
  for (const t of [...study].sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind])) {
    if (t.chapterId && !chapters.some((c) => c.chapterId === t.chapterId)) chapters.push({ chapterId: t.chapterId, kind: t.kind });
  }
  const shown = chapters.slice(0, 3);

  return (
    <section className="today stack">
      <div className="spread">
        <div>
          <span className="eyebrow">Today · {dayName(today)} {formatDate(today)}</span>
          <h2>
            {tasks.length === 0
              ? 'Nothing scheduled today'
              : left.length === 0
                ? 'All done for today'
                : `${left.length} task${left.length === 1 ? '' : 's'} left · about ${Math.round(hoursLeft * 4) / 4} h`}
          </h2>
        </div>
        {tasks.length > 0 && (
          <button className="btn btn-sm" onClick={() => document.getElementById('today-tasks')?.scrollIntoView({ behavior: 'smooth' })}>
            See today’s tasks
          </button>
        )}
      </div>

      {shown.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="label">Videos for today’s chapters</span>
          <ul className="videos">
            {shown.map(({ chapterId, kind }) => {
              const ch = CHAPTER_BY_ID[chapterId];
              const [first, second] = videosFor(chapterId, exam, kind === 'pyq' ? 'pyq' : 'lecture');
              return (
                <li key={chapterId}>
                  <div className="small muted">
                    <span className={`subject-dot s-${ch.subject}`} /> {SUBJECT_NAMES[ch.subject]} · {ch.name}
                  </div>
                  {first ? (
                    <a className="video-link" href={videoUrl(first.id)} target="_blank" rel="noreferrer">
                      <span className={`chip ${first.kind === 'pyq' ? 'chip-warn' : 'chip-accent'}`}>{first.kind === 'pyq' ? 'PYQs' : 'Lecture'}</span>
                      <span>{first.title}</span>
                    </a>
                  ) : null}
                  <div className="row small">
                    {second && (
                      <a href={videoUrl(second.id)} target="_blank" rel="noreferrer">
                        {second.kind === 'pyq' ? 'PYQ video' : 'Another lecture'}: {second.title}
                      </a>
                    )}
                    <a className="muted" href={youtubeSearchUrl(ch.name, exam)} target="_blank" rel="noreferrer">Search YouTube</a>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="hint">Watch a video after you have tried the chapter yourself, or when you are stuck. Videos are a support, not a replacement for your book.</p>
        </div>
      )}
    </section>
  );
}
