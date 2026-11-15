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
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const badgePath = join(root, 'assets', 'balidan badge.jpg');
const outDir = join(root, 'public', 'icons');
const androidResDir = join(root, 'android', 'app', 'src', 'main', 'res');

mkdirSync(outDir, { recursive: true });

// ---- Configuration ----------------------------------------------------------
const BRAND_COLOR = '#6366f1'; // brand-500
const BRAND_COLOR_LIGHT = '#818cf8'; // brand-400
const ATTENTION_COLOR = '#ef4444'; // red for attention state
const COMPLETE_COLOR = '#22c55e'; // green for complete state

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
  console.log(`Source image: ${metadata.width}x${metadata.height}`);
  
  // Generate each size
  for (const { name, size, maskable } of ICON_SIZES) {
    let pipeline = sharp(badgePath)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      });
    
    if (maskable) {
      // For maskable icons, ensure content is within safe zone (40% center)
      // Add padding to keep badge in safe area
      pipeline = pipeline.resize(Math.round(size * 0.8), Math.round(size * 0.8), {
        fit: 'inside',
      }).extend({
        top: Math.round(size * 0.1),
        bottom: Math.round(size * 0.1),
        left: Math.round(size * 0.1),
        right: Math.round(size * 0.1),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }
    
    await pipeline.png().toFile(join(outDir, name));
    console.log(`  wrote ${name} (${size}x${size})`);
  }
  
  // Generate SVG favicon (simplified - we'll create a basic vector representation)
  // Since we can't trace JPG to SVG easily, create a branded SVG with badge-like design
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1a2e"/>
      <stop offset="1" stop-color="#16213e"/>
    </linearGradient>
    <linearGradient id="badge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd700"/>
      <stop offset="0.5" stop-color="#ffaa00"/>
      <stop offset="1" stop-color="#cc8800"/>
    </linearGradient>
    <linearGradient id="badge-attention" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff4444"/>
      <stop offset="1" stop-color="#cc0000"/>
    </linearGradient>
  </defs>
  <!-- Background rounded rect -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- Balidan Badge: upward dagger with wings -->
  <g transform="translate(256, 256) scale(1.2)">
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
  
  // Generate foreground icons for each density
  // The adaptive icon foreground should be the badge without background
  for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
    const dir = join(androidResDir, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });
    
    // Foreground: badge centered, transparent background
    await sharp(badgePath)
      .resize(Math.round(size * 0.66), Math.round(size * 0.66), { fit: 'inside' })
      .extend({
        top: Math.round(size * 0.17),
        bottom: Math.round(size * 0.17),
        left: Math.round(size * 0.17),
        right: Math.round(size * 0.17),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));
    
    // Also generate round variant
    await sharp(badgePath)
      .resize(Math.round(size * 0.66), Math.round(size * 0.66), { fit: 'inside' })
      .extend({
        top: Math.round(size * 0.17),
        bottom: Math.round(size * 0.17),
        left: Math.round(size * 0.17),
        right: Math.round(size * 0.17),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(join(dir, 'ic_launcher_round_foreground.png'));
    
    console.log(`  wrote mipmap-${density} foreground (${size}x${size})`);
  }
  
  // Generate background (solid brand color)
  const bgColor = BRAND_COLOR;
  for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
    const dir = join(androidResDir, `mipmap-${density}`);
    
    // Create solid background
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bgColor,
      },
    })
    .png()
    .toFile(join(dir, 'ic_launcher_background.png'));
    
    console.log(`  wrote mipmap-${density} background (${size}x${size})`);
  }
  
  // Update ic_launcher_background.xml
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${bgColor}</color>
</resources>`;
  writeFileSync(join(androidResDir, 'values', 'ic_launcher_background.xml'), bgXml);
  console.log('  updated ic_launcher_background.xml');
  
  // Generate adaptive icon XML (using foreground PNG instead of vector)
  const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;
  
  writeFileSync(join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIconXml);
  writeFileSync(join(androidResDir, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIconXml);
  console.log('  updated adaptive icon XML');
  
  // Generate attention and complete state foreground variants
  await generateAndroidStateIcons();
}

async function generateAndroidStateIcons() {
  console.log('Generating Android dynamic icon state variants...');
  
  // For dynamic icons, we need separate foreground assets for each state
  // We'll create attention (red tint) and complete (green tint) variants
  
  const states = [
    { name: 'default', tint: null },
    { name: 'attention', tint: ATTENTION_COLOR },
    { name: 'complete', tint: COMPLETE_COLOR },
  ];
  
  for (const state of states) {
    for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
      const dir = join(androidResDir, `mipmap-${density}`);
      mkdirSync(dir, { recursive: true });
      
      let pipeline = sharp(badgePath)
        .resize(Math.round(size * 0.66), Math.round(size * 0.66), { fit: 'inside' })
        .extend({
          top: Math.round(size * 0.17),
          bottom: Math.round(size * 0.17),
          left: Math.round(size * 0.17),
          right: Math.round(size * 0.17),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      
      if (state.tint) {
        // Apply color tint
        pipeline = pipeline.tint(state.tint);
      }
      
      await pipeline.png().toFile(join(dir, `ic_launcher_foreground_${state.name}.png`));
      await pipeline.png().toFile(join(dir, `ic_launcher_round_foreground_${state.name}.png`));
    }
    console.log(`  wrote ${state.name} state foreground variants`);
  }
}

// ---- Main -------------------------------------------------------------------
async function main() {
  try {
    await generatePwaIcons();
    await generateAndroidIcons();
    console.log('\n✅ All icons generated successfully!');
    console.log('\nNext steps:');
    console.log('1. Run "npm run cap:sync" to sync Android assets');
    console.log('2. Update AndroidManifest.xml for dynamic icon support (see generateDynamicIconManifest.mjs)');
    console.log('3. Add icon switching logic to MainActivity.java');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

main();