import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App';
import { useStore } from './store/useStore';
import { shouldRegisterServiceWorker } from './lib/platform';
import { installBackButtonHandler } from './lib/backButton';
import './index.css';

/**
 * CRITICAL (production design, Phase 3):
 * Service workers are registered ONLY in the browser / PWA. The Android APK is
 * a LIVE Capacitor WebView loading https://evolve-habit-tracker-two.vercel.app.
 * If an SW registered there it would serve stale precached content and defeat
 * the whole "updates on next launch without reinstalling" design.
 */
if (shouldRegisterServiceWorker()) {
  // "Update available" toast (web only, Phase 3). With registerType autoUpdate
  // the new SW is installed automatically; onNeedRefresh fires when it is ready
  // and the old page is still open, so offer a one-tap reload to the new version.
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => showUpdateToast(() => void updateSW(true)),
  });
}

function showUpdateToast(reload: () => void): void {
  if (document.getElementById('evolve-update-toast')) return;
  const el = document.createElement('div');
  el.id = 'evolve-update-toast';
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:60;' +
    'display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);' +
    'padding:10px 14px;border-radius:var(--r-xl);background:var(--surface);' +
    'border:1px solid var(--border);color:var(--text);' +
    'box-shadow:0 8px 24px rgba(0,0,0,.35);font:14px system-ui,sans-serif;';
  const label = document.createElement('span');
  label.textContent = 'A new version of Evolve is ready.';
  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.style.minHeight = '36px';
  button.textContent = 'Reload';
  button.addEventListener('click', reload, { once: true });
  el.append(label, button);
  document.body.appendChild(el);
}

// Recompute "today" when the native app resumes (device slept past midnight).
void CapacitorApp.addListener('resume', () => {
  useStore.getState().refreshDay();
});

/**
 * Android hardware back button (Phase 5). The handler lives in lib/backButton
 * and reads live UI state through the getters below, so no React re-render is
 * needed to keep it in sync. Installed on native only.
 */
installBackButtonHandler({
  getModalOpen: () => window.__evolveModalOpen === true,
  closeModal: () => window.dispatchEvent(new Event('evolve:close-modal')),
  getTab: () => window.localStorage.getItem('evolve-tab') ?? 'today',
  goToToday: () => window.dispatchEvent(new Event('evolve:go-today')),
});

// Native UI bridge on window (see App.tsx). Exposed here so the back-button
// handler can read modal/tab state without importing React app internals.
declare global {
  interface Window {
    __evolveModalOpen?: boolean;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
