/**
 * Integrates pre-generated Android launcher icon ZIP bundles into android/app/src/main/res/.
 *
 * Sources (copied byte-for-byte with NO resizing, tinting, overlays, or rings):
 *   - assets/balidan badge.zip -> App icon + Default/Normal launcher state (@mipmap/ic_launcher*)
 *   - assets/maroon skull.zip  -> Attention launcher state (@mipmap/ic_launcher_attention*)
 *
 * Store/marketing previews in the ZIP root (1024.png, play_store_512.png) are intentionally
 * ignored, and website/PWA icons in public/icons/ are left completely untouched.
 */

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const balidanZip = join(root, 'assets', 'balidan badge.zip');
const maroonZip = join(root, 'assets', 'maroon skull.zip');
const androidResDir = join(root, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

function extractZip(zipPath, destDir) {
  if (!existsSync(zipPath)) {
    throw new Error(`Missing icon archive: ${zipPath}`);
  }
  mkdirSync(destDir, { recursive: true });
  execFileSync('tar', ['-xf', zipPath, '-C', destDir], { stdio: 'inherit' });
}

function cleanOldLauncherResources() {
  // Remove deprecated ldpi launcher folder left over from initial template generation
  rmSync(join(androidResDir, 'mipmap-ldpi'), { recursive: true, force: true });

  // Remove unused template/script launcher XMLs (keep splash & theme resources untouched)
  for (const staleRel of [
    join('drawable', 'ic_launcher_background.xml'),
    join('drawable-v24', 'ic_launcher_foreground.xml'),
    join('values', 'ic_launcher_background.xml'),
  ]) {
    rmSync(join(androidResDir, staleRel), { force: true });
  }
  const drawableV24 = join(androidResDir, 'drawable-v24');
  if (existsSync(drawableV24) && readdirSync(drawableV24).length === 0) {
    rmSync(drawableV24, { recursive: true, force: true });
  }

  // Clear previous ic_launcher* files in mipmap-* and mipmap-anydpi-v26
  for (const folder of [...DENSITIES.map((d) => `mipmap-${d}`), 'mipmap-anydpi-v26']) {
    const dir = join(androidResDir, folder);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('ic_launcher')) {
        rmSync(join(dir, entry), { force: true });
      }
    }
  }
}

function main() {
  const tempBase = mkdtempSync(join(tmpdir(), 'evolve-android-icons-'));
  try {
    const balidanDir = join(tempBase, 'balidan');
    const maroonDir = join(tempBase, 'maroon');

    extractZip(balidanZip, balidanDir);
    extractZip(maroonZip, maroonDir);

    cleanOldLauncherResources();

    for (const density of DENSITIES) {
      const targetDir = join(androidResDir, `mipmap-${density}`);
      mkdirSync(targetDir, { recursive: true });

      const balidanMipmap = join(balidanDir, 'res', `mipmap-${density}`);
      const maroonMipmap = join(maroonDir, 'res', `mipmap-${density}`);

      // Default / Normal state + Application icon (Balidan Badge) — exact byte copies
      copyFileSync(join(balidanMipmap, 'ic_launcher.png'), join(targetDir, 'ic_launcher.png'));
      copyFileSync(join(balidanMipmap, 'ic_launcher.png'), join(targetDir, 'ic_launcher_round.png'));
      copyFileSync(
        join(balidanMipmap, 'ic_launcher_adaptive_back.png'),
        join(targetDir, 'ic_launcher_adaptive_back.png'),
      );
      copyFileSync(
        join(balidanMipmap, 'ic_launcher_adaptive_fore.png'),
        join(targetDir, 'ic_launcher_adaptive_fore.png'),
      );

      // Attention state (Maroon Skull) — exact byte copies
      copyFileSync(
        join(maroonMipmap, 'ic_launcher.png'),
        join(targetDir, 'ic_launcher_attention.png'),
      );
      copyFileSync(
        join(maroonMipmap, 'ic_launcher.png'),
        join(targetDir, 'ic_launcher_attention_round.png'),
      );
      copyFileSync(
        join(maroonMipmap, 'ic_launcher_adaptive_back.png'),
        join(targetDir, 'ic_launcher_attention_adaptive_back.png'),
      );
      copyFileSync(
        join(maroonMipmap, 'ic_launcher_adaptive_fore.png'),
        join(targetDir, 'ic_launcher_attention_adaptive_fore.png'),
      );
    }

    // Adaptive icon XMLs (API 26+)
    const anydpiDir = join(androidResDir, 'mipmap-anydpi-v26');
    mkdirSync(anydpiDir, { recursive: true });

    const balidanXml = join(balidanDir, 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml');
    copyFileSync(balidanXml, join(anydpiDir, 'ic_launcher.xml'));
    copyFileSync(balidanXml, join(anydpiDir, 'ic_launcher_round.xml'));

    const maroonXmlContent = readFileSync(
      join(maroonDir, 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml'),
      'utf8',
    )
      .replace('@mipmap/ic_launcher_adaptive_back', '@mipmap/ic_launcher_attention_adaptive_back')
      .replace('@mipmap/ic_launcher_adaptive_fore', '@mipmap/ic_launcher_attention_adaptive_fore');

    writeFileSync(join(anydpiDir, 'ic_launcher_attention.xml'), maroonXmlContent);
    writeFileSync(join(anydpiDir, 'ic_launcher_attention_round.xml'), maroonXmlContent);

    console.log('Synced Android launcher icons from ZIP bundles into android/app/src/main/res/.');
  } finally {
    rmSync(tempBase, { recursive: true, force: true });
  }
}

main();
