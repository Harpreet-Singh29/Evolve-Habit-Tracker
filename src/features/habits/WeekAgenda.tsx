import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  addDays,
  dateRange,
  formatDate,
  fromDateKey,
  getTodayLocal,
  isValidDateKey,
  startOfWeek,
} from '../../lib/dates';
import { Icon } from '../../components/ui';
import { TaskForm, type TaskDraft } from './TaskForm';
import type { Task } from '../../types';

const WEEK_STORAGE_KEY = 'evolve-agenda-week';
const SWIPE_THRESHOLD = 60;

/** e.g. "Nov 16 – Nov 22" (year shown only when it differs from now / spans years). */
function weekRangeLabel(start: string): string {
  const end = addDays(start, 6);
  const s = fromDateKey(start);
  const e = fromDateKey(end);
  const startStr = formatDate(start, { month: 'short', day: 'numeric' });
  const endStr = formatDate(end, { month: 'short', day: 'numeric' });
  if (s.getFullYear() !== e.getFullYear()) {
    return `${startStr}, ${s.getFullYear()} – ${endStr}, ${e.getFullYear()}`;
  }
  return s.getFullYear() === new Date().getFullYear()
    ? `${startStr} – ${endStr}`
    : `${startStr} – ${endStr}, ${s.getFullYear()}`;
}

/** Restore the last viewed week, but only if it is a real Monday. */
function loadWeekStart(): string {
  try {
    const saved = window.localStorage.getItem(WEEK_STORAGE_KEY);
    if (saved && isValidDateKey(saved) && startOfWeek(saved) === saved) return saved;
  } catch {
    // Storage unavailable (private mode) — fall back to the current week.
  }
  return startOfWeek(getTodayLocal());
}

/** Incomplete first, then by time (untimed last), then creation order. */
function sortDayTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    if (!!a.dueTime !== !!b.dueTime) return a.dueTime ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Single-week agenda (Monday → Sunday), one row per day.
 * Used inside the Tasks tab. Reuses the existing Task model and store actions.
 */
export function WeekAgenda() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const toggleTask = useStore((s) => s.toggleTask);

  const today = getTodayLocal();
  const [weekStart, setWeekStart] = useState<string>(loadWeekStart);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(WEEK_STORAGE_KEY, weekStart);
    } catch {
      // Ignore storage failures.
    }
  }, [weekStart]);

  const days = useMemo(() => dateRange(weekStart, addDays(weekStart, 6)), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.dueDate);
      if (list) list.push(t);
      else map.set(t.dueDate, [t]);
    }
    for (const [key, list] of map) map.set(key, sortDayTasks(list));
    return map;
  }, [tasks]);

  const weekCount = useMemo(
    () => tasks.filter((t) => t.dueDate >= weekStart && t.dueDate <= addDays(weekStart, 6)).length,
    [tasks, weekStart],
  );

  const goWeek = useCallback((delta: number) => {
    setWeekStart((w) => addDays(w, delta * 7));
    setConfirmId(null);
  }, [setWeekStart, setConfirmId]);

  const goToday = useCallback(() => {
    setWeekStart(startOfWeek(getTodayLocal()));
    setConfirmId(null);
  }, [setWeekStart, setConfirmId]);

  const openAdd = (date: string) => {
    setEditing(null);
    setAddingDate(date);
    setFormOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setAddingDate(t.dueDate);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setAddingDate(null);
  };

  const handleSave = (draft: TaskDraft) => {
    if (editing) {
      updateTask(editing.id, {
        title: draft.title,
        dueDate: draft.dueDate,
        dueTime: draft.dueTime,
      });
    } else {
      addTask({
        title: draft.title,
        dueDate: draft.dueDate,
        dueTime: draft.dueTime,
        done: false,
      });
    }
    closeForm();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only treat clearly horizontal swipes as week navigation.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    goWeek(dx < 0 ? 1 : -1);
  };

  const isCurrentWeek = weekStart === startOfWeek(today);

  return (
    <div className="flex flex-col gap-4">
      {/* Week header */}
      <div className="card !p-3 animate-fade" style={{ borderRadius: 'var(--r-xl)' }}>
        <div className="flex items-center gap-2">
          <button
            className="tap btn-ghost !px-2"
            onClick={() => goWeek(-1)}
            aria-label="Previous week"
          >
            <Icon name="back" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-base font-semibold">{weekRangeLabel(weekStart)}</div>
            <div className="muted text-xs">
              {weekCount === 0
                ? 'Nothing scheduled'
                : `${weekCount} ${weekCount === 1 ? 'item' : 'items'} scheduled`}
            </div>
          </div>
          <button
            className="tap btn-ghost !px-2"
            onClick={() => goWeek(1)}
            aria-label="Next week"
          >
            <Icon name="back" className="h-5 w-5 rotate-180" />
          </button>
        </div>
        {!isCurrentWeek && (
          <button className="btn btn-ghost mt-2 w-full !py-1.5 text-sm" onClick={goToday}>
            <Icon name="today" className="h-4 w-4" /> Jump to this week
          </button>
        )}
      </div>

      {/* Seven day rows */}
      <div
        className="card !p-0 animate-fade overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y' }}
      >
        {days.map((key, i) => {
          const d = fromDateKey(key);
          const isToday = key === today;
          const isPast = key < today;
          const items = byDay.get(key) ?? [];
          const dow = formatDate(key, { weekday: 'short' }).toUpperCase();
          return (
            <section
              key={key}
              aria-label={`${formatDate(key, { weekday: 'long', month: 'long', day: 'numeric' })}`}
              style={i === 0 ? undefined : { borderTop: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3 px-3 py-3">
                {/* Day chip */}
                <div
                  className="grid w-12 shrink-0 place-items-center py-1"
                  style={{
                    background: isToday ? 'var(--brand)' : 'var(--control)',
                    color: isToday ? 'var(--brand-text)' : isPast ? 'var(--muted)' : 'var(--text)',
                    borderRadius: 'var(--r-lg)',
                    border: isToday ? '1px solid transparent' : '1px solid var(--border-strong)',
                  }}
                >
                  <span className="text-[10px] font-semibold tracking-wider">{dow}</span>
                  <span className="text-lg font-bold leading-tight">{d.getDate()}</span>
                </div>

                {/* Items */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="muted text-xs">
                      {isToday ? 'Today' : formatDate(key, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="muted mt-1 text-xs opacity-85">No items</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {items.map((t) => {
                        const overdue = !t.done && t.dueDate < today;
                        return (
                          <li
                            key={t.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                            style={{ background: 'var(--control)', opacity: t.done ? 0.9 : 1 }}
                          >
                            <button
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
                              style={{
                                background: t.done ? 'var(--brand)' : 'transparent',
                                color: t.done ? 'var(--brand-text)' : 'var(--muted)',
                                border: t.done ? 'none' : '2px solid var(--border-strong)',
                              }}
                              onClick={() => toggleTask(t.id)}
                              aria-label={t.done ? `Mark "${t.title}" incomplete` : `Mark "${t.title}" complete`}
                            >
                              {t.done && <Icon name="check" className="h-3.5 w-3.5 animate-pop" />}
                            </button>
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => openEdit(t)}
                              aria-label={`Edit "${t.title}"`}
                            >
                              <span className={`block truncate text-sm ${t.done ? 'line-through muted' : ''}`}>
                                {t.title}
                              </span>
                              {t.dueTime && <span className="muted text-[11px]">{t.dueTime}</span>}
                              {overdue && (
                                <span className="ml-2 text-[11px] font-medium" style={{ color: 'var(--danger)' }}>
                                  Overdue
                                </span>
                              )}
                            </button>
                            <button
                              className="tap btn-ghost !min-h-0 !px-1.5 !py-1 text-xs"
                              onClick={() => {
                                if (confirmId === t.id) {
                                  deleteTask(t.id);
                                  setConfirmId(null);
                                } else setConfirmId(t.id);
                              }}
                              aria-label={confirmId === t.id ? `Confirm delete "${t.title}"` : `Delete "${t.title}"`}
                            >
                              {confirmId === t.id ? (
                                <span className="font-medium" style={{ color: 'var(--danger)' }}>Del?</span>
                              ) : (
                                <Icon name="trash" className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Add for this day */}
                <button
                  className="tap btn-ghost !min-h-0 !px-2 !py-1.5"
                  onClick={() => openAdd(key)}
                  aria-label={`Add item on ${formatDate(key, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <p className="muted text-center text-xs">Swipe left or right to change week</p>

      <TaskForm
        open={formOpen}
        onClose={closeForm}
        onSave={handleSave}
        initial={editing}
        initialDate={addingDate}
      />
    </div>
  );
}