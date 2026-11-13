import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Evolve — live Capacitor WebView.
 *
 * The APK contains NO bundled web assets. It loads the app directly from the
 * Vercel production origin on every launch, so any push to `main` is visible
 * the next time the app is opened — no reinstall needed.
 *
 * *** LOCKED ORIGIN — DO NOT CHANGE ***
 * https://evolve-habit-tracker-two.vercel.app is baked into the installed APK
 * and is the key for the WebView's localStorage. Changing it would (a) never
 * reach already-installed APKs and (b) strand existing habit data under the
 * old origin. This is why the origin above is LOCKED.
 *
 * Any change to this file MUST be followed by `npm run cap:sync` and a commit of
 * the resulting android/ changes, then a new tagged APK release.
 */
const config: CapacitorConfig = {
  appId: 'com.harpreetsingh29.habittracker',
  appName: 'Evolve',
  webDir: 'dist',
  server: {
    url: 'https://evolve-habit-tracker-two.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // Keep the WebView content fresh; no service worker is registered on native.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // No splash screen needed: the site loads from the network immediately.
  },
};

export default config;
