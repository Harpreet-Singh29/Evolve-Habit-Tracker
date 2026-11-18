/**
 * Minimal ambient typing for the single Node built-in used by the tests.
 *
 * @types/node is deliberately NOT a dependency of this web app, so this
 * declares exactly what `theme-tokens.test.ts` needs to read index.css from
 * disk. Keep it that small; do not grow this into a general Node shim.
 */
declare module 'node:fs' {
  export function readFileSync(path: string | URL, encoding: 'utf8'): string;
}
