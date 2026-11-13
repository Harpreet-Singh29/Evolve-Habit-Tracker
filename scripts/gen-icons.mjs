/**
 * Generates Evolve's PWA / launcher icons as real PNGs without any external
 * image library. Uses zlib (built into Node) to emit valid PNG chunks.
 *
 * Outputs into public/icons/:
 *   icon.svg           - vector favicon
 *   icon-192.png       - PWA 192
 *   icon-512.png       - PWA 512
 *   maskable-512.png   - PWA maskable (full-bleed, safe zone respected)
 *   icon-1024.png      - source for @capacitor/assets generate
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---- minimal PNG encoder ----------------------------------------------------
function crc32(buf) {
  let c,
    crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // no filter
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing ---------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function roundedRectContains(x, y, size, radius) {
  const r = radius;
  const cx = Math.min(Math.max(x, r), size - r);
  const cy = Math.min(Math.max(y, r), size - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// Blocky "E": vertical stem + three horizontal bars (proportional to size).
function isE(x, y, s) {
  const u = x / s;
  const v = y / s;
  const stemL = 0.29,
    stemR = 0.43,
    top = 0.26,
    bottom = 0.74;
  const barThickness = 0.075;
  const bars = [
    [top, top + barThickness],
    [0.465, 0.535],
    [bottom - barThickness, bottom],
  ];
  const stem = u >= stemL && u <= stemR && v >= top && v <= bottom;
  const bar =
    u >= stemL &&
    u <= 0.71 &&
    bars.some(([a, b]) => v >= a && v <= b) &&
    v >= top &&
    v <= bottom;
  return stem || bar;
}

function drawIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  const ink = [99, 102, 241]; // brand-500
  const ink2 = [129, 140, 248]; // brand-400
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = maskable || roundedRectContains(x, y, size, radius);
      if (!inside) {
        buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0;
        continue;
      }
      const t = (x / size) * 0.5 + (y / size) * 0.5;
      let [r, g, b] = mix(ink, ink2, t);
      if (isE(x, y, size)) {
        r = 255;
        g = 255;
        b = 255;
      }
      buf[i] = Math.round(r);
      buf[i + 1] = Math.round(g);
      buf[i + 2] = Math.round(b);
      buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#818cf8"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <path fill="#fff" d="M148 133h73v61h88v-61h73v246h-73v-61h-88v61h-73z"/>
</svg>`;

writeFileSync(join(outDir, 'icon.svg'), svg);
for (const [name, size, opts] of [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['maskable-512.png', 512, { maskable: true }],
  ['icon-1024.png', 1024, {}],
]) {
  writeFileSync(join(outDir, name), drawIcon(size, opts));
  console.log('wrote', name, size + 'x' + size);
}
