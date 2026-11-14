import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Backup, Entry, Habit, Task } from '../types';
import { getTodayLocal } from '../lib/dates';

export interface StoreState {
  habits: Habit[];
  entries: Entry[];
  tasks: Task[];
  /** Bumped on app resume so "today" is recomputed (device slept past midnight). */
  dayKey: string;

  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => string;
  updateHabit: (id: string, patch: Partial<Omit<Habit, 'id'>>) => void;
  archiveHabit: (id: string) => void;
  deleteHabit: (id: string) => void;

  toggleEntry: (habitId: string, date: string) => void;
  setEntry: (habitId: string, date: string, done: boolean) => void;

  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => string;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;

  replaceAll: (data: { habits: Habit[]; entries: Entry[]; tasks: Task[] }) => void;
  clearAll: () => void;
  refreshDay: () => void;
  toBackup: () => Backup;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      habits: [],
      entries: [],
      tasks: [],
      dayKey: getTodayLocal(),

      addHabit: (h) => {
        const id = uid();
        const habit: Habit = {
          ...h,
          id,
          createdAt: getTodayLocal(),
          archived: false,
        };
        set((s) => ({ habits: [...s.habits, habit] }));
        return id;
      },

      updateHabit: (id, patch) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch, id: h.id } : h)),
        })),

      archiveHabit: (id) =>
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
        })),

      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          entries: s.entries.filter((e) => e.habitId !== id),
        })),

      toggleEntry: (habitId, date) => get().setEntry(habitId, date, !get().entries.some((e) => e.habitId === habitId && e.date === date && e.done)),

      setEntry: (habitId, date, done) =>
        set((s) => {
          const others = s.entries.filter((e) => !(e.habitId === habitId && e.date === date));
          if (!done) return { entries: others };
          return {
            entries: [
              ...others,
              { habitId, date, done: true, completedAt: new Date().toISOString() },
            ],
          };
        }),

      addTask: (t) => {
        const id = uid();
        const task: Task = {
          ...t,
          id,
          createdAt: getTodayLocal(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return id;
      },

      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
        })),

      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
        })),

      toggleTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id);
          if (!task) return {};
          return {
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    done: !t.done,
                    completedAt: t.done ? undefined : new Date().toISOString(),
                  }
                : t,
            ),
          };
        }),

      replaceAll: ({ habits, entries, tasks }) => set({ habits, entries, tasks, dayKey: getTodayLocal() }),
      clearAll: () => set({ habits: [], entries: [], tasks: [], dayKey: getTodayLocal() }),
      refreshDay: () => set({ dayKey: getTodayLocal() }),

      toBackup: () => {
        const { habits, entries, tasks } = get();
        return {
          app: 'evolve',
          version: 1,
          exportedAt: new Date().toISOString(),
          habits,
          entries,
          tasks,
        };
      },
    }),
    {
      name: 'evolve-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Data shape is stable at v1; migrate() is the hook for future changes.
      migrate: (persisted, _version) => {
        const p = persisted as Partial<StoreState>;
        return {
          habits: p.habits ?? [],
          entries: p.entries ?? [],
          tasks: p.tasks ?? [],
          dayKey: getTodayLocal(),
        } as StoreState;
      },
      partialize: (s) => ({ habits: s.habits, entries: s.entries, tasks: s.tasks }),
    },
  ),
);
