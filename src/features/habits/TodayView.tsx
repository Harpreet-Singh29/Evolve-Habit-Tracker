import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { formatDate, getTodayLocal } from '../../lib/dates';
import { isScheduledOn, weeklyProgress, weeklyTarget } from '../../lib/streaks';
import { readableTextColor } from '../../lib/color';
import { EmptyState, Icon } from '../../components/ui';

export function TodayView({ onAdd, onAddTask }: { onAdd: () => void; onAddTask: () => void }) {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const tasks = useStore((s) => s.tasks);
  const dayKey = useStore((s) => s.dayKey);
  const toggleEntry = useStore((s) => s.toggleEntry);
  const toggleTask = useStore((s) => s.toggleTask);

  const today = dayKey || getTodayLocal();
  const active = useMemo(() => habits.filter((h) => !h.archived), [habits]);
  const scheduled = useMemo(
    () => active.filter((h) => isScheduledOn(h, today)),
    [active, today],
  );
  const doneCount = useMemo(
    () => scheduled.filter((h) => entries.some((e) => e.habitId === h.id && e.date === today && e.done)).length,
    [scheduled, entries, today],
  );
  const pct = scheduled.length === 0 ? 0 : Math.round((doneCount / scheduled.length) * 100);

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && !t.done),
    [tasks, today],
  );
  const doneTodayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && t.done),
    [tasks, today],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="muted text-sm">{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <button className="btn btn-ghost" onClick={onAddTask}><Icon name="plus" className="h-5 w-5" /> Add task</button>
      </div>

      {active.length > 0 && (
        <div className="card">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Daily progress</span>
            <span className="muted">{doneCount} / {scheduled.length} · {pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
          </div>
        </div>
      )}

      {/* Habits */}
      {(active.length > 0 || todayTasks.length > 0 || doneTodayTasks.length > 0) ? (
        <div className="flex flex-col gap-3">
          {/* Habits section */}
          {scheduled.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Habits</span>
                <span className="muted">{doneCount} / {scheduled.length} done</span>
              </div>
              {scheduled.map((h) => {
                const done = entries.some((e) => e.habitId === h.id && e.date === today && e.done);
                const weekly = h.schedule.type === 'timesPerWeek'
                  ? `${weeklyProgress(h, entries, today)} / ${weeklyTarget(h)} this week`
                  : null;
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleEntry(h.id, today)}
                    className="card flex w-full items-center gap-4 text-left transition active:scale-[0.99] animate-fade control-pressed"
                    style={done ? { borderColor: h.color, boxShadow: '0 0 0 2px ' + h.color + '40' } : undefined}
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center text-2xl" style={{ background: `${h.color}22`, borderRadius: 'var(--r-lg)' }}>
                      {h.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-semibold ${done ? 'line-through muted' : ''}`}>{h.name}</div>
                      <div className="muted text-xs">
                        {weekly ?? (h.schedule.type === 'daily' ? 'Every day' : 'Selected days')}
                      </div>
                    </div>
                    <div
                      className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full"
                      style={{
                        background: done ? h.color : 'var(--surface-2)',
                        color: done ? readableTextColor(h.color) : 'var(--muted)',
                        border: done ? 'none' : '2px solid var(--border)',
                      }}
                    >
                      {done && <Icon name="check" className="h-6 w-6 animate-pop" />}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Tasks due today */}
          {(todayTasks.length > 0 || doneTodayTasks.length > 0) && (
            <>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Tasks</span>
                <span className="muted">{todayTasks.length} pending · {doneTodayTasks.length} done</span>
              </div>
              {todayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className="card flex w-full items-center gap-4 text-left transition active:scale-[0.99] animate-fade control-pressed"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center text-2xl" style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' }}>
                    <Icon name="tasks" className="h-6 w-6 muted" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{t.title}</div>
                    {t.dueTime && <div className="muted text-xs flex items-center gap-1"><Icon name="calendar" className="h-3 w-3" /> {t.dueTime}</div>}
                  </div>
                  <div
                    className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--muted)',
                      border: '2px solid var(--border)',
                    }}
                  />
                </button>
              ))}
              {doneTodayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className="card flex w-full items-center gap-4 text-left transition active:scale-[0.99] animate-fade control-pressed opacity-60"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center text-2xl" style={{ background: 'var(--brand)', borderRadius: 'var(--r-lg)' }}>
                    <div style={{ color: 'var(--brand-text)' }}><Icon name="tasks" className="h-6 w-6" /></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold line-through muted">{t.title}</div>
                    {t.dueTime && <div className="muted text-xs flex items-center gap-1"><Icon name="calendar" className="h-3 w-3" /> {t.dueTime}</div>}
                  </div>
                  <div
                    className="tap grid h-10 w-10 shrink-0 place-items-center rounded-full"
                    style={{
                      background: 'var(--brand)',
                      color: 'var(--brand-text)',
                      border: 'none',
                    }}
                  >
                    <Icon name="check" className="h-6 w-6" />
                  </div>
                </button>
              ))}
            </>
          )}

          {(active.length === 0 && todayTasks.length === 0 && doneTodayTasks.length === 0) && (
            <EmptyState
              icon="habits"
              title="Nothing scheduled today"
              hint="Add a habit or task to see it here."
              action={<button className="btn btn-primary mt-2" onClick={onAdd}><Icon name="plus" /> Add a habit</button>}
            />
          )}
        </div>
      ) : (
        <EmptyState
          icon="habits"
          title="No habits yet"
          hint="Add your first habit to start building a streak. Everything stays on this device."
          action={<button className="btn btn-primary mt-2" onClick={onAdd}><Icon name="plus" /> Add a habit</button>}
        />
      )}
    </div>
  );
}
