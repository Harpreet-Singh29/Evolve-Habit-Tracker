// One-off local sanity check: ensure every @resource reference in android/
// XML/manifest resolves to a defined resource. Catches aapt link errors without
// needing a full Gradle/Android SDK toolchain on this machine.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const manifest = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

const xmlFiles = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.xml')) xmlFiles.push(p);
  }
}
if (existsSync(res)) walk(res);

const sources = [...xmlFiles, existsSync(manifest) ? manifest : null].filter(Boolean);
const refs = new Set();
for (const f of sources) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/@(color|drawable|style|mipmap|string)\/([A-Za-z0-9_]+)/g)) {
    refs.add(`${m[1]}/${m[2]}`);
  }
}

// Value resources: <color name>, <string name>, <style name>
const defined = new Set();
for (const f of xmlFiles) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<(color|string|style)\s+name="([^"]+)"/g)) {
    defined.add(`${m[1]}/${m[2]}`);
  }
}

// File-based resources (drawables/mipmaps) are referenced by base filename.
const fileNames = new Set();
function collect(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) collect(p);
    else fileNames.add(e.name.replace(/\.(png|xml|webp|jpg)$/, ''));
  }
}
if (existsSync(res)) collect(res);

let missing = 0;
for (const r of [...refs].sort()) {
  const [type, name] = r.split('/');
  const ok = ['color', 'string', 'style'].includes(type)
    ? defined.has(`${type}/${name}`)
    : fileNames.has(name) || defined.has(`${type}/${name}`);
  if (!ok) {
    console.log(`  UNRESOLVED @${r}`);
    missing++;
  }
}
console.log(
  missing === 0
    ? `OK: all ${refs.size} @resource references resolve.`
    : `${missing} unresolved reference(s) — Gradle aapt would fail.`,
);
process.exit(missing === 0 ? 0 : 1);
