import { App as CapacitorApp } from '@capacitor/app';
import { isNative } from './platform';

/**
 * Android hardware back button (Phase 5). A listener DISABLES Capacitor's
 * default "go back in WebView history" behaviour (see AppPlugin.java), so we
 * must reproduce it ourselves and control when the app is allowed to close.
 *
 * Rules:
 *  - a modal is open  -> back closes the modal (and nothing else);
 *  - not on the Today tab (and no modal) -> back returns to Today;
 *  - on Today with no modal -> minimise the app (standard Android behaviour for
 *    a single-activity app at its root) rather than exiting abruptly.
 *
 * Registered ONLY on native. On web this is a no-op (the WebCapacitor App
 * plugin does not emit `backButton` there), leaving browser history untouched.
 */
export function installBackButtonHandler(deps: {
  getModalOpen: () => boolean;
  closeModal: () => void;
  getTab: () => string;
  goToToday: () => void;
}): void {
  if (!isNative()) return;

  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (deps.getModalOpen()) {
      deps.closeModal();
      return;
    }
    // Our tab navigation is not browser history, so `canGoBack` is not a
    // reliable signal for it. Prefer the in-app tab state; use the WebView
    // history only as a last resort for any real in-page navigation.
    if (deps.getTab() !== 'today') {
      deps.goToToday();
      return;
    }
    if (canGoBack) {
      window.history.back();
      return;
    }
    void CapacitorApp.minimizeApp();
  });
}
