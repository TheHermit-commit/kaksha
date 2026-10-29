import type { Pace } from '../types';

export const PACE_TEXT: Record<Pace, { label: string; tone: string }> = {
  comfortable: { label: 'Comfortable pace', tone: 'chip-good' },
  balanced: { label: 'Balanced pace', tone: 'chip-accent' },
  tight: { label: 'Tight pace', tone: 'chip-warn' },
  'very-tight': { label: 'Very tight', tone: 'chip-bad' },
};

export function PaceChip({ pace }: { pace: Pace }) {
  const p = PACE_TEXT[pace];
  return <span className={`chip ${p.tone}`}>{p.label}</span>;
}
