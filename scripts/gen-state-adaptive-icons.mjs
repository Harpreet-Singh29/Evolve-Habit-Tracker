/**
 * Generates complete adaptive icon mipmaps for each dynamic state.
 * Combines background + foreground for default, attention, and complete states.
 * These are referenced by the activity-aliases in AndroidManifest.xml.
 */

import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidResDir = join(root, 'android', 'app', 'src', 'main', 'res');

const ANDROID_MIPMAP_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const STATES = [
  { name: 'default', foreground: 'ic_launcher_foreground_default.png', tint: null },
  { name: 'attention', foreground: 'ic_launcher_foreground_attention.png', tint: '#ef4444' },
  { name: 'complete', foreground: 'ic_launcher_foreground_complete.png', tint: '#22c55e' },
];

const BG_COLOR = '#6366f1';

async function generateStateAdaptiveIcons() {
  console.log('Generating complete adaptive icons for each state...');
  
  for (const state of STATES) {
    for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
      const dir = join(androidResDir, `mipmap-${density}`);
      mkdirSync(dir, { recursive: true });
      
      // Create background
      const background = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: BG_COLOR,
        },
      }).png().toBuffer();
      
      // Load foreground and resize to match background if needed
      const fgPath = join(dir, state.foreground);
      const foreground = await sharp(fgPath)
        .resize(size, size, { fit: 'inside' })
        .png()
        .toBuffer();
      
      // Composite foreground onto background
      const composite = await sharp(background)
        .composite([{
          input: foreground,
          gravity: 'center',
        }])
        .png()
        .toBuffer();
      
      // Write as the state-specific launcher icon
      await sharp(composite).toFile(join(dir, `ic_launcher_${state.name}.png`));
      await sharp(composite).toFile(join(dir, `ic_launcher_round_${state.name}.png`));
      
      console.log(`  wrote mipmap-${density} ic_launcher_${state.name}.png (${size}x${size})`);
    }
  }
  
  console.log('\n✅ All state adaptive icons generated!');
  console.log('These are referenced by activity-aliases in AndroidManifest.xml');
}

generateStateAdaptiveIcons().catch(console.error);