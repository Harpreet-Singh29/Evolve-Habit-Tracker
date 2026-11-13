import type { Backup, Entry, Habit } from '../types';
import { isValidDateKey } from './dates';

/**
 * Export/Import JSON is the ONLY bridge between the two separate local stores
 * (browser localStorage vs the APK WebView localStorage).
 * No network, no accounts — the file never leaves the user's control.
 */

const VALID_SCHEDULES = new Set(['daily', 'weekdays', 'timesPerWeek']);
const HEX = /^#[0-9a-fA-F]{6}$/;

function isHabit(v: unknown): v is Habit {
  if (!v || typeof v !== 'object') return false;
  const h = v as Record<string, unknown>;
  const s = h.schedule as Record<string, unknown> | undefined;
  return (
    typeof h.id === 'string' &&
    typeof h.name === 'string' &&
    typeof h.icon === 'string' &&
    typeof h.color === 'string' &&
    HEX.test(h.color) &&
    typeof h.createdAt === 'string' &&
    isValidDateKey(h.createdAt) &&
    typeof h.archived === 'boolean' &&
    !!s &&
    typeof s.type === 'string' &&
    VALID_SCHEDULES.has(s.type) &&
    (s.type !== 'weekdays' || (Array.isArray(s.days) && s.days.every((d) => Number.isInteger(d)))) &&
    (s.type !== 'timesPerWeek' || (typeof s.target === 'number' && s.target >= 1 && s.target <= 7)) &&
    (h.reminder === undefined || typeof h.reminder === 'string')
  );
}

function isEntry(v: unknown): v is Entry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.habitId === 'string' &&
    typeof e.date === 'string' &&
    isValidDateKey(e.date) &&
    typeof e.done === 'boolean' &&
    (e.completedAt === undefined || typeof e.completedAt === 'string')
  );
}

export function createBackup(habits: Habit[], entries: Entry[]): Backup {
  return {
    app: 'evolve',
    version: 1,
    exportedAt: new Date().toISOString(),
    habits,
    entries,
  };
}

/** Throws a readable error instead of corrupting the store on bad input. */
export function parseBackup(text: string): { habits: Habit[]; entries: Entry[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new Error('Unexpected file format.');
  const b = raw as Record<string, unknown>;
  if (b.app !== 'evolve') throw new Error('This is not an Evolve backup file.');
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}.`);
  if (!Array.isArray(b.habits) || !Array.isArray(b.entries)) {
    throw new Error('Backup is missing habits or entries.');
  }
  if (!b.habits.every(isHabit)) throw new Error('Backup contains an invalid habit.');
  if (!b.entries.every(isEntry)) throw new Error('Backup contains an invalid entry.');
  const habits = b.habits as Habit[];
  const ids = new Set(habits.map((h) => h.id));
  if (!b.entries.every((e) => ids.has((e as Entry).habitId))) {
    throw new Error('Backup contains an entry for a missing habit.');
  }
  return { habits, entries: b.entries as Entry[] };
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evolve-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
