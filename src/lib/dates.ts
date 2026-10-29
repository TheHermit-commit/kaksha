// All dates are local calendar days as 'YYYY-MM-DD' strings.

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISO(d);
}

/** Number of days from a to b (positive when b is later). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function dayName(iso: string): string {
  return SHORT_DAYS[weekdayIndex(iso)];
}

export function formatDate(iso: string, withYear = false): string {
  return parseISO(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatMonthYear(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
