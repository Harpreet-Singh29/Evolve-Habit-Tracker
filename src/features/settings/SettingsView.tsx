import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { downloadBackup, parseBackup } from '../../lib/backup';
import { isNative } from '../../lib/platform';
import { Icon } from '../../components/ui';

interface UpdateCheckResult {
  hasUpdate: boolean;
  error?: string;
  latestVersion?: string;
  downloadUrl?: string;
  currentVersion?: string;
}

interface UpdateInfo {
  checking: boolean;
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
  error?: string;
}

export function SettingsView({
  theme,
  onToggleTheme,
}: {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
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
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const callbackIdRef = useRef(0);

  const flash = useCallback((text: string, ok = true) => {
    setMsg({ text, ok });
    window.setTimeout(() => setMsg(null), 3500);
  }, []);

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

  // Initialize native update callback handler
  useEffect(() => {
    if (!isNative()) return;

    // Set up callback registry on window
    const win = window as Window & { AndroidUpdateCallbacks?: Record<string, (result: UpdateCheckResult) => void> };
    win.AndroidUpdateCallbacks = win.AndroidUpdateCallbacks || {};

    // Cleanup on unmount
    return () => {
      // Note: We don't clear the registry as other components might use it
    };
  }, []);

  const handleCheckUpdates = useCallback(() => {
    if (!isNative() || !window.Android?.checkForUpdates) {
      setUpdateInfo({
        checking: false,
        available: false,
        currentVersion: '0.2.8',
        latestVersion: '',
        error: 'Native update check not available (running in browser?)'
      });
      return;
    }

    const callbackId = `updateCheck_${Date.now()}_${++callbackIdRef.current}`;
    
    // Register callback
    const win = window as Window & { AndroidUpdateCallbacks?: Record<string, (result: UpdateCheckResult) => void> };
    win.AndroidUpdateCallbacks![callbackId] = (result: UpdateCheckResult) => {
      delete win.AndroidUpdateCallbacks![callbackId];
      
      if (result.error === 'already_latest') {
        setUpdateInfo({
          checking: false,
          available: false,
          currentVersion: result.currentVersion || '0.2.8',
          latestVersion: result.latestVersion || '0.2.8',
          error: undefined
        });
      } else if (result.error) {
        setUpdateInfo({
          checking: false,
          available: false,
          currentVersion: result.currentVersion || '0.2.8',
          latestVersion: '',
          error: result.error
        });
      } else {
        setUpdateInfo({
          checking: false,
          available: result.hasUpdate === true,
          currentVersion: result.currentVersion || '0.2.8',
          latestVersion: result.latestVersion || '',
          downloadUrl: result.downloadUrl,
          error: undefined
        });
      }
    };

    setUpdateInfo({
      checking: true,
      available: false,
      currentVersion: '',
      latestVersion: ''
    });

    // Get current version from native
    const currentVersion = window.Android.getCurrentVersion?.() || '0.2.8';
    
    setUpdateInfo(prev => prev ? { ...prev, currentVersion, checking: true } : {
      checking: true,
      available: false,
      currentVersion,
      latestVersion: ''
    });

    // Call native checkForUpdates
    window.Android.checkForUpdates(callbackId);
  }, []);

  const handleGetUpdate = useCallback(() => {
    const url = updateInfo?.downloadUrl;
    if (!url) {
      flash('No download URL available', false);
      return;
    }
    // The native installer was removed in v0.2.8: Play Protect blocks APKs
    // that download and install their own updates. Hand off to the browser,
    // where the user downloads the APK and installs it like any sideload.
    if (isNative() && window.Android?.openInBrowser) {
      window.Android.openInBrowser(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
    flash('Opening the release page in your browser. Install the APK when the download finishes.');
  }, [updateInfo, flash]);

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

      {/* App Updates — APK only. In a browser the web app updates itself from
          the deployed site, so there is nothing to check here. */}
      {isNative() && (
      <section className="card">
        <h2 className="mb-3 font-semibold">App Updates</h2>
        <p className="muted mt-1 text-sm">
          Check for native Android app updates. The web version updates automatically on each launch.
        </p>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <button 
            className="btn btn-primary flex-1" 
            onClick={handleCheckUpdates}
            disabled={updateInfo?.checking}
          >
            <Icon name={updateInfo?.checking ? 'loader' : 'refresh-cw'} className={updateInfo?.checking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            {updateInfo?.checking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {updateInfo && !updateInfo.checking && (
          <div className="mt-3 p-3 rounded bg-muted/50">
            <p className="text-sm">
              <strong>Current:</strong> v{updateInfo.currentVersion}
              {updateInfo.latestVersion && (
                <>
                  <span className="mx-2">→</span>
                  <strong>Latest:</strong> v{updateInfo.latestVersion}
                </>
              )}
            </p>
            {updateInfo.error && updateInfo.error !== 'already_latest' && (
              <p className="text-sm text-red-500 mt-1">Error: {updateInfo.error}</p>
            )}
            {updateInfo.available && updateInfo.downloadUrl && (
              <>
                <button className="btn btn-primary mt-2 w-full" onClick={handleGetUpdate}>
                  <Icon name="download" /> Get v{updateInfo.latestVersion} in browser
                </button>
                <p className="muted mt-2 text-xs leading-relaxed">
                  Opens the APK download in your browser. When it finishes, tap the file to install
                  it — apps don't self-install updates anymore, because Google Play Protect blocks
                  APKs that download and install their own updates.
                </p>
              </>
            )}
            {!updateInfo.available && !updateInfo.error && (
              <p className="text-sm text-green-500 mt-1">✓ You're on the latest version!</p>
            )}
            {updateInfo.error === 'already_latest' && (
              <p className="text-sm text-green-500 mt-1">✓ You're on the latest version (v{updateInfo.latestVersion})</p>
            )}
          </div>
        )}
      </section>
      )}

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

      <p className="muted text-center text-xs">Evolve v0.2.8 · {habits.length} habits · {entries.length} check-ins</p>
    </div>
  );
}
