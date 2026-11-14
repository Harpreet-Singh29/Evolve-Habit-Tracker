import { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { downloadBackup, parseBackup } from '../../lib/backup';
import { shouldRegisterServiceWorker, isNative } from '../../lib/platform';
import { Icon } from '../../components/ui';

const APK_URL = 'https://github.com/Harpreet-Singh29/Evolve-Habit-Tracker/releases/latest/download/Evolve.apk';
const SITE_URL = 'https://evolve-habit-tracker-two.vercel.app';

export function SettingsView({
  theme,
  onToggleTheme,
  onInstall,
  canInstall,
}: {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onInstall: () => void;
  canInstall: boolean;
}) {
  const habits = useStore((s) => s.habits);
  const entries = useStore((s) => s.entries);
  const tasks = useStore((s) => s.tasks);
  const toBackup = useStore((s) => s.toBackup);
  const replaceAll = useStore((s) => s.replaceAll);
  const clearAll = useStore((s) => s.clearAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    window.setTimeout(() => setMsg(null), 3500);
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      replaceAll(data);
      flash(`Imported ${data.habits.length} habits, ${data.entries.length} check-ins, and ${data.tasks.length} tasks.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Import failed.', false);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="muted text-sm">Evolve · local-first habit tracker</p>
      </div>

      {msg && (
        <div className="card animate-fade text-sm" style={{ borderColor: msg.ok ? 'var(--brand)' : '#ef4444' }}>
          {msg.text}
        </div>
      )}

      {/* Appearance */}
      <section className="card">
        <h2 className="mb-3 font-semibold">Appearance</h2>
        <button onClick={onToggleTheme} className="btn btn-ghost w-full justify-between">
          <span className="flex items-center gap-2"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /> Theme</span>
          <span className="muted text-sm">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
      </section>

      {/* Backup — the only bridge between the two local stores */}
      <section className="card">
        <h2 className="font-semibold">Your data</h2>
        <p className="muted mt-1 text-sm">
          Everything stays on this device in local storage. There is no account, no sync and no server.
          Because the browser and the Android app use separate storage, use export/import to move data
          between them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary flex-1" onClick={() => downloadBackup(toBackup())} disabled={habits.length === 0 && entries.length === 0 && tasks.length === 0}>
            <Icon name="download" /> Export JSON
          </button>
          <button className="btn btn-ghost flex-1" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" /> Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>
        <p className="muted mt-2 text-xs">Import replaces the current data on this device.</p>
      </section>

      {/* Get the app */}
      <section className="card">
        <h2 className="mb-3 font-semibold">Get Evolve</h2>
        <div className="flex flex-col gap-2">
          <a className="btn btn-ghost w-full justify-between" href={SITE_URL} target="_blank" rel="noreferrer">
            <span className="flex items-center gap-2"><Icon name="external" /> Use in this browser</span>
            <span className="muted text-xs">Web / PWA</span>
          </a>
          {(canInstall || shouldRegisterServiceWorker()) && (
            <button className="btn btn-ghost w-full justify-between" onClick={onInstall} disabled={!canInstall}>
              <span className="flex items-center gap-2"><Icon name="download" /> Install as app</span>
              <span className="muted text-xs">{canInstall ? 'Ready' : 'Use browser menu'}</span>
            </button>
          )}
          <a className="btn btn-ghost w-full justify-between" href={APK_URL}>
            <span className="flex items-center gap-2"><Icon name="external" /> Download Evolve.apk</span>
            <span className="muted text-xs">Android</span>
          </a>
        </div>
        <p className="muted mt-3 text-xs leading-relaxed">
          The Android app loads the latest version of Evolve from the web on each launch, so updates
          appear without reinstalling. It needs an internet connection. Browser and app data are
          separate — use Export/Import to copy habits between them.
        </p>
      </section>

      {/* Privacy */}
      <section className="card">
        <h2 className="mb-2 font-semibold">Privacy</h2>
        <ul className="muted flex flex-col gap-1 text-sm">
          <li>• No habit data ever leaves your device.</li>
          <li>• No sign-in, no accounts, no authentication.</li>
          <li>• No analytics, tracking or third-party scripts.</li>
          <li>{isNative() ? '• Running inside the Android app.' : '• Running in a browser.'}</li>
        </ul>
      </section>

      {/* Danger zone */}
      <section className="card" style={{ borderColor: confirmClear ? '#ef4444' : undefined }}>
        <h2 className="mb-2 font-semibold">Clear all data</h2>
        <p className="muted mb-3 text-sm">Permanently removes every habit and check-in on this device. Export a backup first.</p>
        <button
          className="btn btn-ghost w-full"
          style={{ color: '#ef4444' }}
          onClick={() => {
            if (confirmClear) { clearAll(); setConfirmClear(false); flash('All data cleared.'); }
            else setConfirmClear(true);
          }}
        >
          <Icon name="trash" />
          {confirmClear ? 'Tap again to confirm — this cannot be undone' : 'Clear all data'}
        </button>
      </section>

      <p className="muted text-center text-xs">Evolve v0.1.0 · {habits.length} habits · {entries.length} check-ins</p>
    </div>
  );
}
