import { useEffect, useState } from 'react';
import type { Habit, Schedule } from '../../types';
import { Modal } from '../../components/ui';

const ICONS = ['✅', '🏃', '📚', '💧', '🧘', '💪', '🌱', '🎨', '🎵', '😴', '🥗', '✍️', '🚭', '🧹', '☀️', '🦷'];
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];
const DAYS = [
  { n: 1, l: 'M' }, { n: 2, l: 'T' }, { n: 3, l: 'W' }, { n: 4, l: 'T' },
  { n: 5, l: 'F' }, { n: 6, l: 'S' }, { n: 0, l: 'S' },
];

export interface HabitDraft {
  name: string;
  icon: string;
  color: string;
  schedule: Schedule;
  reminder?: string;
}

const emptyDraft = (): HabitDraft => ({
  name: '',
  icon: '✅',
  color: '#6366f1',
  schedule: { type: 'daily' },
});

export function HabitForm({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: HabitDraft) => void;
  initial?: Habit | null;
}) {
  const [draft, setDraft] = useState<HabitDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            name: initial.name,
            icon: initial.icon,
            color: initial.color,
            schedule: initial.schedule,
            reminder: initial.reminder,
          }
        : emptyDraft(),
    );
  }, [open, initial]);

  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  /** Check if timesPerWeek has more selected days than target (blocks save). */
  const exceedsTarget = (): boolean => {
    const s = draft.schedule;
    if (s.type !== 'timesPerWeek' || !s.days || s.days.length === 0) return false;
    return s.days.length > s.target;
  };

  /**
   * Guardrail from the x/week design: when the weekly target is higher than the
   * number of selected days, the goal cannot be reached in one week (the habit
   * is only shown on those days). Warn, but still allow saving — the target is
   * a goal, not a hard constraint.
   */
  const targetHint = (): string | null => {
    const s = draft.schedule;
    if (s.type !== 'timesPerWeek' || !s.days || s.days.length === 0) return null;
    if (s.target <= s.days.length) return null;
    return `Target ${s.target} exceeds the ${s.days.length} selected ${s.days.length === 1 ? 'day' : 'days'} — the goal can't be reached in one week.`;
  };

  /** Shared day-chip toggle for both "Days" and "x / week" schedules. */
  const toggleDay = (n: number) => {
    const s = draft.schedule;
    if (s.type !== 'weekdays' && s.type !== 'timesPerWeek') return;
    const days = s.days ?? [];
    const next = days.includes(n) ? days.filter((d) => d !== n) : [...days, n];
    // Prevent adding a day that would exceed the target for timesPerWeek
    if (s.type === 'timesPerWeek' && next.length > s.target && !days.includes(n)) {
      return; // silently ignore the click
    }
    set('schedule', { ...s, days: next });
  };

  const submit = () => {
    const name = draft.name.trim();
    if (!name) return;
    if (draft.schedule.type === 'weekdays' && draft.schedule.days.length === 0) return;
    if (exceedsTarget()) return; // block submit if days > target
    onSave({ ...draft, name });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit habit' : 'New habit'}>
      <div className="flex flex-col gap-5">
        <div>
          <label className="muted mb-1 block text-sm">Name</label>
          <input
            className="input"
            autoFocus
            placeholder="e.g. Drink water, Read 10 pages"
            value={draft.name}
            maxLength={60}
            onChange={(e) => set('name', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <div>
          <label className="muted mb-2 block text-sm">Icon</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => set('icon', ic)}
                className="tap grid h-11 w-11 place-items-center text-xl"
                style={{ background: draft.icon === ic ? 'var(--brand)' : 'var(--surface-2)', borderRadius: 'var(--r-lg)' }}
                aria-label={`Icon ${ic}`}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="muted mb-2 block text-sm">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => set('color', c)}
                className="tap h-9 w-9 rounded-full"
                style={{ background: c, outline: draft.color === c ? '3px solid var(--text)' : 'none', outlineOffset: 2 }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="muted mb-2 block text-sm">Schedule</label>
          <div className="flex gap-2">
            {(['daily', 'weekdays', 'timesPerWeek'] as const).map((t) => (
              <button
                key={t}
                onClick={() =>
                  set('schedule',
                    t === 'daily' ? { type: 'daily' }
                      : t === 'weekdays' ? { type: 'weekdays', days: [1, 2, 3, 4, 5] }
                        : { type: 'timesPerWeek', target: 3 },
                  )
                }
                className={`btn flex-1 !px-2 text-sm ${draft.schedule.type === t ? 'text-white' : 'btn-ghost muted'}`}
                style={draft.schedule.type === t ? { background: 'var(--brand)' } : undefined}
              >
                {t === 'daily' ? 'Every day' : t === 'weekdays' ? 'Days' : 'x / week'}
              </button>
            ))}
          </div>

          {(draft.schedule.type === 'weekdays' || draft.schedule.type === 'timesPerWeek') && (
            <div className="mt-3 flex justify-between">
              {DAYS.map(({ n, l }) => {
                const s = draft.schedule;
                // TypeScript narrowing: both types have `days` when we're in this block
                const days = 'days' in s ? (s.days ?? []) : [];
                const active = days.includes(n);
                const isExcess = s.type === 'timesPerWeek' && s.days && days.length > s.target && active;
                return (
                  <button
                    key={n}
                    onClick={() => toggleDay(n)}
                    className="tap grid h-11 w-11 place-items-center text-sm font-semibold"
                    style={{
                      background: isExcess ? '#ef4444' : active ? 'var(--brand)' : 'var(--surface-2)',
                      color: active ? '#fff' : undefined,
                      borderRadius: 'var(--r-lg)',
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          )}

          {draft.schedule.type === 'timesPerWeek' && (() => {
              const tpw = draft.schedule;
              const hint = targetHint();
              return (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="muted text-sm">Target per week</span>
                    <input
                      type="range"
                      min={1}
                      max={7}
                      value={tpw.target}
                      onChange={(e) => set('schedule', { type: 'timesPerWeek', target: Number(e.target.value), days: tpw.days })}
                      className="flex-1"
                    />
                    <span className="w-6 text-center font-semibold">{tpw.target}</span>
                  </div>
                  {hint && (
                    <p className="mt-2 text-xs" style={{ color: '#f59e0b' }} role="status">
                      {hint}
                    </p>
                  )}
                </>
              );
            })()}
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={!draft.name.trim() || exceedsTarget()}>
            {initial ? 'Save changes' : 'Add habit'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
