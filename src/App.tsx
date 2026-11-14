import { useCallback, useEffect, useRef, useState } from 'react';
import type { Habit } from './types';
import { useStore } from './store/useStore';
import { Layout, type Tab } from './components/Layout';
import { HabitForm, type HabitDraft } from './features/habits/HabitForm';
import { TodayView } from './features/habits/TodayView';
import { HabitsView } from './features/habits/HabitsView';
import { StatsView } from './features/stats/StatsView';
import { SettingsView } from './features/settings/SettingsView';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const TAB_KEYS: Record<string, Tab> = {
  '1': 'today', '2': 'habits', '3': 'stats', '4': 'settings',
};

function initialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) return 'habits';
  const saved = window.localStorage.getItem('evolve-tab');
  if (saved === 'today' || saved === 'habits' || saved === 'stats' || saved === 'settings') return saved;
  return 'today';
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (window.localStorage.getItem('evolve-theme') as 'dark' | 'light') ?? 'light',
  );
  const [formOpen, setFormOpen] = useState(() => new URLSearchParams(window.location.search).has('new'));
  const [editing, setEditing] = useState<Habit | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const installRef = useRef<InstallPromptEvent | null>(null);

  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const refreshDay = useStore((s) => s.refreshDay);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.localStorage.setItem('evolve-tab', t);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditing(null);
  }, []);

  const openNew = useCallback(() => { setEditing(null); setFormOpen(true); }, []);
  const openEdit = useCallback((h: Habit) => { setEditing(h); setFormOpen(true); }, []);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    window.localStorage.setItem('evolve-theme', theme);
  }, [theme]);

  // Expose modal state to the native back-button handler (lib/backButton.ts).
  useEffect(() => {
    window.__evolveModalOpen = formOpen;
    return () => { window.__evolveModalOpen = false; };
  }, [formOpen]);

  // Native back button: close an open modal, or return to the Today tab.
  useEffect(() => {
    const onClose = () => closeForm();
    const onToday = () => setTab('today');
    window.addEventListener('evolve:close-modal', onClose);
    window.addEventListener('evolve:go-today', onToday);
    return () => {
      window.removeEventListener('evolve:close-modal', onClose);
      window.removeEventListener('evolve:go-today', onToday);
    };
  }, [closeForm, setTab]);

  // Keyboard shortcuts for desktop (Phase 2): 1-4 switch tabs, N adds a habit,
  // Esc closes the form. Ignored while typing in an input/textarea/contenteditable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      if (e.key === 'Escape' && formOpen) { closeForm(); return; }
      if (typing) return;
      if (TAB_KEYS[e.key]) { setTab(TAB_KEYS[e.key]); return; }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen, closeForm, openNew, setTab]);

  // PWA install prompt (browser only; never fires inside the WebView)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      installRef.current = e as InstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // Recompute "today" when the device wakes / tab regains focus (slept across midnight)
  useEffect(() => {
    const onResume = () => refreshDay();
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    // Capacitor app resume is also handled here via the App plugin in main.tsx.
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [refreshDay]);

  const onInstall = () => {
    const p = installRef.current;
    if (!p) return;
    void p.prompt().then(() => {
      installRef.current = null;
      setCanInstall(false);
    });
  };

  const save = (draft: HabitDraft) => {
    if (editing) updateHabit(editing.id, draft);
    else addHabit(draft);
    closeForm();
    // Clear the ?new=1 query so a refresh doesn't reopen the form.
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <>
      <Layout tab={tab} onTab={setTab} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
        {tab === 'today' && <TodayView onAdd={openNew} />}
        {tab === 'habits' && <HabitsView onAdd={openNew} onEdit={openEdit} />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && (
          <SettingsView theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} onInstall={onInstall} canInstall={canInstall} />
        )}
      </Layout>
      <HabitForm open={formOpen} onClose={closeForm} onSave={save} initial={editing} />
    </>
  );
}
