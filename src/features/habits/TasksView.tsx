import { useMemo, useState } from 'react';
import { useStore } from '../../store/useStore';
import { formatDate, getTodayLocal } from '../../lib/dates';
import { EmptyState, Icon } from '../../components/ui';
import { TaskForm } from './TaskForm';
import type { Task } from '../../types';

type Filter = 'today' | 'upcoming' | 'overdue' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'all', label: 'All' },
];

function isOverdue(task: { dueDate: string; done: boolean }, today: string): boolean {
  return !task.done && task.dueDate < today;
}

function isDueToday(task: { dueDate: string }, today: string): boolean {
  return task.dueDate === today;
}

function isUpcoming(task: { dueDate: string; done: boolean }, today: string): boolean {
  return !task.done && task.dueDate > today;
}

export function TasksView() {
  const tasks = useStore((s) => s.tasks);
  const toggleTask = useStore((s) => s.toggleTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const [filter, setFilter] = useState<Filter>('today');
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const today = getTodayLocal();

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === 'today') return isDueToday(t, today);
        if (filter === 'upcoming') return isUpcoming(t, today);
        if (filter === 'overdue') return isOverdue(t, today);
        return true;
      })
      .sort((a, b) => {
        // Sort: incomplete first, then by due date, then by creation date
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [tasks, filter, today]);

  const todayTasks = tasks.filter((t) => isDueToday(t, today) && !t.done).length;
  const overdueTasks = tasks.filter((t) => isOverdue(t, today)).length;
  const upcomingTasks = tasks.filter((t) => isUpcoming(t, today)).length;

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditing(t);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  // We'll handle add directly in the component
  const addTask = useStore((s) => s.addTask);

  const handleSave = (draft: { title: string; dueDate: string; dueTime?: string }) => {
    if (editing) {
      updateTask(editing.id, { title: draft.title, dueDate: draft.dueDate, dueTime: draft.dueTime });
    } else {
      addTask({ title: draft.title, dueDate: draft.dueDate, dueTime: draft.dueTime, done: false });
    }
    closeForm();
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="muted text-sm">One-off items with due dates</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}><Icon name="plus" /> Add</button>
        </div>
        <EmptyState
          icon="tasks"
          title="No tasks yet"
          hint="Create a task to see it here. Tasks are one-off items with due dates, separate from your recurring habits."
          action={<button className="btn btn-primary mt-2" onClick={openNew}><Icon name="plus" /> Add a task</button>}
        />
        <TaskForm open={formOpen} onClose={closeForm} onSave={handleSave} initial={editing} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="muted text-sm">
            {todayTasks} due today · {overdueTasks} overdue · {upcomingTasks} upcoming
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" /> Add</button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            role="tab"
            aria-selected={filter === f.id}
            className={`btn flex-shrink-0 !px-3 text-sm ${filter === f.id ? 'text-white' : 'muted'}`}
            style={filter === f.id ? { background: 'var(--brand)' } : undefined}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <>
          <EmptyState
            icon="tasks"
            title={`No ${filter} tasks`}
            hint={filter === 'today' ? 'Tasks due today will appear here.' : filter === 'upcoming' ? 'Future tasks will appear here.' : filter === 'overdue' ? 'Overdue tasks will appear here.' : 'All tasks will appear here.'}
          />
          <TaskForm open={formOpen} onClose={closeForm} onSave={handleSave} initial={editing} />
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((t) => {
            const overdue = isOverdue(t, today);
            const dueToday = isDueToday(t, today);
            return (
              <div key={t.id} className="card flex items-center gap-3 animate-fade" style={{ opacity: t.done ? 0.6 : 1 }}>
                <button
                  className="tap grid h-12 w-12 shrink-0 place-items-center rounded-full"
                  style={{
                    background: t.done ? 'var(--brand)' : overdue ? '#ef4444' : dueToday ? 'var(--brand)' : 'var(--surface-2)',
                    color: t.done ? '#fff' : overdue ? '#fff' : dueToday ? 'var(--brand-text)' : 'var(--muted)',
                    border: t.done ? 'none' : '2px solid var(--border)',
                  }}
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.done ? 'Mark incomplete' : 'Mark complete'}
                >
                  {t.done && <Icon name="check" className="h-6 w-6 animate-pop" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-semibold ${t.done ? 'line-through muted' : ''}`}>{t.title}</div>
                  <div className="muted text-xs flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Icon name="calendar" className="h-3 w-3" />
                      {formatDate(t.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {t.dueTime && (
                      <span className="flex items-center gap-1">
                        <Icon name="calendar" className="h-3 w-3" />
                        {t.dueTime}
                      </span>
                    )}
                    {overdue && !t.done && <span className="text-xs font-medium" style={{ color: '#ef4444' }}>Overdue</span>}
                    {dueToday && !t.done && !overdue && <span className="text-xs font-medium" style={{ color: 'var(--brand)' }}>Due today</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="tap btn-ghost !px-2" onClick={() => openEdit(t)} aria-label={`Edit ${t.title}`}>
                    <Icon name="edit" className="h-4 w-4" />
                  </button>
                  <button className="tap btn-ghost !px-2 text-xs" onClick={() => {
                    if (confirmId === t.id) {
                      deleteTask(t.id);
                      setConfirmId(null);
                    } else setConfirmId(t.id);
                  }}>
                    {confirmId === t.id ? 'Delete?' : <Icon name="trash" className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskForm open={formOpen} onClose={closeForm} onSave={handleSave} initial={editing} />
    </div>
  );
}