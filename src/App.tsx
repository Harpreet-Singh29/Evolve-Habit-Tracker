import { useCallback, useEffect, useRef, useState } from 'react';
import type { Habit, Task } from './types';
import { useStore } from './store/useStore';
import { Layout, type Tab } from './components/Layout';
import { HabitForm, type HabitDraft } from './features/habits/HabitForm';
import { TaskForm, type TaskDraft } from './features/habits/TaskForm';
import { TodayView } from './features/habits/TodayView';
import { HabitsView } from './features/habits/HabitsView';
import { TasksView } from './features/habits/TasksView';
import { StatsView } from './features/stats/StatsView';
import { SettingsView } from './features/settings/SettingsView';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const TAB_KEYS: Record<string, Tab> = {
  '1': 'today', '2': 'habits', '3': 'tasks', '4': 'stats', '5': 'settings',
};

function initialTab(): Tab {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) return 'habits';
  const saved = window.localStorage.getItem('evolve-tab');
  if (saved === 'today' || saved === 'habits' || saved === 'tasks' || saved === 'stats' || saved === 'settings') return saved;
  return 'today';
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (window.localStorage.getItem('evolve-theme') as 'dark' | 'light') ?? 'light',
  );
  const [habitFormOpen, setHabitFormOpen] = useState(() => new URLSearchParams(window.location.search).has('new'));
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const installRef = useRef<InstallPromptEvent | null>(null);

  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const refreshDay = useStore((s) => s.refreshDay);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    window.localStorage.setItem('evolve-tab', t);
  }, []);

  const closeHabitForm = useCallback(() => {
    setHabitFormOpen(false);
    setEditingHabit(null);
  }, []);

  const closeTaskForm = useCallback(() => {
    setTaskFormOpen(false);
    setEditingTask(null);
  }, []);

  const openNewHabit = useCallback(() => { setEditingHabit(null); setHabitFormOpen(true); }, []);
  const openEditHabit = useCallback((h: Habit) => { setEditingHabit(h); setHabitFormOpen(true); }, []);
  const openNewTask = useCallback(() => { setEditingTask(null); setTaskFormOpen(true); }, []);

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    window.localStorage.setItem('evolve-theme', theme);
  }, [theme]);

  // Expose modal state to the native back-button handler (lib/backButton.ts).
  useEffect(() => {
    window.__evolveModalOpen = habitFormOpen || taskFormOpen;
    return () => { window.__evolveModalOpen = false; };
  }, [habitFormOpen, taskFormOpen]);

  // Native back button: close an open modal, or return to the Today tab.
  useEffect(() => {
    const onClose = () => { closeHabitForm(); closeTaskForm(); };
    const onToday = () => setTab('today');
    window.addEventListener('evolve:close-modal', onClose);
    window.addEventListener('evolve:go-today', onToday);
    return () => {
      window.removeEventListener('evolve:close-modal', onClose);
      window.removeEventListener('evolve:go-today', onToday);
    };
  }, [closeHabitForm, closeTaskForm, setTab]);

  // Keyboard shortcuts for desktop: 1-5 switch tabs, N adds a habit, T adds a task,
  // Esc closes the form. Ignored while typing in an input/textarea/contenteditable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );
      if (e.key === 'Escape' && (habitFormOpen || taskFormOpen)) { closeHabitForm(); closeTaskForm(); return; }
      if (typing) return;
      if (TAB_KEYS[e.key]) { setTab(TAB_KEYS[e.key]); return; }
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openNewHabit(); }
      if (e.key.toLowerCase() === 't') { e.preventDefault(); openNewTask(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [habitFormOpen, taskFormOpen, closeHabitForm, closeTaskForm, openNewHabit, openNewTask, setTab]);

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

  const saveHabit = (draft: HabitDraft) => {
    if (editingHabit) updateHabit(editingHabit.id, draft);
    else addHabit(draft);
    closeHabitForm();
    // Clear the ?new=1 query so a refresh doesn't reopen the form.
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
  };

  const saveTask = (draft: TaskDraft) => {
    if (editingTask) updateTask(editingTask.id, draft);
    else addTask({ title: draft.title, dueDate: draft.dueDate, dueTime: draft.dueTime, done: false });
    closeTaskForm();
  };

  return (
    <>
      <Layout tab={tab} onTab={setTab} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
        {tab === 'today' && <TodayView onAdd={openNewHabit} />}
        {tab === 'habits' && <HabitsView onAdd={openNewHabit} onEdit={openEditHabit} />}
        {tab === 'tasks' && <TasksView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && (
          <SettingsView theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} onInstall={onInstall} canInstall={canInstall} />
        )}
      </Layout>
      <HabitForm open={habitFormOpen} onClose={closeHabitForm} onSave={saveHabit} initial={editingHabit} />
      <TaskForm open={taskFormOpen} onClose={closeTaskForm} onSave={saveTask} initial={editingTask} />
    </>
  );
}
