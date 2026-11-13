import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { formatDate, getTodayLocal } from '../../lib/dates';
import { isScheduledOn, weeklyProgress, weeklyTarget } from '../../lib/streaks';
import { EmptyState, Icon } from '../../components/ui';

export function TodayView({ onAdd }: { onAdd: () => void }) {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const dayKey = useStore((s) => s.dayKey);
  const toggleEntry = useStore((s) => s.toggleEntry);

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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Today</h1>
        <p className="muted text-sm">{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
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

      {active.length === 0 ? (
        <EmptyState
          icon="habits"
          title="No habits yet"
          hint="Add your first habit to start building a streak. Everything stays on this device."
          action={<button className="btn btn-primary mt-2" onClick={onAdd}><Icon name="plus" /> Add a habit</button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {scheduled.map((h) => {
            const done = entries.some((e) => e.habitId === h.id && e.date === today && e.done);
            const weekly = h.schedule.type === 'timesPerWeek'
              ? `${weeklyProgress(h, entries, today)} / ${weeklyTarget(h)} this week`
              : null;
            return (
              <button
                key={h.id}
                onClick={() => toggleEntry(h.id, today)}
                className="card flex w-full items-center gap-4 text-left transition active:scale-[0.99] animate-fade"
                style={done ? { borderColor: h.color } : undefined}
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl" style={{ background: `${h.color}22` }}>
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
                    color: done ? '#fff' : 'var(--muted)',
                    border: done ? 'none' : '2px solid var(--border)',
                  }}
                >
                  {done && <Icon name="check" className="h-6 w-6 animate-pop" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
