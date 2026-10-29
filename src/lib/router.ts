import { useEffect, useState } from 'react';

export type Route =
  | { name: 'planner' }
  | { name: 'intro' }
  | { name: 'syllabus' }
  | { name: 'mocks' }
  | { name: 'mock'; id: string }
  | { name: 'trainer' }
  | { name: 'doubts' }
  | { name: 'profile' };

// Plain hash names (#planner, #mock-2026-11-01-sun) so links work on any static host.
function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  if (raw.startsWith('mock-')) return { name: 'mock', id: decodeURIComponent(raw.slice(5)) };
  const name = raw.split('/')[0];
  switch (name) {
    case 'intro':
    case 'syllabus':
    case 'mocks':
    case 'trainer':
    case 'doubts':
    case 'profile':
      return { name };
    default:
      return { name: 'planner' };
  }
}

export function href(route: Route): string {
  return route.name === 'mock' ? `#mock-${encodeURIComponent(route.id)}` : `#${route.name}`;
}

export function navigate(route: Route): void {
  window.location.hash = href(route);
  window.scrollTo(0, 0);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
