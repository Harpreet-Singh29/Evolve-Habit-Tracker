import { Capacitor } from '@capacitor/core';

/** True when running inside the Capacitor WebView (the Evolve.apk). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * The APK is a LIVE WebView loading the Vercel origin. It must never register
 * a service worker, or stale precached content would break automatic updates.
 * This is the crux of the design (local-first WebView vs PWA, Phase 3).
 */
export function shouldRegisterServiceWorker(): boolean {
  return !isNative();
}
