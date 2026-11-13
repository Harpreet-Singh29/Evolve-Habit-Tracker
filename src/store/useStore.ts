import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Backup, Entry, Habit } from '../types';
import { getTodayLocal } from '../lib/dates';

export interface StoreState {
  habits: Habit[];
  entries: Entry[];
  /** Bumped on app resume so "today" is recomputed (device slept past midnight). */
  dayKey: string;

  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'archived'>) => string;
  updateHabit: (id: string, patch: Partial<Omit<Habit, 'id'>>) => void;
  archiveHabit: (id: string) => void;
  deleteHabit: (id: string) => void;

  toggleEntry: (habitId: string, date: string) => void;
  setEntry: (habitId: string, date: string, done: boolean) => void;

  replaceAll: (data: { habits: Habit[]; entries: Entry[] }) => void;
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

      replaceAll: ({ habits, entries }) => set({ habits, entries, dayKey: getTodayLocal() }),
      clearAll: () => set({ habits: [], entries: [], dayKey: getTodayLocal() }),
      refreshDay: () => set({ dayKey: getTodayLocal() }),

      toBackup: () => {
        const { habits, entries } = get();
        return {
          app: 'evolve',
          version: 1,
          exportedAt: new Date().toISOString(),
          habits,
          entries,
        };
      },
    }),
    {
      name: 'evolve-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Data shape is stable at v1; migrate() is the hook for future changes.
      migrate: (persisted, _version) => persisted as StoreState,
      partialize: (s) => ({ habits: s.habits, entries: s.entries }),
    },
  ),
);
