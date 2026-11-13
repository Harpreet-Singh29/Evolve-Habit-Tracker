/**
 * Evolve ships a LIVE Capacitor WebView (capacitor.config.ts -> server.url).
 * The APK must be a THIN native shell with NO bundled web assets: Capacitor
 * loads the app from the Vercel origin on every launch instead.
 *
 * `npx cap sync android` re-copies dist/ into
 * android/app/src/main/assets/public/. This script removes that folder while
 * KEEPING assets/capacitor.config.json and assets/capacitor.plugins.json (which
 * carry the baked, LOCKED origin and the plugin list). It is wired into
 * `npm run cap:sync` and is idempotent / safe when the folder is already gone.
 *
 * The thin-shell rule (bundled `assets/` never served, `cap:sync` strips it).
 */
import { rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'android', 'app', 'src', 'main', 'assets', 'public');

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  console.log('[evolve] removed bundled web assets: android/app/src/main/assets/public');
} else {
  console.log('[evolve] thin shell OK: no bundled web assets present');
}
