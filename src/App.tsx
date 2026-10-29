import { useEffect, useState } from 'react';
import Onboarding from './pages/Onboarding';
import PlanIntro from './pages/PlanIntro';
import Planner from './pages/Planner';
import Syllabus from './pages/Syllabus';
import Mocks from './pages/Mocks';
import MockTest from './pages/MockTest';
import Trainer from './pages/Trainer';
import Doubts from './pages/Doubts';
import ProfilePage from './pages/Profile';
import { createState, loadState, saveState } from './lib/state';
import { href, navigate, useRoute, type Route } from './lib/router';
import type { AppState } from './types';

const NAV: { route: Route; label: string }[] = [
  { route: { name: 'planner' }, label: 'Planner' },
  { route: { name: 'intro' }, label: 'My plan' },
  { route: { name: 'syllabus' }, label: 'Syllabus' },
  { route: { name: 'mocks' }, label: 'Mock tests' },
  { route: { name: 'doubts' }, label: 'Doubts' },
  { route: { name: 'trainer' }, label: 'Trainer' },
  { route: { name: 'profile' }, label: 'Profile' },
];

export type Update = (fn: (s: AppState) => AppState) => void;

export default function App() {
  const [state, setState] = useState<AppState | null>(loadState);
  const route = useRoute();

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  if (!state) {
    return (
      <Onboarding
        onDone={(profile, progress) => {
          setState(createState(profile, progress));
          navigate({ name: 'intro' });
        }}
      />
    );
  }

  const update: Update = (fn) => setState((s) => (s ? fn(s) : s));
  const active = route.name === 'mock' ? 'mocks' : route.name;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href({ name: 'planner' })}>
            Kaksha<span>.</span>
          </a>
          <nav className="nav" aria-label="Main">
            {NAV.map((item) => (
              <a key={item.label} href={href(item.route)} aria-current={active === item.route.name ? 'page' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      {route.name === 'planner' && <Planner state={state} update={update} />}
      {route.name === 'intro' && <PlanIntro state={state} />}
      {route.name === 'syllabus' && <Syllabus state={state} update={update} />}
      {route.name === 'mocks' && <Mocks state={state} />}
      {route.name === 'mock' && <MockTest key={route.id} state={state} update={update} mockId={route.id} />}
      {route.name === 'trainer' && <Trainer state={state} update={update} />}
      {route.name === 'doubts' && <Doubts state={state} />}
      {route.name === 'profile' && <ProfilePage state={state} update={update} onReset={() => setState(null)} />}
    </>
  );
}
