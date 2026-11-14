import type { ReactNode } from 'react';
import { Icon } from './ui';

export type Tab = 'today' | 'habits' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'habits', label: 'Habits', icon: 'habits' },
  { id: 'stats', label: 'Stats', icon: 'stats' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function Layout({
  tab,
  onTab,
  children,
  theme,
  onToggleTheme,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  children: ReactNode;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}) {
  return (
    <div className="min-h-full lg:flex">
      {/* Desktop sidebar (>=1024px) */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:shrink-0 surface lg:border-r lg:border-b-0" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="grid h-10 w-10 place-items-center text-xl font-bold" style={{ background: 'var(--brand)', color: 'var(--brand-text)', borderRadius: 'var(--r-lg)' }}>E</div>
          <div>
            <div className="text-lg font-bold leading-tight">Evolve</div>
            <div className="muted text-xs">Habit tracker</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              className={`btn justify-start !px-3 ${tab === t.id ? '' : 'muted'}`}
              style={tab === t.id ? { background: 'var(--brand)', color: 'var(--brand-text)' } : undefined}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto p-3">
          <button onClick={onToggleTheme} className="btn btn-ghost w-full justify-start !px-3 muted">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <p className="muted mt-3 px-2 text-[11px] leading-relaxed">
            Local-only · no account · no sync
          </p>
          <p className="muted mt-1 px-2 text-[11px] leading-relaxed">
            Keys 1–4 switch tabs · N new habit · Esc closes
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-24 lg:pb-0">
        {/* Mobile header */}
        <header className="flex items-center justify-between px-4 py-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center text-base font-bold" style={{ background: 'var(--brand)', color: 'var(--brand-text)', borderRadius: 'var(--r-md)' }}>E</div>
            <span className="text-lg font-bold">Evolve</span>
          </div>
          <button onClick={onToggleTheme} className="tap btn-ghost !px-2" aria-label="Toggle theme">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </header>
        <div className="mx-auto w-full max-w-2xl px-4 lg:max-w-4xl lg:px-8 lg:py-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex lg:hidden"
        style={{ background: 'var(--surface-3)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: 'var(--shadow-lg)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`tap flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${tab === t.id ? '' : 'muted'}`}
            style={tab === t.id ? { color: 'var(--brand)' } : undefined}
          >
            <Icon name={t.icon} className="h-6 w-6" />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
