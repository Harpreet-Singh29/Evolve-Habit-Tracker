import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App';
import { useStore } from './store/useStore';
import { shouldRegisterServiceWorker } from './lib/platform';
import './index.css';

/**
 * CRITICAL (production design, Phase 3):
 * Service workers are registered ONLY in the browser / PWA. The Android APK is
 * a LIVE Capacitor WebView loading https://evolve-habit-tracker-two.vercel.app.
 * If an SW registered there it would serve stale precached content and defeat
 * the whole "updates on next launch without reinstalling" design.
 */
if (shouldRegisterServiceWorker()) {
  registerSW({ immediate: true });
}

// Recompute "today" when the native app resumes (device slept past midnight).
void CapacitorApp.addListener('resume', () => {
  useStore.getState().refreshDay();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
