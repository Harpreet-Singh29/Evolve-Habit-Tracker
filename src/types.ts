/** Domain model. All habit/entry types live here. */

export type Schedule =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] } // 0 = Sunday .. 6 = Saturday (local)
  | { type: 'timesPerWeek'; target: number; days?: number[] }; // target: 1..7; days optional

export interface Habit {
  id: string;
  name: string;
  icon: string; // single emoji / short glyph
  color: string; // hex
  schedule: Schedule;
  /** "HH:mm" local time — stored now, unused until the reminders phase. */
  reminder?: string;
  createdAt: string; // YYYY-MM-DD (local)
  archived: boolean;
}

export interface Entry {
  habitId: string;
  date: string; // YYYY-MM-DD (local) — NEVER a UTC timestamp
  done: boolean;
  completedAt?: string; // ISO timestamp for audit/merge only
}

export interface Task {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD (local)
  dueTime?: string; // "HH:mm" local, optional
  done: boolean;
  createdAt: string; // YYYY-MM-DD (local)
  completedAt?: string; // ISO timestamp for audit/merge only
}

export interface Backup {
  app: 'evolve';
  version: 1;
  exportedAt: string;
  habits: Habit[];
  entries: Entry[];
  tasks: Task[];
}
