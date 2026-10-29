import { useState } from 'react';
import type { Update } from '../App';
import { formatDate } from '../lib/dates';
import { href } from '../lib/router';
import { applyCheckIn } from '../lib/state';
import type { AppState, CheckInAnswers } from '../types';

const STRESS = ['Calm', 'Okay', 'Some pressure', 'Stressed', 'Overwhelmed'];
const SLEEP: { id: CheckInAnswers['sleep']; label: string }[] = [
  { id: 'under6', label: 'Under 6 h' },
  { id: '6to7', label: '6–7 h' },
  { id: '7plus', label: '7 h or more' },
];
const SCHOOL: { id: CheckInAnswers['school']; label: string }[] = [
  { id: 'none', label: 'Nothing major' },
  { id: 'some', label: 'Some tests or assignments' },
  { id: 'heavy', label: 'School exams' },
];
const PACE: { id: CheckInAnswers['pace']; label: string }[] = [
  { id: 'slow', label: 'Too easy, I can do more' },
  { id: 'right', label: 'About right' },
  { id: 'fast', label: 'Too fast' },
];

function summarise(a: CheckInAnswers): string {
  const parts = [
    `${a.hoursAvailable} h a day available`,
    `stress: ${STRESS[a.stress - 1].toLowerCase()}`,
    `sleep: ${SLEEP.find((s) => s.id === a.sleep)!.label.toLowerCase()}`,
    `school: ${SCHOOL.find((s) => s.id === a.school)!.label.toLowerCase()}`,
    `pace: ${PACE.find((p) => p.id === a.pace)!.label.toLowerCase()}`,
  ];
  return parts.join(' · ');
}

function Helpline() {
  return (
    <div className="callout callout-warn">
      <p><strong>Tele-MANAS: 14416</strong> or 1-800-891-4416</p>
      <p className="small">Free, confidential mental health support from the Government of India, 24 hours a day, in many Indian languages.</p>
    </div>
  );
}

export default function Trainer({ state, update }: { state: AppState; update: Update }) {
  const { profile } = state;
  const [answers, setAnswers] = useState<CheckInAnswers>({
    hoursAvailable: profile.hoursPerDay,
    stress: 2,
    sleep: '7plus',
    school: 'none',
    pace: 'right',
    note: '',
  });
  const set = <K extends keyof CheckInAnswers>(k: K, v: CheckInAnswers[K]) => setAnswers((a) => ({ ...a, [k]: v }));

  const submit = () => {
    const out = applyCheckIn(state, answers);
    update(() => out.state);
    setAnswers((a) => ({ ...a, note: '' }));
    setTimeout(() => document.getElementById('latest-reply')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const history = [...state.checkins].reverse();

  return (
    <main className="page narrow">
      <div className="stack">
        <h1>Your trainer</h1>
        <p className="muted">
          Check in once a week, ideally on Sunday after your mock, or whenever things change. Tell me about your workload, sleep and stress, and I will rearrange the coming weeks to fit. Your exam date stays fixed.
        </p>
      </div>

      <section className="section">
        <h2>How are things going, {profile.name}?</h2>

        <div className="field">
          <span className="label">How many hours can you study each day for the next 7 days?</span>
          <input type="range" min={0.5} max={12} step={0.5} value={answers.hoursAvailable} onChange={(e) => set('hoursAvailable', Number(e.target.value))} aria-label="Hours available per day" />
          <div className="spread small">
            <span className="muted">Usually {profile.hoursPerDay} h</span>
            <strong className="num">{answers.hoursAvailable} h a day</strong>
          </div>
        </div>

        <div className="field">
          <span className="label">How stressed do you feel?</span>
          <div className="scale" role="group" aria-label="Stress level">
            {STRESS.map((label, i) => (
              <button key={label} aria-pressed={answers.stress === i + 1} onClick={() => set('stress', (i + 1) as CheckInAnswers['stress'])}>
                <b>{i + 1}</b>{label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="label">How much have you been sleeping?</span>
          <div className="seg" role="group" aria-label="Sleep">
            {SLEEP.map((o) => <button key={o.id} aria-pressed={answers.sleep === o.id} onClick={() => set('sleep', o.id)}>{o.label}</button>)}
          </div>
        </div>

        <div className="field">
          <span className="label">What does school look like this week?</span>
          <div className="seg" role="group" aria-label="School workload">
            {SCHOOL.map((o) => <button key={o.id} aria-pressed={answers.school === o.id} onClick={() => set('school', o.id)}>{o.label}</button>)}
          </div>
        </div>

        <div className="field">
          <span className="label">How does the pace of new chapters feel?</span>
          <div className="seg" role="group" aria-label="Pace">
            {PACE.map((o) => <button key={o.id} aria-pressed={answers.pace === o.id} onClick={() => set('pace', o.id)}>{o.label}</button>)}
          </div>
        </div>

        <div className="field">
          <label htmlFor="note">Anything else I should know?</label>
          <textarea id="note" className="input" value={answers.note} onChange={(e) => set('note', e.target.value)} placeholder="For example: a cousin’s wedding on Saturday, I had a fever, I feel behind in Organic Chemistry…" maxLength={600} />
          <p className="hint">I read this for things like illness, family events or feeling overwhelmed. It stays in this browser.</p>
        </div>

        <div className="row">
          <button className="btn btn-primary btn-lg" onClick={submit}>Update my plan</button>
        </div>
      </section>

      {history.length > 0 && (
        <section className="section" id="latest-reply">
          <h2>Conversation</h2>
          <div className="stack-lg">
            {history.map((e) => (
              <div key={e.id} className="stack">
                <div className="bubble-row me">
                  <div className="msg">
                    <span className="small muted">{formatDate(e.date)}</span>
                    <span className="small">{summarise(e.answers)}</span>
                    {e.answers.note && <span>“{e.answers.note}”</span>}
                  </div>
                </div>
                <div className="bubble-row coach">
                  <div className="msg">
                    {e.reply.map((r) => <p key={r}>{r}</p>)}
                    {e.changes.length > 0 && (
                      <div className="stack" style={{ gap: 4 }}>
                        <span className="eyebrow">What changed</span>
                        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                          {e.changes.map((c) => <li key={c}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    {e.showHelpline && <Helpline />}
                    {e.id === history[0].id && <a className="small" href={href({ name: 'planner' })}>See the updated planner →</a>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="small muted">
        Feeling low or anxious for more than a few days? Talk to someone you trust, or call Tele-MANAS on 14416 (free, 24 hours).
      </p>
    </main>
  );
}
