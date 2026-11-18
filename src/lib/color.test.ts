import { describe, expect, it } from 'vitest';
import { contrastRatio, ensureContrast, isLightTheme, readableTextColor, relativeLuminance } from './color';

// The habit color palette from HabitForm.tsx.
const PALETTE = ['#1a1d21', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

describe('contrast math', () => {
  it('relative luminance spans black to white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('contrast ratio spans 1 (identical) to 21 (black on white)', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });
});

describe('readableTextColor', () => {
  it('picks dark ink on light backgrounds and light ink on dark ones', () => {
    expect(readableTextColor('#ffffff')).toBe('#1a1d21');
    expect(readableTextColor('#f59e0b')).toBe('#1a1d21'); // amber is light
    expect(readableTextColor('#000000')).toBe('#fafafa');
    expect(readableTextColor('#1a1d21')).toBe('#fafafa');
  });

  it('the chosen ink always clears 3:1 on every habit color (icons)', () => {
    for (const c of PALETTE) {
      const ink = readableTextColor(c);
      expect(['#1a1d21', '#fafafa']).toContain(ink);
      expect(contrastRatio(c, ink)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('ensureContrast', () => {
  it('returns colors that already pass unchanged', () => {
    expect(ensureContrast('#1a1d21', 4.5, true)).toBe('#1a1d21'); // dark ink on white
    expect(ensureContrast('#fafafa', 4.5, false)).toBe('#fafafa'); // light ink on dark surface
  });

  it('brings every habit color to 4.5:1 on both themes', () => {
    // Light reference is the darkest light surface (--surface-2/--control).
    for (const c of PALETTE) {
      expect(contrastRatio(ensureContrast(c, 4.5, true), '#e8ebef')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(ensureContrast(c, 4.5, false), '#27272a')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never lands under 4.5:1 on the lightest light surface either', () => {
    for (const c of PALETTE) {
      expect(contrastRatio(ensureContrast(c, 4.5, true), '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the hue while nudging lightness', () => {
    // #3b82f6 is blue and must stay blue after adjustment.
    const out = ensureContrast('#3b82f6', 4.5, true);
    expect(out).not.toBe('#3b82f6');
    expect(parseInt(out.slice(5, 7), 16)).toBeGreaterThan(parseInt(out.slice(1, 3), 16)); // b > r
  });

  it('returns invalid input as-is', () => {
    expect(ensureContrast('nope', 4.5, true)).toBe('nope');
  });

  it('auto-detects the dark theme when no document exists', () => {
    expect(isLightTheme()).toBe(false);
    expect(ensureContrast('#3b82f6')).toBe(ensureContrast('#3b82f6', 4.5, false));
  });
});
