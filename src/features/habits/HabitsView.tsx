import { useState } from 'react';
import type { Habit } from '../../types';
import { useStore } from '../../store/useStore';
import { currentStreak } from '../../lib/streaks';
import { ensureContrast, habitFill } from '../../lib/color';
import { EmptyState, Icon } from '../../components/ui';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function scheduleLabel(h: Habit): string {
  const s = h.schedule;
  if (s.type === 'daily') return 'Every day';
  if (s.type === 'timesPerWeek') {
    const base = `${s.target}× per week`;
    if (!s.days || s.days.length === 0) return base;
    const days = [...s.days].sort().map((d) => DAY_NAMES[d]).join(', ');
    return `${base} · ${days}`;
  }
  return [...s.days].sort().map((d) => DAY_NAMES[d]).join(', ') || 'No days';
}

export function HabitsView({ onAdd, onEdit }: { onAdd: () => void; onEdit: (h: Habit) => void }) {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const archiveHabit = useStore((s) => s.archiveHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Habits</h1>
          <p className="muted text-sm">{active.length} active</p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}><Icon name="plus" /> Add</button>
      </div>

      {habits.length === 0 ? (
        <EmptyState icon="habits" title="Nothing here yet" hint="Create a habit to see it listed." />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((h) => {
            const streak = currentStreak(h, entries);
            return (
              <div key={h.id} className="card flex items-center gap-3 animate-fade">
                <div className="grid h-11 w-11 shrink-0 place-items-center text-xl" style={{ background: `${habitFill(h.color)}22`, borderRadius: 'var(--r-lg)' }}>
                  {h.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{h.name}</div>
                  <div className="muted text-xs">{scheduleLabel(h)}</div>
                </div>
                {streak > 0 && (
                  <div className="flex shrink-0 items-center gap-1 px-2 py-1 text-xs font-semibold" style={{ background: 'var(--surface-2)', color: ensureContrast(h.color), borderRadius: 'var(--r-md)' }}>
                    <Icon name="flame" className="h-4 w-4" /> {streak}
                  </div>
                )}
                <button className="tap btn-ghost !px-2" onClick={() => onEdit(h)} aria-label={`Edit ${h.name}`}>
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                <button className="tap btn-ghost !px-2" onClick={() => archiveHabit(h.id)} aria-label={`Archive ${h.name}`}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {archived.length > 0 && (
        <details className="muted text-sm">
          <summary className="cursor-pointer py-2">Archived ({archived.length})</summary>
          <div className="mt-2 flex flex-col gap-2">
            {archived.map((h) => (
              <div key={h.id} className="card flex items-center gap-3 opacity-90">
                <span className="text-lg">{h.icon}</span>
                <span className="flex-1 truncate">{h.name}</span>
                <button
                  className="tap btn-ghost !px-2 text-xs"
                  onClick={() => {
                    if (confirmId === h.id) { deleteHabit(h.id); setConfirmId(null); }
                    else setConfirmId(h.id);
                  }}
                >
                  {confirmId === h.id ? 'Tap again to delete' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
