# Kaksha

A free self-study planner for Class 11 and 12 students preparing for JEE Main, JEE Advanced or NEET UG without coaching.

## What it does

1. **Onboarding:** asks for name, class and exam, then the time left (1–24 months or an exact date), daily study hours and which NCERT chapters are still left.
2. **Plan explanation:** shows how many weeks are left, how many hours the remaining syllabus needs, the pace (comfortable to very tight) and the phases: learning, optional practice, then final revision.
3. **Weekly planner:** gives day-by-day tasks. About 80% of each day goes to new chapters and 20% to revising older ones. Every Sunday has a timed mock on that week's chapters, and every fourth mock is cumulative.
4. **Mock tests:** an NTA-style interface with a question palette, a timer and real marking. The results show chapter-wise accuracy, and weak chapters move to the front of the revision slots.
5. **Trainer check-in:** the student reports hours available, stress, sleep, school load, pace and a free-text note. Fixed rules (`src/lib/checkin.ts`) lighten or reshuffle the coming weeks and explain what changed. Notes that mention distress show the Tele-MANAS helpline (14416).
6. **Doubts:** students type a question or attach up to 3 photos, choose "Give me a hint" or "Show full solution", then ask for more hints or follow-ups. Every doubt is saved and can be browsed by chapter or by day. Answers come from Google Gemini (or Claude) through the small server in `server/`.

Plans, progress and saved doubts are stored in the browser's `localStorage`. The only server-side piece is the doubt tutor.

## Run it

The doubt tutor needs an AI API key on the server. The key is never sent to students' browsers. Use either:

- a Google Gemini key from [Google AI Studio](https://aistudio.google.com) (has a free tier), set as `GEMINI_API_KEY`, or
- an Anthropic key from [console.anthropic.com](https://console.anthropic.com), set as `ANTHROPIC_API_KEY`.

```bash
npm install
```

Copy `.env.example` to a new file named `.env` and paste your key after `GEMINI_API_KEY=`. The server reads it on start, and git never commits it. On a hosting service, set `GEMINI_API_KEY` in its environment-variable settings instead.

For development, run the tutor server and the Vite dev server in two terminals:

```bash
npm run server
```

```bash
npm run dev
```

For production, build the site and serve it, together with the tutor, from one Node process on `PORT` (default 8787):

```bash
npm start
```

Server settings (environment variables):

| Variable | Default | Meaning |
| --- | --- | --- |
| `GEMINI_API_KEY` | none | Google Gemini key; when set, Gemini answers doubts |
| `ANTHROPIC_API_KEY` | none | Anthropic key; used when no Gemini key is set |
| `TUTOR_PROVIDER` | automatic | Force `gemini` or `claude` when both keys are set |
| `KAKSHA_MODEL` | `gemini-flash-latest` (Gemini) or `claude-opus-5-5` (Claude) | Model that answers doubts |
| `DOUBTS_PER_HOUR` | `30` | Per-visitor limit, to protect your API bill |
| `PORT` | `8787` | Port for the site and `/api/doubt` |

The Gemini free tier has a small daily request limit shared by every student using your site. When it runs out, students see a "try again later" message until the quota resets.

Any Node 22.18+ host works, such as Render, Railway, Fly.io or a small VPS. A static-only host (GitHub Pages, Netlify static) runs everything except the doubt tutor.

To run the tests and type checks:

```bash
npm test
```

```bash
npm run typecheck
```

## Where things live

| Path | Contents |
| --- | --- |
| `src/data/chapters.ts` | NCERT chapter lists per exam, with weightage and estimated hours |
| `src/data/questions/` | PYQ-style question bank, about 3 per chapter, with solutions |
| `src/lib/planner.ts` | Builds the week-by-week plan from the syllabus and the time left |
| `src/lib/checkin.ts` | Trainer rules that turn a check-in into plan changes |
| `src/lib/state.ts` | App state, replanning, saving to `localStorage` |
| `src/lib/tutorPrompt.ts` | The doubt tutor's instructions (shared by browser and server) |
| `server/index.ts` | Serves the site and streams doubt answers from Gemini or Claude |
| `src/pages/` | Screens: onboarding, plan, planner, syllabus, mocks, doubts, trainer, profile |

## Content notes

- Chapter lists follow the current rationalised NCERT books. Topics still in the exam syllabus but removed from NCERT (such as p-block groups 13–18) are listed as extra topics.
- Questions are original, written in the style of past papers. They are not copied from official papers. Add more by appending to the files in `src/data/questions/`.
- Chapter hours and weightage are estimates. Adjust them in `src/data/chapters.ts`.
