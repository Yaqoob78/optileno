/** Calendar dates as local ISO strings (YYYY-MM-DD). No time zones, no surprises. */
export type ISODate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toISO(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(now = new Date()): ISODate {
  return toISO(now);
}

/** Parses at local noon so DST shifts can never move the date. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function isValidISO(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !ISO_RE.test(value)) return false;
  const d = parseISO(value);
  return !Number.isNaN(d.getTime()) && toISO(d) === value;
}

export function addDays(iso: ISODate, n: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Moves forward by working days (Mon–Fri). */
export function addWorkdays(iso: ISODate, n: number): ISODate {
  if (n <= 0) return iso;
  const d = parseISO(iso);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return toISO(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

const SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const LONG = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const FULL = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export function formatShort(iso: ISODate): string {
  return SHORT.format(parseISO(iso));
}

export function formatLong(iso: ISODate): string {
  return LONG.format(parseISO(iso));
}

export function formatFull(iso: ISODate): string {
  return FULL.format(parseISO(iso));
}

/** "Today", "Yesterday", or "Sep 21" for a timestamp. */
export function formatWhen(ts: number, now = Date.now()): string {
  const day = toISO(new Date(ts));
  const today = toISO(new Date(now));
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return formatShort(day);
}
