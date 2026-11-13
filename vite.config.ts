/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // CRITICAL: never auto-inject a registration script into index.html.
      // Registration is done MANUALLY in src/main.tsx and GATED on
      // shouldRegisterServiceWorker() so the live Capacitor WebView (the APK)
      // registers NO service worker. If this were 'auto'/'inline'/'script', a
      // future refactor could silently re-register an SW in the APK and break
      // the whole "content updates on next launch without reinstalling" design.
      injectRegister: false,
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'Evolve',
        short_name: 'Evolve',
        description: 'A local-first habit tracker. No account, no sync, no data leaving your device.',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Add a habit',
            short_name: 'Add habit',
            url: '/?new=1',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Precache the app shell for the browser PWA. Fonts/images from the app
        // are all local, so no runtime caching of third-party origins is needed.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // IMPORTANT: on native, service-worker registration is skipped entirely
        // (see src/main.tsx). A live WebView must NOT cache stale content.
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
