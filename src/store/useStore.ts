import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Backup, Entry, Habit, Task } from '../types';
import { getTodayLocal } from '../lib/dates';
import { isScheduledOn } from '../lib/streaks';

export type IconState = 'DEFAULT' | 'ATTENTION';

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

  // Icon state helpers
  computeIconState: () => IconState;
  isHabitDueToday: (habit: Habit, today: string) => boolean;

  // Widget cache sync
  updateWidgetCache: () => void;
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

      updateHabit: (id, patch) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch, id: h.id } : h)),
        }));
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      archiveHabit: (id) => {
        set((s) => ({
          habits: s.habits.map((h) => (h.id === id ? { ...h, archived: true } : h)),
        }));
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      deleteHabit: (id) => {
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          entries: s.entries.filter((e) => e.habitId !== id),
        }));
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      toggleEntry: (habitId, date) => get().setEntry(habitId, date, !get().entries.some((e) => e.habitId === habitId && e.date === date && e.done)),

      setEntry: (habitId, date, done) => {
        set((s) => {
          const others = s.entries.filter((e) => !(e.habitId === habitId && e.date === date));
          if (!done) return { entries: others };
          return {
            entries: [
              ...others,
              { habitId, date, done: true, completedAt: new Date().toISOString() },
            ],
          };
        });
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      addTask: (t) => {
        const id = uid();
        const task: Task = {
          ...t,
          id,
          createdAt: getTodayLocal(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        setTimeout(() => get().updateWidgetCache(), 0);
        return id;
      },

      updateTask: (id, patch) => {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)),
        }));
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      deleteTask: (id) => {
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
        }));
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      toggleTask: (id) => {
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
        });
        setTimeout(() => get().updateWidgetCache(), 0);
      },

      replaceAll: ({ habits, entries, tasks }) => {
        set({ habits, entries, tasks, dayKey: getTodayLocal() });
        setTimeout(() => get().updateWidgetCache(), 0);
      },
      clearAll: () => {
        set({ habits: [], entries: [], tasks: [], dayKey: getTodayLocal() });
        setTimeout(() => get().updateWidgetCache(), 0);
      },
      refreshDay: () => {
        set({ dayKey: getTodayLocal() });
        setTimeout(() => get().updateWidgetCache(), 0);
      },

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

      // Check if a habit is due today based on its schedule
      isHabitDueToday: (habit: Habit, today: string) => {
        if (habit.archived) return false;
        
        const weekday = new Date(today + 'T12:00:00').getDay(); // 0=Sun..6=Sat
        
        switch (habit.schedule.type) {
          case 'daily':
            return true;
          case 'weekdays':
            return habit.schedule.days.includes(weekday);
          case 'timesPerWeek':
            if (habit.schedule.days && habit.schedule.days.length > 0) {
              return habit.schedule.days.includes(weekday);
            }
            // If no specific days, it's due every day but only counts toward weekly target
            // For icon purposes, treat as due today
            return true;
        }
      },

      // Compute icon state based on today's habits and tasks
      computeIconState: () => {
        const { habits, entries, tasks } = get();
        const today = getTodayLocal();
        
        let incompleteCount = 0;
        
        // Check habits due today
        for (const habit of habits) {
          if (get().isHabitDueToday(habit, today)) {
            const isDone = entries.some(e => e.habitId === habit.id && e.date === today && e.done);
            if (!isDone) {
              incompleteCount++;
            }
          }
        }
        
        // Check tasks due today
        for (const task of tasks) {
          if (task.dueDate === today && !task.done) {
            incompleteCount++;
          }
        }
        
        // Two states only: ATTENTION if any incomplete, DEFAULT otherwise (complete or nothing due)
        return incompleteCount > 0 ? 'ATTENTION' : 'DEFAULT';
      },

      // Update the native Android widget cache with today's data
      updateWidgetCache: () => {
        if (typeof window === 'undefined' || !window.Android?.updateWidgetCache) {
          return; // Not on Android or bridge not ready
        }
        
        const { habits, entries, tasks } = get();
        const today = getTodayLocal();
        
        // Get scheduled habits for today
        const scheduledHabits = habits.filter(h => !h.archived && isScheduledOn(h, today));
        
        // Get tasks due today
        const todayTasks = tasks.filter(t => t.dueDate === today);
        
        // Build items array: habits first, then tasks
        const items = [
          ...scheduledHabits.map(h => ({
            id: h.id,
            name: h.name,
            done: entries.some(e => e.habitId === h.id && e.date === today && e.done),
          })),
          ...todayTasks.map(t => ({
            id: t.id,
            name: t.title,
            done: t.done,
          })),
        ];
        
        const total = items.length;
        const completed = items.filter(i => i.done).length;
        
        const json = JSON.stringify({
          date: today,
          total,
          completed,
          items,
        });
        
        try {
          window.Android.updateWidgetCache(json);
        } catch (e) {
          console.warn('Failed to update widget cache:', e);
        }
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
