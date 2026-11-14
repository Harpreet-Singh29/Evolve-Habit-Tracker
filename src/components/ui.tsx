import type { ReactNode } from 'react';

export function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    today: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    habits: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    stats: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l-.06-.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l-.06.06a2 2 0 1 1 2.83 2.83l-.06-.06A1.7 1.7 0 0 0 19.4 9c.14.63.7 1.07 1.35 1.09H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" /></>,
    tasks: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M5 13l4 4L19 7" />,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
    upload: <><path d="M12 17V5M7 10l5-5 5 5M4 21h16" /></>,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    flame: <path d="M12 2c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1 0 1-1 1-2 0-2 0-4 0-6z" />,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></>,
    back: <path d="M15 18l-6-6 6-6" />,
    external: <><path d="M14 3h7v7" /><path d="M10 14L21 3" /><path d="M21 14v7H3V3h7" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  };
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.today}
    </svg>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade">
      <div className="control p-4" style={{ borderRadius: 'var(--r-xl)' }}>
        <Icon name={icon ?? 'habits'} className="h-8 w-8 muted" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <p className="muted max-w-sm text-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="surface-raised w-full max-w-lg p-5 animate-fade"
        style={{ maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--r-2xl)', borderTopLeftRadius: 'var(--r-2xl)', borderTopRightRadius: 'var(--r-2xl)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="tap btn-ghost !px-2" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}