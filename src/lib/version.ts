/**
 * The app's human-facing version. Must be bumped TOGETHER with
 * android/app/build.gradle `versionName` whenever a release tag is cut.
 * Single source of truth for the Settings footer and the update-checker's
 * web fallbacks (the APK reads the real version from BuildConfig via the
 * native bridge; these constants only matter in the browser/PWA).
 */
export const APP_VERSION = '0.3.0';
