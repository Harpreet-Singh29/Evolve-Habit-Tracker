import { describe, expect, it } from 'vitest';
import type { Entry, Habit } from '../types';
import { addDays, dateRange, getTodayLocal, startOfWeek, weekdayOf } from './dates';
import {
  bestStreak,
  completionRate,
  currentStreak,
  heatmap,
  isScheduledOn,
  weeklyProgress,
} from './streaks';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h1',
  name: 'Test',
  icon: '✅',
  color: '#6366f1',
  schedule: { type: 'daily' },
  createdAt: '2024-01-01',
  archived: false,
  ...over,
});

const doneOn = (dates: string[], h: Habit = habit()): Entry[] =>
  dates.map((date) => ({ habitId: h.id, date, done: true }));

describe('dates', () => {
  it('getTodayLocal matches local calendar, not UTC', () => {
    const d = new Date(2024, 0, 1, 23, 30);
    expect(getTodayLocal(d)).toBe('2024-01-01');
    const d2 = new Date(2024, 0, 1, 0, 10);
    expect(getTodayLocal(d2)).toBe('2024-01-01');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap year
  });

  it('addDays survives a DST spring-forward (no 23/25h day assumption)', () => {
    // US DST 2024 starts Mar 10. Adding calendar days must still land on dates.
    expect(addDays('2024-03-09', 1)).toBe('2024-03-10');
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11');
    // And a full week round-trips.
    expect(addDays('2024-03-09', 7)).toBe('2024-03-16');
  });

  it('dateRange is inclusive', () => {
    expect(dateRange('2024-02-28', '2024-03-01')).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('startOfWeek is Monday-based', () => {
    // 2024-03-10 is a Sunday -> week starts Mon 2024-03-04
    expect(weekdayOf('2024-03-10')).toBe(0);
    expect(startOfWeek('2024-03-10')).toBe('2024-03-04');
    expect(startOfWeek('2024-03-11')).toBe('2024-03-11');
  });
});

describe('isScheduledOn', () => {
  it('daily is always scheduled', () => {
    expect(isScheduledOn(habit(), '2024-06-15')).toBe(true);
  });

  it('weekdays respects local weekday numbers', () => {
    const h = habit({ schedule: { type: 'weekdays', days: [1, 3, 5] } }); // Mon/Wed/Fri
    expect(isScheduledOn(h, '2024-03-11')).toBe(true); // Mon
    expect(isScheduledOn(h, '2024-03-12')).toBe(false); // Tue
    expect(isScheduledOn(h, '2024-03-13')).toBe(true); // Wed
  });

  it('timesPerWeek without day list is scheduled every day (target checked weekly)', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3 } });
    expect(isScheduledOn(h, '2024-03-12')).toBe(true);
  });

  it('timesPerWeek with explicit days only scheduled on those days', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3, days: [1, 3, 5] } }); // Mon/Wed/Fri
    expect(isScheduledOn(h, '2024-03-11')).toBe(true); // Mon
    expect(isScheduledOn(h, '2024-03-12')).toBe(false); // Tue
    expect(isScheduledOn(h, '2024-03-13')).toBe(true); // Wed
    expect(isScheduledOn(h, '2024-03-14')).toBe(false); // Thu
    expect(isScheduledOn(h, '2024-03-15')).toBe(true); // Fri
    expect(isScheduledOn(h, '2024-03-16')).toBe(false); // Sat
    expect(isScheduledOn(h, '2024-03-17')).toBe(false); // Sun
  });

  it('timesPerWeek with empty days array behaves like no day list (every day)', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3, days: [] } });
    expect(isScheduledOn(h, '2024-03-12')).toBe(true);
  });

  it('timesPerWeek with all 7 days is scheduled every day of the week', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3, days: [0, 1, 2, 3, 4, 5, 6] } });
    // Mon 2024-03-11 .. Sun 2024-03-17
    for (const d of ['2024-03-11', '2024-03-12', '2024-03-13', '2024-03-14', '2024-03-15', '2024-03-16', '2024-03-17']) {
      expect(isScheduledOn(h, d)).toBe(true);
    }
  });

  it('timesPerWeek with day selection is hidden from TODAY on non-chosen days but weekly target still counts', () => {
    const h = habit({ createdAt: '2024-03-01', schedule: { type: 'timesPerWeek', target: 3, days: [1, 3, 5] } }); // Mon/Wed/Fri
    // Tue is not a chosen day -> the habit is not scheduled (hidden from TODAY).
    expect(isScheduledOn(h, '2024-03-12')).toBe(false);
    expect(isScheduledOn(h, '2024-03-11')).toBe(true);
    // Weekly progress is still a distinct-completion count across the ISO week,
    // independent of which days are selected.
    const e = doneOn(['2024-03-11', '2024-03-13', '2024-03-15'], h);
    expect(weeklyProgress(h, e, '2024-03-13')).toBe(3);
  });

  it('timesPerWeek with day selection survives a week boundary (Monday-based)', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3, days: [1] } }); // Mondays only
    expect(isScheduledOn(h, '2024-03-11')).toBe(true); // Mon, start of week
    expect(isScheduledOn(h, '2024-03-10')).toBe(false); // Sun, previous week
    expect(isScheduledOn(h, '2024-03-18')).toBe(true); // Mon, next week
  });

  it('explicit-day timesPerWeek streak logic matches weekdays (unscheduled days do not break it)', () => {
    const h = habit({ createdAt: '2024-03-01', schedule: { type: 'timesPerWeek', target: 3, days: [1, 2, 3, 4, 5] } });
    // Fri Mar 8, Mon Mar 11 done; weekend not scheduled -> streak is 2.
    const e = doneOn(['2024-03-08', '2024-03-11'], h);
    expect(currentStreak(h, e, '2024-03-11')).toBe(2);
  });
});

describe('currentStreak', () => {
  it('counts consecutive completed days ending today', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const e = doneOn(['2024-03-08', '2024-03-09', '2024-03-10'], h);
    expect(currentStreak(h, e, '2024-03-10')).toBe(3);
  });

  it('streak ending yesterday still counts when today is not done', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const e = doneOn(['2024-03-08', '2024-03-09'], h);
    expect(currentStreak(h, e, '2024-03-10')).toBe(2);
  });

  it('unscheduled days do not break a streak', () => {
    const h = habit({ createdAt: '2024-03-01', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] } });
    // Fri Mar 8, Mon Mar 11 done; weekend not scheduled.
    const e = doneOn(['2024-03-08', '2024-03-11'], h);
    expect(currentStreak(h, e, '2024-03-11')).toBe(2);
  });

  it('a missed scheduled day resets to zero', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const e = doneOn(['2024-03-08', '2024-03-10'], h);
    expect(currentStreak(h, e, '2024-03-10')).toBe(1);
  });

  it('works across a DST boundary', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const e = doneOn(['2024-03-09', '2024-03-10', '2024-03-11'], h);
    expect(currentStreak(h, e, '2024-03-11')).toBe(3);
  });
});

describe('bestStreak', () => {
  it('returns the longest run in history', () => {
    const h = habit({ createdAt: '2024-01-01' });
    const e = doneOn(['2024-01-01', '2024-01-02', '2024-01-05', '2024-01-06', '2024-01-07'], h);
    expect(bestStreak(h, e)).toBe(3);
  });

  it('returns 0 with no entries', () => {
    expect(bestStreak(habit(), [])).toBe(0);
  });
});

describe('completionRate', () => {
  it('computes completed / scheduled days since creation', () => {
    const h = habit({ createdAt: '2024-03-01' });
    const e = doneOn(['2024-03-01', '2024-03-02'], h);
    expect(completionRate(h, e, '2024-03-04')).toBeCloseTo(2 / 4);
  });

  it('ignores unscheduled days in the denominator', () => {
    const h = habit({ createdAt: '2024-03-04', schedule: { type: 'weekdays', days: [1] } }); // Mondays
    const e = doneOn(['2024-03-04'], h);
    expect(completionRate(h, e, '2024-03-11')).toBeCloseTo(1 / 2);
  });
});

describe('weeklyProgress', () => {
  it('counts completions within the Monday-based week', () => {
    const h = habit({ schedule: { type: 'timesPerWeek', target: 3 } });
    const e = doneOn(['2024-03-10', '2024-03-11', '2024-03-12'], h); // Sun, Mon, Tue
    // Mar 11 week starts Mon Mar 11 -> counts Mon+Tue = 2; Mar 10 is prev week.
    expect(weeklyProgress(h, e, '2024-03-13')).toBe(2);
  });
});

describe('heatmap', () => {
  it('returns scheduled/done flags for a bounded window', () => {
    const h = habit({ createdAt: '2024-01-01' });
    const e = doneOn(['2024-03-10'], h);
    const cells = heatmap(h, e, '2024-03-10', 2);
    expect(cells.length).toBe(14);
    expect(cells[cells.length - 1].date).toBe('2024-03-10');
    expect(cells[cells.length - 1].done).toBe(true);
  });
});
