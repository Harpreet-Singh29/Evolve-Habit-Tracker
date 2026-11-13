/**
 * All dates in Evolve are LOCAL calendar dates as "YYYY-MM-DD" strings.
 * Never use UTC timestamps for day identity — that is the #1 source of
 * timezone/DST bugs in habit trackers.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's local calendar date. */
export function getTodayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Convert any Date to its local YYYY-MM-DD key. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a YYYY-MM-DD key into a local Date at noon (DST-safe). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  // Noon avoids midnight DST shifts entirely.
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Add/remove days from a date key using local Date arithmetic (DST-safe). */
export function addDays(key: string, delta: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + delta);
  return toDateKey(d);
}

/** Local weekday: 0 = Sunday .. 6 = Saturday. */
export function weekdayOf(key: string): number {
  return fromDateKey(key).getDay();
}

/** Monday-based start of the week containing `key`. */
export function startOfWeek(key: string): string {
  const dow = weekdayOf(key); // 0=Sun..6=Sat
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(key, -back);
}

/** Inclusive list of date keys from `start` to `end`. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 10000) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatDate(key: string, opts?: Intl.DateTimeFormatOptions): string {
  return fromDateKey(key).toLocaleDateString(undefined, opts ?? {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function monthLabel(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Returns the local date key used for the "week" grouping key. */
export function isoWeekKey(key: string): string {
  return startOfWeek(key);
}
