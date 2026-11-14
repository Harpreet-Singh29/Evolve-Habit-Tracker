import { useEffect, useState } from 'react';
import type { Task } from '../../types';
import { Modal } from '../../components/ui';
import { getTodayLocal } from '../../lib/dates';

export interface TaskDraft {
  title: string;
  dueDate: string;
  dueTime?: string;
}

const emptyDraft = (): TaskDraft => ({
  title: '',
  dueDate: getTodayLocal(),
  dueTime: '',
});

export function TaskForm({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
  initial?: Task | null;
}) {
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);

  useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            title: initial.title,
            dueDate: initial.dueDate,
            dueTime: initial.dueTime ?? '',
          }
        : emptyDraft(),
    );
  }, [open, initial]);

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const submit = () => {
    const title = draft.title.trim();
    if (!title) return;
    if (!draft.dueDate) return;
    onSave({ ...draft, title });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit task' : 'New task'}>
      <div className="flex flex-col gap-5">
        <div>
          <label className="muted mb-1 block text-sm">Title</label>
          <input
            className="input"
            autoFocus
            placeholder="e.g. Call dentist, Finish report"
            value={draft.title}
            maxLength={100}
            onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <div>
          <label className="muted mb-2 block text-sm">Due date</label>
          <input
            className="input"
            type="date"
            value={draft.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            min={getTodayLocal()}
          />
        </div>

        <div>
          <label className="muted mb-2 block text-sm">Due time (optional)</label>
          <input
            className="input"
            type="time"
            value={draft.dueTime}
            onChange={(e) => set('dueTime', e.target.value || undefined)}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={submit} disabled={!draft.title.trim() || !draft.dueDate}>
            {initial ? 'Save changes' : 'Add task'}
          </button>
        </div>
      </div>
    </Modal>
  );
}