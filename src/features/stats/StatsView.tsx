import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatDate, getTodayLocal, monthLabel } from '../../lib/dates';
import { bestStreak, completionRate, currentStreak, heatmap } from '../../lib/streaks';
import { EmptyState, Icon } from '../../components/ui';

function Heatmap({ habitId }: { habitId: string }) {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const h = habits.find((x) => x.id === habitId);
  const cells = useMemo(() => (h ? heatmap(h, entries, getTodayLocal(), 16) : []), [h, entries]);

  if (!h) return null;

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ width: 'max-content' }}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date}${c.done ? ' · done' : c.scheduled ? ' · not done' : ''}`}
            className="h-4 w-4"
            style={{
              background: c.done ? h.color : c.scheduled ? 'var(--surface-2)' : 'transparent',
              borderRadius: 'var(--r-sm)',
              outline: c.date === getTodayLocal() ? '2px solid var(--text)' : 'none',
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
      <div className="muted mt-2 flex items-center gap-2 text-xs">
        <span>Less</span>
        <span className="h-3 w-3" style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-xs)' }} />
        <span className="h-3 w-3" style={{ background: h.color, opacity: 0.5, borderRadius: 'var(--r-xs)' }} />
        <span className="h-3 w-3" style={{ background: h.color, borderRadius: 'var(--r-xs)' }} />
        <span>More</span>
        <span className="ml-auto">Last 16 weeks</span>
      </div>
    </div>
  );
}

export function StatsView() {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const active = habits.filter((h) => !h.archived);
  const [selected, setSelected] = useState<string | null>(null);
  const today = getTodayLocal();

  const totalDone = entries.filter((e) => e.done).length;
  const bestOverall = active.reduce((m, h) => Math.max(m, bestStreak(h, entries)), 0);

  if (active.length === 0) {
    return <EmptyState icon="stats" title="No stats yet" hint="Track a few days and your streaks will appear here." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Stats</h1>
        <p className="muted text-sm">Your progress, kept on this device</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Habits', value: active.length, icon: 'habits' },
          { label: 'Check-ins', value: totalDone, icon: 'check' },
          { label: 'Best streak', value: bestOverall, icon: 'flame' },
        ].map((s) => (
          <div key={s.label} className="card flex flex-col items-center gap-1 py-4 text-center">
            <Icon name={s.icon} className="h-5 w-5 muted" />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="muted text-[11px]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Completion rates</h2>
        <div className="flex flex-col gap-3">
          {active.map((h) => {
            const rate = Math.round(completionRate(h, entries, today) * 100);
            return (
              <button key={h.id} onClick={() => setSelected(selected === h.id ? null : h.id)} className="text-left">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span>{h.icon}</span>
                  <span className="flex-1 truncate">{h.name}</span>
                  <span className="muted">{rate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${rate}%`, background: h.color }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="card animate-fade">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">{active.find((h) => h.id === selected)?.name}</h2>
            <button className="tap btn-ghost !px-2" onClick={() => setSelected(null)} aria-label="Close"><Icon name="close" /></button>
          </div>
          <p className="muted mb-3 text-xs">
            Current streak {currentStreak(active.find((h) => h.id === selected)!, entries)} · month of {monthLabel(today)}
          </p>
          <Heatmap habitId={selected} />
        </div>
      )}

      {!selected && (
        <div className="card">
          <h2 className="mb-2 font-semibold">Streaks</h2>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
            {active.map((h) => (
              <div key={h.id} className="flex items-center gap-3 py-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-lg">{h.icon}</span>
                <span className="flex-1 truncate text-sm">{h.name}</span>
                <span className="muted text-xs">best {bestStreak(h, entries)}</span>
                <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: h.color }}>
                  <Icon name="flame" className="h-4 w-4" /> {currentStreak(h, entries)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="muted text-center text-xs">
        {formatDate(today, { month: 'long', year: 'numeric' })} · data stays local
      </p>
    </div>
  );
}
