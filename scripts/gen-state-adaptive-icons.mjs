/**
 * Generates complete adaptive icon mipmaps for each dynamic state.
 * Combines transparent background + larger foreground for default, attention, and complete states.
 * These are referenced by the activity-aliases in AndroidManifest.xml.
 * Creates circular icons where the badge artwork fills the circular area.
 */

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
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

async function generateStateAdaptiveIcons() {
  console.log('Generating complete adaptive icons for each state (circular, badge-filled)...');
  
  for (const state of STATES) {
    for (const [density, size] of Object.entries(ANDROID_MIPMAP_SIZES)) {
      const dir = join(androidResDir, `mipmap-${density}`);
      mkdirSync(dir, { recursive: true });
      
      // Create a circular background with brand color (or state color) 
      // The foreground already has the badge at 85% scale centered
      // We'll composite the foreground onto a circular background
      
      // Load foreground (already at correct scale from gen-icons-from-badge)
      const fgPath = join(dir, state.foreground);
      const foreground = await sharp(fgPath)
        .resize(size, size, { fit: 'inside' })
        .png()
        .toBuffer();
      
      // Create circular background with brand color
      // For default: brand color circle
      // For attention: red tint circle
      // For complete: green tint circle
      const bgColors = {
        default: '#6366f1',
        attention: '#ef4444',
        complete: '#22c55e',
      };
      
      // Create a circular mask background
      const background = await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
      .composite([{
        input: Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bgColors[state.name]}"/></svg>`),
        gravity: 'center',
      }])
      .png()
      .toBuffer();
      
      // Composite foreground onto circular background
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
      
      console.log(`  wrote mipmap-${density} ic_launcher_${state.name}.png (${size}x${size}) circular`);
    }
  }
  
  console.log('\n✅ All state adaptive icons generated (circular, badge-filled)!');
  console.log('These are referenced by activity-aliases in AndroidManifest.xml');
}

generateStateAdaptiveIcons().catch(console.error);