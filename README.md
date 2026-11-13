# Evolve

A local-first habit tracker. One **Android APK** plus a **browser/PWA**, both
serving the same app — with **no account, no sync, no sign-in, no analytics and
no backend**. Your habits never leave your device.

- **Web / PWA:** <https://evolve-habit-tracker-two.vercel.app>
- **Android APK (stable download):**
  <https://github.com/Harpreet-Singh29/Evolve-Habit-Tracker/releases/latest/download/Evolve.apk>
- **Source:** <https://github.com/Harpreet-Singh29/Evolve-Habit-Tracker> (public)

> 📌 A local master plan records every decision, risk and phase. Consult and
> update it **before** making changes — note it is never committed to the
> public repo.

---

## How it works (the update model)

| Surface | Loads from | Data lives in | Offline? |
|---------|-----------|---------------|----------|
| Browser / PWA | Vercel site | Browser `localStorage` | Yes (service worker) |
| Android `Evolve.apk` | The **same Vercel site**, live, on every launch | WebView `localStorage` | No (needs internet) |

The APK is a thin **Capacitor WebView** whose `server.url` points at the locked
production origin. It contains **no bundled web assets** and registers **no
service worker**. This means:

- **Web content** (features, UI, fixes) pushed to `main` reaches **both** the
  browser and the installed APK the **next time the app is opened** — no
  reinstall, no new release needed.
- The **APK binary** only needs a new tag + sideload when the **native shell**
  itself changes (Capacitor plugins, `applicationId`, `capacitor.config.ts`,
  including the origin, or signing/Gradle config).

Two honest caveats (accepted by design): if Vercel is down or the device is
offline, the APK shows an error page (the browser PWA is unaffected). And
`server.url` is a dev-oriented Capacitor feature — fine for **sideloading**, but
such a wrapped site would be rejected by the Play Store (not a target here).

---

## ⚠️ The production origin is LOCKED — do not change

`https://evolve-habit-tracker-two.vercel.app` is baked into
`capacitor.config.ts` → into the committed `android/` project → into the
installed APK. Consequences:

- Changing the domain will **never** reach already-installed APKs (no reinstall
  = no new config).
- The WebView's `localStorage` is keyed to that origin, so switching domains
  would **strand existing habit data** under the old origin.

Keep the Vercel project `evolve-habit-tracker-two` and its production domain.
A custom domain, if ever wanted, should be a **browser-only alias**. Changing
`capacitor.config.ts` requires `npm run cap:sync`, a commit of `android/`, and a
**new tagged APK release**.

---

## Two separate datasets

Chrome and Android WebView use separate browser profiles. Even though both load
the same origin, they do **not** share `localStorage`. A habit checked off in
the browser will **not** appear in the APK, and vice versa.

**Export / Import JSON** (Settings → Your data) is the only bridge between the
two stores. Export a backup file from one surface and import it into the other.
Import **replaces** the current data on that device, so export first if you want
to keep it.

---

## Local development

Requirements: **Node ≥ 20**, npm, Git. (JDK 17 / Android SDK are only needed to
build the APK — see below.)

```bash
npm install
npm run dev          # http://localhost:5173
```

Quality gates (must all pass before pushing / releasing):

```bash
npm run typecheck    # tsc --noEmit
npm test             # vitest (pure date/streak logic, incl. DST boundaries)
npm run lint         # eslint
npm run build        # typecheck + vite build + PWA service worker -> dist/
```

Regenerate PWA/launcher icons after changing `scripts/gen-icons.mjs`:

```bash
npm run icons        # writes public/icons/*.png + icon.svg
```

Capacitor commands:

```bash
npm run cap:sync     # build web + copy config/plugins to android/ (re-copies
                     # web assets into assets/public — remove them again, see below)
npm run cap:open     # open android/ in Android Studio
```

> **Important:** because this is a **live WebView** APK, do **not** ship the
> `android/app/src/main/assets/public/` web bundle. `cap sync` re-creates it;
> delete that folder before building/committing the APK shell (keep
> `assets/capacitor.config.json` and `assets/capacitor.plugins.json`). The
> thin-shell rule is also enforced by `npm run cap:sync` and by the root
> `.gitignore`.

---

## Deployment

- **Vercel** is connected to the GitHub repo. Production = `main`, previews on
  PRs, build command `npm run build`, output `dist`. `vercel.json` sets the SPA
  rewrite, `no-cache` on `sw.js` / `index.html`, immutable caching for
  `/assets/*`, and security headers.
- Pushing to `main` deploys the web app automatically. That is also how the
  installed APK picks up new content.
- **CI** (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the web
  build on every push/PR to `main`, and fails if any signing material is
  committed.

### First-time setup (one-off, done by the repo owner)

1. Delete leftover Vercel projects from earlier domain attempts — keep **only**
   `evolve-habit-tracker-two` connected to the repo (Production Branch = `main`).
2. Generate a release keystore **once** and back it up **outside the repo**:
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias <alias> \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   Losing it means **no APK updates ever** (the app ID must stay signed by the
   same key).
3. Add four GitHub **Secrets** (Settings → Secrets and variables → Actions):
   `KEYSTORE_BASE64` (base64 of the `.keystore` file), `KEYSTORE_PASSWORD`,
   `KEY_ALIAS`, `KEY_PASSWORD`. **Never commit these** — the repo is public.
   Enable secret scanning / push protection.
4. Decide/finalize the `applicationId` (`com.harpreetsingh29.habittracker` by
   default) **before** the first install — it is immutable afterwards.

---

## Cutting a release (new APK binary)

A new APK is **only** needed when the native shell changes. For ordinary web
changes, just push to `main` — no release required.

```bash
# ensure the native config is synced and the thin shell is clean
npm run cap:sync
# remove android/app/src/main/assets/public/ (web bundle) before committing
git add -A && git commit -m "chore: sync native shell"

git tag v0.1.0
git push origin main --tags
```

`.github/workflows/release.yml` then: sets up JDK 17 → decodes the keystore from
secrets → `./gradlew assembleRelease` → renames the output to the exact,
case-sensitive **`Evolve.apk`** → publishes a GitHub Release. The stable URL
`.../releases/latest/download/Evolve.apk` never changes because the asset
filename contains **no version number**.

---

## Installing the APK

1. Download [`Evolve.apk`](https://github.com/Harpreet-Singh29/Evolve-Habit-Tracker/releases/latest/download/Evolve.apk)
   on an Android device (or from the Settings → Get Evolve screen in the app).
2. Enable **Install from unknown sources** when prompted, then install.
3. Open **Evolve**. It needs an internet connection (it loads the live site).
   Habit data is stored locally on the device.

For local verification with the Android SDK + `adb`:

```bash
cd android && ./gradlew assembleRelease   # needs JDK 17 + Android SDK
adb install -r ../Evolve.apk
```

### The acceptance test (the whole design hinges on this)

1. Install `Evolve.apk`, open it, note the current UI.
2. Push a small change to `main` and wait for the Vercel deploy.
3. **Reopen** the installed APK — **without reinstalling** — and confirm the
   change appears.
4. Confirm the APK registers **no service worker** (the browser PWA does).

---

## Privacy

- No habit data ever leaves the device.
- No sign-in, no accounts, no authentication.
- No analytics, tracking, or third-party scripts/fonts/CDNs.
- The **only** network traffic is loading the app's code from the locked Vercel
  origin.
- The app fetches **code**, never your **data**.

---

## Tech stack

Vite + React + TypeScript + Tailwind CSS · Zustand (`persist`, versioned +
`migrate`) · Vitest · `vite-plugin-pwa` (browser only) · Capacitor 6 (Android
WebView shell) · GitHub Actions (CI + signed releases).

Reminders are intentionally deferred; the `Habit.reminder` field already exists
in the schema so no migration will be needed later.

---

## License / ownership

Public repository, owner `Harpreet-Singh29`. Full plan, risks, phases and
changelog are recorded in the local master plan file.
