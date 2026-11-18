/**
 * WCAG 2.1 contrast helpers (no dependencies).
 *
 * Used where text or icons are drawn on top of user-chosen colors (habit
 * colors) and where a color must stay readable in both themes. Ink values
 * mirror the --text tokens in index.css; the surface references are the
 * worst-case (lightest) surface of each theme, so passing a ratio against
 * them guarantees at least that ratio on every surface of that theme.
 */

const INK_DARK = '#1a1d21'; // light-theme --text
const INK_LIGHT = '#fafafa'; // dark-theme --text

/* Light theme: contrast is worst against the DARKEST light surface, so a pass
   here guarantees a pass on every light surface. #e8ebef is --surface-2 /
   --control; #ffffff (--surface-3) is lighter and therefore easier. */
const SURFACE_LIGHT = '#e8ebef';
const SURFACE_DARK = '#27272a'; // dark --surface-2/--control (lightest dark surface)

/* Card surfaces, used for solid habit-coloured fills (see habitFill). */
const CARD_LIGHT = '#ffffff'; // light --surface-3
const CARD_DARK = '#1f1f23'; // dark --surface-3

/** True when the light theme class is present on <html>. Defaults to dark. */
export function isLightTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('light');
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return [
    parseInt(m[1].slice(0, 2), 16),
    parseInt(m[1].slice(2, 4), 16),
    parseInt(m[1].slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const h = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). Invalid input -> 0. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1 = identical, 21 = black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Highest-contrast theme ink for text or icons drawn on top of `bg`
 * (e.g. the check mark inside a habit's colored circle).
 */
export function readableTextColor(bg: string): string {
  return contrastRatio(bg, INK_DARK) >= contrastRatio(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (h % 360) / 360;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
}

/**
 * Nudge a color's lightness (hue-preserving) until it reaches `min` contrast
 * against `ref`. Returns the input unchanged when it already passes; falls back
 * to the closest attempt if the exact ratio is unreachable.
 */
function nudgeToContrast(hex: string, ref: string, min: number, dir: 1 | -1): string {
  if (contrastRatio(hex, ref) >= min) return hex;
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  let best = hex;
  let bestRatio = contrastRatio(hex, ref);
  for (let i = 1; i <= 50; i++) {
    const li = Math.min(1, Math.max(0, l + dir * i * 0.02));
    const [r, g, b] = hslToRgb(h, s, li);
    const cand = toHex(r, g, b);
    const ratio = contrastRatio(cand, ref);
    if (ratio >= min) return cand;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = cand;
    }
    if (li === 0 || li === 1) break;
  }
  return best;
}

/**
 * Nudge a color's lightness (hue-preserving) until it reaches `min` contrast
 * against the current theme's worst-case surface. Returns the input unchanged
 * when it already passes. `light` overrides theme detection (for tests).
 */
export function ensureContrast(hex: string, min = 4.5, light?: boolean): string {
  const isLight = light ?? isLightTheme();
  const ref = isLight ? SURFACE_LIGHT : SURFACE_DARK;
  return nudgeToContrast(hex, ref, min, isLight ? -1 : 1);
}

/**
 * Theme-aware version of a habit colour for use as a SOLID FILL — the done
 * circle, heatmap cells, progress-bar fills, swatches, and their alpha tints
 * (`${habitFill(c)}22`).
 *
 * The palette deliberately includes #1a1d21, which is the light theme's ink
 * and reads at 1.03:1 against the dark card — the circle, heatmap and progress
 * bar simply vanished in dark mode. Fills must clear the 3:1 non-text minimum
 * against the card surface of whichever theme is active. Colours that already
 * pass are returned untouched, so the palette is unchanged and light mode keeps
 * its true black. `light` overrides theme detection (for tests).
 */
export function habitFill(hex: string, min = 3, light?: boolean): string {
  const isLight = light ?? isLightTheme();
  return nudgeToContrast(hex, isLight ? CARD_LIGHT : CARD_DARK, min, isLight ? -1 : 1);
}
