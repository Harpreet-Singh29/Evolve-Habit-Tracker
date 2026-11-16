package com.harpreetsingh29.habittracker;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "EvolveMainActivity";
    private ActivityResultLauncher<String> createBackupFileLauncher;
    
    // GitHub API constants
    private static final String GITHUB_API_URL = "https://api.github.com/repos/Harpreet-Singh29/Evolve-Habit-Tracker/releases/latest";
    private static final String GITHUB_REPO = "Harpreet-Singh29/Evolve-Habit-Tracker";
    
    // Download tracking
    private long currentDownloadId = -1;
    private String pendingVersionName = null;
    private BroadcastReceiver downloadCompleteReceiver;
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    
    // JS Callback storage
    private String pendingUpdateCheckCallback = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createBackupFileLauncher = registerForActivityResult(
            new ActivityResultContracts.CreateDocument("application/json"),
            this::writeBackupFile
        );
        configureSystemBars();
        
        // Register download complete receiver
        registerDownloadReceiver();
        
        // Add JavaScript interface for dynamic icon updates
        // This must be done after super.onCreate() initializes the bridge
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(this, "Android");
            Log.d(TAG, "Added JavaScript interface 'Android' for dynamic icon and updates");
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        if (downloadCompleteReceiver != null) {
            try {
                unregisterReceiver(downloadCompleteReceiver);
            } catch (IllegalArgumentException e) {
                // Receiver not registered, ignore
            }
        }
        executorService.shutdown();
    }
    
    /**
     * Register BroadcastReceiver for DownloadManager completion.
     */
    private void registerDownloadReceiver() {
        downloadCompleteReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (downloadId == currentDownloadId) {
                    onDownloadComplete(downloadId);
                }
            }
        };
        registerReceiver(downloadCompleteReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
    }
    
    /**
     * Get current app version from BuildConfig.
     */
    @JavascriptInterface
    public String getCurrentVersion() {
        return BuildConfig.VERSION_NAME;
    }
    
    /**
     * Get current version code from BuildConfig.
     */
    @JavascriptInterface
    public int getCurrentVersionCode() {
        return BuildConfig.VERSION_CODE;
    }
    
    /**
     * Check for updates from GitHub Releases.
     * Called from JavaScript with a callback function name.
     * @param callbackId Unique identifier for the callback
     */
    @JavascriptInterface
    public void checkForUpdates(String callbackId) {
        Log.d(TAG, "checkForUpdates called from JS with callbackId: " + callbackId);
        this.pendingUpdateCheckCallback = callbackId;
        
        executorService.execute(() -> {
            try {
                // Fetch latest release from GitHub API
                URL url = new URL(GITHUB_API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                conn.setRequestProperty("User-Agent", "Evolve-Android-App");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    sendUpdateCheckResult(false, "GitHub API error: " + responseCode, null, null);
                    return;
                }
                
                // Read response
                StringBuilder response = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }
                
                // Parse JSON
                JSONObject release = new JSONObject(response.toString());
                String tagName = release.optString("tag_name", "");
                String latestVersion = tagName.replaceFirst("^v", ""); // Remove 'v' prefix
                
                // Find APK asset
                String downloadUrl = null;
                if (release.has("assets")) {
                    org.json.JSONArray assets = release.getJSONArray("assets");
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject asset = assets.getJSONObject(i);
                        String name = asset.optString("name", "");
                        if (name.endsWith(".apk")) {
                            downloadUrl = asset.optString("browser_download_url", null);
                            break;
                        }
                    }
                }
                
                if (downloadUrl == null) {
                    sendUpdateCheckResult(false, "No APK asset found in latest release", null, null);
                    return;
                }
                
                // Compare versions
                String currentVersion = BuildConfig.VERSION_NAME;
                int comparison = compareVersions(currentVersion, latestVersion);
                
                if (comparison < 0) {
                    // Update available
                    sendUpdateCheckResult(true, null, latestVersion, downloadUrl);
                } else {
                    // Already up to date
                    sendUpdateCheckResult(false, "already_latest", latestVersion, null);
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error checking for updates", e);
                sendUpdateCheckResult(false, "Error: " + e.getMessage(), null, null);
            }
        });
    }
    
    /**
     * Send update check result back to JavaScript.
     */
    private void sendUpdateCheckResult(boolean hasUpdate, String error, String latestVersion, String downloadUrl) {
        String callbackId = pendingUpdateCheckCallback;
        pendingUpdateCheckCallback = null;
        
        if (callbackId == null) {
            Log.w(TAG, "No pending callback for update check result");
            return;
        }
        
        JSONObject result = new JSONObject();
        try {
            result.put("hasUpdate", hasUpdate);
            result.put("currentVersion", BuildConfig.VERSION_NAME);
            if (error != null) {
                result.put("error", error);
            }
            if (latestVersion != null) {
                result.put("latestVersion", latestVersion);
            }
            if (downloadUrl != null) {
                result.put("downloadUrl", downloadUrl);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error creating result JSON", e);
        }
        
        final String jsCallback = "window.AndroidUpdateCallbacks && window.AndroidUpdateCallbacks['" + callbackId + "']";
        final String jsResult = result.toString();
        
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    jsCallback + " && " + jsCallback + "(" + jsResult + ")",
                    r -> Log.d(TAG, "Update check callback result: " + r)
                );
            }
        });
    }
    
    /**
     * Download and install APK using DownloadManager.
     * @param downloadUrl Direct URL to the APK file
     * @param versionName Version name for notification
     */
    @JavascriptInterface
    public void downloadAndInstallApk(String downloadUrl, String versionName) {
        Log.d(TAG, "downloadAndInstallApk called: " + downloadUrl + " version: " + versionName);
        
        if (downloadUrl == null || downloadUrl.isEmpty()) {
            Log.e(TAG, "Invalid download URL");
            runOnUiThread(() -> Toast.makeText(this, "Invalid download URL", Toast.LENGTH_LONG).show());
            return;
        }
        
        this.pendingVersionName = versionName;
        
        runOnUiThread(() -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl))
                    .setTitle("Evolve " + versionName)
                    .setDescription("Downloading update...")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "Evolve-" + versionName + ".apk")
                    .setMimeType("application/vnd.android.package-archive")
                    .setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE)
                    .setAllowedOverRoaming(false);
                
                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    currentDownloadId = dm.enqueue(request);
                    Log.d(TAG, "Download enqueued with ID: " + currentDownloadId);
                    Toast.makeText(this, "Downloading Evolve " + versionName + "...", Toast.LENGTH_SHORT).show();
                } else {
                    Log.e(TAG, "DownloadManager service not available");
                    Toast.makeText(this, "Download service unavailable", Toast.LENGTH_LONG).show();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error starting download", e);
                Toast.makeText(this, "Failed to start download: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
    
    /**
     * Handle download completion - launch install intent.
     */
    private void onDownloadComplete(long downloadId) {
        Log.d(TAG, "Download complete for ID: " + downloadId);
        
        DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        if (dm == null) {
            Log.e(TAG, "DownloadManager not available");
            return;
        }
        
        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        try (Cursor cursor = dm.query(query)) {
            if (cursor == null || !cursor.moveToFirst()) {
                Log.e(TAG, "No download row found for ID: " + downloadId);
                return;
            }

            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
            int status = statusIndex >= 0 ? cursor.getInt(statusIndex) : -1;

            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                int uriIndex = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
                String localUri = uriIndex >= 0 ? cursor.getString(uriIndex) : null;
                Log.d(TAG, "Download successful, file: " + localUri);
                installApk(dm, downloadId, localUri);
            } else if (status == DownloadManager.STATUS_FAILED) {
                int reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON);
                int reason = reasonIndex >= 0 ? cursor.getInt(reasonIndex) : 0;
                Log.e(TAG, "Download failed, reason: " + reason);
                runOnUiThread(() -> Toast.makeText(this, "Download failed (code: " + reason + ")", Toast.LENGTH_LONG).show());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error querying download status", e);
        } finally {
            currentDownloadId = -1;
            pendingVersionName = null;
        }
    }
    
    /**
     * Launch the system installer for the downloaded APK.
     *
     * The APK is exposed through FileProvider: passing a file:// URI to the
     * installer throws FileUriExposedException on Android 7+ and is rejected
     * outright by newer package installers.
     */
    private void installApk(DownloadManager dm, long downloadId, String localUri) {
        Uri apkUri = null;

        if (localUri != null && localUri.startsWith("file:")) {
            try {
                java.io.File apkFile = new java.io.File(Uri.parse(localUri).getPath());
                apkUri = FileProvider.getUriForFile(
                    this, getPackageName() + ".fileprovider", apkFile);
            } catch (Exception e) {
                Log.e(TAG, "Could not build FileProvider URI", e);
            }
        }
        if (apkUri == null) {
            apkUri = dm.getUriForDownloadedFile(downloadId);
        }
        if (apkUri == null) {
            runOnUiThread(() -> Toast.makeText(this, "Downloaded file not found", Toast.LENGTH_LONG).show());
            return;
        }

        // Android 8+ only lets an app install packages if the user granted
        // "Install unknown apps" for it. Send them straight to that setting.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getPackageManager().canRequestPackageInstalls()) {
            final Uri settingsUri = Uri.parse("package:" + getPackageName());
            runOnUiThread(() -> {
                Toast.makeText(this,
                    "Allow Evolve to install unknown apps, then try again",
                    Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, settingsUri));
                } catch (Exception e) {
                    Log.e(TAG, "Could not open unknown-sources settings", e);
                }
            });
            return;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            Log.d(TAG, "Launched installer for: " + apkUri);
        } catch (Exception e) {
            Log.e(TAG, "Error launching install intent", e);
            runOnUiThread(() -> Toast.makeText(this, "Could not open installer: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    /**
     * Draw the WebView behind the system bars and keep navigation-bar icons
     * readable against Evolve's current web theme. The WebView CSS supplies the
     * actual light/dark background, including beneath the gesture indicator.
     */
    @JavascriptInterface
    public void setAppTheme(String theme) {
        if (theme == null) {
            return;
        }
        boolean isLightTheme = "light".equalsIgnoreCase(theme.trim());
        getSharedPreferences("evolve", MODE_PRIVATE)
            .edit()
            .putBoolean("lightTheme", isLightTheme)
            .apply();
        runOnUiThread(() -> applySystemBarAppearance(isLightTheme));
    }

    /** Open Android's document picker so backups can be saved from the WebView. */
    @JavascriptInterface
    public void exportBackup(String json, String filename) {
        if (json == null || createBackupFileLauncher == null) {
            return;
        }
        runOnUiThread(() -> {
            try {
                java.io.File backupFile = java.io.File.createTempFile(
                    "evolve-backup-", ".json", getCacheDir()
                );
                try (java.io.FileOutputStream output = new java.io.FileOutputStream(backupFile)) {
                    output.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                getPreferences(MODE_PRIVATE).edit()
                    .putString("pendingBackupFile", backupFile.getAbsolutePath())
                    .apply();
                createBackupFileLauncher.launch(
                    filename == null || filename.trim().isEmpty()
                        ? "evolve-backup.json"
                        : filename
                );
            } catch (java.io.IOException e) {
                Log.e(TAG, "Failed to prepare backup file", e);
                Toast.makeText(this, "Could not prepare backup file", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void writeBackupFile(Uri uri) {
        String path = getPreferences(MODE_PRIVATE).getString("pendingBackupFile", null);
        getPreferences(MODE_PRIVATE).edit().remove("pendingBackupFile").apply();
        if (path == null) {
            return;
        }
        java.io.File backupFile = new java.io.File(path);
        if (uri == null) {
            backupFile.delete();
            return;
        }
        try (java.io.InputStream input = new java.io.FileInputStream(backupFile);
             java.io.OutputStream output = getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                throw new java.io.IOException("Unable to open selected backup file");
            }
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            Toast.makeText(this, "Backup exported successfully", Toast.LENGTH_SHORT).show();
        } catch (java.io.IOException e) {
            Log.e(TAG, "Failed to write backup file", e);
            Toast.makeText(this, "Could not save backup file", Toast.LENGTH_LONG).show();
        } finally {
            backupFile.delete();
        }
    }

    private void configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boolean isLightTheme = getSharedPreferences("evolve", MODE_PRIVATE)
            .getBoolean("lightTheme", !isSystemInDarkTheme());
        applySystemBarAppearance(isLightTheme);
    }

    private boolean isSystemInDarkTheme() {
        int nightMode = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applySystemBarAppearance(boolean isLightTheme) {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightNavigationBars(isLightTheme);
            controller.setAppearanceLightStatusBars(isLightTheme);
        }

        // Transparent system bars let the WebView's themed surface extend beneath
        // them on legacy Android versions as well as modern edge-to-edge devices.
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private static final String PACKAGE_NAME = "com.harpreetsingh29.habittracker";
    
    // Activity alias class names (two states: Default and Attention)
    private static final String ALIAS_DEFAULT = PACKAGE_NAME + ".launcher.DefaultIcon";
    private static final String ALIAS_ATTENTION = PACKAGE_NAME + ".launcher.AttentionIcon";
    
    // Icon states: DEFAULT (normal/complete) and ATTENTION (incomplete due today)
    private enum IconState { DEFAULT, ATTENTION }
    
    @Override
    public void onResume() {
        super.onResume();
        // Update icon when app comes to foreground
        updateIconFromWebView();
    }
    
    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        // Handle date change or data refresh
        updateIconFromWebView();
    }
    
    /**
     * Called from JavaScript via @JavascriptInterface to update the launcher icon.
     * @param stateString One of "DEFAULT", "ATTENTION"
     */
    @JavascriptInterface
    public void updateIconState(String stateString) {
        Log.d(TAG, "updateIconState called from JS: " + stateString);
        if (stateString == null) {
            return;
        }
        try {
            IconState state = IconState.valueOf(stateString.trim().toUpperCase(Locale.ROOT));
            setEnabledAlias(this, state);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Invalid icon state: " + stateString);
        }
    }
    
    /**
     * Request the web view to compute and send the current icon state.
     * This is called on resume and can be called from JS when data changes.
     */
    private void updateIconFromWebView() {
        // Execute JavaScript in the web view to compute icon state
        // The web side has access to the store (localStorage) and can compute
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "window.EvolveNative && window.EvolveNative.requestIconUpdate()",
                    result -> Log.d(TAG, "JS icon update request result: " + result)
                );
            }
        });
    }
    
    /**
     * Enable the activity alias for the given state and disable the other alias.
     * Skips PackageManager updates when the desired state is already active, and
     * enables the target alias before disabling the previous one so launchers
     * never observe zero enabled launcher entries.
     */
    private static void setEnabledAlias(Context context, IconState state) {
        PackageManager pm = context.getPackageManager();
        ComponentName defaultAlias = new ComponentName(context, ALIAS_DEFAULT);
        ComponentName attentionAlias = new ComponentName(context, ALIAS_ATTENTION);

        int defaultSetting = pm.getComponentEnabledSetting(defaultAlias);
        int attentionSetting = pm.getComponentEnabledSetting(attentionAlias);

        // In AndroidManifest.xml, DefaultIcon has enabled="true" and AttentionIcon has enabled="false".
        boolean defaultIsEnabled =
            defaultSetting == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            defaultSetting == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;
        boolean attentionIsEnabled =
            attentionSetting == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;

        if (state == IconState.ATTENTION) {
            if (attentionIsEnabled && !defaultIsEnabled) {
                return;
            }
            pm.setComponentEnabledSetting(attentionAlias,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(defaultAlias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
            Log.d(TAG, "Enabled launcher alias: " + attentionAlias.getClassName());
        } else {
            if (defaultIsEnabled && !attentionIsEnabled) {
                return;
            }
            pm.setComponentEnabledSetting(defaultAlias,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(attentionAlias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
            Log.d(TAG, "Enabled launcher alias: " + defaultAlias.getClassName());
        }
    }
    
    /**
     * Get today's date in YYYY-MM-DD format (local timezone).
     * This matches the format used by the web store.
     */
    private String getTodayLocal() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        return sdf.format(new Date());
    }
    
    /**
     * Static method to be called from Capacitor plugins if needed.
     */
    public static void updateIconFromPlugin(Context context, String state) {
        if (state == null) {
            return;
        }
        try {
            IconState iconState = IconState.valueOf(state.trim().toUpperCase(Locale.ROOT));
            setEnabledAlias(context, iconState);
        } catch (Exception e) {
            Log.e(TAG, "Error updating icon from plugin", e);
        }
    }
    
    /**
     * Compare two semantic version strings.
     * Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
     */
    private int compareVersions(String v1, String v2) {
        if (v1 == null || v2 == null) return 0;
        
        // Strip 'v' prefix if present
        v1 = v1.replaceFirst("^v", "");
        v2 = v2.replaceFirst("^v", "");
        
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        
        int maxLen = Math.max(parts1.length, parts2.length);
        for (int i = 0; i < maxLen; i++) {
            int n1 = i < parts1.length ? parseIntSafe(parts1[i]) : 0;
            int n2 = i < parts2.length ? parseIntSafe(parts2[i]) : 0;
            if (n1 != n2) return Integer.compare(n1, n2);
        }
        return 0;
    }
    
    private int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}