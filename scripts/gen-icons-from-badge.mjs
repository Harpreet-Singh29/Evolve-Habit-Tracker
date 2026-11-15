/**
 * Generates Evolve's PWA / launcher icons from the Balidan Badge JPG.
 * Uses sharp for image processing.
 *
 * Outputs into public/icons/:
 *   icon.svg           - vector favicon (traced from badge)
 *   icon-192.png       - PWA 192
 *   icon-512.png       - PWA 512
 *   maskable-512.png   - PWA maskable (full-bleed, safe zone respected)
 *   icon-1024.png      - source for @capacitor/assets generate
 *
 * Also generates Android adaptive icon assets in android/app/src/main/res/
 * Two states: normal (Balidan Badge) and attention (Maroon Skull)
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const badgePath = join(root, 'assets', 'balidan badge.png');
const skullPath = join(root, 'assets', 'maroon skull.png');
const outDir = join(root, 'public', 'icons');
const androidResDir = join(root, 'android', 'app', 'src', 'main', 'res');

mkdirSync(outDir, { recursive: true });

// ---- Configuration ----------------------------------------------------------
const ICON_SIZES = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'maskable-512.png', size: 512, maskable: true },
  { name: 'icon-1024.png', size: 1024, maskable: false },
];

const ANDROID_MIPMAP_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// ---- Helpers ----------------------------------------------------------------
async function generatePwaIcons() {
  console.log('Generating PWA icons from Balidan Badge...');
  
  const image = sharp(badgePath);
  const metadata = await image.metadata();
  console.log(`Source image (badge): ${metadata.width}x${metadata.height}`);
  
  // Generate each size - make badge larger (90% of icon) and circular
  for (const { name, size, maskable } of ICON_SIZES) {
    let pipeline = sharp(badgePath)
      .resize(Math.round(size * 0.9), Math.round(size * 0.9), {
        fit: 'inside',
      });
    
    if (maskable) {
      // For maskable icons, ensure content is within safe zone (40% center)
      // But we want it larger, so use 80% with 10% padding
      pipeline = sharp(badgePath)
        .resize(Math.round(size * 0.8), Math.round(size * 0.8), {
          fit: 'inside',
        }).extend({
          top: Math.round(size * 0.1),
          bottom: Math.round(size * 0.1),
          left: Math.round(size * 0.1),
          right: Math.round(size * 0.1),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
    } else {
      // Regular icons: center the badge on transparent background, make it circular
      pipeline = pipeline.extend({
        top: Math.round(size * 0.05),
        bottom: Math.round(size * 0.05),
        left: Math.round(size * 0.05),
        right: Math.round(size * 0.05),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    
    await pipeline.png().toFile(join(outDir, name));
    console.log(`  wrote ${name} (${size}x${size})`);
  }
  
  // Generate SVG favicon - circular badge design (static, no state changes)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="badge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd700"/>
      <stop offset="0.5" stop-color="#ffaa00"/>
      <stop offset="1" stop-color="#cc8800"/>
    </linearGradient>
  </defs>
  <!-- Circular background -->
  <circle cx="256" cy="256" r="240" fill="url(#badge)"/>
  <!-- Balidan Badge: upward dagger with wings -->
  <g transform="translate(256, 256) scale(2.2)">
    <!-- Wings -->
    <path fill="url(#badge)" d="M-80,0 Q-120,-40 -100,-90 Q-80,-60 -60,-80 Q-40,-40 0,0 Z"/>
    <path fill="url(#badge)" d="M80,0 Q120,-40 100,-90 Q80,-60 60,-80 Q40,-40 0,0 Z"/>
    <!-- Dagger blade -->
    <path fill="url(#badge)" d="M-12,-20 L0,-100 L12,-20 Z"/>
    <!-- Dagger guard -->
    <path fill="url(#badge)" d="M-30,-10 L30,-10 L25,-5 L-25,-5 Z"/>
    <!-- Dagger handle -->
    <path fill="#8B6914" d="M-10,-5 L-10,30 L10,30 L10,-5 Z"/>
    <!-- Handle pommel -->
    <circle cx="0" cy="35" r="12" fill="url(#badge)"/>
  </g>
</svg>`;
  
  writeFileSync(join(outDir, 'icon.svg'), svg);
  console.log('  wrote icon.svg');
}

async function generateAndroidIcons() {
  console.log('Generating Android adaptive icons...');
  
  // Generate foreground icons for each density (normal state - Balidan Badge)
  // Android adaptive icon safe zone is 66% (2/3), but we can go to ~85% for the artwork
  const FOREGROUND_SCALE = 0.85; // 85% of icon size for the badge artwork
  const PADDING = (1 - FOREGROUND_SCALE) / 2; // ~7.5% padding each side
  
  for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
    const dir = join(androidResDir, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    
    // Normal state foreground (Balidan Badge)
    await sharp(badgePath)
      .resize(Math.round(size * FOREGROUND_SCALE), Math.round(size * FOREGROUND_SCALE), { fit: 'inside' })
      .extend({
        top: Math.round(size * PADDING),
        bottom: Math.round(size * PADDING),
        left: Math.round(size * PADDING),
        right: Math.round(size * PADDING),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));
    
    // Also generate round variant
    await sharp(badgePath)
      .resize(Math.round(size * FOREGROUND_SCALE), Math.round(size * FOREGROUND_SCALE), { fit: 'inside' })
      .extend({
        top: Math.round(size * PADDING),
        bottom: Math.round(size * PADDING),
        left: Math.round(size * PADDING),
        right: Math.round(size * PADDING),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_round_foreground.png'));
    
    // Attention state foreground (Maroon Skull) - distinct artwork, no tint
    await sharp(skullPath)
      .resize(Math.round(size * FOREGROUND_SCALE), Math.round(size * FOREGROUND_SCALE), { fit: 'inside' })
      .extend({
        top: Math.round(size * PADDING),
        bottom: Math.round(size * PADDING),
        left: Math.round(size * PADDING),
        right: Math.round(size * PADDING),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_foreground_attention.png'));
    
    await sharp(skullPath)
      .resize(Math.round(size * FOREGROUND_SCALE), Math.round(size * FOREGROUND_SCALE), { fit: 'inside' })
      .extend({
        top: Math.round(size * PADDING),
        bottom: Math.round(size * PADDING),
        left: Math.round(size * PADDING),
        right: Math.round(size * PADDING),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_round_foreground_attention.png'));
    
    console.log(`  wrote mipmap-${density} foregrounds (${size}x${size}) at ${Math.round(FOREGROUND_SCALE * 100)}% scale`);
  }
  
  // Generate background (transparent for adaptive icon - let the launcher handle mask)
  for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
    const dir = join(androidResDir, `mipmap-${density}`);
    
    // Create transparent background for adaptive icon
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
    .png()
    .toFile(join(dir, 'ic_launcher_background.png'));
    
    console.log(`  wrote mipmap-${density} background (${size}x${size}) transparent`);
  }
  
  // Update ic_launcher_background.xml to transparent
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#00000000</color>
</resources>`;
  writeFileSync(join(androidResDir, 'values', 'ic_launcher_background.xml'), bgXml);
  console.log('  updated ic_launcher_background.xml to transparent');
  
  // Generate adaptive icon XML (using foreground PNG with transparent background)
  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;
  
  writeFileSync(join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIconXml);
  writeFileSync(join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIconXml);
  console.log('  updated adaptive icon XML');
  
  console.log('  Normal state: Balidan Badge artwork');
  console.log('  Attention state: Maroon Skull artwork (distinct, no tint)');
}

// ---- Main -------------------------------------------------------------------
async function main() {
  try {
    await generatePwaIcons();
    await generateAndroidIcons();
    console.log('\n✅ All icons generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Run "npm run icons:states" to generate combined state icons');
    console.log('2. Run "npm run cap:sync" to sync Android assets');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();