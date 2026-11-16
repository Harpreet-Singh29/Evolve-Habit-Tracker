import { describe, it, expect } from 'vitest';
import {
  addDays,
  dateRange,
  fromDateKey,
  getTodayLocal,
  isValidDateKey,
  startOfWeek,
  toDateKey,
  weekdayOf,
} from './dates';

describe('week math (weekly agenda)', () => {
  it('startOfWeek returns Monday for every weekday', () => {
    // 2026-11-16 is a Monday.
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16'); // Mon
    expect(startOfWeek('2026-11-17')).toBe('2026-11-16'); // Tue
    expect(startOfWeek('2026-11-18')).toBe('2026-11-16'); // Wed
    expect(startOfWeek('2026-11-19')).toBe('2026-11-16'); // Thu
    expect(startOfWeek('2026-11-20')).toBe('2026-11-16'); // Fri
    expect(startOfWeek('2026-11-21')).toBe('2026-11-16'); // Sat
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16'); // Sun
  });

  it('startOfWeek crosses a month boundary backwards', () => {
    // 2026-11-01 is a Sunday -> week starts Monday 2026-10-26.
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });

  it('startOfWeek crosses a year boundary backwards', () => {
    // 2027-01-01 is a Friday -> week starts Monday 2026-12-28.
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('addDays moves exactly one week forward/back', () => {
    expect(addDays('2026-11-16', 7)).toBe('2026-11-23');
    expect(addDays('2026-11-23', -7)).toBe('2026-11-16');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('dateRange yields the seven day keys of a week crossing months', () => {
    const days = dateRange('2026-11-30', '2026-12-06');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-11-30');
    expect(days[6]).toBe('2026-12-06');
    expect(weekdayOf(days[0])).toBe(1); // Monday
    expect(weekdayOf(days[6])).toBe(0); // Sunday
  });

  it('dateRange yields seven day keys across a year boundary', () => {
    const days = dateRange('2026-12-28', '2027-01-03');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-12-28');
    expect(days[6]).toBe('2027-01-03');
    expect(new Set(days).size).toBe(7);
  });

  it('navigating prev/next keeps the anchor on a Monday', () => {
    let anchor = startOfWeek('2026-11-18');
    anchor = addDays(anchor, -7);
    expect(weekdayOf(anchor)).toBe(1);
    anchor = addDays(anchor, 7);
    expect(weekdayOf(anchor)).toBe(1);
    expect(anchor).toBe('2026-11-16');
  });

  it('date keys round-trip through Date without timezone drift', () => {
    for (const key of ['2026-11-16', '2026-12-31', '2027-01-01', '2028-02-29']) {
      expect(toDateKey(fromDateKey(key))).toBe(key);
    }
  });

  it('rejects impossible dates', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
    expect(isValidDateKey('not-a-date')).toBe(false);
    expect(isValidDateKey('2026-11-16')).toBe(true);
  });

  it('getTodayLocal returns a valid date key', () => {
    expect(isValidDateKey(getTodayLocal())).toBe(true);
  });
});