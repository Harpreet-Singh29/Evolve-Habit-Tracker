/**
 * Regression guard for the theme itself.
 *
 * `color.test.ts` checks the maths; this file checks the actual tokens in
 * index.css, including the cases a token table cannot see: CSS opacity and
 * alpha tints. It parses the two theme blocks straight out of the stylesheet,
 * so a colour can only change if it still passes here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, habitFill, readableTextColor } from './color';

/* Read the stylesheet from disk: Vite processes ?raw imports of CSS through the
   CSS pipeline and hands back an empty module, so the tokens must be read
   verbatim for the assertions below to mean anything. */
const cssText = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

type Tokens = Record<string, string>;

const BLOCK = /(?:^|\n)(:root|html\.light)\s*\{([\s\S]*?)\n\}/;

function block(selector: string): Tokens {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`);
  const m = re.exec(cssText);
  if (!m) throw new Error(`could not find ${selector} in index.css`);
  const tokens: Tokens = {};
  for (const line of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens[line[1]] = line[2].toLowerCase();
  }
  return tokens;
}

// TEMP debug
console.log('CSS RAW HEAD:', JSON.stringify(cssText.slice(0, 120)), 'len', cssText.length);

const dark = block(':root');const light = block('html.light');
const THEMES: Array<[string, Tokens]> = [['dark', dark], ['light', light]];

const parse = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const hex = (rgb: number[]): string =>
  '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Composite `fg` at `alpha` over `bg`, exactly as the renderer does. */
const over = (fg: string, bg: string, alpha: number): string => {
  const f = parse(fg);
  const b = parse(bg);
  return hex(f.map((c, i) => c * alpha + b[i] * (1 - alpha)));
};

// The habit color palette from HabitForm.tsx.
const PALETTE = ['#1a1d21', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];

describe('index.css parses', () => {
  it('finds both theme blocks with the expected tokens', () => {
    expect(BLOCK.test(cssText)).toBe(true);
    for (const [, t] of THEMES) {
      for (const key of ['bg', 'surface', 'surface-2', 'surface-3', 'control', 'text', 'muted', 'border', 'border-strong', 'brand', 'brand-text', 'danger', 'danger-on']) {
        expect(t[key], key).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe.each(THEMES)('%s theme text contrast', (_name, t) => {
  it('body text clears AA on every surface', () => {
    for (const surface of ['bg', 'surface', 'surface-2', 'surface-3', 'control']) {
      expect(contrastRatio(t.text, t[surface]), `text on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('muted text clears AA on every surface, including the banner/control', () => {
    for (const surface of ['bg', 'surface', 'surface-2', 'surface-3', 'control']) {
      expect(contrastRatio(t.muted, t[surface]), `muted on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('muted text still clears AA at the reduced opacity used for done rows (0.9)', () => {
    // Done rows are card_colour at 0.9 over the page; text and background scale
    // toward the card together, so the pair to check is muted-on-surface-3.
    const dimmed = over(t.muted, t['surface-3'], 0.9);
    expect(contrastRatio(dimmed, t['surface-3']), 'muted@0.9 on card').toBeGreaterThanOrEqual(4.5);
    // WeekAgenda done rows are a --control strip inside that 0.9 layer.
    expect(contrastRatio(t.muted, t.control), 'muted on control strip').toBeGreaterThanOrEqual(4.5);
  });

  it('muted text still clears AA at opacity-85 (empty day notice)', () => {
    const dimmed = over(t.muted, t['surface-3'], 0.85);
    expect(contrastRatio(dimmed, t['surface-3'])).toBeGreaterThanOrEqual(4.5);
  });

  it('disabled buttons keep readable labels at 0.7 opacity', () => {
    const card = t['surface-3'];
    // primary: brand fill + brand-text label, element composited at 70%
    const pBg = over(t.brand, card, 0.7);
    const pFg = over(t['brand-text'], card, 0.7);
    expect(contrastRatio(pFg, pBg), 'disabled primary label').toBeGreaterThanOrEqual(4.5);
    // ghost: control fill + text label
    const gBg = over(t.control, card, 0.7);
    const gFg = over(t.text, card, 0.7);
    expect(contrastRatio(gFg, gBg), 'disabled ghost label').toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(THEMES)('%s theme component boundaries', (_name, t) => {
  it('interactive edges clear the 3:1 non-text minimum', () => {
    for (const surface of ['surface-3', 'control']) {
      expect(contrastRatio(t['border-strong'], t[surface]), `border-strong on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('decorative borders stay visible (not < 1.4:1)', () => {
    expect(contrastRatio(t.border, t['surface-3'])).toBeGreaterThanOrEqual(1.4);
  });

  it('the "scheduled" heatmap cell and progress track are discernible from the card', () => {
    expect(contrastRatio(t.border, t['surface-3'])).toBeGreaterThanOrEqual(1.4);
  });

  it('danger ink clears AA on a danger fill', () => {
    expect(contrastRatio(t['danger-on'], t.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it('danger text clears AA on the card', () => {
    expect(contrastRatio(t.danger, t['surface-3'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('habit fills', () => {
  it.each([
    ['dark', false, '#1f1f23'],
    ['light', true, '#ffffff'],
  ] as const)('%s theme: every palette colour is visible as a solid fill', (_name, isLight, card) => {
    for (const c of PALETTE) {
      const fill = habitFill(c, 3, isLight);
      expect(contrastRatio(fill, card), `${c} -> ${fill}`).toBeGreaterThanOrEqual(3);
      // the check icon drawn on that fill must also be legible
      expect(contrastRatio(readableTextColor(fill), fill), `ink on ${fill}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('leaves colours that already pass untouched, so light mode keeps true black', () => {
    expect(habitFill('#1a1d21', 3, true)).toBe('#1a1d21');
    expect(habitFill('#ec4899', 3, true)).toBe('#ec4899');
    expect(habitFill('#ec4899', 3, false)).toBe('#ec4899');
  });

  it('fixes the near-black default in dark mode without losing its hue family', () => {
    const fixed = habitFill('#1a1d21', 3, false);
    expect(fixed).not.toBe('#1a1d21');
    expect(contrastRatio(fixed, '#1f1f23')).toBeGreaterThanOrEqual(3);
    // Stays a near-neutral grey (still the user's "black" choice, just visible):
    // the palette entry is a very slightly cool black, and the HSL nudge keeps
    // its saturation, so a little blue tint is expected.
    const [r, g, b] = parse(fixed);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(40);
  });
});
