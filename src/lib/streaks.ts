import type { Entry, Habit, Schedule } from '../types';
import { addDays, getTodayLocal, isoWeekKey, startOfWeek, weekdayOf } from './dates';

/**
 * Pure streak / schedule logic. Heavily unit-tested (see streaks.test.ts).
 * All comparisons use local YYYY-MM-DD strings.
 */

/** Is this habit expected on the given local date? */
export function isScheduledOn(habit: Habit, date: string): boolean {
  const s: Schedule = habit.schedule;
  if (s.type === 'daily') return true;
  if (s.type === 'weekdays') return s.days.includes(weekdayOf(date));
  // timesPerWeek with an explicit day list: scheduled only on the chosen days.
  if (s.type === 'timesPerWeek' && Array.isArray(s.days) && s.days.length > 0) {
    return s.days.includes(weekdayOf(date));
  }
  // timesPerWeek without day selection: the target is a weekly count, so the
  // habit stays visible every day (any of the target completions counts).
  return true;
}

function doneSet(entries: Entry[]): Set<string> {
  const s = new Set<string>();
  for (const e of entries) if (e.done) s.add(`${e.habitId}|${e.date}`);
  return s;
}

/** Current consecutive streak of completed scheduled days, ending today. */
export function currentStreak(habit: Habit, entries: Entry[], today: string = getTodayLocal()): number {
  const done = doneSet(entries);
  const isDone = (d: string) => done.has(`${habit.id}|${d}`);
  let streak = 0;
  let cursor = today;

  // If today isn't done yet, a streak that ended yesterday still counts.
  if (isScheduledOn(habit, cursor) && !isDone(cursor)) {
    cursor = addDays(cursor, -1);
  }

  for (let guard = 0; guard < 3650; guard++) {
    // Skip days that are not scheduled without breaking the streak.
    if (!isScheduledOn(habit, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!isDone(cursor)) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest consecutive streak of completed scheduled days in the history. */
export function bestStreak(habit: Habit, entries: Entry[]): number {
  const done = doneSet(entries);
  const dates = [...done]
    .filter((k) => k.startsWith(`${habit.id}|`))
    .map((k) => k.split('|')[1])
    .sort();
  if (dates.length === 0) return 0;

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    if (prev === null) {
      run = 1;
    } else {
      // Walk from prev to d; unscheduled days don't break a streak.
      let cursor = addDays(prev, 1);
      let gapIsUnscheduledOnly = true;
      for (let g = 0; cursor < d && g < 14; g++, cursor = addDays(cursor, 1)) {
        if (isScheduledOn(habit, cursor)) {
          gapIsUnscheduledOnly = false;
          break;
        }
      }
      if (cursor === d && gapIsUnscheduledOnly) run++;
      else run = 1;
    }
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Fraction of scheduled days completed across all recorded history (0..1). */
export function completionRate(
  habit: Habit,
  entries: Entry[],
  today: string = getTodayLocal(),
): number {
  if (habit.createdAt > today) return 0;
  let scheduled = 0;
  let completed = 0;
  const done = doneSet(entries);
  for (let cursor = habit.createdAt, guard = 0; cursor <= today && guard++ < 3650; cursor = addDays(cursor, 1)) {
    if (!isScheduledOn(habit, cursor)) continue;
    scheduled++;
    if (done.has(`${habit.id}|${cursor}`)) completed++;
  }
  return scheduled === 0 ? 0 : completed / scheduled;
}

/** For timesPerWeek habits: completions in the week containing `date`. */
export function weeklyProgress(habit: Habit, entries: Entry[], date: string): number {
  if (habit.schedule.type !== 'timesPerWeek') return 0;
  const done = doneSet(entries);
  const start = startOfWeek(date);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (done.has(`${habit.id}|${d}`)) count++;
  }
  return count;
}

export function weeklyTarget(habit: Habit): number {
  return habit.schedule.type === 'timesPerWeek' ? habit.schedule.target : 0;
}

/** Heatmap data: completion status per day for the last `weeks` weeks. */
export function heatmap(
  habit: Habit,
  entries: Entry[],
  today: string = getTodayLocal(),
  weeks = 16,
): { date: string; done: boolean; scheduled: boolean }[] {
  const done = doneSet(entries);
  const end = today;
  const start = addDays(startOfWeek(end), -(weeks - 1) * 7);
  const out: { date: string; done: boolean; scheduled: boolean }[] = [];
  for (let cursor = start, guard = 0; cursor <= end && guard++ < 1000; cursor = addDays(cursor, 1)) {
    out.push({
      date: cursor,
      done: done.has(`${habit.id}|${cursor}`),
      scheduled: isScheduledOn(habit, cursor) && cursor >= habit.createdAt && cursor <= end,
    });
  }
  return out;
}

/** Grouping key for a day's week — used by weekly targets. */
export { isoWeekKey };
